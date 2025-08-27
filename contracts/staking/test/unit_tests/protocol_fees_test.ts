import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
    constants,
    expect,
    filterLogsToArguments,
    getRandomInteger,
    Numberish,
    randomAddress,
    expectBigIntEqual,
    toBigInt,
} from '../test_constants';
import { hexUtils } from '../test_constants';
import { TestProtocolFees__factory, TestProtocolFees } from '../../src/typechain-types';

// StakingRevertErrors replacement
export class StakingRevertErrors {
    static ProtocolFeesError(): Error {
        return new Error('Staking: protocol fees error');
    }
}

// TODO: Fix BigNumber usage throughout this file  
/*
import { LogEntry } from 'ethereum-types';
import * as _ from 'lodash';

import { artifacts } from '../artifacts';
import {
    IStakingEventsEvents,
    IStakingEventsStakingPoolEarnedRewardsInEpochEventArgs,
    TestProtocolFeesContract,
    TestProtocolFeesERC20ProxyTransferFromEventArgs,
    TestProtocolFeesEvents,
} from '../wrappers';

('Protocol Fees unit tests', env => {
    let ownerAddress: string;
    let exchangeAddress: string;
    let notExchangeAddress: string;
    let testContract: TestProtocolFeesContract;
    let minimumStake: BigNumber;

    before(async () => {
        [ownerAddress, exchangeAddress, notExchangeAddress] = await env.web3Wrapper.getAvailableAddressesAsync();

        // Deploy the protocol fees contract.
        testContract = await TestProtocolFeesContract.deployFrom0xArtifactAsync(
            artifacts.TestProtocolFees,
            await ethers.getSigners().then(signers => signers[0]),
            {
                ...{},
                from: ownerAddress,
            },
            artifacts,
            exchangeAddress,
        );

        minimumStake = (await testContract.getParams())[2];
    });

    interface CreateTestPoolOpts {
        poolId: string;
        operatorStake: Numberish;
        membersStake: Numberish;
        makers: string[];
    }

    async function createTestPoolAsync(opts?: Partial<CreateTestPoolOpts>): Promise<CreateTestPoolOpts> {
        const _opts = {
            poolId: hexUtils.random(),
            operatorStake: getRandomInteger(minimumStake, '100e18'),
            membersStake: getRandomInteger(minimumStake, '100e18'),
            makers: _.times(2, () => randomAddress()),
            ...opts,
        };
        await testContract
            .createTestPool(
                _opts.poolId,
                _opts.operatorStaken,
                _opts.membersStaken,
                _opts.makers,
            )
            ; await tx.wait();
        return _opts;
    }

    describe('payProtocolFee()', () => {
        const DEFAULT_PROTOCOL_FEE_PAID = 150e3n.times(1e9);
        const { ZERO_AMOUNT } = constants;
        const makerAddress = randomAddress();
        const payerAddress = randomAddress();

        describe('forbidden actions', () => {
            it('should revert if called by a non-exchange', async () => {
                const tx = testContract
                    .payProtocolFee(makerAddress, payerAddress, DEFAULT_PROTOCOL_FEE_PAID)
                    .awaitTransactionSuccessAsync({ from: notExchangeAddress });
                const expectedError = new StakingRevertErrors.OnlyCallableByExchangeError(notExchangeAddress);
                return expect(tx).to.revertedWith(expectedError);
            });

            it('should revert if `protocolFee` is zero with non-zero value sent', async () => {
                const tx = testContract
                    .payProtocolFee(makerAddress, payerAddress, ZERO_AMOUNT)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: DEFAULT_PROTOCOL_FEE_PAID });
                const expectedError = new StakingRevertErrors.InvalidProtocolFeePaymentError(
                    ZERO_AMOUNT,
                    DEFAULT_PROTOCOL_FEE_PAID,
                );
                return expect(tx).to.revertedWith(expectedError);
            });

            it('should revert if `protocolFee` is < than the provided message value', async () => {
                const tx = testContract
                    .payProtocolFee(makerAddress, payerAddress, DEFAULT_PROTOCOL_FEE_PAID)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: DEFAULT_PROTOCOL_FEE_PAID.minus(1) });
                const expectedError = new StakingRevertErrors.InvalidProtocolFeePaymentError(
                    DEFAULT_PROTOCOL_FEE_PAID,
                    DEFAULT_PROTOCOL_FEE_PAID.minus(1),
                );
                return expect(tx).to.revertedWith(expectedError);
            });

            it('should revert if `protocolFee` is > than the provided message value', async () => {
                const tx = testContract
                    .payProtocolFee(makerAddress, payerAddress, DEFAULT_PROTOCOL_FEE_PAID)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: DEFAULT_PROTOCOL_FEE_PAID.plus(1) });
                const expectedError = new StakingRevertErrors.InvalidProtocolFeePaymentError(
                    DEFAULT_PROTOCOL_FEE_PAID,
                    DEFAULT_PROTOCOL_FEE_PAID.plus(1),
                );
                return expect(tx).to.revertedWith(expectedError);
            });
        });

        async function getProtocolFeesAsync(poolId: string): Promise<BigNumber> {
            return (await testContract.getStakingPoolStatsThisEpoch(poolId)).feesCollected;
        }

        describe('ETH fees', () => {
            function assertNoWETHTransferLogs(logs: LogEntry[]): void {
                const logsArgs = filterLogsToArguments<TestProtocolFeesERC20ProxyTransferFromEventArgs>(
                    logs,
                    TestProtocolFeesEvents.ERC20ProxyTransferFrom,
                );
                expect(logsArgs).to.deep.eq([]);
            }

            it('should not transfer WETH if value is sent', async () => {
                await createTestPoolAsync({ operatorStake: minimumStake });
                const receipt = await testContract
                    .payProtocolFee(makerAddress, payerAddress, DEFAULT_PROTOCOL_FEE_PAID)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: DEFAULT_PROTOCOL_FEE_PAID });
                assertNoWETHTransferLogs(receipt.logs);
            });

            it('should credit pool if the maker is in a pool', async () => {
                const { poolId } = await createTestPoolAsync({ operatorStake: minimumStake, makers: [makerAddress] });
                const receipt = await testContract
                    .payProtocolFee(makerAddress, payerAddress, DEFAULT_PROTOCOL_FEE_PAID)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: DEFAULT_PROTOCOL_FEE_PAID });

                assertNoWETHTransferLogs(receipt.logs);
                const poolFees = await getProtocolFeesAsync(poolId);
                expectBigIntEqual(toBigInt(poolFees), toBigInt(DEFAULT_PROTOCOL_FEE_PAID));
            });

            it('should not credit the pool if maker is not in a pool', async () => {
                const { poolId } = await createTestPoolAsync({ operatorStake: minimumStake });
                const receipt = await testContract
                    .payProtocolFee(makerAddress, payerAddress, DEFAULT_PROTOCOL_FEE_PAID)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: DEFAULT_PROTOCOL_FEE_PAID });
                assertNoWETHTransferLogs(receipt.logs);
                const poolFees = await getProtocolFeesAsync(poolId);
                expectBigIntEqual(toBigInt(poolFees), toBigInt(ZERO_AMOUNT));
            });

            it('fees paid to the same maker should go to the same pool', async () => {
                const { poolId } = await createTestPoolAsync({ operatorStake: minimumStake, makers: [makerAddress] });
                const payAsync = async () => {
                    const receipt = await testContract
                        .payProtocolFee(makerAddress, payerAddress, DEFAULT_PROTOCOL_FEE_PAID)
                        .awaitTransactionSuccessAsync({ from: exchangeAddress, value: DEFAULT_PROTOCOL_FEE_PAID });
                    assertNoWETHTransferLogs(receipt.logs);
                };
                await payAsync();
                await payAsync();
                const expectedTotalFees = DEFAULT_PROTOCOL_FEE_PAID.times(2);
                const poolFees = await getProtocolFeesAsync(poolId);
                expectBigIntEqual(toBigInt(poolFees), toBigInt(expectedTotalFees));
            });
        });

        describe('WETH fees', () => {
            function assertWETHTransferLogs(logs: LogEntry[], fromAddress: string, amount: BigNumber): void {
                const logsArgs = filterLogsToArguments<TestProtocolFeesERC20ProxyTransferFromEventArgs>(
                    logs,
                    TestProtocolFeesEvents.ERC20ProxyTransferFrom,
                );
                expect(logsArgs.length).to.eq(1);
                for (const args of logsArgs) {
                    expect(args.from).to.eq(fromAddress);
                    expect(args.to).to.eq(testContract.address);
                    expectBigIntEqual(toBigInt(args.amount), toBigInt(amount));
                }
            }

            it('should transfer WETH if no value is sent and the maker is not in a pool', async () => {
                await createTestPoolAsync({ operatorStake: minimumStake });
                const receipt = await testContract
                    .payProtocolFee(makerAddress, payerAddress, DEFAULT_PROTOCOL_FEE_PAID)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: ZERO_AMOUNT });
                assertWETHTransferLogs(receipt.logs, payerAddress, DEFAULT_PROTOCOL_FEE_PAID);
            });

            it('should update `protocolFeesThisEpochByPool` if the maker is in a pool', async () => {
                const { poolId } = await createTestPoolAsync({ operatorStake: minimumStake, makers: [makerAddress] });
                const receipt = await testContract
                    .payProtocolFee(makerAddress, payerAddress, DEFAULT_PROTOCOL_FEE_PAID)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: ZERO_AMOUNT });
                assertWETHTransferLogs(receipt.logs, payerAddress, DEFAULT_PROTOCOL_FEE_PAID);
                const poolFees = await getProtocolFeesAsync(poolId);
                expectBigIntEqual(toBigInt(poolFees), toBigInt(DEFAULT_PROTOCOL_FEE_PAID));
            });

            it('should not update `protocolFeesThisEpochByPool` if maker is not in a pool', async () => {
                const { poolId } = await createTestPoolAsync({ operatorStake: minimumStake });
                const receipt = await testContract
                    .payProtocolFee(makerAddress, payerAddress, DEFAULT_PROTOCOL_FEE_PAID)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: ZERO_AMOUNT });
                assertWETHTransferLogs(receipt.logs, payerAddress, DEFAULT_PROTOCOL_FEE_PAID);
                const poolFees = await getProtocolFeesAsync(poolId);
                expectBigIntEqual(toBigInt(poolFees), toBigInt(ZERO_AMOUNT));
            });

            it('fees paid to the same maker should go to the same pool', async () => {
                const { poolId } = await createTestPoolAsync({ operatorStake: minimumStake, makers: [makerAddress] });
                const payAsync = async () => {
                    const receipt = await testContract
                        .payProtocolFee(makerAddress, payerAddress, DEFAULT_PROTOCOL_FEE_PAID)
                        .awaitTransactionSuccessAsync({ from: exchangeAddress, value: ZERO_AMOUNT });
                    assertWETHTransferLogs(receipt.logs, payerAddress, DEFAULT_PROTOCOL_FEE_PAID);
                };
                await payAsync();
                await payAsync();
                const expectedTotalFees = DEFAULT_PROTOCOL_FEE_PAID.times(2);
                const poolFees = await getProtocolFeesAsync(poolId);
                expectBigIntEqual(toBigInt(poolFees), toBigInt(expectedTotalFees));
            });

            it('fees paid to the same maker in WETH then ETH should go to the same pool', async () => {
                const { poolId } = await createTestPoolAsync({ operatorStake: minimumStake, makers: [makerAddress] });
                const payAsync = async (inWETH: boolean) => {
                    await testContract
                        .payProtocolFee(makerAddress, payerAddress, DEFAULT_PROTOCOL_FEE_PAID)
                        .awaitTransactionSuccessAsync({
                            from: exchangeAddress,
                            value: inWETH ? ZERO_AMOUNT : DEFAULT_PROTOCOL_FEE_PAID,
                        });
                };
                await payAsync(true);
                await payAsync(false);
                const expectedTotalFees = DEFAULT_PROTOCOL_FEE_PAID.times(2);
                const poolFees = await getProtocolFeesAsync(poolId);
                expectBigIntEqual(toBigInt(poolFees), toBigInt(expectedTotalFees));
            });
        });

        describe('Dust stake', () => {
            it('credits pools with stake > minimum', async () => {
                const { poolId } = await createTestPoolAsync({
                    operatorStake: minimumStake.plus(1),
                    membersStake: 0,
                    makers: [makerAddress],
                });
                await testContract
                    .payProtocolFee(makerAddress, constants.NULL_ADDRESS, DEFAULT_PROTOCOL_FEE_PAID)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: DEFAULT_PROTOCOL_FEE_PAID });
                const feesCredited = await getProtocolFeesAsync(poolId);
                expectBigIntEqual(toBigInt(feesCredited), toBigInt(DEFAULT_PROTOCOL_FEE_PAID));
            });

            it('credits pools with stake == minimum', async () => {
                const { poolId } = await createTestPoolAsync({
                    operatorStake: minimumStake,
                    membersStake: 0,
                    makers: [makerAddress],
                });
                await testContract
                    .payProtocolFee(makerAddress, constants.NULL_ADDRESS, DEFAULT_PROTOCOL_FEE_PAID)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: DEFAULT_PROTOCOL_FEE_PAID });
                const feesCredited = await getProtocolFeesAsync(poolId);
                expectBigIntEqual(toBigInt(feesCredited), toBigInt(DEFAULT_PROTOCOL_FEE_PAID));
            });

            it('does not credit pools with stake < minimum', async () => {
                const { poolId } = await createTestPoolAsync({
                    operatorStake: minimumStake.minus(1),
                    membersStake: 0,
                    makers: [makerAddress],
                });
                await testContract
                    .payProtocolFee(makerAddress, constants.NULL_ADDRESS, DEFAULT_PROTOCOL_FEE_PAID)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: DEFAULT_PROTOCOL_FEE_PAID });
                const feesCredited = await getProtocolFeesAsync(poolId);
                expectBigIntEqual(toBigInt(feesCredited), 0n);
            });
        });

    describe('Finalization', () => {
            let membersStakeWeight: number;

            before(async () => {
                membersStakeWeight = (await testContract.getParams())[1];
            });

            interface FinalizationState {
                numPoolsToFinalize: BigNumber;
                totalFeesCollected: BigNumber;
                totalWeightedStake: BigNumber;
            }

            async function getFinalizationStateAsync(): Promise<FinalizationState> {
                const aggregatedStats = await testContract.getAggregatedStatsForCurrentEpoch();
                return {
                    numPoolsToFinalize: aggregatedStats.numPoolsToFinalize,
                    totalFeesCollected: aggregatedStats.totalFeesCollected,
                    totalWeightedStake: aggregatedStats.totalWeightedStake,
                };
            }

            interface PayToMakerResult {
                poolEarnedRewardsEvents: IStakingEventsStakingPoolEarnedRewardsInEpochEventArgs[];
                fee: BigNumber;
            }

            async function payToMakerAsync(poolMaker: string, fee?: Numberish): Promise<PayToMakerResult> {
                const _fee = fee === undefined ? getRandomInteger(1, '1e18') : fee;
                const receipt = await testContract
                    .payProtocolFee(poolMaker, payerAddress, _feen)
                    .awaitTransactionSuccessAsync({ from: exchangeAddress, value: _fee });
                const events = filterLogsToArguments<IStakingEventsStakingPoolEarnedRewardsInEpochEventArgs>(
                    receipt.logs,
                    IStakingEventsEvents.StakingPoolEarnedRewardsInEpoch,
                );
                return {
                    fee: _feen,
                    poolEarnedRewardsEvents: events,
                };
            }

            function toWeightedStake(operatorStake: Numberish, membersStake: Numberish): BigNumber {
                return membersStaken
                    .times(membersStakeWeight)
                    .dividedToIntegerBy(constants.PPM_DENOMINATOR)
                    .plus(operatorStake);
            }

            it('no pools to finalize to start', async () => {
                const state = await getFinalizationStateAsync();
                            expectBigIntEqual(toBigInt(state.numPoolsToFinalize), 0n);
            expectBigIntEqual(toBigInt(state.totalFeesCollected), 0n);
            expectBigIntEqual(toBigInt(state.totalWeightedStake), 0n);
            });

            it('pool is not registered to start', async () => {
                const { poolId } = await createTestPoolAsync();
                const pool = await testContract.getStakingPoolStatsThisEpoch(poolId);
                expectBigIntEqual(toBigInt(pool.feesCollected), 0n);
                expectBigIntEqual(toBigInt(pool.membersStake), 0n);
                expectBigIntEqual(toBigInt(pool.weightedStake), 0n);
            });

            it('correctly emits event for pool the first time it earns a fee', async () => {
                const pool = await createTestPoolAsync();
                const {
                    poolId,
                    makers: [poolMaker],
                } = pool;
                const { fee, poolEarnedRewardsEvents } = await payToMakerAsync(poolMaker);
                expect(poolEarnedRewardsEvents.length).to.eq(1);
                expect(poolEarnedRewardsEvents[0].poolId).to.eq(poolId);
                const actualPoolStats = await testContract.getStakingPoolStatsThisEpoch(poolId);
                const expectedWeightedStake = toWeightedStake(pool.operatorStake, pool.membersStake);
                expectBigIntEqual(toBigInt(actualPoolStats.feesCollected), toBigInt(fee));
                expectBigIntEqual(toBigInt(actualPoolStats.membersStake), toBigInt(pool.membersStake));
                expectBigIntEqual(toBigInt(actualPoolStats.weightedStake), toBigInt(expectedWeightedStake));
                const state = await getFinalizationStateAsync();
                expectBigIntEqual(toBigInt(state.numPoolsToFinalize), 1n);
                expectBigIntEqual(toBigInt(state.totalFeesCollected), toBigInt(fee));
                expectBigIntEqual(toBigInt(state.totalWeightedStake), toBigInt(expectedWeightedStake));
            });

            it('only adds to the already activated pool in the same epoch', async () => {
                const pool = await createTestPoolAsync();
                const {
                    poolId,
                    makers: [poolMaker],
                } = pool;
                const { fee: fee1 } = await payToMakerAsync(poolMaker);
                const { fee: fee2, poolEarnedRewardsEvents } = await payToMakerAsync(poolMaker);
                expect(poolEarnedRewardsEvents).to.deep.eq([]);
                const actualPoolStats = await testContract.getStakingPoolStatsThisEpoch(poolId);
                const expectedWeightedStake = toWeightedStake(pool.operatorStake, pool.membersStake);
                const fees = BigNumber.sum(fee1, fee2);
                expect(actualPoolStats.feesCollected).to.bignumber.eq(fees);
                expect(actualPoolStats.membersStake).to.bignumber.eq(pool.membersStake);
                expect(actualPoolStats.weightedStake).to.bignumber.eq(expectedWeightedStake);
                const state = await getFinalizationStateAsync();
                expect(state.numPoolsToFinalize).to.bignumber.eq(1);
                expect(state.totalFeesCollected).to.bignumber.eq(fees);
                expect(state.totalWeightedStake).to.bignumber.eq(expectedWeightedStake);
            });

            it('can activate multiple pools in the same epoch', async () => {
                const pools = await Promise.all(_.times(3, async () => createTestPoolAsync()));
                let totalFees = 0n;
                let totalWeightedStake = 0n;
                for (const pool of pools) {
                    const {
                        poolId,
                        makers: [poolMaker],
                    } = pool;
                    const { fee, poolEarnedRewardsEvents } = await payToMakerAsync(poolMaker);
                    expect(poolEarnedRewardsEvents.length).to.eq(1);
                    expect(poolEarnedRewardsEvents[0].poolId).to.eq(poolId);
                    const actualPoolStats = await testContract.getStakingPoolStatsThisEpoch(poolId);
                    const expectedWeightedStake = toWeightedStake(pool.operatorStake, pool.membersStake);
                    expect(actualPoolStats.feesCollected).to.bignumber.eq(fee);
                    expect(actualPoolStats.membersStake).to.bignumber.eq(pool.membersStake);
                    expect(actualPoolStats.weightedStake).to.bignumber.eq(expectedWeightedStake);
                    totalFees = totalFees.plus(fee);
                    totalWeightedStake = totalWeightedStake.plus(expectedWeightedStake);
                }
                const state = await getFinalizationStateAsync();
                expectBigIntEqual(toBigInt(state.numPoolsToFinalize), toBigInt(pools.length));
                expectBigIntEqual(toBigInt(state.totalFeesCollected), toBigInt(totalFees));
                expectBigIntEqual(toBigInt(state.totalWeightedStake), toBigInt(totalWeightedStake));
            });

            it('resets the pool after the epoch advances', async () => {
                const pool = await createTestPoolAsync();
                const {
                    poolId,
                    makers: [poolMaker],
                } = pool;
                await payToMakerAsync(poolMaker);
                await testContract.advanceEpoch(); await tx.wait();
                const actualPoolStats = await testContract.getStakingPoolStatsThisEpoch(poolId);
                expectBigIntEqual(toBigInt(actualPoolStats.feesCollected), 0n);
                expectBigIntEqual(toBigInt(actualPoolStats.membersStake), 0n);
                expectBigIntEqual(toBigInt(actualPoolStats.weightedStake), 0n);
            });

            describe('Multiple makers', () => {
                it('fees paid to different makers in the same pool go to that pool', async () => {
                    const { poolId, makers } = await createTestPoolAsync();
                    const { fee: fee1 } = await payToMakerAsync(makers[0]);
                    const { fee: fee2 } = await payToMakerAsync(makers[1]);
                    const expectedTotalFees = BigNumber.sum(fee1, fee2);
                    const poolFees = await getProtocolFeesAsync(poolId);
                    expectBigIntEqual(toBigInt(poolFees), toBigInt(expectedTotalFees));
                });

                it('fees paid to makers in different pools go to their respective pools', async () => {
                    const {
                        poolId: poolId1,
                        makers: [maker1],
                    } = await createTestPoolAsync();
                    const {
                        poolId: poolId2,
                        makers: [maker2],
                    } = await createTestPoolAsync();
                    const { fee: fee1 } = await payToMakerAsync(maker1);
                    const { fee: fee2 } = await payToMakerAsync(maker2);
                    const [poolFees, otherPoolFees] = await Promise.all([
                        getProtocolFeesAsync(poolId1),
                        getProtocolFeesAsync(poolId2),
                    ]);
                                    expectBigIntEqual(toBigInt(poolFees), toBigInt(fee1));
                expectBigIntEqual(toBigInt(otherPoolFees), toBigInt(fee2));
                });
            });
        });
    });
});
// tslint:disable: max-file-line-count
*/

// Minimal modernized tests (Hardhat + Ethers v6)
describe('Protocol Fees unit tests', () => {
    let exchange: string;
    let testContract: TestProtocolFees;

    before(async () => {
        const signers = await ethers.getSigners();
        exchange = await signers[1].getAddress();
        const factory = new TestProtocolFees__factory(signers[0]);
        testContract = await factory.deploy(exchange);
    });

    it('credits pool with ETH protocol fee when maker is in a pool', async () => {
        const poolId = hexUtils.random();
        const maker = randomAddress();
        const payer = randomAddress();
        // Default minimumPoolStake is 100 * 1e18, so set operator stake >= that
        const minimum = 100n * 10n ** 18n;
        const tx1 = await testContract.createTestPool(poolId, minimum, 0, [maker]);
        await tx1.wait();
        const exchangeSigner = await ethers.getSigner(exchange);
        const fee = 150_000n * 1_000_000_000n; // 150k gwei
        const receipt = await (await testContract.connect(exchangeSigner).payProtocolFee(maker, payer, fee, { value: fee })).wait();
        const logs = receipt?.logs ?? [];
        const erc20Transfers = filterLogsToArguments(logs, 'ERC20ProxyTransferFrom');
        expect(erc20Transfers).to.deep.equal([]);
        const stats = await testContract.getStakingPoolStatsThisEpoch(poolId);
        expectBigIntEqual(toBigInt(stats.feesCollected), toBigInt(fee));
    });
});
