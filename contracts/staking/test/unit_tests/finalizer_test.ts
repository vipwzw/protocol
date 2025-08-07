import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
    assertIntegerRoughlyEquals,
    constants,
    expect,
    filterLogsToArguments,
    getRandomInteger,
    Numberish,
    shortZip,
    toBaseUnitAmount,
} from '@0x/test-utils';

// Local bigint assertion helpers
function expectBigIntEqual(actual: any, expected: any, message?: string): void {
    const actualBigInt = typeof actual === 'bigint' ? actual : BigInt(actual.toString());
    const expectedBigInt = typeof expected === 'bigint' ? expected : BigInt(expected.toString());
    expect(actualBigInt, message).to.equal(expectedBigInt);
}

function expectBigIntLessThanOrEqual(actual: any, expected: any, message?: string): void {
    const actualBigInt = typeof actual === 'bigint' ? actual : BigInt(actual.toString());
    const expectedBigInt = typeof expected === 'bigint' ? expected : BigInt(expected.toString());
    expect(actualBigInt <= expectedBigInt, message || `Expected ${actualBigInt} to be <= ${expectedBigInt}`).to.be.true;
}

function toBigInt(value: any): bigint {
    if (typeof value === 'bigint') {
        return value;
    }
    return BigInt(value.toString());
}
import { hexUtils, StakingRevertErrors } from '@0x/utils';
import { LogEntry } from 'ethereum-types';
import * as _ from 'lodash';

import { constants as stakingConstants } from '../../src/constants';

import { artifacts } from '../artifacts';

import {
    IStakingEventsEpochEndedEventArgs,
    IStakingEventsEpochFinalizedEventArgs,
    IStakingEventsEvents,
    IStakingEventsRewardsPaidEventArgs,
    TestFinalizerContract,
    TestFinalizerDepositStakingPoolRewardsEventArgs as DepositStakingPoolRewardsEventArgs,
    TestFinalizerEvents,
} from '../wrappers';

describe('Finalizer unit tests', env => {
    const { ZERO_AMOUNT } = constants;
    const INITIAL_BALANCE = toBaseUnitAmount(32);
    let operatorRewardsReceiver: string;
    let membersRewardsReceiver: string;
    let testContract: TestFinalizerContract;

    before(async () => {
        operatorRewardsReceiver = hexUtils.random(constants.ADDRESS_LENGTH);
        membersRewardsReceiver = hexUtils.random(constants.ADDRESS_LENGTH);
        testContract = await TestFinalizerContract.deployFrom0xArtifactAsync(
            artifacts.TestFinalizer,
            await ethers.getSigners().then(signers => signers[0]),
            {},
            artifacts,
            operatorRewardsReceiver,
            membersRewardsReceiver,
        );
        // Give the contract a balance.
        await sendEtherAsync(testContract.address, INITIAL_BALANCE);
    });

    async function sendEtherAsync(to: string, amount: Numberish): Promise<void> {
        await env.web3Wrapper.awaitTransactionSuccessAsync(
            await env.web3Wrapper.sendTransactionAsync({
                from: (await ethers.getSigners().then(signers => signers.map(s => s.address)))[0],
                to,
                value: amountn,
            }),
        );
    }

    interface ActivePoolOpts {
        poolId: string;
        operatorShare: number;
        feesCollected: Numberish;
        membersStake: Numberish;
        weightedStake: Numberish;
    }

    async function addActivePoolAsync(opts?: Partial<ActivePoolOpts>): Promise<ActivePoolOpts> {
        const maxAmount = toBaseUnitAmount(1e9);
        const _opts = {
            poolId: hexUtils.random(),
            operatorShare: Math.floor(Math.random() * constants.PPM_DENOMINATOR) / constants.PPM_DENOMINATOR,
            feesCollected: getRandomInteger(0, maxAmount),
            membersStake: getRandomInteger(0, maxAmount),
            weightedStake: getRandomInteger(0, maxAmount),
            ...opts,
        };
        await testContract
            .addActivePool(
                _opts.poolId,
                _opts.operatorShare * constants.PPM_DENOMINATORn.integerValue(),
                _opts.feesCollectedn,
                _opts.membersStaken,
                _opts.weightedStaken,
            )
            ; await tx.wait();
        return _opts;
    }

    interface UnfinalizedState {
        rewardsAvailable: Numberish;
        numPoolsToFinalize: Numberish;
        totalFeesCollected: Numberish;
        totalWeightedStake: Numberish;
        totalRewardsFinalized: Numberish;
    }

    async function getUnfinalizedStateAsync(): Promise<UnfinalizedState> {
        return testContract.getAggregatedStatsForPreviousEpoch();
    }

    async function finalizePoolsAsync(poolIds: string[]): Promise<LogEntry[]> {
        const logs = [] as LogEntry[];
        for (const poolId of poolIds) {
            const receipt = await testContract.finalizePool(poolId); await tx.wait();
            logs.splice(logs.length, 0, ...receipt.logs);
        }
        return logs;
    }

    async function assertUnfinalizedStateAsync(expected: Partial<UnfinalizedState>): Promise<void> {
        const actual = await getUnfinalizedStateAsync();
        assertEqualNumberFields(actual, expected);
    }

    function assertEpochEndedEvent(logs: LogEntry[], args: Partial<IStakingEventsEpochEndedEventArgs>): void {
        const events = getEpochEndedEvents(logs);
        expect(events.length).to.eq(1);
        assertEqualNumberFields(events[0], args);
    }

    function assertEpochFinalizedEvent(logs: LogEntry[], args: Partial<IStakingEventsEpochFinalizedEventArgs>): void {
        const events = getEpochFinalizedEvents(logs);
        expect(events.length).to.eq(1);
        assertEqualNumberFields(events[0], args);
    }

    function assertEqualNumberFields<T>(actual: T, expected: Partial<T>): void {
        for (const key of Object.keys(actual)) {
            const a = (actual as any)[key] as BigNumber;
            const e = (expected as any)[key] as Numberish;
            if (e !== undefined) {
                expectBigIntEqual(toBigInt(a), toBigInt(e), key);
            }
        }
    }

    async function assertFinalizationLogsAndBalancesAsync(
        rewardsAvailable: Numberish,
        poolsToFinalize: ActivePoolOpts[],
        finalizationLogs: LogEntry[],
    ): Promise<void> {
        const currentEpoch = await getCurrentEpochAsync();
        // Compute the expected rewards for each pool.
        const poolsWithStake = poolsToFinalize.filter(p => !p.weightedStaken.isZero());
        const poolRewards = await calculatePoolRewardsAsync(rewardsAvailable, poolsWithStake);
        const totalRewards = BigNumber.sum(...poolRewards);
        const rewardsRemaining = rewardsAvailablen.minus(totalRewards);
        const [totalOperatorRewards, totalMembersRewards] = getTotalSplitRewards(poolsToFinalize, poolRewards);

        // Assert the `RewardsPaid` logs.
        const rewardsPaidEvents = getRewardsPaidEvents(finalizationLogs);
        expect(rewardsPaidEvents.length).to.eq(poolsWithStake.length);
        for (const i of _.times(rewardsPaidEvents.length)) {
            const event = rewardsPaidEvents[i];
            const pool = poolsWithStake[i];
            const reward = poolRewards[i];
            const [operatorReward, membersReward] = splitRewards(pool, reward);
            expectBigIntEqual(toBigInt(event.epoch), toBigInt(currentEpoch));
            assertIntegerRoughlyEquals(event.operatorReward, operatorReward);
            assertIntegerRoughlyEquals(event.membersReward, membersReward);
        }

        // Assert the `DepositStakingPoolRewards` logs.
        const depositStakingPoolRewardsEvents = getDepositStakingPoolRewardsEvents(finalizationLogs);
        expect(depositStakingPoolRewardsEvents.length).to.eq(poolsWithStake.length);
        for (const i of _.times(depositStakingPoolRewardsEvents.length)) {
            const event = depositStakingPoolRewardsEvents[i];
            const pool = poolsWithStake[i];
            const reward = poolRewards[i];
            expect(event.poolId).to.eq(pool.poolId);
            assertIntegerRoughlyEquals(event.reward, reward);
            assertIntegerRoughlyEquals(event.membersStake, pool.membersStake);
        }
        // Make sure they all sum up to the totals.
        if (depositStakingPoolRewardsEvents.length > 0) {
            const totalDepositRewards = BigNumber.sum(...depositStakingPoolRewardsEvents.map(e => e.reward));
            assertIntegerRoughlyEquals(totalDepositRewards, totalRewards);
        }

        // Assert the `EpochFinalized` logs.
        const epochFinalizedEvents = getEpochFinalizedEvents(finalizationLogs);
        expect(epochFinalizedEvents.length).to.eq(1);
        expectBigIntEqual(toBigInt(epochFinalizedEvents[0].epoch), toBigInt(currentEpoch) - 1n);
        assertIntegerRoughlyEquals(epochFinalizedEvents[0].rewardsPaid, totalRewards);
        assertIntegerRoughlyEquals(epochFinalizedEvents[0].rewardsRemaining, rewardsRemaining);

        // Assert the receiver balances.
        await assertReceiverBalancesAsync(totalOperatorRewards, totalMembersRewards);
    }

    async function assertReceiverBalancesAsync(operatorRewards: Numberish, membersRewards: Numberish): Promise<void> {
        const operatorRewardsBalance = await getBalanceOfAsync(operatorRewardsReceiver);
        assertIntegerRoughlyEquals(operatorRewardsBalance, operatorRewards);
        const membersRewardsBalance = await getBalanceOfAsync(membersRewardsReceiver);
        assertIntegerRoughlyEquals(membersRewardsBalance, membersRewards);
    }

    async function calculatePoolRewardsAsync(
        rewardsAvailable: Numberish,
        poolsToFinalize: ActivePoolOpts[],
    ): Promise<BigNumber[]> {
        const totalFees = BigNumber.sum(...poolsToFinalize.map(p => p.feesCollected));
        const totalStake = BigNumber.sum(...poolsToFinalize.map(p => p.weightedStake));
        const poolRewards = _.times(poolsToFinalize.length, () => constants.ZERO_AMOUNT);
        for (const i of _.times(poolsToFinalize.length)) {
            const pool = poolsToFinalize[i];
            const feesCollected = pool.feesCollectedn;
            if (feesCollected.isZero()) {
                continue;
            }
            poolRewards[i] = await testContract
                .cobbDouglas(
                    rewardsAvailablen,
                    feesCollectedn,
                    totalFeesn,
                    pool.weightedStaken,
                    totalStaken,
                )
                ;
        }
        return poolRewards;
    }

    function splitRewards(pool: ActivePoolOpts, totalReward: Numberish): [BigNumber, BigNumber] {
        if (pool.membersStaken.isZero()) {
            return [totalRewardn, ZERO_AMOUNT];
        }
        const operatorShare = totalRewardn.times(pool.operatorShare).integerValue(BigNumber.ROUND_UP);
        const membersShare = totalRewardn.minus(operatorShare);
        return [operatorShare, membersShare];
    }

    // Calculates the split rewards for every pool and returns the operator
    // and member sums.
    function getTotalSplitRewards(pools: ActivePoolOpts[], rewards: Numberish[]): [BigNumber, BigNumber] {
        const _rewards = _.times(pools.length).map(i => splitRewards(pools[i], rewards[i]));
        const totalOperatorRewards = BigNumber.sum(..._rewards.map(([o]) => o));
        const totalMembersRewards = BigNumber.sum(..._rewards.map(([, m]) => m));
        return [totalOperatorRewards, totalMembersRewards];
    }

    function getEpochEndedEvents(logs: LogEntry[]): IStakingEventsEpochEndedEventArgs[] {
        return filterLogsToArguments<IStakingEventsEpochEndedEventArgs>(logs, IStakingEventsEvents.EpochEnded);
    }

    function getEpochFinalizedEvents(logs: LogEntry[]): IStakingEventsEpochFinalizedEventArgs[] {
        return filterLogsToArguments<IStakingEventsEpochFinalizedEventArgs>(logs, IStakingEventsEvents.EpochFinalized);
    }

    function getDepositStakingPoolRewardsEvents(logs: LogEntry[]): DepositStakingPoolRewardsEventArgs[] {
        return filterLogsToArguments<DepositStakingPoolRewardsEventArgs>(
            logs,
            TestFinalizerEvents.DepositStakingPoolRewards,
        );
    }

    function getRewardsPaidEvents(logs: LogEntry[]): IStakingEventsRewardsPaidEventArgs[] {
        return filterLogsToArguments<IStakingEventsRewardsPaidEventArgs>(logs, IStakingEventsEvents.RewardsPaid);
    }

    async function getCurrentEpochAsync(): Promise<BigNumber> {
        return testContract.currentEpoch();
    }

    async function getBalanceOfAsync(whom: string): Promise<BigNumber> {
        return env.web3Wrapper.getBalanceInWeiAsync(whom);
    }

    describe('endEpoch()', () => {
        it('advances the epoch', async () => {
            await testContract.endEpoch(); await tx.wait();
            const currentEpoch = await testContract.currentEpoch();
            expectBigIntEqual(toBigInt(currentEpoch), toBigInt(stakingConstants.INITIAL_EPOCH) + 1n);
        });

        it('emits an `EpochEnded` event', async () => {
            const receipt = await testContract.endEpoch(); await tx.wait();
            assertEpochEndedEvent(receipt.logs, {
                epoch: stakingConstants.INITIAL_EPOCH,
                numActivePools: ZERO_AMOUNT,
                rewardsAvailable: INITIAL_BALANCE,
                totalFeesCollected: ZERO_AMOUNT,
                totalWeightedStake: ZERO_AMOUNT,
            });
        });

        it('immediately finalizes if there are no pools to finalize', async () => {
            const receipt = await testContract.endEpoch(); await tx.wait();
            assertEpochFinalizedEvent(receipt.logs, {
                epoch: stakingConstants.INITIAL_EPOCH,
                rewardsPaid: ZERO_AMOUNT,
                rewardsRemaining: INITIAL_BALANCE,
            });
        });

        it('does not immediately finalize if there is a pool to finalize', async () => {
            await addActivePoolAsync();
            const receipt = await testContract.endEpoch(); await tx.wait();
            const events = filterLogsToArguments<IStakingEventsEpochFinalizedEventArgs>(
                receipt.logs,
                IStakingEventsEvents.EpochFinalized,
            );
            expect(events).to.deep.eq([]);
        });

        it('prepares unfinalized state', async () => {
            // Add a pool so there is state to clear.
            const pool = await addActivePoolAsync();
            await testContract.endEpoch(); await tx.wait();
            return assertUnfinalizedStateAsync({
                numPoolsToFinalize: 1,
                rewardsAvailable: INITIAL_BALANCE,
                totalFeesCollected: pool.feesCollected,
                totalWeightedStake: pool.weightedStake,
            });
        });

        it("correctly stores the epoch's aggregated stats after ending the epoch", async () => {
            const pool = await addActivePoolAsync();
            const epoch = await testContract.currentEpoch();
            await testContract.endEpoch(); await tx.wait();
            const aggregatedStats = await testContract.aggregatedStatsByEpoch(epoch);
            expect(aggregatedStats).to.be.deep.equal([
                INITIAL_BALANCE,
                1n, // pools to finalize
                pool.feesCollected,
                pool.weightedStake,
                0n, // rewards finalized
            ]);
        });

        it('reverts if the prior epoch is unfinalized', async () => {
            await addActivePoolAsync();
            await testContract.endEpoch(); await tx.wait();
            const tx = testContract.endEpoch(); await tx.wait();
            const expectedError = new StakingRevertErrors.PreviousEpochNotFinalizedError(
                stakingConstants.INITIAL_EPOCH,
                1,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
    });

    describe('_finalizePool()', () => {
        it('does nothing if there were no pools to finalize', async () => {
            await testContract.endEpoch(); await tx.wait();
            const poolId = hexUtils.random();
            const logs = await finalizePoolsAsync([poolId]);
            expect(logs).to.deep.eq([]);
        });

        it('can finalize a pool', async () => {
            const pool = await addActivePoolAsync();
            await testContract.endEpoch(); await tx.wait();
            const logs = await finalizePoolsAsync([pool.poolId]);
            return assertFinalizationLogsAndBalancesAsync(INITIAL_BALANCE, [pool], logs);
        });

        it('can finalize multiple pools over multiple transactions', async () => {
            const pools = await Promise.all(_.times(2, async () => addActivePoolAsync()));
            await testContract.endEpoch(); await tx.wait();
            const logs = await finalizePoolsAsync(pools.map(p => p.poolId));
            return assertFinalizationLogsAndBalancesAsync(INITIAL_BALANCE, pools, logs);
        });

        it('ignores a finalized pool', async () => {
            const pools = await Promise.all(_.times(3, async () => addActivePoolAsync()));
            await testContract.endEpoch(); await tx.wait();
            const [finalizedPool] = _.sampleSize(pools, 1);
            await finalizePoolsAsync([finalizedPool.poolId]);
            const logs = await finalizePoolsAsync([finalizedPool.poolId]);
            const rewardsPaidEvents = getRewardsPaidEvents(logs);
            expect(rewardsPaidEvents).to.deep.eq([]);
        });

        it('resets pool state after finalizing it', async () => {
            const pools = await Promise.all(_.times(3, async () => addActivePoolAsync()));
            const pool = _.sample(pools) as ActivePoolOpts;
            await testContract.endEpoch(); await tx.wait();
            await finalizePoolsAsync([pool.poolId]);
            const poolState = await testContract
                .getPoolStatsFromEpoch(stakingConstants.INITIAL_EPOCH, pool.poolId)
                ;
            expectBigIntEqual(toBigInt(poolState.feesCollected), 0n);
            expectBigIntEqual(toBigInt(poolState.weightedStake), 0n);
            expectBigIntEqual(toBigInt(poolState.membersStake), 0n);
        });

        it('`rewardsPaid` <= `rewardsAvailable` <= contract balance at the end of the epoch', async () => {
            const pools = await Promise.all(_.times(3, async () => addActivePoolAsync()));
            const receipt = await testContract.endEpoch(); await tx.wait();
            const { rewardsAvailable } = getEpochEndedEvents(receipt.logs)[0];
            expectBigIntLessThanOrEqual(toBigInt(rewardsAvailable), toBigInt(INITIAL_BALANCE));
            const logs = await finalizePoolsAsync(pools.map(r => r.poolId));
            const { rewardsPaid } = getEpochFinalizedEvents(logs)[0];
            expectBigIntLessThanOrEqual(toBigInt(rewardsPaid), toBigInt(rewardsAvailable));
        });

        it('`rewardsPaid` <= `rewardsAvailable` with two equal pools', async () => {
            const pool1 = await addActivePoolAsync();
            const pool2 = await addActivePoolAsync(_.omit(pool1, 'poolId'));
            const receipt = await testContract.endEpoch(); await tx.wait();
            const { rewardsAvailable } = getEpochEndedEvents(receipt.logs)[0];
            const logs = await finalizePoolsAsync([pool1, pool2].map(r => r.poolId));
            const { rewardsPaid } = getEpochFinalizedEvents(logs)[0];
            expectBigIntLessThanOrEqual(toBigInt(rewardsPaid), toBigInt(rewardsAvailable));
        });

        describe.skip('`rewardsPaid` fuzzing', () => {
            const numTests = 32;
            for (const i of _.times(numTests)) {
                const numPools = _.random(1, 32);
                it(`${i + 1}/${numTests} \`rewardsPaid\` <= \`rewardsAvailable\` (${numPools} pools)`, async () => {
                    const pools = await Promise.all(_.times(numPools, async () => addActivePoolAsync()));
                    const receipt = await testContract.endEpoch(); await tx.wait();
                    const { rewardsAvailable } = getEpochEndedEvents(receipt.logs)[0];
                    const logs = await finalizePoolsAsync(pools.map(r => r.poolId));
                    const { rewardsPaid } = getEpochFinalizedEvents(logs)[0];
                    expectBigIntLessThanOrEqual(toBigInt(rewardsPaid), toBigInt(rewardsAvailable));
                });
            }
        });
    });

    describe('lifecycle', () => {
        it('can advance the epoch after the prior epoch is finalized', async () => {
            const pool = await addActivePoolAsync();
            await testContract.endEpoch(); await tx.wait();
            await finalizePoolsAsync([pool.poolId]);
            await testContract.endEpoch(); await tx.wait();
            return expect(getCurrentEpochAsync()).to.become(stakingConstants.INITIAL_EPOCH.plus(2));
        });

        it('does not reward a pool that only earned rewards 2 epochs ago', async () => {
            const pool1 = await addActivePoolAsync();
            await testContract.endEpoch(); await tx.wait();
            await finalizePoolsAsync([pool1.poolId]);
            await addActivePoolAsync();
            await testContract.endEpoch(); await tx.wait();
            expect(getCurrentEpochAsync()).to.become(stakingConstants.INITIAL_EPOCH.plus(2));
            const logs = await finalizePoolsAsync([pool1.poolId]);
            const rewardsPaidEvents = getRewardsPaidEvents(logs);
            expect(rewardsPaidEvents).to.deep.eq([]);
        });

        it('does not reward a pool that only earned rewards 3 epochs ago', async () => {
            const pool1 = await addActivePoolAsync();
            await testContract.endEpoch(); await tx.wait();
            await finalizePoolsAsync([pool1.poolId]);
            await testContract.endEpoch(); await tx.wait();
            await addActivePoolAsync();
            await testContract.endEpoch(); await tx.wait();
            expect(getCurrentEpochAsync()).to.become(stakingConstants.INITIAL_EPOCH.plus(3));
            const logs = await finalizePoolsAsync([pool1.poolId]);
            const rewardsPaidEvents = getRewardsPaidEvents(logs);
            expect(rewardsPaidEvents).to.deep.eq([]);
        });

        it('rolls over leftover rewards into the next epoch', async () => {
            const poolIds = _.times(3, () => hexUtils.random());
            await Promise.all(poolIds.map(async id => addActivePoolAsync({ poolId: id })));
            await testContract.endEpoch(); await tx.wait();
            const finalizeLogs = await finalizePoolsAsync(poolIds);
            const { rewardsRemaining: rolledOverRewards } = getEpochFinalizedEvents(finalizeLogs)[0];
            await Promise.all(poolIds.map(async id => addActivePoolAsync({ poolId: id })));
            const { logs: endEpochLogs } = await testContract.endEpoch(); await tx.wait();
            const { rewardsAvailable } = getEpochEndedEvents(endEpochLogs)[0];
            expectBigIntEqual(toBigInt(rewardsAvailable), toBigInt(rolledOverRewards));
        });
    });

    interface FinalizedPoolRewards {
        totalReward: Numberish;
        membersStake: Numberish;
    }

    async function assertUnfinalizedPoolRewardsAsync(
        poolId: string,
        expected: Partial<FinalizedPoolRewards>,
    ): Promise<void> {
        const actual = await testContract.getUnfinalizedPoolRewards(poolId);
        if (expected.totalReward !== undefined) {
            expectBigIntEqual(toBigInt(actual.totalReward), toBigInt(expected.totalReward));
        }
        if (expected.membersStake !== undefined) {
            expectBigIntEqual(toBigInt(actual.membersStake), toBigInt(expected.membersStake));
        }
    }

    describe('_getUnfinalizedPoolReward()', () => {
        const ZERO_REWARDS = {
            totalReward: 0,
            membersStake: 0,
        };

        it('returns empty if epoch is 1', async () => {
            const poolId = hexUtils.random();
            return assertUnfinalizedPoolRewardsAsync(poolId, ZERO_REWARDS);
        });

        it('returns empty if pool did not earn rewards', async () => {
            await testContract.endEpoch(); await tx.wait();
            const poolId = hexUtils.random();
            return assertUnfinalizedPoolRewardsAsync(poolId, ZERO_REWARDS);
        });

        it('returns empty if pool is earned rewards only in the current epoch', async () => {
            const pool = await addActivePoolAsync();
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, ZERO_REWARDS);
        });

        it('returns empty if pool only earned rewards in the 2 epochs ago', async () => {
            const pool = await addActivePoolAsync();
            await testContract.endEpoch(); await tx.wait();
            await finalizePoolsAsync([pool.poolId]);
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, ZERO_REWARDS);
        });

        it('returns empty if pool was already finalized', async () => {
            const pools = await Promise.all(_.times(3, async () => addActivePoolAsync()));
            const [pool] = _.sampleSize(pools, 1);
            await testContract.endEpoch(); await tx.wait();
            await finalizePoolsAsync([pool.poolId]);
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, ZERO_REWARDS);
        });

        it('computes one reward among one pool', async () => {
            const pool = await addActivePoolAsync();
            await testContract.endEpoch(); await tx.wait();
            const expectedTotalRewards = INITIAL_BALANCE;
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, {
                totalReward: expectedTotalRewards,
                membersStake: pool.membersStake,
            });
        });

        it('computes one reward among multiple pools', async () => {
            const pools = await Promise.all(_.times(3, async () => addActivePoolAsync()));
            await testContract.endEpoch(); await tx.wait();
            const expectedPoolRewards = await calculatePoolRewardsAsync(INITIAL_BALANCE, pools);
            const [pool, reward] = _.sampleSize(shortZip(pools, expectedPoolRewards), 1)[0];
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, {
                totalReward: reward,
                membersStake: pool.membersStake,
            });
        });

        it('computes a reward with 0% operatorShare', async () => {
            const pool = await addActivePoolAsync({ operatorShare: 0 });
            await testContract.endEpoch(); await tx.wait();
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, {
                totalReward: INITIAL_BALANCE,
                membersStake: pool.membersStake,
            });
        });

        it('computes a reward with 0% < operatorShare < 100%', async () => {
            const pool = await addActivePoolAsync({ operatorShare: Math.random() });
            await testContract.endEpoch(); await tx.wait();
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, {
                totalReward: INITIAL_BALANCE,
                membersStake: pool.membersStake,
            });
        });

        it('computes a reward with 100% operatorShare', async () => {
            const pool = await addActivePoolAsync({ operatorShare: 1 });
            await testContract.endEpoch(); await tx.wait();
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, {
                totalReward: INITIAL_BALANCE,
                membersStake: pool.membersStake,
            });
        });
    });
});
// tslint:disable: max-file-line-count
