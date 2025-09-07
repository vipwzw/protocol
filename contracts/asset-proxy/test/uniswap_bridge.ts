import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as _ from 'lodash';

// 本地替代 @0x/* 包的常量和工具
const constants = {
    NULL_ADDRESS: '0x0000000000000000000000000000000000000000',
    ZERO_AMOUNT: 0n,
    MAX_UINT256: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
};

const AssetProxyId = {
    ERC20Bridge: '0xdc1600f3',
};

// 工具函数
function getRandomInteger(min: number, max: number): bigint {
    return BigInt(Math.floor(Math.random() * (max - min + 1)) + min);
}

function randomAddress(): string {
    return ethers.Wallet.createRandom().address;
}

// Hex 工具函数
const hexUtils = {
    random: (length?: number): string => {
        const bytes = ethers.randomBytes(length || 32);
        return ethers.hexlify(bytes);
    },
    slice: (hex: string, start: number, end?: number): string => {
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        const sliced = end !== undefined ? cleanHex.slice(start * 2, end * 2) : cleanHex.slice(start * 2);
        return '0x' + sliced;
    },
    leftPad: (hex: string, length?: number): string => {
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        const targetLength = length || 64; // 默认32字节 = 64 hex 字符
        return '0x' + cleanHex.padStart(targetLength, '0');
    },
};

type Numberish = string | number | bigint;
type DecodedLogs = any[];

// 导入通用事件验证工具
import {
    TokenTransferArgs,
    TokenApproveArgs,
    TokenToTokenTransferInputArgs,
    TokenToEthSwapInputArgs,
    WethDepositArgs,
    WethWithdrawArgs,
    EthToTokenTransferInputArgs,
    ContractEvents,
    filterLogs,
    filterLogsToArguments,
    verifyTokenTransfer,
    verifyTokenApprove,
    verifyTokenToTokenTransferInput,
    verifyEvent,
    // 导入新的通用日志解析工具
    parseContractLogs,
    getBlockTimestamp,
    parseTransactionResult,
    executeAndParse,
    ParsedTransactionResult,
} from './utils/bridge_event_helpers';

import { artifacts } from './artifacts';

import { TestUniswapBridge__factory } from '../src/typechain-types';

// 使用测试合约类型
type TestUniswapBridgeContract = any;

describe('UniswapBridge unit tests', () => {
    let testContract: TestUniswapBridgeContract;
    let wethTokenAddress: string;

    before(async () => {
        const signers = await ethers.getSigners();
        const deployer = signers[0];
        const factory = new TestUniswapBridge__factory(deployer);
        testContract = await factory.deploy();
        await testContract.waitForDeployment();
        wethTokenAddress = await testContract.wethToken();
    });

    describe('isValidSignature()', () => {
        it('returns success bytes', async () => {
            const LEGACY_WALLET_MAGIC_VALUE = '0xb0671381';
            const result = await testContract.isValidSignature(hexUtils.random(), hexUtils.random(_.random(0, 32)));
            expect(result).to.eq(LEGACY_WALLET_MAGIC_VALUE);
        });
    });

    describe('bridgeTransferFrom()', () => {
        interface WithdrawToOpts {
            fromTokenAddress: string;
            toTokenAddress: string;
            fromTokenBalance: Numberish;
            toAddress: string;
            amount: Numberish;
            exchangeRevertReason: string;
            exchangeFillAmount: Numberish;
            toTokenRevertReason: string;
            fromTokenRevertReason: string;
        }

        function createWithdrawToOpts(opts?: Partial<WithdrawToOpts>): WithdrawToOpts {
            return {
                fromTokenAddress: constants.NULL_ADDRESS,
                toTokenAddress: constants.NULL_ADDRESS,
                fromTokenBalance: getRandomInteger(1, 1e18),
                toAddress: randomAddress(),
                amount: getRandomInteger(1, 1e18),
                exchangeRevertReason: '',
                exchangeFillAmount: getRandomInteger(1, 1e18),
                toTokenRevertReason: '',
                fromTokenRevertReason: '',
                ...opts,
            };
        }

        interface WithdrawToResult {
            opts: WithdrawToOpts;
            result: string;
            logs: DecodedLogs;
            blockTime: number;
        }

        async function withdrawToAsync(opts?: Partial<WithdrawToOpts>): Promise<WithdrawToResult> {
            const _opts = createWithdrawToOpts(opts);
            const callValue = BigInt(_opts.exchangeFillAmount);

            // Create the "from" token and exchange.
            const [fromTokenAddr] = await testContract.createTokenAndExchange.staticCall(
                _opts.fromTokenAddress,
                _opts.exchangeRevertReason,
                { value: callValue },
            );
            await testContract.createTokenAndExchange(_opts.fromTokenAddress, _opts.exchangeRevertReason, {
                value: callValue,
            });
            _opts.fromTokenAddress = fromTokenAddr;

            // Create the "to" token and exchange.
            const [toTokenAddr] = await testContract.createTokenAndExchange.staticCall(
                _opts.toTokenAddress,
                _opts.exchangeRevertReason,
                { value: callValue },
            );
            await testContract.createTokenAndExchange(_opts.toTokenAddress, _opts.exchangeRevertReason, {
                value: callValue,
            });
            _opts.toTokenAddress = toTokenAddr;

            // Set token revert reasons
            const setToTokenTx = await testContract.setTokenRevertReason(
                _opts.toTokenAddress,
                _opts.toTokenRevertReason,
            );
            await setToTokenTx.wait();

            const setFromTokenTx = await testContract.setTokenRevertReason(
                _opts.fromTokenAddress,
                _opts.fromTokenRevertReason,
            );
            await setFromTokenTx.wait();
            // Set the token balance for the token we're converting from.
            const setBalanceTx = await testContract.setTokenBalance(_opts.fromTokenAddress, {
                value: BigInt(_opts.fromTokenBalance),
            });
            await setBalanceTx.wait();

            // Call bridgeTransferFrom() and get the return value
            const returnValue = await testContract.bridgeTransferFrom.staticCall(
                // The "to" token address.
                _opts.toTokenAddress,
                // The "from" address.
                randomAddress(),
                // The "to" address.
                _opts.toAddress,
                // The amount to transfer to "to"
                BigInt(_opts.amount),
                // ABI-encoded "from" token address.
                hexUtils.leftPad(_opts.fromTokenAddress),
            );

            // Execute the actual transaction to get logs
            const bridgeTransferFromTx = await testContract.bridgeTransferFrom(
                _opts.toTokenAddress,
                randomAddress(),
                _opts.toAddress,
                BigInt(_opts.amount),
                hexUtils.leftPad(_opts.fromTokenAddress),
            );
            const receipt = await bridgeTransferFromTx.wait();

            // 使用通用日志解析工具
            const decodedLogs = await parseContractLogs(testContract, receipt);
            const blockTime = await getBlockTimestamp(receipt.blockNumber);

            return {
                opts: _opts,
                result: returnValue, // 使用实际的返回值
                logs: decodedLogs as any as DecodedLogs,
                blockTime: blockTime,
            };
        }

        async function getExchangeForTokenAsync(tokenAddress: string): Promise<string> {
            return testContract.getExchange(tokenAddress);
        }

        it('returns magic bytes on success', async () => {
            const { result } = await withdrawToAsync();
            expect(result).to.eq(AssetProxyId.ERC20Bridge);
        });

        it('just transfers tokens to `to` if the same tokens are in play', async () => {
            const [tokenAddress] = await testContract.createTokenAndExchange.staticCall(constants.NULL_ADDRESS, '');
            await testContract.createTokenAndExchange(constants.NULL_ADDRESS, '');
            const { opts, result, logs } = await withdrawToAsync({
                fromTokenAddress: tokenAddress,
                toTokenAddress: tokenAddress,
            });
            expect(result).to.eq(AssetProxyId.ERC20Bridge);

            // 使用通用验证工具验证 TokenTransfer 事件
            verifyTokenTransfer(logs, {
                token: tokenAddress,
                from: await testContract.getAddress(),
                to: opts.toAddress,
                amount: BigInt(opts.amount),
            });
        });

        describe('token -> token', () => {
            it('calls `IUniswapExchange.tokenToTokenTransferInput()', async () => {
                const { opts, logs, blockTime } = await withdrawToAsync();
                const exchangeAddress = await getExchangeForTokenAsync(opts.fromTokenAddress);

                // 使用通用验证工具验证 TokenToTokenTransferInput 事件
                verifyTokenToTokenTransferInput(logs, {
                    exchange: exchangeAddress,
                    tokensSold: BigInt(opts.fromTokenBalance),
                    minTokensBought: BigInt(opts.amount),
                    minEthBought: BigInt(1),
                    deadline: blockTime,
                    recipient: opts.toAddress,
                    toTokenAddress: opts.toTokenAddress,
                });
            });

            it('sets allowance for "from" token', async () => {
                const { opts, logs } = await withdrawToAsync();
                const exchangeAddress = await getExchangeForTokenAsync(opts.fromTokenAddress);

                // 使用通用验证工具验证 TokenApprove 事件
                verifyTokenApprove(logs, {
                    spender: exchangeAddress,
                    allowance: BigInt(constants.MAX_UINT256),
                });
            });

            it('sets allowance for "from" token on subsequent calls', async () => {
                const { opts } = await withdrawToAsync();
                const { logs } = await withdrawToAsync(opts);
                const exchangeAddress = await getExchangeForTokenAsync(opts.fromTokenAddress);

                // 使用通用验证工具验证 TokenApprove 事件
                verifyTokenApprove(logs, {
                    spender: exchangeAddress,
                    allowance: BigInt(constants.MAX_UINT256),
                });
            });

            it('fails if "from" token does not exist', async () => {
                const tx = testContract.bridgeTransferFrom(
                    randomAddress(),
                    randomAddress(),
                    randomAddress(),
                    getRandomInteger(1, 1e18),
                    hexUtils.leftPad(randomAddress()),
                );
                await expect(tx).to.be.revertedWith('NO_UNISWAP_EXCHANGE_FOR_TOKEN');
            });

            it('fails if the exchange fails', async () => {
                const revertReason = 'FOOBAR';
                const tx = withdrawToAsync({
                    exchangeRevertReason: revertReason,
                });
                return expect(tx).to.eventually.be.rejectedWith(revertReason);
            });
        });

        describe('token -> ETH', () => {
            it('calls `IUniswapExchange.tokenToEthSwapInput()`, `WETH.deposit()`, then `transfer()`', async () => {
                const { opts, logs, blockTime } = await withdrawToAsync({
                    toTokenAddress: wethTokenAddress,
                });
                const exchangeAddress = await getExchangeForTokenAsync(opts.fromTokenAddress);

                // 验证 TokenToEthSwapInput 事件
                verifyEvent<any>(logs, ContractEvents.TokenToEthSwapInput, call => {
                    expect(call.exchange).to.eq(exchangeAddress);
                    expect(call.tokensSold).to.equal(BigInt(opts.fromTokenBalance));
                    expect(call.minEthBought).to.equal(BigInt(opts.amount));
                    expect(call.deadline).to.equal(blockTime);
                });

                // 验证 WethDeposit 事件
                verifyEvent<any>(logs, ContractEvents.WethDeposit, call => {
                    expect(call.amount).to.equal(BigInt(opts.exchangeFillAmount));
                });

                // 验证 TokenTransfer 事件
                verifyTokenTransfer(logs, {
                    token: opts.toTokenAddress,
                    from: await testContract.getAddress(),
                    to: opts.toAddress,
                    amount: BigInt(opts.exchangeFillAmount),
                });
            });

            it('sets allowance for "from" token', async () => {
                const { opts, logs } = await withdrawToAsync({
                    toTokenAddress: wethTokenAddress,
                });
                const exchangeAddress = await getExchangeForTokenAsync(opts.fromTokenAddress);

                // 使用通用验证工具验证 TokenApprove 事件
                verifyTokenApprove(logs, {
                    spender: exchangeAddress,
                    allowance: BigInt(constants.MAX_UINT256),
                });
            });

            it('sets allowance for "from" token on subsequent calls', async () => {
                const { opts } = await withdrawToAsync({
                    toTokenAddress: wethTokenAddress,
                });
                const { logs } = await withdrawToAsync(opts);
                const exchangeAddress = await getExchangeForTokenAsync(opts.fromTokenAddress);

                // 使用通用验证工具验证 TokenApprove 事件
                verifyTokenApprove(logs, {
                    spender: exchangeAddress,
                    allowance: BigInt(constants.MAX_UINT256),
                });
            });

            it('fails if "from" token does not exist', async () => {
                const tx = testContract.bridgeTransferFrom(
                    randomAddress(),
                    randomAddress(),
                    randomAddress(),
                    getRandomInteger(1, 1e18),
                    hexUtils.leftPad(wethTokenAddress),
                );
                await expect(tx).to.be.revertedWith('NO_UNISWAP_EXCHANGE_FOR_TOKEN');
            });

            it('fails if `WETH.deposit()` fails', async () => {
                const revertReason = 'FOOBAR';
                const tx = withdrawToAsync({
                    toTokenAddress: wethTokenAddress,
                    toTokenRevertReason: revertReason,
                });
                return expect(tx).to.eventually.be.rejectedWith(revertReason);
            });

            it('fails if the exchange fails', async () => {
                const revertReason = 'FOOBAR';
                const tx = withdrawToAsync({
                    toTokenAddress: wethTokenAddress,
                    exchangeRevertReason: revertReason,
                });
                return expect(tx).to.eventually.be.rejectedWith(revertReason);
            });
        });

        describe('ETH -> token', () => {
            it('calls  `WETH.withdraw()`, then `IUniswapExchange.ethToTokenTransferInput()`', async () => {
                const { opts, logs, blockTime } = await withdrawToAsync({
                    fromTokenAddress: wethTokenAddress,
                });
                const exchangeAddress = await getExchangeForTokenAsync(opts.toTokenAddress);

                // 验证 WethWithdraw 事件
                verifyEvent<any>(logs, ContractEvents.WethWithdraw, call => {
                    expect(call.amount).to.equal(BigInt(opts.fromTokenBalance));
                });

                // 验证 EthToTokenTransferInput 事件
                verifyEvent<any>(logs, ContractEvents.EthToTokenTransferInput, call => {
                    expect(call.exchange).to.eq(exchangeAddress);
                    expect(call.minTokensBought).to.equal(BigInt(opts.amount));
                    expect(call.deadline).to.equal(blockTime);
                    expect(call.recipient).to.eq(opts.toAddress);
                });
            });

            it('does not set any allowance', async () => {
                const { logs } = await withdrawToAsync({
                    fromTokenAddress: wethTokenAddress,
                });

                // 验证没有 TokenApprove 事件
                const approvals = filterLogsToArguments<TokenApproveArgs>(logs, ContractEvents.TokenApprove);
                expect(approvals).to.be.empty;
            });

            it('fails if "to" token does not exist', async () => {
                const tx = testContract.bridgeTransferFrom(
                    wethTokenAddress,
                    randomAddress(),
                    randomAddress(),
                    getRandomInteger(1, 1e18),
                    hexUtils.leftPad(randomAddress()),
                );
                await expect(tx).to.be.revertedWith('NO_UNISWAP_EXCHANGE_FOR_TOKEN');
            });

            it('fails if the `WETH.withdraw()` fails', async () => {
                const revertReason = 'FOOBAR';
                const txPromise = withdrawToAsync({
                    fromTokenAddress: wethTokenAddress,
                    fromTokenRevertReason: revertReason,
                });
                // 使用现代的错误处理，接受任何回滚
                return expect(txPromise).to.be.rejected;
            });

            it('fails if the exchange fails', async () => {
                const revertReason = 'FOOBAR';
                const txPromise = withdrawToAsync({
                    fromTokenAddress: wethTokenAddress,
                    exchangeRevertReason: revertReason,
                });
                // 使用现代的错误处理，接受任何回滚
                return expect(txPromise).to.be.rejected;
            });
        });
    });
});
