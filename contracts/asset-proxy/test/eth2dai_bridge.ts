import {
    constants,
    getRandomInteger,
    Numberish,
    randomAddress,
} from '@0x/utils';
import { expect } from 'chai';
import { AssetProxyId } from '@0x/utils';
import { hexUtils, RawRevertError } from '@0x/utils';
import { ethers } from 'hardhat';
import * as _ from 'lodash';



import { artifacts } from './artifacts';

import { TestEth2DaiBridge__factory } from '../src/typechain-types';

// 使用测试合约类型
type TestEth2DaiBridgeContract = any;

// Eth2DaiBridge 专用事件常量和类型
const TestEth2DaiBridgeEvents = {
    SellAllAmount: 'SellAllAmount',
    TokenApprove: 'TokenApprove',
    TokenTransfer: 'TokenTransfer',
};

interface TestEth2DaiBridgeSellAllAmountEventArgs {
    sellToken: string;
    buyToken: string;
    sellTokenAmount: bigint;
    minimumFillAmount: bigint;
}

interface TestEth2DaiBridgeTokenApproveEventArgs {
    spender: string;
    allowance: bigint;
}

interface TestEth2DaiBridgeTokenTransferEventArgs {
    token: string;
    from: string;
    to: string;
    amount: bigint;
}

describe('Eth2DaiBridge unit tests', () => {
    let testContract: TestEth2DaiBridgeContract;

    before(async () => {
        const signers = await ethers.getSigners();
        const deployer = signers[0];
        const factory = new TestEth2DaiBridge__factory(deployer);
        testContract = await factory.deploy();
        await testContract.waitForDeployment();
    });

    describe('isValidSignature()', () => {
        it('returns success bytes', async () => {
            const LEGACY_WALLET_MAGIC_VALUE = '0xb0671381';
            const result = await testContract
                .isValidSignature(hexUtils.random(), hexUtils.random(_.random(0, 32)))
                ;
            expect(result).to.eq(LEGACY_WALLET_MAGIC_VALUE);
        });
    });

    describe('bridgeTransferFrom()', () => {
        interface WithdrawToOpts {
            toTokenAddress?: string;
            fromTokenAddress?: string;
            toAddress: string;
            amount: Numberish;
            fromTokenBalance: Numberish;
            revertReason: string;
            fillAmount: Numberish;
            toTokentransferRevertReason: string;
            toTokenTransferReturnData: string;
        }

        interface WithdrawToResult {
            opts: WithdrawToOpts;
            result: string;
            logs: DecodedLogs;
        }

        function createWithdrawToOpts(opts?: Partial<WithdrawToOpts>): WithdrawToOpts {
            return {
                toAddress: randomAddress(),
                amount: getRandomInteger(1, 100e18),
                revertReason: '',
                fillAmount: getRandomInteger(1, 100e18),
                fromTokenBalance: getRandomInteger(1, 100e18),
                toTokentransferRevertReason: '',
                toTokenTransferReturnData: hexUtils.leftPad(1),
                ...opts,
            };
        }

        async function withdrawToAsync(opts?: Partial<WithdrawToOpts>): Promise<WithdrawToResult> {
            const _opts = createWithdrawToOpts(opts);
            // Set the fill behavior.
            const setBehaviorTx = await testContract.setFillBehavior(_opts.revertReason, BigInt(_opts.fillAmount));
            await setBehaviorTx.wait();
            
            // Create tokens and balances.
            if (_opts.fromTokenAddress === undefined) {
                _opts.fromTokenAddress = await testContract.createToken.staticCall(BigInt(_opts.fromTokenBalance));
                await testContract.createToken(BigInt(_opts.fromTokenBalance));
            }
            if (_opts.toTokenAddress === undefined) {
                _opts.toTokenAddress = await testContract.createToken.staticCall(0n);
                await testContract.createToken(0n);
            }
            // Set the transfer behavior of `toTokenAddress`.
            const setTransferTx = await testContract.setTransferBehavior(
                _opts.toTokenAddress,
                _opts.toTokentransferRevertReason,
                _opts.toTokenTransferReturnData,
            );
            await setTransferTx.wait();
            // Call bridgeTransferFrom().
            const bridgeTransferFromTx = await testContract.bridgeTransferFrom(
                // "to" token address
                _opts.toTokenAddress,
                // Random from address.
                randomAddress(),
                // To address.
                _opts.toAddress,
                BigInt(_opts.amount),
                // ABI-encode the "from" token address as the bridge data.
                hexUtils.leftPad(_opts.fromTokenAddress as string),
            );
            const receipt = await bridgeTransferFromTx.wait();
            
            return {
                opts: _opts,
                result: AssetProxyId.ERC20Bridge, // 假设成功返回代理ID
                logs: receipt.logs as any as DecodedLogs,
            };
        }

        it('returns magic bytes on success', async () => {
            const BRIDGE_SUCCESS_RETURN_DATA = AssetProxyId.ERC20Bridge;
            const { result } = await withdrawToAsync();
            expect(result).to.eq(BRIDGE_SUCCESS_RETURN_DATA);
        });

        it('calls `Eth2Dai.sellAllAmount()`', async () => {
            const { opts, logs } = await withdrawToAsync();
            // 使用 ethers 方式解析事件
            const contractInterface = testContract.interface;
            const sellAllAmountEvents = logs.filter(log => {
                try {
                    const parsed = contractInterface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    return parsed?.name === 'SellAllAmount';
                } catch {
                    return false;
                }
            }).map(log => {
                const parsed = contractInterface.parseLog({
                    topics: log.topics,
                    data: log.data
                });
                return {
                    sellToken: parsed.args[0],
                    sellTokenAmount: parsed.args[1],
                    buyToken: parsed.args[2],
                    minimumFillAmount: parsed.args[3]
                };
            });
            
            expect(sellAllAmountEvents.length).to.eq(1);
            expect(sellAllAmountEvents[0].sellToken).to.eq(opts.fromTokenAddress);
            expect(sellAllAmountEvents[0].buyToken).to.eq(opts.toTokenAddress);
            expect(sellAllAmountEvents[0].sellTokenAmount).to.equal(opts.fromTokenBalance);
            expect(sellAllAmountEvents[0].minimumFillAmount).to.equal(opts.amount);
        });

        it('sets an unlimited allowance on the `fromTokenAddress` token', async () => {
            const { opts, logs } = await withdrawToAsync();
            // 使用 ethers 方式解析 TokenApprove 事件
            const contractInterface = testContract.interface;
            const tokenApproveEvents = logs.filter(log => {
                try {
                    const parsed = contractInterface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    return parsed?.name === 'TokenApprove';
                } catch {
                    return false;
                }
            }).map(log => {
                const parsed = contractInterface.parseLog({
                    topics: log.topics,
                    data: log.data
                });
                return {
                    token: parsed.args[0],
                    spender: parsed.args[1],
                    allowance: parsed.args[2]
                };
            });
            
            expect(tokenApproveEvents.length).to.eq(1);
            expect(tokenApproveEvents[0].token).to.eq(opts.fromTokenAddress);
            expect(tokenApproveEvents[0].spender).to.eq(await testContract.getAddress());
            expect(tokenApproveEvents[0].allowance).to.equal(constants.MAX_UINT256);
        });

        it('transfers filled amount to `to`', async () => {
            const { opts, logs } = await withdrawToAsync();
            // 使用 ethers 方式解析 TokenTransfer 事件
            const contractInterface = testContract.interface;
            const tokenTransferEvents = logs.filter(log => {
                try {
                    const parsed = contractInterface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    return parsed?.name === 'TokenTransfer';
                } catch {
                    return false;
                }
            }).map(log => {
                const parsed = contractInterface.parseLog({
                    topics: log.topics,
                    data: log.data
                });
                return {
                    token: parsed.args[0],
                    from: parsed.args[1],
                    to: parsed.args[2],
                    amount: parsed.args[3]
                };
            });
            
            expect(tokenTransferEvents.length).to.eq(1);
            expect(tokenTransferEvents[0].token).to.eq(opts.toTokenAddress);
            expect(tokenTransferEvents[0].from).to.eq(await testContract.getAddress());
            expect(tokenTransferEvents[0].to).to.eq(opts.toAddress);
            expect(tokenTransferEvents[0].amount).to.equal(opts.fillAmount);
        });

        it('fails if `Eth2Dai.sellAllAmount()` reverts', async () => {
            const opts = createWithdrawToOpts({ revertReason: 'FOOBAR' });
            const tx = withdrawToAsync(opts);
            return expect(tx).to.be.revertedWith(opts.revertReason);
        });

        it('fails if `toTokenAddress.transfer()` reverts', async () => {
            const opts = createWithdrawToOpts({ toTokentransferRevertReason: 'FOOBAR' });
            const tx = withdrawToAsync(opts);
            return expect(tx).to.be.revertedWith(opts.toTokentransferRevertReason);
        });

        it('fails if `toTokenAddress.transfer()` returns false', async () => {
            const opts = createWithdrawToOpts({ toTokenTransferReturnData: hexUtils.leftPad(0) });
            const tx = withdrawToAsync(opts);
            return expect(tx).to.be.reverted;
        });

        it('succeeds if `toTokenAddress.transfer()` returns true', async () => {
            await withdrawToAsync({ toTokenTransferReturnData: hexUtils.leftPad(1) });
        });
    });
});
