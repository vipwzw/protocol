import { ethers } from 'hardhat';
import { BlockchainTestsEnvironment, constants, getRandomInteger, randomAddress } from '@0x/utils';
import { expect } from 'chai';
import {
    LimitOrder,
    LimitOrderFields,
    OrderBase,
    OrderInfo,
    OtcOrder,
    RfqOrder,
    RfqOrderFields,
    SignatureType,
} from '@0x/protocol-utils';
import { hexUtils } from '@0x/utils';
import { TransactionReceiptWithDecodedLogs } from 'ethereum-types';

import {
    IZeroExContract,
    IZeroExLimitOrderFilledEventArgs,
    IZeroExOtcOrderFilledEventArgs,
    IZeroExRfqOrderFilledEventArgs,
} from '../../src/wrappers';
import { artifacts } from '../artifacts';
import { fullMigrateAsync } from '../utils/migration';
import { TestMintableERC20TokenContract, TestMintableERC20Token__factory } from '../wrappers';

const { ZERO_AMOUNT: ZERO, NULL_ADDRESS } = constants;

interface RfqOrderFilledAmounts {
    makerTokenFilledAmount: bigint;
    takerTokenFilledAmount: bigint;
}
type OtcOrderFilledAmounts = RfqOrderFilledAmounts;

interface LimitOrderFilledAmounts {
    makerTokenFilledAmount: bigint;
    takerTokenFilledAmount: bigint;
    takerTokenFeeFilledAmount: bigint;
}

export enum OtcOrderWethOptions {
    LeaveAsWeth,
    WrapEth,
    UnwrapWeth,
}

export class NativeOrdersTestEnvironment {
    public static async createAsync(
        env: BlockchainTestsEnvironment,
        gasPrice: bigint = ethers.parseUnits('123', 9),
        protocolFeeMultiplier = 70e3,
    ): Promise<NativeOrdersTestEnvironment> {
        const [owner, maker, taker] = await env.getAccountAddressesAsync();
        const signer = await env.provider.getSigner(owner);

        // Deploy tokens
        const tokenFactories = [...new Array(2)].map(() => new TestMintableERC20Token__factory(signer));
        const tokenDeployments = await Promise.all(tokenFactories.map(factory => factory.deploy()));
        await Promise.all(tokenDeployments.map(token => token.waitForDeployment()));
        const [makerToken, takerToken] = tokenDeployments;
        const zeroEx = await fullMigrateAsync(owner, env.provider, env.txDefaults, {}, { protocolFeeMultiplier });
        const makerSigner = await env.provider.getSigner(maker);
        const takerSigner = await env.provider.getSigner(taker);
        await makerToken.connect(makerSigner).approve(await zeroEx.getAddress(), constants.MAX_UINT256);
        await takerToken.connect(takerSigner).approve(await zeroEx.getAddress(), constants.MAX_UINT256);
        return new NativeOrdersTestEnvironment(
            maker,
            taker,
            makerToken,
            takerToken,
            zeroEx,
            gasPrice,
            gasPrice * BigInt(protocolFeeMultiplier),
            env,
        );
    }

    constructor(
        public readonly maker: string,
        public readonly taker: string,
        public readonly makerToken: TestMintableERC20TokenContract,
        public readonly takerToken: TestMintableERC20TokenContract,
        public readonly zeroEx: IZeroExContract,
        public readonly gasPrice: bigint,
        public readonly protocolFee: bigint,
        private readonly _env: BlockchainTestsEnvironment,
    ) {}

    public async prepareBalancesForOrdersAsync(
        orders: LimitOrder[] | RfqOrder[] | OtcOrder[],
        taker: string = this.taker,
    ): Promise<void> {
        await this.makerToken.mint(
            this.maker,
            (orders as OrderBase[]).map(order => BigInt(order.makerAmount || 0)).reduce((a, b) => a + b, 0n),
        );
        await this.takerToken.mint(
            taker,
            (orders as OrderBase[])
                .map(
                    order =>
                        BigInt(order.takerAmount || 0) +
                        (order instanceof LimitOrder ? BigInt(order.takerTokenFeeAmount || 0) : 0n),
                )
                .reduce((a, b) => a + b, 0n),
        );
    }

    public async fillLimitOrderAsync(
        order: LimitOrder,
        opts: Partial<{
            fillAmount: bigint | number;
            taker: string;
            protocolFee: bigint | number;
        }> = {},
    ): Promise<TransactionReceiptWithDecodedLogs> {
        const { fillAmount, taker, protocolFee } = {
            taker: this.taker,
            fillAmount: order.takerAmount,
            ...opts,
        };
        await this.prepareBalancesForOrdersAsync([order], taker);
        const value = protocolFee === undefined ? this.protocolFee : protocolFee;
        const takerSigner = await this._env.provider.getSigner(taker);

        // 使用 INativeOrdersFeature 接口调用
        const nativeOrdersFeature = await ethers.getContractAt('INativeOrdersFeature', await this.zeroEx.getAddress());
        const tx = await nativeOrdersFeature
            .connect(takerSigner)
            .fillLimitOrder(order, await order.getSignatureWithProviderAsync(this._env.provider), BigInt(fillAmount), {
                value,
            });
        return await tx.wait();
    }

    public async fillRfqOrderAsync(
        order: RfqOrder,
        fillAmount: bigint | number = order.takerAmount,
        taker: string = this.taker,
    ): Promise<TransactionReceiptWithDecodedLogs> {
        await this.prepareBalancesForOrdersAsync([order], taker);
        const takerSigner = await this._env.provider.getSigner(taker);

        // 使用 INativeOrdersFeature 接口调用
        const nativeOrdersFeature = await ethers.getContractAt('INativeOrdersFeature', await this.zeroEx.getAddress());
        const tx = await nativeOrdersFeature
            .connect(takerSigner)
            .fillRfqOrder(order, await order.getSignatureWithProviderAsync(this._env.provider), BigInt(fillAmount));
        return await tx.wait();
    }

    public async fillOtcOrderAsync(
        order: OtcOrder,
        fillAmount: bigint | number = order.takerAmount,
        taker: string = this.taker,
        unwrapWeth = false,
    ): Promise<TransactionReceiptWithDecodedLogs> {
        await this.prepareBalancesForOrdersAsync([order], taker);
        const takerSigner = await this._env.provider.getSigner(taker);
        if (unwrapWeth) {
            const tx = await this.zeroEx
                .connect(takerSigner)
                .fillOtcOrderForEth(
                    order,
                    await order.getSignatureWithProviderAsync(this._env.provider),
                    BigInt(fillAmount),
                );
            return await tx.wait();
        } else {
            const tx = await this.zeroEx
                .connect(takerSigner)
                .fillOtcOrder(order, await order.getSignatureWithProviderAsync(this._env.provider), BigInt(fillAmount));
            return await tx.wait();
        }
    }

    public async fillTakerSignedOtcOrderAsync(
        order: OtcOrder,
        origin: string = order.txOrigin,
        taker: string = order.taker,
        unwrapWeth = false,
    ): Promise<TransactionReceiptWithDecodedLogs> {
        await this.prepareBalancesForOrdersAsync([order], taker);
        const originSigner = await this._env.provider.getSigner(origin);
        if (unwrapWeth) {
            const tx = await this.zeroEx
                .connect(originSigner)
                .fillTakerSignedOtcOrderForEth(
                    order,
                    await order.getSignatureWithProviderAsync(this._env.provider),
                    await order.getSignatureWithProviderAsync(this._env.provider, SignatureType.EthSign, taker),
                );
            return await tx.wait();
        } else {
            const otcOrdersFeature = await ethers.getContractAt('IOtcOrdersFeature', await this.zeroEx.getAddress());
            const tx = await otcOrdersFeature
                .connect(originSigner)
                .fillTakerSignedOtcOrder(
                    order,
                    await order.getSignatureWithProviderAsync(this._env.provider),
                    await order.getSignatureWithProviderAsync(this._env.provider, SignatureType.EthSign, taker),
                );
            return await tx.wait();
        }
    }

    public async fillOtcOrderWithEthAsync(
        order: OtcOrder,
        fillAmount: bigint | number = order.takerAmount,
        taker: string = this.taker,
    ): Promise<TransactionReceiptWithDecodedLogs> {
        await this.prepareBalancesForOrdersAsync([order], taker);
        const takerSigner = await this._env.provider.getSigner(taker);
        const tx = await this.zeroEx
            .connect(takerSigner)
            .fillOtcOrderWithEth(order, await order.getSignatureWithProviderAsync(this._env.provider), {
                value: fillAmount,
            });
        return await tx.wait();
    }

    public createLimitOrderFilledEventArgs(
        order: LimitOrder,
        takerTokenFillAmount: bigint = order.takerAmount,
        takerTokenAlreadyFilledAmount: bigint = ZERO,
    ): IZeroExLimitOrderFilledEventArgs {
        const { makerTokenFilledAmount, takerTokenFilledAmount, takerTokenFeeFilledAmount } =
            computeLimitOrderFilledAmounts(order, takerTokenFillAmount, takerTokenAlreadyFilledAmount);
        const protocolFee = order.taker !== NULL_ADDRESS ? ZERO : this.protocolFee;
        return {
            takerTokenFilledAmount,
            makerTokenFilledAmount,
            takerTokenFeeFilledAmount,
            orderHash: order.getHash(),
            maker: order.maker,
            taker: this.taker,
            feeRecipient: order.feeRecipient,
            makerToken: order.makerToken,
            takerToken: order.takerToken,
            protocolFeePaid: protocolFee,
            pool: order.pool,
        };
    }

    public createRfqOrderFilledEventArgs(
        order: RfqOrder,
        takerTokenFillAmount: bigint = order.takerAmount,
        takerTokenAlreadyFilledAmount: bigint = ZERO,
    ): IZeroExRfqOrderFilledEventArgs {
        const { makerTokenFilledAmount, takerTokenFilledAmount } = computeRfqOrderFilledAmounts(
            order,
            takerTokenFillAmount,
            takerTokenAlreadyFilledAmount,
        );
        return {
            takerTokenFilledAmount,
            makerTokenFilledAmount,
            orderHash: order.getHash(),
            maker: order.maker,
            taker: this.taker,
            makerToken: order.makerToken,
            takerToken: order.takerToken,
            pool: order.pool,
        };
    }

    public createOtcOrderFilledEventArgs(
        order: OtcOrder,
        takerTokenFillAmount: bigint = order.takerAmount,
    ): IZeroExOtcOrderFilledEventArgs {
        const { makerTokenFilledAmount, takerTokenFilledAmount } = computeOtcOrderFilledAmounts(
            order,
            takerTokenFillAmount,
        );
        return {
            takerTokenFilledAmount,
            makerTokenFilledAmount,
            orderHash: order.getHash(),
            maker: order.maker,
            taker: order.taker !== NULL_ADDRESS ? order.taker : this.taker,
            makerToken: order.makerToken,
            takerToken: order.takerToken,
        };
    }
}

/**
 * Generate a random limit order.
 */
export function getRandomLimitOrder(fields: Partial<LimitOrderFields> = {}): LimitOrder {
    return new LimitOrder({
        makerToken: randomAddress(),
        takerToken: randomAddress(),
        makerAmount: getRandomInteger('1e18', '100e18'),
        takerAmount: getRandomInteger('1e6', '100e6'),
        takerTokenFeeAmount: getRandomInteger('0.01e18', '1e18'),
        maker: randomAddress(),
        taker: randomAddress(),
        sender: randomAddress(),
        feeRecipient: randomAddress(),
        pool: hexUtils.random(),
        expiry: BigInt(Math.floor(Date.now() / 1000 + 3600)), // 1小时过期时间，避免测试过程中过期
        salt: BigInt(hexUtils.random()),
        ...fields,
    });
}

/**
 * Generate a random RFQ order.
 */
export function getRandomRfqOrder(fields: Partial<RfqOrderFields> = {}): RfqOrder {
    return new RfqOrder({
        makerToken: randomAddress(),
        takerToken: randomAddress(),
        makerAmount: getRandomInteger('1e18', '100e18'),
        takerAmount: getRandomInteger('1e6', '100e6'),
        maker: randomAddress(),
        taker: randomAddress(), // 添加 taker 字段
        txOrigin: randomAddress(),
        pool: hexUtils.random(),
        expiry: BigInt(Math.floor(Date.now() / 1000 + 3600)), // 1小时过期时间
        salt: BigInt(hexUtils.random()),
        ...fields,
    });
}

/**
 * Generate a random OTC Order
 */
export function getRandomOtcOrder(fields: Partial<OtcOrder> = {}): OtcOrder {
    return new OtcOrder({
        makerToken: randomAddress(),
        takerToken: randomAddress(),
        makerAmount: getRandomInteger('1e18', '100e18'),
        takerAmount: getRandomInteger('1e6', '100e6'),
        maker: randomAddress(),
        taker: randomAddress(),
        txOrigin: randomAddress(),
        expiryAndNonce: OtcOrder.encodeExpiryAndNonce(
            fields.expiry ?? BigInt(Math.floor(Date.now() / 1000 + 60)), // expiry
            fields.nonceBucket ?? getRandomInteger(0, OtcOrder.MAX_NONCE_BUCKET), // nonceBucket
            fields.nonce ?? getRandomInteger(0, OtcOrder.MAX_NONCE_VALUE), // nonce
        ),
        ...fields,
    });
}

/**
 * Asserts the fields of an OrderInfo object.
 */
export function assertOrderInfoEquals(actual: OrderInfo, expected: OrderInfo): void {
    expect(actual.status, 'Order status').to.eq(expected.status);
    expect(actual.orderHash, 'Order hash').to.eq(expected.orderHash);
    expect(actual.takerTokenFilledAmount, 'Order takerTokenFilledAmount').to.eq(expected.takerTokenFilledAmount);
}

/**
 * Creates an order expiry field.
 * Uses blockchain time instead of JavaScript time to avoid issues
 * when previous tests have advanced blockchain time with increaseTimeAsync.
 */
export async function createExpiry(deltaSeconds = 60): Promise<bigint> {
    // 使用区块链时间而不是 JavaScript 时间
    const currentBlock = await ethers.provider.getBlock('latest');
    return BigInt(currentBlock.timestamp + deltaSeconds);
}

/**
 * Computes the maker, taker, and taker token fee amounts filled for
 * the given limit order.
 */
export function computeLimitOrderFilledAmounts(
    order: LimitOrder,
    takerTokenFillAmount: bigint = order.takerAmount,
    takerTokenAlreadyFilledAmount: bigint = ZERO,
): LimitOrderFilledAmounts {
    const candidates = [order.takerAmount, takerTokenFillAmount, order.takerAmount - takerTokenAlreadyFilledAmount];
    const fillAmount = candidates.reduce((min, v) => (v < min ? v : min));
    const makerTokenFilledAmount = (fillAmount * order.makerAmount) / order.takerAmount;
    const takerTokenFeeFilledAmount = (fillAmount * order.takerTokenFeeAmount) / order.takerAmount;
    return {
        makerTokenFilledAmount,
        takerTokenFilledAmount: fillAmount,
        takerTokenFeeFilledAmount,
    };
}

/**
 * Computes the maker and taker amounts filled for the given RFQ order.
 */
export function computeRfqOrderFilledAmounts(
    order: RfqOrder,
    takerTokenFillAmount: bigint = order.takerAmount,
    takerTokenAlreadyFilledAmount: bigint = ZERO,
): RfqOrderFilledAmounts {
    const candidates = [order.takerAmount, takerTokenFillAmount, order.takerAmount - takerTokenAlreadyFilledAmount];
    const fillAmount = candidates.reduce((min, v) => (v < min ? v : min));
    const makerTokenFilledAmount = (fillAmount * order.makerAmount) / order.takerAmount;
    return {
        makerTokenFilledAmount,
        takerTokenFilledAmount: fillAmount,
    };
}

/**
 * Computes the maker and taker amounts filled for the given OTC order.
 */
export function computeOtcOrderFilledAmounts(
    order: OtcOrder,
    takerTokenFillAmount: bigint = order.takerAmount,
): OtcOrderFilledAmounts {
    const fillAmount = takerTokenFillAmount < order.takerAmount ? takerTokenFillAmount : order.takerAmount;
    const makerTokenFilledAmount = (fillAmount * order.makerAmount) / order.takerAmount;
    return {
        makerTokenFilledAmount,
        takerTokenFilledAmount: fillAmount,
    };
}

/**
 * Computes the remaining fillable amount in maker token for
 * the given order.
 */
export function getFillableMakerTokenAmount(
    order: LimitOrder | RfqOrder,
    takerTokenFilledAmount: bigint = ZERO,
): bigint {
    return ((order.takerAmount - takerTokenFilledAmount) * order.makerAmount) / order.takerAmount;
}

/**
 * Computes the remaining fillable amnount in taker token, based on
 * the amount already filled and the maker's balance/allowance.
 */
export function getActualFillableTakerTokenAmount(
    order: LimitOrder | RfqOrder,
    makerBalance: bigint = order.makerAmount,
    makerAllowance: bigint = order.makerAmount,
    takerTokenFilledAmount: bigint = ZERO,
): bigint {
    // 实现与合约相同的计算逻辑，包括正确的舍入方式

    // 1. 计算 fillableMakerTokenAmount (使用 Floor 舍入，与合约 getPartialAmountFloor 一致)
    const remainingTakerAmount = order.takerAmount - takerTokenFilledAmount;
    const fillableMakerTokenAmount = (remainingTakerAmount * order.makerAmount) / order.takerAmount;

    // 2. 限制到实际可用的余额和授权 (取最小值)
    const minCap = [fillableMakerTokenAmount, makerBalance, makerAllowance].reduce((min, v) => (v < min ? v : min));

    // 3. 转换回 taker token 数量 (使用 Ceil 舍入，与合约 getPartialAmountCeil 一致)
    // ceil(a / b) = floor((a + b - 1) / b)
    const result = (minCap * order.takerAmount + (order.makerAmount - 1n)) / order.makerAmount;

    return result;
}
