import { ethers } from "hardhat";
import {
    constants,
    getRandomInteger,
    toBaseUnitAmount,
    verifyEventsFromLogs,
} from '@0x/utils';
import { expect } from 'chai';
import { OtcOrder, RfqOrder, SIGNATURE_ABI } from '@0x/protocol-utils';
import { hexUtils } from '@0x/utils';
import { LogWithDecodedArgs } from 'ethereum-types';

import { 
    IZeroExContract, 
    IZeroExEvents,
    OtcOrdersFeature__factory,
    LiquidityProviderSandbox__factory,
    TestLiquidityProvider__factory,
    TestUniswapV2Factory__factory,
    TestUniswapV3Factory__factory,
    UniswapV3Feature__factory,
    TestMintableERC20Token__factory,
    TestWeth__factory,
    TestMintTokenERC20Transformer__factory,
    MultiplexFeature__factory
} from '../../src/wrappers';
import { artifacts } from '../artifacts';
import { abis } from '../utils/abis'; // 🔧 添加abis导入

import { fullMigrateAsync } from '../utils/migration';
import { getRandomOtcOrder, getRandomRfqOrder } from '../utils/orders';
import {
    IOwnableFeatureContract,
    LiquidityProviderSandboxContract,
    MultiplexFeatureContract,
    MultiplexFeatureEvents,
    OtcOrdersFeatureContract,
    TestLiquidityProviderContract,
    TestMintableERC20TokenContract,
    TestMintableERC20TokenEvents,
    TestMintTokenERC20TransformerContract,
    TestMintTokenERC20TransformerEvents,
    TestUniswapV2FactoryContract,
    TestUniswapV2FactoryPoolCreatedEventArgs,
    TestUniswapV2PoolContract,
    TestUniswapV3FactoryContract,
    TestUniswapV3FactoryPoolCreatedEventArgs,
    TestUniswapV3PoolContract,
    TestWethContract,
    TestWethEvents,
    UniswapV3FeatureContract,
} from '../wrappers';

interface TransferEvent {
    token: string;
    from: string;
    to: string;
    value?: bigint;
}

enum MultiplexSubcall {
    Invalid,
    Rfq,
    Otc,
    UniswapV2,
    UniswapV3,
    LiquidityProvider,
    TransformERC20,
    BatchSell,
    MultiHopSell,
}

interface MultiHopSellSubcall {
    id: MultiplexSubcall;
    data: string;
}

interface BatchSellSubcall extends MultiHopSellSubcall {
    sellAmount: bigint;
}

const HIGH_BIT = 2n ** 255n;
function encodeFractionalFillAmount(frac: number): bigint {
    return HIGH_BIT + BigInt(Math.floor(Number(frac) * 1e18));
}

describe('MultiplexFeature', () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => {
            const signers = await ethers.getSigners();
            return Promise.all(signers.map(s => s.getAddress()));
        },
    } as any;
    const POOL_FEE = 1234;

    let zeroEx: IZeroExContract;
    let multiplex: MultiplexFeatureContract;
    let flashWalletAddress: string;
    let sandbox: LiquidityProviderSandboxContract;
    let liquidityProvider: TestLiquidityProviderContract;
    let sushiFactory: TestUniswapV2FactoryContract;
    let uniV2Factory: TestUniswapV2FactoryContract;
    let uniV3Factory: TestUniswapV3FactoryContract;
    let dai: TestMintableERC20TokenContract;
    let shib: TestMintableERC20TokenContract;
    let zrx: TestMintableERC20TokenContract;
    let weth: TestWethContract;
    let owner: string;
    let maker: string;
    let taker: string;
    let transformerNonce: number;

    //////////////// Deployment utility functions ////////////////
    async function migrateOtcOrdersFeatureAsync(): Promise<void> {
        const signer = await env.provider.getSigner(owner);
        const featureFactory = new OtcOrdersFeature__factory(signer);
        const featureImpl = await featureFactory.deploy(
            await zeroEx.getAddress(),
            await weth.getAddress()
        );
        await featureImpl.waitForDeployment();
        
        const ownerSigner = await env.provider.getSigner(owner);
        const ownableFeature = await ethers.getContractAt('IOwnableFeature', await zeroEx.getAddress(), ownerSigner);
        await ownableFeature.migrate(await featureImpl.getAddress(), featureImpl.interface.encodeFunctionData('migrate'), owner);
    }

    async function migrateLiquidityProviderContractsAsync(): Promise<void> {
        const signer = await env.provider.getSigner(owner);
        
        const sandboxFactory = new LiquidityProviderSandbox__factory(signer);
        sandbox = await sandboxFactory.deploy(await zeroEx.getAddress());
        await sandbox.waitForDeployment();
        
        // 🔧 使用ethers.getContractFactory替代可能不存在的factory
        const liquidityProviderFactory = await ethers.getContractFactory('TestLiquidityProvider');
        liquidityProvider = await liquidityProviderFactory.deploy() as TestLiquidityProviderContract;
        await liquidityProvider.waitForDeployment();
    }

    async function migrateUniswapV2ContractsAsync(): Promise<void> {
        const signer = await env.provider.getSigner(owner);
        
        // 🔧 使用ethers.getContractFactory替代可能不存在的factory
        const sushiFactoryFactory = await ethers.getContractFactory('TestUniswapV2Factory');
        sushiFactory = await sushiFactoryFactory.deploy() as TestUniswapV2FactoryContract;
        await sushiFactory.waitForDeployment();
        
        const uniV2FactoryFactory = await ethers.getContractFactory('TestUniswapV2Factory');
        uniV2Factory = await uniV2FactoryFactory.deploy() as TestUniswapV2FactoryContract;
        await uniV2Factory.waitForDeployment();
    }

    async function migrateUniswapV3ContractsAsync(): Promise<void> {
        const signer = await env.provider.getSigner(owner);
        
        // 🔧 使用ethers.getContractFactory替代可能不存在的factory
        const uniV3FactoryFactory = await ethers.getContractFactory('TestUniswapV3Factory');
        uniV3Factory = await uniV3FactoryFactory.deploy() as TestUniswapV3FactoryContract;
        await uniV3Factory.waitForDeployment();
        
        const featureFactory = new UniswapV3Feature__factory(signer);
        const featureImpl = await featureFactory.deploy(
            await weth.getAddress(),
            await uniV3Factory.getAddress(),
            await uniV3Factory.POOL_INIT_CODE_HASH()
        );
        await featureImpl.waitForDeployment();
        
        const ownerSigner = await env.provider.getSigner(owner);
        const ownableFeature = await ethers.getContractAt('IOwnableFeature', await zeroEx.getAddress(), ownerSigner);
        await ownableFeature.migrate(await featureImpl.getAddress(), featureImpl.interface.encodeFunctionData('migrate'), owner);
    }

    //////////////// Miscellaneous utils ////////////////

    function isWethContract(t: TestMintableERC20TokenContract | TestWethContract): t is TestWethContract {
        return !!(t as any).deposit;
    }

    async function mintToAsync(
        token: TestMintableERC20TokenContract | TestWethContract,
        recipient: string,
        amount: bigint,
    ): Promise<void> {
        if (isWethContract(token)) {
            await token.depositTo(recipient, { value: amount });
        } else {
            await token.mint(recipient, amount);
        }
    }

    //////////////// Deploy Uniswap pools ////////////////

    async function createUniswapV2PoolAsync(
        factory: TestUniswapV2FactoryContract,
        token0: TestMintableERC20TokenContract | TestWethContract,
        token1: TestMintableERC20TokenContract | TestWethContract,
        balance0: bigint = toBaseUnitAmount(10),
        balance1: bigint = toBaseUnitAmount(10),
    ): Promise<TestUniswapV2PoolContract> {
        const tx = await factory.createPool(await token0.getAddress(), await token1.getAddress());
        const receipt = await tx.wait();
        const pool = await ethers.getContractAt(
            'TestUniswapV2Pool',
            (receipt.logs[0] as LogWithDecodedArgs<TestUniswapV2FactoryPoolCreatedEventArgs>).args.pool
        );
        await mintToAsync(token0, await pool.getAddress(), balance0);
        await mintToAsync(token1, await pool.getAddress(), balance1);
        if (await token0.getAddress() < await token1.getAddress()) {
            await pool.setReserves(balance0, balance1, 0n);
        } else {
            await pool.setReserves(balance1, balance0, 0n);
        }
        return pool;
    }

    async function createUniswapV3PoolAsync(
        token0: TestMintableERC20TokenContract | TestWethContract,
        token1: TestMintableERC20TokenContract | TestWethContract,
        balance0: bigint = toBaseUnitAmount(10),
        balance1: bigint = toBaseUnitAmount(10),
    ): Promise<TestUniswapV3PoolContract> {
        const tx = await uniV3Factory
            .createPool(await token0.getAddress(), await token1.getAddress(), BigInt(POOL_FEE));
        const receipt = await tx.wait();
        const pool = await ethers.getContractAt(
            'TestUniswapV3Pool',
            (receipt.logs[0] as LogWithDecodedArgs<TestUniswapV3FactoryPoolCreatedEventArgs>).args.pool
        );
        await mintToAsync(token0, await pool.getAddress(), balance0);
        await mintToAsync(token1, await pool.getAddress(), balance1);
        return pool;
    }

    //////////////// Generate subcalls ////////////////

    async function getTestRfqOrder(overrides: Partial<RfqOrder> = {}): Promise<RfqOrder> {
        return getRandomRfqOrder({
            maker,
            verifyingContract: await zeroEx.getAddress(),
            chainId: (await ethers.provider.getNetwork()).chainId,
            takerToken: await dai.getAddress(),
            makerToken: await zrx.getAddress(),
            makerAmount: toBaseUnitAmount(1),
            takerAmount: toBaseUnitAmount(1),
            txOrigin: taker,
            ...overrides,
        });
    }
    async function getRfqSubcallAsync(
        rfqOrder: RfqOrder,
        sellAmount: bigint = rfqOrder.takerAmount,
    ): Promise<BatchSellSubcall> {
        // 使用 ethers.AbiCoder 替代 AbiEncoder
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const makerToken =
            rfqOrder.makerToken === await weth.getAddress()
                ? weth
                : await ethers.getContractAt('TestMintableERC20Token', rfqOrder.makerToken);
        await mintToAsync(makerToken, rfqOrder.maker, rfqOrder.makerAmount);
        const signature = await rfqOrder.getSignatureWithProviderAsync(env.provider);
        return {
            id: MultiplexSubcall.Rfq,
            sellAmount,
            data: abiCoder.encode(
                ['tuple(address,address,uint128,uint128,address,uint64,uint256,uint256)', 'tuple(uint8,uint8,bytes32,bytes32)'],
                [
                    [
                        rfqOrder.makerToken,
                        rfqOrder.takerToken,
                        rfqOrder.makerAmount,
                        rfqOrder.takerAmount,
                        rfqOrder.maker,
                        rfqOrder.expiry,
                        rfqOrder.salt,
                        rfqOrder.txOrigin
                    ],
                    [
                        signature.signatureType,
                        signature.v,
                        signature.r,
                        signature.s
                    ]
                ]
            ),
        };
    }

    async function getTestOtcOrder(fields: Partial<OtcOrder> = {}): Promise<OtcOrder> {
        return getRandomOtcOrder({
            maker,
            verifyingContract: await zeroEx.getAddress(),
            chainId: (await ethers.provider.getNetwork()).chainId,
            takerToken: await dai.getAddress(),
            makerToken: await zrx.getAddress(),
            makerAmount: toBaseUnitAmount(1),
            takerAmount: toBaseUnitAmount(1),
            taker,
            txOrigin: taker,
            ...fields,
        });
    }
    async function getOtcSubcallAsync(
        otcOrder: OtcOrder,
        sellAmount: bigint = otcOrder.takerAmount,
    ): Promise<BatchSellSubcall> {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const makerToken =
            otcOrder.makerToken === await weth.getAddress()
                ? weth
                : await ethers.getContractAt('TestMintableERC20Token', otcOrder.makerToken);
        await mintToAsync(makerToken, otcOrder.maker, otcOrder.makerAmount);
        const signature = await otcOrder.getSignatureWithProviderAsync(env.provider);
        return {
            id: MultiplexSubcall.Otc,
            sellAmount,
            data: abiCoder.encode(
                ['tuple(address,address,uint128,uint128,address,uint256,uint256,uint256)', 'tuple(uint8,uint8,bytes32,bytes32)'],
                [
                    [
                        otcOrder.makerToken,
                        otcOrder.takerToken,
                        otcOrder.makerAmount,
                        otcOrder.takerAmount,
                        otcOrder.maker,
                        otcOrder.nonceBucket,
                        otcOrder.nonce,
                        otcOrder.expiry
                    ],
                    [
                        signature.signatureType,
                        signature.v,
                        signature.r,
                        signature.s
                    ]
                ]
            ),
        };
    }

    function getUniswapV2MultiHopSubcall(tokens: string[], isSushi = false): MultiHopSellSubcall {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        return {
            id: MultiplexSubcall.UniswapV2,
            data: abiCoder.encode(['address[]', 'bool'], [tokens, isSushi]),
        };
    }
    function getUniswapV2BatchSubcall(
        tokens: string[],
        sellAmount: bigint = getRandomInteger(1, toBaseUnitAmount(1)),
        isSushi = false,
    ): BatchSellSubcall {
        return {
            ...getUniswapV2MultiHopSubcall(tokens, isSushi),
            sellAmount,
        };
    }

    async function getUniswapV3MultiHopSubcall(
        tokens_: Array<TestMintableERC20TokenContract | TestWethContract>,
    ): Promise<MultiHopSellSubcall> {
        const elems: string[] = [];
        for (let i = 0; i < tokens_.length; i++) {
            const t = tokens_[i];
            if (i) {
                elems.push(hexUtils.leftPad(POOL_FEE, 3));
            }
            elems.push(hexUtils.leftPad(await t.getAddress(), 20));
        }
        const data = hexUtils.concat(...elems);

        return {
            id: MultiplexSubcall.UniswapV3,
            data,
        };
    }
    async function getUniswapV3BatchSubcall(
        tokens: Array<TestMintableERC20TokenContract | TestWethContract>,
        sellAmount: bigint = getRandomInteger(1, toBaseUnitAmount(1)),
    ): Promise<BatchSellSubcall> {
        return {
            ...(await getUniswapV3MultiHopSubcall(tokens)),
            sellAmount,
        };
    }

    async function getLiquidityProviderMultiHopSubcall(): Promise<MultiHopSellSubcall> {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        return {
            id: MultiplexSubcall.LiquidityProvider,
            data: abiCoder.encode(["address", "bytes"], [await liquidityProvider.getAddress(), constants.NULL_BYTES]),
        };
    }
    function getLiquidityProviderBatchSubcall(
        sellAmount: bigint = getRandomInteger(1, toBaseUnitAmount(1)),
    ): BatchSellSubcall {
        return {
            ...getLiquidityProviderMultiHopSubcall(),
            sellAmount,
        };
    }

    function getTransformERC20Subcall(
        inputToken: string,
        outputToken: string,
        sellAmount: bigint = getRandomInteger(1, toBaseUnitAmount(1)),
        mintAmount: bigint = getRandomInteger(1, toBaseUnitAmount(1)),
    ): BatchSellSubcall {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        
        // 编码内部 transform data
        const transformData = abiCoder.encode(
            ['tuple(address,address,uint256,uint256,uint256)'],
            [[inputToken, outputToken, constants.ZERO_AMOUNT, mintAmount, constants.ZERO_AMOUNT]]
        );
        
        return {
            id: MultiplexSubcall.TransformERC20,
            sellAmount,
            data: abiCoder.encode(
                ['tuple(uint32,bytes)[]'],
                [[[transformerNonce, transformData]]]
            ),
        };
    }

    function getNestedBatchSellSubcall(calls: BatchSellSubcall[]): MultiHopSellSubcall {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        return {
            id: MultiplexSubcall.BatchSell,
            data: abiCoder.encode(["tuple(uint8,uint256,bytes)[]"], [calls]),
        };
    }

    function getNestedMultiHopSellSubcall(
        tokens: string[],
        calls: MultiHopSellSubcall[],
        sellAmount: bigint = getRandomInteger(1, toBaseUnitAmount(1)),
    ): BatchSellSubcall {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        return {
            id: MultiplexSubcall.MultiHopSell,
            sellAmount,
            data: abiCoder.encode(['address[]', 'tuple(uint8,bytes)[]'], [tokens, calls]),
        };
    }

    before(async () => {
        [owner, maker, taker] = await env.getAccountAddressesAsync();
        env.txDefaults.from = owner;
        zeroEx = await fullMigrateAsync(owner, env.provider, env.txDefaults, {});
        // 🔧 使用ITransformERC20Feature接口调用getTransformWallet
        const transformERC20Feature = await ethers.getContractAt('ITransformERC20Feature', await zeroEx.getAddress());
        flashWalletAddress = await transformERC20Feature.getTransformWallet();

        const signer = await env.provider.getSigner(owner);
        const tokenFactories = [...new Array(3)].map(() => new TestMintableERC20Token__factory(signer));
        const tokenDeployments = await Promise.all(
            tokenFactories.map(factory => factory.deploy())
        );
        await Promise.all(tokenDeployments.map(token => token.waitForDeployment()));
        [dai, shib, zrx] = tokenDeployments;
        
        const wethFactory = new TestWeth__factory(signer);
        weth = await wethFactory.deploy();
        await weth.waitForDeployment();

        await Promise.all([
            ...[dai, shib, zrx, weth].map(async t => {
                const takerSigner = await env.provider.getSigner(taker);
                return t.connect(takerSigner).approve(await zeroEx.getAddress(), constants.MAX_UINT256);
            }),
            ...[dai, shib, zrx, weth].map(async t => {
                const makerSigner = await env.provider.getSigner(maker);
                return t.connect(makerSigner).approve(await zeroEx.getAddress(), constants.MAX_UINT256);
            }),
        ]);
        await migrateOtcOrdersFeatureAsync();
        await migrateLiquidityProviderContractsAsync();
        await migrateUniswapV2ContractsAsync();
        await migrateUniswapV3ContractsAsync();
        transformerNonce = await ethers.provider.getTransactionCount(owner);
        
        const transformerFactory = new TestMintTokenERC20Transformer__factory(signer);
        await transformerFactory.deploy();

        // 🔧 使用ethers.getContractFactory替代可能不存在的factory
        const featureFactory = await ethers.getContractFactory('MultiplexFeature');
        const featureImpl = await featureFactory.deploy(
            await zeroEx.getAddress(),
            await weth.getAddress(),
            await sandbox.getAddress(),
            await uniV2Factory.getAddress(),
            await sushiFactory.getAddress(),
            await uniV2Factory.POOL_INIT_CODE_HASH(),
            await sushiFactory.POOL_INIT_CODE_HASH()
        );
        await featureImpl.waitForDeployment();
        
        const ownerSigner = await env.provider.getSigner(owner);
        const ownableFeature = await ethers.getContractAt('IOwnableFeature', await zeroEx.getAddress(), ownerSigner);
        await ownableFeature.migrate(await featureImpl.getAddress(), featureImpl.interface.encodeFunctionData('migrate'), owner);
        // 🔧 使用ethers.getContractAt替代constructor
        multiplex = await ethers.getContractAt('IMultiplexFeature', await zeroEx.getAddress()) as MultiplexFeatureContract;
    });

    describe('batch sells', () => {
        describe('multiplexBatchSellTokenForToken', () => {
            it('reverts if minBuyAmount is not satisfied', async () => {
                const order = await getTestRfqOrder();
                const rfqSubcall = await getRfqSubcallAsync(order);
                await mintToAsync(dai, taker, rfqSubcall.sellAmount);

                const tx = multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForToken(await dai.getAddress(),
                        await zrx.getAddress(),
                        [rfqSubcall],
                        order.takerAmount,
                        order.makerAmount + 1n,
                    );
                return expect(tx).to.be.revertedWith('MultiplexFeature::_multiplexBatchSell/UNDERBOUGHT');
            });
            it('reverts if given an invalid subcall type', async () => {
                const invalidSubcall: BatchSellSubcall = {
                    id: MultiplexSubcall.Invalid,
                    sellAmount: toBaseUnitAmount(1),
                    data: constants.NULL_BYTES,
                };
                const tx = multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForToken(await dai.getAddress(),
                        await zrx.getAddress(),
                        [invalidSubcall],
                        invalidSubcall.sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                return expect(tx).to.be.revertedWith('MultiplexFeature::_executeBatchSell/INVALID_SUBCALL');
            });
            it('reverts if the full sell amount is not sold', async () => {
                const order = await getTestRfqOrder();
                const rfqSubcall = await getRfqSubcallAsync(order);
                await mintToAsync(dai, taker, rfqSubcall.sellAmount);

                const tx = multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForToken(await dai.getAddress(),
                        await zrx.getAddress(),
                        [rfqSubcall],
                        order.takerAmount + 1n,
                        order.makerAmount,
                    );
                return expect(tx).to.be.revertedWith('MultiplexFeature::_executeBatchSell/INCORRECT_AMOUNT_SOLD');
            });
            it('RFQ, fallback(UniswapV2)', async () => {
                const order = await getTestRfqOrder();
                const rfqSubcall = await getRfqSubcallAsync(order);
                await createUniswapV2PoolAsync(uniV2Factory, dai, zrx);
                await mintToAsync(dai, taker, rfqSubcall.sellAmount);

                const takerSigner = await env.provider.getSigner(taker);
                const tx = await multiplex
                    .connect(takerSigner)
                    .multiplexBatchSellTokenForToken(
                        await dai.getAddress(),
                        await zrx.getAddress(),
                        [rfqSubcall, getUniswapV2BatchSubcall([await dai.getAddress(), await zrx.getAddress()], order.takerAmount)],
                        order.takerAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs(
                    tx.logs,
                    [
                        {
                            orderHash: order.getHash(),
                            maker,
                            taker,
                            makerToken: order.makerToken,
                            takerToken: order.takerToken,
                            takerTokenFilledAmount: order.takerAmount,
                            makerTokenFilledAmount: order.makerAmount,
                            pool: order.pool,
                        },
                    ],
                    IZeroExEvents.RfqOrderFilled,
                );
            });
            it('OTC, fallback(UniswapV2)', async () => {
                const order = await getTestOtcOrder();
                const otcSubcall = await getOtcSubcallAsync(order);
                await createUniswapV2PoolAsync(uniV2Factory, dai, zrx);
                await mintToAsync(dai, taker, otcSubcall.sellAmount);

                const tx = await multiplex
                    .multiplexBatchSellTokenForToken(
                        await dai.getAddress(),
                        await zrx.getAddress(),
                        [otcSubcall, getUniswapV2BatchSubcall([await dai.getAddress(), await zrx.getAddress()], order.takerAmount)],
                        order.takerAmount,
                        constants.ZERO_AMOUNT,
                    )
                    ({ from: taker });
                verifyEventsFromLogs(
                    tx.logs,
                    [
                        {
                            orderHash: order.getHash(),
                            maker,
                            taker,
                            makerToken: order.makerToken,
                            takerToken: order.takerToken,
                            takerTokenFilledAmount: order.takerAmount,
                            makerTokenFilledAmount: order.makerAmount,
                        },
                    ],
                    IZeroExEvents.OtcOrderFilled,
                );
            });
            it('expired RFQ, fallback(UniswapV2)', async () => {
                const order = await getTestRfqOrder({ expiry: constants.ZERO_AMOUNT });
                const rfqSubcall = await getRfqSubcallAsync(order);
                const uniswap = await createUniswapV2PoolAsync(uniV2Factory, dai, zrx);
                await mintToAsync(dai, taker, rfqSubcall.sellAmount);

                const tx = await multiplex
                    .multiplexBatchSellTokenForToken(
                        await dai.getAddress(),
                        await zrx.getAddress(),
                        [rfqSubcall, getUniswapV2BatchSubcall([await dai.getAddress(), await zrx.getAddress()], order.takerAmount)],
                        order.takerAmount,
                        constants.ZERO_AMOUNT,
                    )
                    ({ from: taker });
                verifyEventsFromLogs(
                    tx.logs,
                    [
                        {
                            orderHash: order.getHash(),
                            maker,
                            expiry: order.expiry,
                        },
                    ],
                    MultiplexFeatureEvents.ExpiredRfqOrder,
                );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniswap.getAddress(),
                            value: order.takerAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await uniswap.getAddress(),
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('expired OTC, fallback(UniswapV2)', async () => {
                const order = await getTestOtcOrder({ expiry: constants.ZERO_AMOUNT });
                const otcSubcall = await getOtcSubcallAsync(order);
                const uniswap = await createUniswapV2PoolAsync(uniV2Factory, dai, zrx);
                await mintToAsync(dai, taker, otcSubcall.sellAmount);

                const tx = await multiplex
                    .multiplexBatchSellTokenForToken(
                        await dai.getAddress(),
                        await zrx.getAddress(),
                        [otcSubcall, getUniswapV2BatchSubcall([await dai.getAddress(), await zrx.getAddress()], order.takerAmount)],
                        order.takerAmount,
                        constants.ZERO_AMOUNT,
                    )
                    ({ from: taker });
                verifyEventsFromLogs(
                    tx.logs,
                    [
                        {
                            orderHash: order.getHash(),
                            maker,
                            expiry: order.expiry,
                        },
                    ],
                    MultiplexFeatureEvents.ExpiredOtcOrder,
                );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniswap.getAddress(),
                            value: order.takerAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await uniswap.getAddress(),
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('expired RFQ, fallback(TransformERC20)', async () => {
                const order = await getTestRfqOrder({ expiry: constants.ZERO_AMOUNT });
                const rfqSubcall = await getRfqSubcallAsync(order);
                const transformERC20Subcall = getTransformERC20Subcall(await dai.getAddress(), await zrx.getAddress(), order.takerAmount);
                await mintToAsync(dai, taker, order.takerAmount);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForToken(await dai.getAddress(),
                        await zrx.getAddress(),
                        [rfqSubcall, transformERC20Subcall],
                        order.takerAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs(
                    tx.logs,
                    [
                        {
                            orderHash: order.getHash(),
                            maker,
                            expiry: order.expiry,
                        },
                    ],
                    MultiplexFeatureEvents.ExpiredRfqOrder,
                );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: flashWalletAddress,
                            value: order.takerAmount,
                        },
                        {
                            token: await dai.getAddress(),
                            from: flashWalletAddress,
                            to: constants.NULL_ADDRESS,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: flashWalletAddress,
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
                verifyEventsFromLogs(
                    tx.logs,
                    [
                        {
                            caller: await zeroEx.getAddress(),
                            sender: await zeroEx.getAddress(),
                            taker,
                            inputTokenBalance: order.takerAmount,
                        },
                    ],
                    TestMintTokenERC20TransformerEvents.MintTransform,
                );
            });
            it('LiquidityProvider, UniV3, Sushiswap', async () => {
                const sushiswap = await createUniswapV2PoolAsync(sushiFactory, dai, zrx);
                const uniV3 = await createUniswapV3PoolAsync(dai, zrx);
                const liquidityProviderSubcall = getLiquidityProviderBatchSubcall();
                const uniV3Subcall = getUniswapV3BatchSubcall([dai, zrx]);
                const sushiswapSubcall = getUniswapV2BatchSubcall([await dai.getAddress(), await zrx.getAddress()], undefined, true);
                const sellAmount = [liquidityProviderSubcall, uniV3Subcall, sushiswapSubcall]
                    .map(c => c.sellAmount)
                    .reduce((a, b) => a + b, 0n) - 1n;
                await mintToAsync(dai, taker, sellAmount);
                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForToken(await dai.getAddress(),
                        await zrx.getAddress(),
                        [liquidityProviderSubcall, uniV3Subcall, sushiswapSubcall],
                        sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await liquidityProvider.getAddress(),
                            value: liquidityProviderSubcall.sellAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await liquidityProvider.getAddress(),
                            to: taker,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await uniV3.getAddress(),
                            to: taker,
                        },
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniV3.getAddress(),
                            value: uniV3Subcall.sellAmount,
                        },
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await sushiswap.getAddress(),
                            value: sushiswapSubcall.sellAmount - 1n,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await sushiswap.getAddress(),
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('proportional fill amounts', async () => {
                const order = await getTestRfqOrder();
                const uniswap = await createUniswapV2PoolAsync(uniV2Factory, dai, zrx);
                const sellAmount = toBaseUnitAmount(1);
                await mintToAsync(dai, taker, sellAmount);

                const rfqFillProportion = 0.42;
                const rfqSubcall = await getRfqSubcallAsync(order, encodeFractionalFillAmount(rfqFillProportion));
                // fractional fill amount 100% => the rest of the total sell amount is sold to Uniswap
                const uniswapV2Subcall = getUniswapV2BatchSubcall(
                    [await dai.getAddress(), await zrx.getAddress()],
                    encodeFractionalFillAmount(1),
                );
                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForToken(await dai.getAddress(),
                        await zrx.getAddress(),
                        [rfqSubcall, uniswapV2Subcall],
                        sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: order.maker,
                            value: sellAmount * rfqFillProportion,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: order.maker,
                            to: taker,
                        },
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniswap.getAddress(),
                            value: sellAmount - sellAmount * rfqFillProportion,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await uniswap.getAddress(),
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('RFQ, MultiHop(UniV3, UniV2)', async () => {
                const order = await getTestRfqOrder();
                const rfqSubcall = await getRfqSubcallAsync(order);
                const uniV3 = await createUniswapV3PoolAsync(dai, shib);
                const uniV3Subcall = getUniswapV3MultiHopSubcall([dai, shib]);
                const uniV2 = await createUniswapV2PoolAsync(uniV2Factory, shib, zrx);
                const uniV2Subcall = getUniswapV2MultiHopSubcall([await shib.getAddress(), await zrx.getAddress()]);
                const nestedMultiHopSubcall = getNestedMultiHopSellSubcall(
                    [await dai.getAddress(), await shib.getAddress(), await zrx.getAddress()],
                    [uniV3Subcall, uniV2Subcall],
                );
                const sellAmount = rfqSubcall.sellAmount + nestedMultiHopSubcall.sellAmount;
                await mintToAsync(dai, taker, sellAmount);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForToken(await dai.getAddress(),
                        await zrx.getAddress(),
                        [rfqSubcall, nestedMultiHopSubcall],
                        sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: order.maker,
                            value: order.takerAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: order.maker,
                            to: taker,
                            value: order.makerAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await uniV3.getAddress(),
                            to: await uniV2.getAddress(),
                        },
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniV3.getAddress(),
                            value: nestedMultiHopSubcall.sellAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await uniV2.getAddress(),
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
        });
        describe('multiplexBatchSellEthForToken', () => {
            it('RFQ', async () => {
                const order = await getTestRfqOrder({ takerToken: await weth.getAddress() });
                const rfqSubcall = await getRfqSubcallAsync(order);

                const takerSigner = await env.provider.getSigner(taker);
                const tx = await multiplex
                    .connect(takerSigner)
                    .multiplexBatchSellEthForToken(await zrx.getAddress(), [rfqSubcall], constants.ZERO_AMOUNT, { value: order.takerAmount });
                const receipt = await tx.wait();
                verifyEventsFromLogs(
                    receipt.logs,
                    [{ owner: await zeroEx.getAddress(), value: order.takerAmount }],
                    TestWethEvents.Deposit,
                );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: order.maker,
                            value: order.takerAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: order.maker,
                            to: taker,
                            value: order.makerAmount,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('OTC', async () => {
                const order = await getTestOtcOrder({ takerToken: await weth.getAddress() });
                const otcSubcall = await getOtcSubcallAsync(order);

                const tx = await multiplex
                    .multiplexBatchSellEthForToken(await zrx.getAddress(), [otcSubcall], constants.ZERO_AMOUNT)
                    ({ from: taker, value: order.takerAmount });
                verifyEventsFromLogs(
                    tx.logs,
                    [{ owner: await zeroEx.getAddress(), value: order.takerAmount }],
                    TestWethEvents.Deposit,
                );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: order.maker,
                            value: order.takerAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: order.maker,
                            to: taker,
                            value: order.makerAmount,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('UniswapV2', async () => {
                const uniswap = await createUniswapV2PoolAsync(uniV2Factory, weth, zrx);
                const uniswapV2Subcall = getUniswapV2BatchSubcall([await weth.getAddress(), await zrx.getAddress()]);

                const tx = await multiplex
                    .multiplexBatchSellEthForToken(await zrx.getAddress(), [uniswapV2Subcall], constants.ZERO_AMOUNT)
                    ({ from: taker, value: uniswapV2Subcall.sellAmount });
                verifyEventsFromLogs(
                    tx.logs,
                    [{ owner: await zeroEx.getAddress(), value: uniswapV2Subcall.sellAmount }],
                    TestWethEvents.Deposit,
                );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await uniswap.getAddress(),
                            value: uniswapV2Subcall.sellAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await uniswap.getAddress(),
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('UniswapV3', async () => {
                const uniV3 = await createUniswapV3PoolAsync(weth, zrx);
                const uniswapV3Subcall = getUniswapV3BatchSubcall([weth, zrx]);
                const tx = await multiplex
                    .multiplexBatchSellEthForToken(await zrx.getAddress(), [uniswapV3Subcall], constants.ZERO_AMOUNT)
                    ({ from: taker, value: uniswapV3Subcall.sellAmount });
                verifyEventsFromLogs(
                    tx.logs,
                    [{ owner: await zeroEx.getAddress(), value: uniswapV3Subcall.sellAmount }],
                    TestWethEvents.Deposit,
                );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await zrx.getAddress(),
                            from: await uniV3.getAddress(),
                            to: taker,
                        },
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await uniV3.getAddress(),
                            value: uniswapV3Subcall.sellAmount,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('LiquidityProvider', async () => {
                const liquidityProviderSubcall = getLiquidityProviderBatchSubcall();
                const takerSigner = await env.provider.getSigner(taker);
                const tx = await multiplex
                    .connect(takerSigner)
                    .multiplexBatchSellEthForToken(await zrx.getAddress(), [liquidityProviderSubcall], constants.ZERO_AMOUNT, { value: liquidityProviderSubcall.sellAmount });
                const receipt = await tx.wait();
                verifyEventsFromLogs(
                    receipt.logs,
                    [{ owner: await zeroEx.getAddress(), value: liquidityProviderSubcall.sellAmount }],
                    TestWethEvents.Deposit,
                );
                verifyEventsFromLogs<TransferEvent>(
                    receipt.logs,
                    [
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await liquidityProvider.getAddress(),
                            value: liquidityProviderSubcall.sellAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await liquidityProvider.getAddress(),
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('TransformERC20', async () => {
                const transformERC20Subcall = getTransformERC20Subcall(await weth.getAddress(), await zrx.getAddress());
                const tx = await multiplex
                    .multiplexBatchSellEthForToken(await zrx.getAddress(), [transformERC20Subcall], constants.ZERO_AMOUNT)
                    ({ from: taker, value: transformERC20Subcall.sellAmount });
                verifyEventsFromLogs(
                    tx.logs,
                    [{ owner: await zeroEx.getAddress(), value: transformERC20Subcall.sellAmount }],
                    TestWethEvents.Deposit,
                );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: flashWalletAddress,
                            value: transformERC20Subcall.sellAmount,
                        },
                        {
                            token: await weth.getAddress(),
                            from: flashWalletAddress,
                            to: constants.NULL_ADDRESS,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: flashWalletAddress,
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('RFQ, MultiHop(UniV3, UniV2)', async () => {
                const order = await getTestRfqOrder({ takerToken: await weth.getAddress(), makerToken: await zrx.getAddress() });
                const rfqSubcall = await getRfqSubcallAsync(order);
                const uniV3 = await createUniswapV3PoolAsync(weth, shib);
                const uniV3Subcall = getUniswapV3MultiHopSubcall([weth, shib]);
                const uniV2 = await createUniswapV2PoolAsync(uniV2Factory, shib, zrx);
                const uniV2Subcall = getUniswapV2MultiHopSubcall([await shib.getAddress(), await zrx.getAddress()]);
                const nestedMultiHopSubcall = getNestedMultiHopSellSubcall(
                    [await weth.getAddress(), await shib.getAddress(), await zrx.getAddress()],
                    [uniV3Subcall, uniV2Subcall],
                );
                const sellAmount = rfqSubcall.sellAmount + nestedMultiHopSubcall.sellAmount;

                const tx = await multiplex
                    .multiplexBatchSellEthForToken(
                        await zrx.getAddress(),
                        [rfqSubcall, nestedMultiHopSubcall],
                        constants.ZERO_AMOUNT,
                    )
                    ({ from: taker, value: sellAmount });
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress(), value: sellAmount }], TestWethEvents.Deposit);
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: order.maker,
                            value: order.takerAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: order.maker,
                            to: taker,
                            value: order.makerAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await uniV3.getAddress(),
                            to: await uniV2.getAddress(),
                        },
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await uniV3.getAddress(),
                            value: nestedMultiHopSubcall.sellAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await uniV2.getAddress(),
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
        });
        describe('multiplexBatchSellTokenForEth', () => {
            it('RFQ', async () => {
                const order = await getTestRfqOrder({ makerToken: await weth.getAddress() });
                const rfqSubcall = await getRfqSubcallAsync(order);
                await mintToAsync(dai, taker, order.takerAmount);
                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForEth(await dai.getAddress(), [rfqSubcall], order.takerAmount, constants.ZERO_AMOUNT);
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress() }], TestWethEvents.Withdrawal);
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: order.maker,
                            value: order.takerAmount,
                        },
                        {
                            token: await weth.getAddress(),
                            from: order.maker,
                            to: await zeroEx.getAddress(),
                            value: order.makerAmount,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('OTC', async () => {
                const order = await getTestOtcOrder({ makerToken: await weth.getAddress() });
                const otcSubcall = await getOtcSubcallAsync(order);
                await mintToAsync(dai, taker, order.takerAmount);
                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForEth(await dai.getAddress(), [otcSubcall], order.takerAmount, constants.ZERO_AMOUNT);
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress() }], TestWethEvents.Withdrawal);
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: order.maker,
                            value: order.takerAmount,
                        },
                        {
                            token: await weth.getAddress(),
                            from: order.maker,
                            to: await zeroEx.getAddress(),
                            value: order.makerAmount,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('UniswapV2', async () => {
                const uniswapV2Subcall = getUniswapV2BatchSubcall([await dai.getAddress(), await weth.getAddress()]);
                const uniswap = await createUniswapV2PoolAsync(uniV2Factory, dai, weth);
                await mintToAsync(dai, taker, uniswapV2Subcall.sellAmount);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForEth(await dai.getAddress(),
                        [uniswapV2Subcall],
                        uniswapV2Subcall.sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress() }], TestWethEvents.Withdrawal);
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniswap.getAddress(),
                            value: uniswapV2Subcall.sellAmount,
                        },
                        {
                            token: await weth.getAddress(),
                            from: await uniswap.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('UniswapV3', async () => {
                const uniswapV3Subcall = getUniswapV3BatchSubcall([dai, weth]);
                const uniV3 = await createUniswapV3PoolAsync(dai, weth);
                await mintToAsync(dai, taker, uniswapV3Subcall.sellAmount);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForEth(await dai.getAddress(),
                        [uniswapV3Subcall],
                        uniswapV3Subcall.sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress() }], TestWethEvents.Withdrawal);
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await weth.getAddress(),
                            from: await uniV3.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniV3.getAddress(),
                            value: uniswapV3Subcall.sellAmount,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('LiquidityProvider', async () => {
                const liquidityProviderSubcall = getLiquidityProviderBatchSubcall();
                await mintToAsync(dai, taker, liquidityProviderSubcall.sellAmount);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForEth(await dai.getAddress(),
                        [liquidityProviderSubcall],
                        liquidityProviderSubcall.sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress() }], TestWethEvents.Withdrawal);
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await liquidityProvider.getAddress(),
                            value: liquidityProviderSubcall.sellAmount,
                        },
                        {
                            token: await weth.getAddress(),
                            from: await liquidityProvider.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('TransformERC20', async () => {
                const transformERC20Subcall = getTransformERC20Subcall(
                    await dai.getAddress(),
                    await weth.getAddress(),
                    undefined,
                    constants.ZERO_AMOUNT,
                );
                await mintToAsync(dai, taker, transformERC20Subcall.sellAmount);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForEth(await dai.getAddress(),
                        [transformERC20Subcall],
                        transformERC20Subcall.sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress() }], TestWethEvents.Withdrawal);
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: flashWalletAddress,
                            value: transformERC20Subcall.sellAmount,
                        },
                        {
                            token: await dai.getAddress(),
                            from: flashWalletAddress,
                            to: constants.NULL_ADDRESS,
                        },
                        {
                            token: await weth.getAddress(),
                            from: flashWalletAddress,
                            to: await zeroEx.getAddress(),
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('RFQ, MultiHop(UniV3, UniV2)', async () => {
                const order = await getTestRfqOrder({ takerToken: await dai.getAddress(), makerToken: await weth.getAddress() });
                const rfqSubcall = await getRfqSubcallAsync(order);
                const uniV3 = await createUniswapV3PoolAsync(dai, shib);
                const uniV3Subcall = getUniswapV3MultiHopSubcall([dai, shib]);
                const uniV2 = await createUniswapV2PoolAsync(uniV2Factory, shib, weth);
                const uniV2Subcall = getUniswapV2MultiHopSubcall([await shib.getAddress(), await weth.getAddress()]);
                const nestedMultiHopSubcall = getNestedMultiHopSellSubcall(
                    [await dai.getAddress(), await shib.getAddress(), await weth.getAddress()],
                    [uniV3Subcall, uniV2Subcall],
                );
                const sellAmount = rfqSubcall.sellAmount + nestedMultiHopSubcall.sellAmount;
                await mintToAsync(dai, taker, sellAmount);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexBatchSellTokenForEth(await dai.getAddress(),
                        [rfqSubcall, nestedMultiHopSubcall],
                        sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: order.maker,
                            value: order.takerAmount,
                        },
                        {
                            token: await weth.getAddress(),
                            from: order.maker,
                            to: await zeroEx.getAddress(),
                            value: order.makerAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await uniV3.getAddress(),
                            to: await uniV2.getAddress(),
                        },
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniV3.getAddress(),
                            value: nestedMultiHopSubcall.sellAmount,
                        },
                        {
                            token: await weth.getAddress(),
                            from: await uniV2.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress() }], TestWethEvents.Withdrawal);
            });
        });
    });
    describe('multihop sells', () => {
        describe('multiplexMultiHopSellTokenForToken', () => {
            it('reverts if given an invalid subcall type', async () => {
                const invalidSubcall: MultiHopSellSubcall = {
                    id: MultiplexSubcall.Invalid,
                    data: constants.NULL_BYTES,
                };
                const tx = multiplex
                    .multiplexMultiHopSellTokenForToken(
                        [await dai.getAddress(), await zrx.getAddress()],
                        [invalidSubcall],
                        toBaseUnitAmount(1),
                        constants.ZERO_AMOUNT,
                    )
                    ({ from: taker });
                return expect(tx).to.be.revertedWith('MultiplexFeature::_computeHopTarget/INVALID_SUBCALL');
            });
            it('reverts if minBuyAmount is not satisfied', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                await createUniswapV2PoolAsync(uniV2Factory, dai, zrx);
                const uniswapV2Subcall = getUniswapV2MultiHopSubcall([await dai.getAddress(), await zrx.getAddress()]);
                await mintToAsync(dai, taker, sellAmount);

                const tx = multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexMultiHopSellTokenForToken([await dai.getAddress(), await zrx.getAddress()],
                        [uniswapV2Subcall],
                        sellAmount,
                        constants.MAX_UINT256,
                    );
                return expect(tx).to.be.revertedWith('MultiplexFeature::_multiplexMultiHopSell/UNDERBOUGHT');
            });
            it('reverts if array lengths are mismatched', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                await createUniswapV2PoolAsync(uniV2Factory, dai, zrx);
                const uniswapV2Subcall = getUniswapV2MultiHopSubcall([await dai.getAddress(), await zrx.getAddress()]);
                await mintToAsync(dai, taker, sellAmount);

                const tx = multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexMultiHopSellTokenForToken([await dai.getAddress(), await zrx.getAddress()],
                        [uniswapV2Subcall, uniswapV2Subcall],
                        sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                return expect(tx).to.be.revertedWith('MultiplexFeature::_multiplexMultiHopSell/MISMATCHED_ARRAY_LENGTHS');
            });
            it('UniswapV2 -> LiquidityProvider', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const buyAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const uniswap = await createUniswapV2PoolAsync(uniV2Factory, dai, shib);
                const uniswapV2Subcall = getUniswapV2MultiHopSubcall([await dai.getAddress(), await shib.getAddress()]);
                const liquidityProviderSubcall = getLiquidityProviderMultiHopSubcall();
                await mintToAsync(dai, taker, sellAmount);
                await mintToAsync(zrx, await liquidityProvider.getAddress(), buyAmount);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexMultiHopSellTokenForToken([await dai.getAddress(), await shib.getAddress(), await zrx.getAddress()],
                        [uniswapV2Subcall, liquidityProviderSubcall],
                        sellAmount,
                        buyAmount,
                    );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniswap.getAddress(),
                            value: sellAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await uniswap.getAddress(),
                            to: await liquidityProvider.getAddress(),
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await liquidityProvider.getAddress(),
                            to: taker,
                            value: buyAmount,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('LiquidityProvider -> Sushiswap', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const shibAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const liquidityProviderSubcall = getLiquidityProviderMultiHopSubcall();
                const sushiswap = await createUniswapV2PoolAsync(sushiFactory, shib, zrx);
                const sushiswapSubcall = getUniswapV2MultiHopSubcall([await shib.getAddress(), await zrx.getAddress()], true);
                await mintToAsync(dai, taker, sellAmount);
                await mintToAsync(shib, await liquidityProvider.getAddress(), shibAmount);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexMultiHopSellTokenForToken([await dai.getAddress(), await shib.getAddress(), await zrx.getAddress()],
                        [liquidityProviderSubcall, sushiswapSubcall],
                        sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await liquidityProvider.getAddress(),
                            value: sellAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await liquidityProvider.getAddress(),
                            to: await sushiswap.getAddress(),
                            value: shibAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await sushiswap.getAddress(),
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('UniswapV3 -> BatchSell(RFQ, UniswapV2)', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                await mintToAsync(dai, taker, sellAmount);
                const uniV3 = await createUniswapV3PoolAsync(dai, shib);
                const uniV3Subcall = getUniswapV3MultiHopSubcall([dai, shib]);
                const rfqOrder = getTestRfqOrder({ takerToken: await shib.getAddress(), makerToken: await zrx.getAddress() });
                const rfqFillProportion = 0.42;
                const rfqSubcall = await getRfqSubcallAsync(rfqOrder, encodeFractionalFillAmount(rfqFillProportion));
                const uniV2 = await createUniswapV2PoolAsync(uniV2Factory, shib, zrx);
                const uniV2Subcall = getUniswapV2BatchSubcall(
                    [await shib.getAddress(), await zrx.getAddress()],
                    encodeFractionalFillAmount(1),
                );
                const nestedBatchSellSubcall = getNestedBatchSellSubcall([rfqSubcall, uniV2Subcall]);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexMultiHopSellTokenForToken([await dai.getAddress(), await shib.getAddress(), await zrx.getAddress()],
                        [uniV3Subcall, nestedBatchSellSubcall],
                        sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await shib.getAddress(),
                            from: await uniV3.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniV3.getAddress(),
                            value: sellAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: maker,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: maker,
                            to: taker,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await uniV2.getAddress(),
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await uniV2.getAddress(),
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('BatchSell(RFQ, UniswapV2) -> UniswapV3', async () => {
                const rfqOrder = getTestRfqOrder({ takerToken: await dai.getAddress(), makerToken: await shib.getAddress() });
                const rfqSubcall = await getRfqSubcallAsync(rfqOrder, rfqOrder.takerAmount);
                const uniV2 = await createUniswapV2PoolAsync(uniV2Factory, dai, shib);
                const uniV2Subcall = getUniswapV2BatchSubcall([await dai.getAddress(), await shib.getAddress()]);
                const sellAmount = rfqSubcall.sellAmount + uniV2Subcall.sellAmount;
                await mintToAsync(dai, taker, sellAmount);
                const nestedBatchSellSubcall = getNestedBatchSellSubcall([rfqSubcall, uniV2Subcall]);

                const uniV3 = await createUniswapV3PoolAsync(shib, zrx);
                const uniV3Subcall = getUniswapV3MultiHopSubcall([shib, zrx]);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexMultiHopSellTokenForToken([await dai.getAddress(), await shib.getAddress(), await zrx.getAddress()],
                        [nestedBatchSellSubcall, uniV3Subcall],
                        sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: maker,
                            value: rfqOrder.takerAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: maker,
                            to: await zeroEx.getAddress(),
                            value: rfqOrder.makerAmount,
                        },
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniV2.getAddress(),
                            value: uniV2Subcall.sellAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await uniV2.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await uniV3.getAddress(),
                            to: taker,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await uniV3.getAddress(),
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
        });
        describe('multiplexMultiHopSellEthForToken', () => {
            it('reverts if first token is not WETH', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                await createUniswapV2PoolAsync(uniV2Factory, weth, zrx);
                const uniswapV2Subcall = getUniswapV2MultiHopSubcall([await weth.getAddress(), await zrx.getAddress()]);
                await mintToAsync(weth, taker, sellAmount);

                const tx = multiplex
                    .multiplexMultiHopSellEthForToken(
                        [await dai.getAddress(), await zrx.getAddress()],
                        [uniswapV2Subcall],
                        constants.ZERO_AMOUNT,
                    )
                    ({ from: taker, value: sellAmount });
                return expect(tx).to.be.revertedWith('MultiplexFeature::multiplexMultiHopSellEthForToken/NOT_WETH');
            });
            it('UniswapV2 -> LiquidityProvider', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const buyAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const uniswap = await createUniswapV2PoolAsync(uniV2Factory, weth, shib);
                const uniswapV2Subcall = getUniswapV2MultiHopSubcall([await weth.getAddress(), await shib.getAddress()]);
                const liquidityProviderSubcall = getLiquidityProviderMultiHopSubcall();
                await mintToAsync(zrx, await liquidityProvider.getAddress(), buyAmount);

                const tx = await multiplex
                    .multiplexMultiHopSellEthForToken(
                        [await weth.getAddress(), await shib.getAddress(), await zrx.getAddress()],
                        [uniswapV2Subcall, liquidityProviderSubcall],
                        buyAmount,
                    )
                    ({ from: taker, value: sellAmount });
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress(), value: sellAmount }], TestWethEvents.Deposit);
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await uniswap.getAddress(),
                            value: sellAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await uniswap.getAddress(),
                            to: await liquidityProvider.getAddress(),
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await liquidityProvider.getAddress(),
                            to: taker,
                            value: buyAmount,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('LiquidityProvider -> Sushiswap', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const shibAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const liquidityProviderSubcall = getLiquidityProviderMultiHopSubcall();
                const sushiswap = await createUniswapV2PoolAsync(sushiFactory, shib, zrx);
                const sushiswapSubcall = getUniswapV2MultiHopSubcall([await shib.getAddress(), await zrx.getAddress()], true);
                await mintToAsync(shib, await liquidityProvider.getAddress(), shibAmount);

                const tx = await multiplex
                    .multiplexMultiHopSellEthForToken(
                        [await weth.getAddress(), await shib.getAddress(), await zrx.getAddress()],
                        [liquidityProviderSubcall, sushiswapSubcall],
                        constants.ZERO_AMOUNT,
                    )
                    ({ from: taker, value: sellAmount });
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress(), value: sellAmount }], TestWethEvents.Deposit);
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await liquidityProvider.getAddress(),
                            value: sellAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await liquidityProvider.getAddress(),
                            to: await sushiswap.getAddress(),
                            value: shibAmount,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await sushiswap.getAddress(),
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('UniswapV3 -> BatchSell(RFQ, UniswapV2)', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const uniV3 = await createUniswapV3PoolAsync(weth, shib);
                const uniV3Subcall = getUniswapV3MultiHopSubcall([weth, shib]);
                const rfqOrder = getTestRfqOrder({ takerToken: await shib.getAddress(), makerToken: await zrx.getAddress() });
                const rfqFillProportion = 0.42;
                const rfqSubcall = await getRfqSubcallAsync(rfqOrder, encodeFractionalFillAmount(rfqFillProportion));
                const uniV2 = await createUniswapV2PoolAsync(uniV2Factory, shib, zrx);
                const uniV2Subcall = getUniswapV2BatchSubcall(
                    [await shib.getAddress(), await zrx.getAddress()],
                    encodeFractionalFillAmount(1),
                );
                const nestedBatchSellSubcall = getNestedBatchSellSubcall([rfqSubcall, uniV2Subcall]);

                const tx = await multiplex
                    .multiplexMultiHopSellEthForToken(
                        [await weth.getAddress(), await shib.getAddress(), await zrx.getAddress()],
                        [uniV3Subcall, nestedBatchSellSubcall],
                        constants.ZERO_AMOUNT,
                    )
                    ({ from: taker, value: sellAmount });
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress(), value: sellAmount }], TestWethEvents.Deposit);
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await shib.getAddress(),
                            from: await uniV3.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await uniV3.getAddress(),
                            value: sellAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: maker,
                        },
                        {
                            token: await zrx.getAddress(),
                            from: maker,
                            to: taker,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await uniV2.getAddress(),
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await uniV2.getAddress(),
                            to: taker,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
            it('BatchSell(RFQ, UniswapV2) -> UniswapV3', async () => {
                const rfqOrder = getTestRfqOrder({ takerToken: await weth.getAddress(), makerToken: await shib.getAddress() });
                const rfqSubcall = await getRfqSubcallAsync(rfqOrder, rfqOrder.takerAmount);
                const uniV2 = await createUniswapV2PoolAsync(uniV2Factory, weth, shib);
                const uniV2Subcall = getUniswapV2BatchSubcall([await weth.getAddress(), await shib.getAddress()]);
                const sellAmount = rfqSubcall.sellAmount + uniV2Subcall.sellAmount;
                const nestedBatchSellSubcall = getNestedBatchSellSubcall([rfqSubcall, uniV2Subcall]);

                const uniV3 = await createUniswapV3PoolAsync(shib, zrx);
                const uniV3Subcall = getUniswapV3MultiHopSubcall([shib, zrx]);

                const tx = await multiplex
                    .multiplexMultiHopSellEthForToken(
                        [await weth.getAddress(), await shib.getAddress(), await zrx.getAddress()],
                        [nestedBatchSellSubcall, uniV3Subcall],
                        constants.ZERO_AMOUNT,
                    )
                    ({ from: taker, value: sellAmount });
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress(), value: sellAmount }], TestWethEvents.Deposit);
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: maker,
                            value: rfqOrder.takerAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: maker,
                            to: await zeroEx.getAddress(),
                            value: rfqOrder.makerAmount,
                        },
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await uniV2.getAddress(),
                            value: uniV2Subcall.sellAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await uniV2.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                        {
                            token: await zrx.getAddress(),
                            from: await uniV3.getAddress(),
                            to: taker,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await uniV3.getAddress(),
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
            });
        });
        describe('multiplexMultiHopSellTokenForEth', () => {
            it('reverts if last token is not WETH', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                await createUniswapV2PoolAsync(uniV2Factory, zrx, weth);
                const uniswapV2Subcall = getUniswapV2MultiHopSubcall([await zrx.getAddress(), await weth.getAddress()]);
                await mintToAsync(zrx, taker, sellAmount);

                const tx = multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexMultiHopSellTokenForEth([await zrx.getAddress(), await dai.getAddress()],
                        [uniswapV2Subcall],
                        sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                return expect(tx).to.be.revertedWith('MultiplexFeature::multiplexMultiHopSellTokenForEth/NOT_WETH');
            });
            it('UniswapV2 -> LiquidityProvider', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const buyAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const uniswap = await createUniswapV2PoolAsync(uniV2Factory, dai, shib);
                const uniswapV2Subcall = getUniswapV2MultiHopSubcall([await dai.getAddress(), await shib.getAddress()]);
                const liquidityProviderSubcall = getLiquidityProviderMultiHopSubcall();
                await mintToAsync(dai, taker, sellAmount);
                await mintToAsync(weth, await liquidityProvider.getAddress(), buyAmount);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexMultiHopSellTokenForEth([await dai.getAddress(), await shib.getAddress(), await weth.getAddress()],
                        [uniswapV2Subcall, liquidityProviderSubcall],
                        sellAmount,
                        buyAmount,
                    );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniswap.getAddress(),
                            value: sellAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await uniswap.getAddress(),
                            to: await liquidityProvider.getAddress(),
                        },
                        {
                            token: await weth.getAddress(),
                            from: await liquidityProvider.getAddress(),
                            to: await zeroEx.getAddress(),
                            value: buyAmount,
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress(), value: buyAmount }], TestWethEvents.Withdrawal);
            });
            it('LiquidityProvider -> Sushiswap', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const shibAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const liquidityProviderSubcall = getLiquidityProviderMultiHopSubcall();
                const sushiswap = await createUniswapV2PoolAsync(sushiFactory, shib, weth);
                const sushiswapSubcall = getUniswapV2MultiHopSubcall([await shib.getAddress(), await weth.getAddress()], true);
                await mintToAsync(dai, taker, sellAmount);
                await mintToAsync(shib, await liquidityProvider.getAddress(), shibAmount);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexMultiHopSellTokenForEth([await dai.getAddress(), await shib.getAddress(), await weth.getAddress()],
                        [liquidityProviderSubcall, sushiswapSubcall],
                        sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await liquidityProvider.getAddress(),
                            value: sellAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await liquidityProvider.getAddress(),
                            to: await sushiswap.getAddress(),
                            value: shibAmount,
                        },
                        {
                            token: await weth.getAddress(),
                            from: await sushiswap.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress() }], TestWethEvents.Withdrawal);
            });
            it('UniswapV3 -> BatchSell(RFQ, UniswapV2)', async () => {
                const sellAmount = getRandomInteger(1, toBaseUnitAmount(1));
                const uniV3 = await createUniswapV3PoolAsync(dai, shib);
                const uniV3Subcall = getUniswapV3MultiHopSubcall([dai, shib]);
                const rfqOrder = getTestRfqOrder({ takerToken: await shib.getAddress(), makerToken: await weth.getAddress() });
                const rfqFillProportion = 0.42;
                const rfqSubcall = await getRfqSubcallAsync(rfqOrder, encodeFractionalFillAmount(rfqFillProportion));
                const uniV2 = await createUniswapV2PoolAsync(uniV2Factory, shib, weth);
                const uniV2Subcall = getUniswapV2BatchSubcall(
                    [await shib.getAddress(), await weth.getAddress()],
                    encodeFractionalFillAmount(1),
                );
                const nestedBatchSellSubcall = getNestedBatchSellSubcall([rfqSubcall, uniV2Subcall]);
                await mintToAsync(dai, taker, sellAmount);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexMultiHopSellTokenForEth([await dai.getAddress(), await shib.getAddress(), await weth.getAddress()],
                        [uniV3Subcall, nestedBatchSellSubcall],
                        sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await shib.getAddress(),
                            from: await uniV3.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniV3.getAddress(),
                            value: sellAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: maker,
                        },
                        {
                            token: await weth.getAddress(),
                            from: maker,
                            to: await zeroEx.getAddress(),
                        },
                        {
                            token: await shib.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await uniV2.getAddress(),
                        },
                        {
                            token: await weth.getAddress(),
                            from: await uniV2.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress() }], TestWethEvents.Withdrawal);
            });
            it('BatchSell(RFQ, UniswapV2) -> UniswapV3', async () => {
                const rfqOrder = getTestRfqOrder({ takerToken: await dai.getAddress(), makerToken: await shib.getAddress() });
                const rfqSubcall = await getRfqSubcallAsync(rfqOrder, rfqOrder.takerAmount);
                const uniV2 = await createUniswapV2PoolAsync(uniV2Factory, dai, shib);
                const uniV2Subcall = getUniswapV2BatchSubcall([await dai.getAddress(), await shib.getAddress()]);
                const sellAmount = rfqSubcall.sellAmount + uniV2Subcall.sellAmount;
                const nestedBatchSellSubcall = getNestedBatchSellSubcall([rfqSubcall, uniV2Subcall]);
                await mintToAsync(dai, taker, sellAmount);
                const uniV3 = await createUniswapV3PoolAsync(shib, weth);
                const uniV3Subcall = getUniswapV3MultiHopSubcall([shib, weth]);

                const tx = await multiplex
                    .connect(await env.provider.getSigner(taker))

                    .multiplexMultiHopSellTokenForEth([await dai.getAddress(), await shib.getAddress(), await weth.getAddress()],
                        [nestedBatchSellSubcall, uniV3Subcall],
                        sellAmount,
                        constants.ZERO_AMOUNT,
                    );
                verifyEventsFromLogs<TransferEvent>(
                    tx.logs,
                    [
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: maker,
                            value: rfqOrder.takerAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: maker,
                            to: await zeroEx.getAddress(),
                            value: rfqOrder.makerAmount,
                        },
                        {
                            token: await dai.getAddress(),
                            from: taker,
                            to: await uniV2.getAddress(),
                            value: uniV2Subcall.sellAmount,
                        },
                        {
                            token: await shib.getAddress(),
                            from: await uniV2.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                        {
                            token: await weth.getAddress(),
                            from: await uniV3.getAddress(),
                            to: await zeroEx.getAddress(),
                        },
                        {
                            token: await shib.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: await uniV3.getAddress(),
                        },
                    ],
                    TestMintableERC20TokenEvents.Transfer,
                );
                verifyEventsFromLogs(tx.logs, [{ owner: await zeroEx.getAddress() }], TestWethEvents.Withdrawal);
            });
        });
    });
});
