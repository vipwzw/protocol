import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants as stakingConstants } from '../../src/constants';
import { constants, filterLogsToArguments, getRandomInteger, Numberish, randomAddress } from '../test_constants';

// Local bigint assertion helper
function expectBigIntEqual(actual: any, expected: any): void {
    const actualBigInt = typeof actual === 'bigint' ? actual : BigInt(actual.toString());
    const expectedBigInt = typeof expected === 'bigint' ? expected : BigInt(expected.toString());
    expect(actualBigInt).to.equal(expectedBigInt);
}

function toBigInt(value: any): bigint {
    if (typeof value === 'bigint') {
        return value;
    }
    return BigInt(value.toString());
}

import { hexUtils } from '../test_constants';

import { artifacts } from '../artifacts';

import {
    TestDelegatorRewardsContract,
    TestDelegatorRewardsEvents,
    TestDelegatorRewardsTransferEventArgs,
} from '../wrappers';

describe('Delegator rewards unit tests', () => {
    let testContract: TestDelegatorRewardsContract;

    before(async () => {
        testContract = await TestDelegatorRewardsContract.deployFrom0xArtifactAsync(
            artifacts.TestDelegatorRewards,
            await ethers.getSigners().then(signers => signers[0]),
            {},
            artifacts,
        );
    });

    interface RewardPoolOpts {
        poolId: string;
        operator: string;
        membersReward: Numberish;
        operatorReward: Numberish;
        membersStake: Numberish;
    }

    const ONE_ETHER = 10n ** 18n;

    function randWei(maxInteger: number): bigint {
        return BigInt(getRandomInteger(1, maxInteger)) * ONE_ETHER;
    }

    // Helper: approximate equality with 1 wei tolerance by default
    function assertRoughlyEquals(actual: Numberish, expected: Numberish, tolerance: bigint = 1n): void {
        const a = toBigInt(actual);
        const e = toBigInt(expected);
        const diff = a > e ? a - e : e - a;
        expect(diff <= tolerance).to.be.true;
    }

    function bigSum(...vals: Array<Numberish>): bigint {
        return vals.reduce((acc, v) => acc + toBigInt(v), 0n);
    }

    function toActualRewards(operatorRewardIn: Numberish, membersRewardIn: Numberish): [bigint, bigint] {
        const op = toBigInt(operatorRewardIn);
        const mem = toBigInt(membersRewardIn);
        const total = op + mem;
        if (total === 0n) {
            return [0n, 0n];
        }
        const ppmDenom = BigInt(stakingConstants.PPM_DENOMINATOR);
        const ppm100 = BigInt(stakingConstants.PPM_100_PERCENT);
        const operatorSharePPM = (op * ppm100) / total; // floor
        const opReward = (total * operatorSharePPM + ppmDenom - 1n) / ppmDenom; // ceil
        const memReward = total - opReward;
        return [opReward, memReward];
    }

    async function rewardPoolAsync(opts?: Partial<RewardPoolOpts>): Promise<RewardPoolOpts> {
        const _opts = {
            poolId: hexUtils.random(),
            operator: constants.NULL_ADDRESS,
            membersReward: randWei(100),
            operatorReward: randWei(100),
            membersStake: randWei(10),
            ...opts,
        };
        // Generate a deterministic operator address based on the poolId.
        _opts.operator = poolIdToOperator(_opts.poolId);
        const tx = await testContract.syncPoolRewards(
            _opts.poolId,
            _opts.operator,
            _opts.operatorReward,
            _opts.membersReward,
            _opts.membersStake,
        );
        await tx.wait();
        // Because the operator share is implicitly defined by the member and
        // operator reward, and is stored as a uint32, there will be precision
        // loss when the reward is combined then split again in the contracts.
        // So we perform this transformation on the values and return them.
        const [opReward, memReward] = toActualRewards(_opts.operatorReward, _opts.membersReward);
        _opts.operatorReward = opReward;
        _opts.membersReward = memReward;
        return _opts;
    }

    interface SetUnfinalizedMembersRewardsOpts extends RewardPoolOpts {}

    async function setUnfinalizedPoolRewardAsync(
        opts?: Partial<SetUnfinalizedMembersRewardsOpts>,
    ): Promise<SetUnfinalizedMembersRewardsOpts> {
        const _opts = {
            poolId: hexUtils.random(),
            operator: constants.NULL_ADDRESS,
            membersReward: randWei(100),
            operatorReward: randWei(100),
            membersStake: randWei(10),
            ...opts,
        };
        // Generate a deterministic operator address based on the poolId.
        _opts.operator = poolIdToOperator(_opts.poolId);
        const tx = await testContract.setUnfinalizedPoolReward(
            _opts.poolId,
            _opts.operator,
            _opts.operatorReward,
            _opts.membersReward,
            _opts.membersStake,
        );
        await tx.wait();
        // Because the operator share is implicitly defined by the member and
        // operator reward, and is stored as a uint32, there will be precision
        // loss when the reward is combined then split again in the contracts.
        // So we perform this transformation on the values and return them.
        const [opReward, memReward] = toActualRewards(_opts.operatorReward, _opts.membersReward);
        _opts.operatorReward = opReward;
        _opts.membersReward = memReward;
        return _opts;
    }

    // Generates a deterministic operator address given a pool ID.
    function poolIdToOperator(poolId: string): string {
        return hexUtils.slice(hexUtils.hash(poolId), -20);
    }

    // Converts pre-split rewards to the amounts the contracts will calculate
    // after suffering precision loss from the low-precision `operatorShare`.
    // (moved above) toActualRewards using bigint

    type ResultWithTransfers<T extends {}> = T & {
        delegatorTransfers: bigint;
    };

    interface DelegateStakeOpts {
        delegator: string;
        stake: Numberish;
    }

    async function delegateStakeNowAsync(
        poolId: string,
        opts?: Partial<DelegateStakeOpts>,
    ): Promise<ResultWithTransfers<DelegateStakeOpts>> {
        return delegateStakeAsync(poolId, opts, true);
    }

    async function delegateStakeAsync(
        poolId: string,
        opts?: Partial<DelegateStakeOpts>,
        now?: boolean,
    ): Promise<ResultWithTransfers<DelegateStakeOpts>> {
        const _opts = {
            delegator: randomAddress(),
            stake: randWei(10),
            ...opts,
        };
        const fn = now
            ? testContract.delegateStakeNow.bind(testContract)
            : testContract.delegateStake.bind(testContract);
        const tx = await fn(_opts.delegator, poolId, _opts.stake);
        const receipt = await tx.wait();
        const delegatorTransfers = getTransfersFromLogs(receipt.logs, _opts.delegator);
        return {
            ..._opts,
            delegatorTransfers,
        };
    }

    async function undelegateStakeAsync(
        poolId: string,
        delegator: string,
        stake?: Numberish,
    ): Promise<ResultWithTransfers<{ stake: BigNumber }>> {
        const _stake =
            stake || (await testContract.getStakeDelegatedToPoolByOwner(delegator, poolId)).currentEpochBalance;
        const tx = await testContract.undelegateStake(delegator, poolId, _stake);
        const receipt = await tx.wait();
        const delegatorTransfers = getTransfersFromLogs(receipt.logs, delegator);
        return {
            stake: _stake,
            delegatorTransfers,
        };
    }

    function getTransfersFromLogs(logs: any[], delegator?: string): bigint {
        let delegatorTransfers = constants.ZERO_AMOUNT;
        const transferArgs = filterLogsToArguments<TestDelegatorRewardsTransferEventArgs>(logs, 'Transfer');
        for (const event of transferArgs) {
            if (event._to === delegator) {
                delegatorTransfers = toBigInt(delegatorTransfers) + toBigInt(event._value);
            }
        }
        return delegatorTransfers;
    }

    async function advanceEpochAsync(): Promise<number> {
        const tx = await testContract.advanceEpoch();
        await tx.wait();
        const epoch = await testContract.currentEpoch();
        return Number(epoch);
    }

    async function getDelegatorRewardBalanceAsync(poolId: string, delegator: string): Promise<bigint> {
        return testContract.computeRewardBalanceOfDelegator(poolId, delegator);
    }

    async function getOperatorRewardBalanceAsync(poolId: string): Promise<bigint> {
        return testContract.computeRewardBalanceOfOperator(poolId);
    }

    async function touchStakeAsync(poolId: string, delegator: string): Promise<ResultWithTransfers<{}>> {
        return undelegateStakeAsync(poolId, delegator, 0);
    }

    async function finalizePoolAsync(poolId: string): Promise<ResultWithTransfers<{}>> {
        const tx = await testContract.finalizePool(poolId);
        const receipt = await tx.wait();
        const delegatorTransfers = getTransfersFromLogs(receipt.logs, poolId);
        return {
            delegatorTransfers,
        };
    }

    function computeDelegatorRewards(
        totalRewards: Numberish,
        delegatorStake: Numberish,
        totalDelegatorStake: Numberish,
    ): bigint {
        const total = toBigInt(totalRewards);
        const stake = toBigInt(delegatorStake);
        const denom = toBigInt(totalDelegatorStake);
        if (denom === 0n) {
            return 0n;
        }
        return (total * stake) / denom; // floor
    }

    describe('computeRewardBalanceOfOperator()', () => {
        it('nothing in epoch 1', async () => {
            const { poolId } = await rewardPoolAsync();
            const operatorReward = await getOperatorRewardBalanceAsync(poolId);
            expectBigIntEqual(toBigInt(operatorReward), 0n);
        });

        it('nothing in epoch 2', async () => {
            await advanceEpochAsync();
            const { poolId } = await rewardPoolAsync();
            const operatorReward = await getOperatorRewardBalanceAsync(poolId);
            expectBigIntEqual(toBigInt(operatorReward), 0n);
        });

        it('nothing one epoch after rewards', async () => {
            const { poolId } = await rewardPoolAsync();
            await advanceEpochAsync();
            const operatorReward = await getOperatorRewardBalanceAsync(poolId);
            expectBigIntEqual(toBigInt(operatorReward), 0n);
        });

        describe('with unfinalized rewards', () => {
            it('something with unfinalized rewards', async () => {
                const { poolId, operatorReward: expectedOperatorReward } = await setUnfinalizedPoolRewardAsync();
                const operatorReward = await getOperatorRewardBalanceAsync(poolId);
                assertRoughlyEquals(operatorReward, expectedOperatorReward);
            });

            it('nothing for operator with 0% share', async () => {
                // We define operator shares implicitly, so we set the operator
                // reward to 0, which kind of makes this silly.
                const { poolId } = await setUnfinalizedPoolRewardAsync({ operatorReward: 0 });
                const operatorReward = await getOperatorRewardBalanceAsync(poolId);
                expectBigIntEqual(toBigInt(operatorReward), 0n);
            });

            it('everything for operator with 100% share', async () => {
                // We define operator shares implicitly, so we set the members
                // reward to 0.
                const { poolId, operatorReward: expectedOperatorReward } = await setUnfinalizedPoolRewardAsync({
                    membersReward: 0,
                });
                const operatorReward = await getOperatorRewardBalanceAsync(poolId);
                assertRoughlyEquals(operatorReward, expectedOperatorReward);
            });

            it('nothing once rewards are finalized', async () => {
                const { poolId } = await setUnfinalizedPoolRewardAsync();
                await finalizePoolAsync(poolId);
                const operatorReward = await getOperatorRewardBalanceAsync(poolId);
                expectBigIntEqual(toBigInt(operatorReward), 0n);
            });
        });
    });

    describe('computeRewardBalanceOfDelegator()', () => {
        it('nothing in epoch 1 for delegator with no stake', async () => {
            const { poolId } = await rewardPoolAsync();
            const delegator = randomAddress();
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            expectBigIntEqual(toBigInt(delegatorReward), 0n);
        });

        it('nothing in epoch 2 for delegator with no stake', async () => {
            await advanceEpochAsync(); // epoch 2
            const { poolId } = await rewardPoolAsync();
            const delegator = randomAddress();
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            expectBigIntEqual(toBigInt(delegatorReward), 0n);
        });

        it('nothing in epoch 1 for delegator staked in epoch 1', async () => {
            const { poolId } = await rewardPoolAsync();
            // Assign active stake to pool in epoch 1, which is usuaslly not
            // possible due to delegating delays.
            const { delegator } = await delegateStakeNowAsync(poolId);
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            expectBigIntEqual(toBigInt(delegatorReward), 0n);
        });

        it('nothing in epoch 2 for delegator delegating in epoch 2', async () => {
            await advanceEpochAsync(); // epoch 2
            const { poolId } = await rewardPoolAsync();
            const { delegator } = await delegateStakeAsync(poolId);
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            expectBigIntEqual(toBigInt(delegatorReward), 0n);
        });

        it('nothing in epoch 2 for delegator delegating in epoch 1', async () => {
            const poolId = hexUtils.random();
            const { delegator, stake } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake now active)
            // rewards paid for stake in epoch 1.
            await rewardPoolAsync({ poolId, membersStake: stake });
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            expectBigIntEqual(toBigInt(delegatorReward), 0n);
        });

        it('all rewards from epoch 3 for delegator delegating in epoch 1', async () => {
            const poolId = hexUtils.random();
            const { delegator, stake } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake now active)
            await advanceEpochAsync(); // epoch 3
            // rewards paid for stake in epoch 2.
            const { membersReward: reward } = await rewardPoolAsync({ poolId, membersStake: stake });
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            expectBigIntEqual(toBigInt(delegatorReward), toBigInt(reward));
        });

        it('all rewards from epoch 3 and 3 for delegator delegating in epoch 1', async () => {
            const poolId = hexUtils.random();
            const { delegator, stake } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake now active)
            await advanceEpochAsync(); // epoch 3
            const { membersReward: reward1 } = await rewardPoolAsync({ poolId, membersStake: stake });
            await advanceEpochAsync(); // epoch 4
            const { membersReward: reward2 } = await rewardPoolAsync({ poolId, membersStake: stake });
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            assertRoughlyEquals(delegatorReward, bigSum(reward1, reward2));
        });

        it('partial rewards from epoch 3 and 3 for delegator partially delegating in epoch 1', async () => {
            const poolId = hexUtils.random();
            const { delegator, stake: delegatorStake } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake now active)
            await advanceEpochAsync(); // epoch 3
            // rewards paid for stake in epoch 2.
            const { membersReward: reward, membersStake: rewardStake } = await rewardPoolAsync({
                poolId,
                membersStake: toBigInt(delegatorStake) * 2n,
            });
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            const expectedDelegatorRewards = computeDelegatorRewards(reward, delegatorStake, rewardStake);
            assertRoughlyEquals(delegatorReward, expectedDelegatorRewards);
        });

        it('has correct reward immediately after undelegating', async () => {
            const poolId = hexUtils.random();
            const { delegator, stake } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake now active)
            await advanceEpochAsync(); // epoch 3
            // rewards paid for stake in epoch 2.
            const { membersReward: reward } = await rewardPoolAsync({ poolId, membersStake: stake });
            const { delegatorTransfers: withdrawal } = await undelegateStakeAsync(poolId, delegator);
            assertRoughlyEquals(withdrawal, reward);
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            expectBigIntEqual(toBigInt(delegatorReward), 0n);
        });

        it('has correct reward immediately after undelegating and redelegating', async () => {
            const poolId = hexUtils.random();
            const { delegator, stake } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake now active)
            await advanceEpochAsync(); // epoch 3
            // rewards paid for stake in epoch 2.
            const { membersReward: reward } = await rewardPoolAsync({ poolId, membersStake: stake });
            const { delegatorTransfers: withdrawal } = await undelegateStakeAsync(poolId, delegator);
            assertRoughlyEquals(withdrawal, reward);
            await delegateStakeAsync(poolId, { delegator, stake });
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            expectBigIntEqual(toBigInt(delegatorReward), 0n);
        });

        it('has correct reward immediately after undelegating, redelegating, and rewarding fees', async () => {
            const poolId = hexUtils.random();
            const { delegator, stake } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake now active)
            await advanceEpochAsync(); // epoch 3
            // rewards paid for stake in epoch 2.
            await rewardPoolAsync({ poolId, membersStake: stake });
            await undelegateStakeAsync(poolId, delegator);
            await delegateStakeAsync(poolId, { delegator, stake });
            await advanceEpochAsync(); // epoch 4
            await advanceEpochAsync(); // epoch 5
            // rewards paid for stake in epoch 4.
            const { membersReward: reward } = await rewardPoolAsync({ poolId, membersStake: stake });
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            assertRoughlyEquals(delegatorReward, reward);
        });

        it('ignores rewards paid in the same epoch the stake was first active in', async () => {
            const poolId = hexUtils.random();
            // stake at 0
            const { delegator, stake } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake now active)
            // Pay rewards for epoch 1.
            await advanceEpochAsync(); // epoch 3
            // Pay rewards for epoch 2.
            const { membersReward: reward } = await rewardPoolAsync({ poolId, membersStake: stake });
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            expectBigIntEqual(toBigInt(delegatorReward), toBigInt(reward));
        });

        it('uses old stake for rewards paid in the same epoch extra stake is added', async () => {
            const poolId = hexUtils.random();
            // stake at 0
            const { delegator, stake: stake1 } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake1 now active)
            await advanceEpochAsync(); // epoch 3
            const stake2 = toBigInt(stake1) / 2n;
            const totalStake = toBigInt(stake1) + toBigInt(stake2);
            // Make the total stake in rewards > totalStake so delegator never
            // receives 100% of rewards.
            const rewardStake = totalStake * 2n;
            // Pay rewards for epoch 2.
            const { membersReward: reward1 } = await rewardPoolAsync({ poolId, membersStake: rewardStake });
            // add extra stake
            const { delegatorTransfers: withdrawal } = await delegateStakeAsync(poolId, { delegator, stake: stake2 });
            await advanceEpochAsync(); // epoch 4 (stake2 now active)
            // Pay rewards for epoch 3.
            await advanceEpochAsync(); // epoch 5
            // Pay rewards for epoch 4.
            const { membersReward: reward2 } = await rewardPoolAsync({ poolId, membersStake: rewardStake });
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            const expectedDelegatorReward = bigSum(
                computeDelegatorRewards(reward1, stake1, rewardStake),
                computeDelegatorRewards(reward2, totalStake, rewardStake),
            );
            assertRoughlyEquals(bigSum(withdrawal, delegatorReward), expectedDelegatorReward);
        });

        it('uses old stake for rewards paid in the epoch right after extra stake is added', async () => {
            const poolId = hexUtils.random();
            // stake at 0
            const { delegator, stake: stake1 } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake1 now active)
            // add extra stake
            const { stake: stake2 } = await delegateStakeAsync(poolId, { delegator });
            const totalStake = toBigInt(stake1) + toBigInt(stake2);
            await advanceEpochAsync(); // epoch 3 (stake2 now active)
            // Make the total stake in rewards > totalStake so delegator never
            // receives 100% of rewards.
            const rewardStake = totalStake * 2n;
            // Pay rewards for epoch 2.
            const { membersReward: reward1 } = await rewardPoolAsync({ poolId, membersStake: rewardStake });
            await advanceEpochAsync(); // epoch 4
            // Pay rewards for epoch 3.
            const { membersReward: reward2 } = await rewardPoolAsync({ poolId, membersStake: rewardStake });
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            const expectedDelegatorReward = bigSum(
                computeDelegatorRewards(reward1, stake1, rewardStake),
                computeDelegatorRewards(reward2, totalStake, rewardStake),
            );
            assertRoughlyEquals(delegatorReward, expectedDelegatorReward);
        });

        it('computes correct rewards for 2 staggered delegators', async () => {
            const poolId = hexUtils.random();
            const { delegator: delegatorA, stake: stakeA } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake A now active)
            const { delegator: delegatorB, stake: stakeB } = await delegateStakeAsync(poolId);
            const totalStake = toBigInt(stakeA) + toBigInt(stakeB);
            await advanceEpochAsync(); // epoch 3 (stake B now active)
            // rewards paid for stake in epoch 2 (delegator A only)
            const { membersReward: reward1 } = await rewardPoolAsync({ poolId, membersStake: stakeA });
            await advanceEpochAsync(); // epoch 4
            // rewards paid for stake in epoch 3 (delegator A and B)
            const { membersReward: reward2 } = await rewardPoolAsync({ poolId, membersStake: totalStake });
            const delegatorRewardA = await getDelegatorRewardBalanceAsync(poolId, delegatorA);
            const expectedDelegatorRewardA = bigSum(
                computeDelegatorRewards(reward1, stakeA, stakeA),
                computeDelegatorRewards(reward2, stakeA, totalStake),
            );
            assertRoughlyEquals(delegatorRewardA, expectedDelegatorRewardA);
            const delegatorRewardB = await getDelegatorRewardBalanceAsync(poolId, delegatorB);
            const expectedDelegatorRewardB = computeDelegatorRewards(reward2, stakeB, totalStake);
            assertRoughlyEquals(delegatorRewardB, expectedDelegatorRewardB);
        });

        it('computes correct rewards for 2 staggered delegators with a 2 epoch gap between payments', async () => {
            const poolId = hexUtils.random();
            const { delegator: delegatorA, stake: stakeA } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake A now active)
            const { delegator: delegatorB, stake: stakeB } = await delegateStakeAsync(poolId);
            const totalStake = toBigInt(stakeA) + toBigInt(stakeB);
            await advanceEpochAsync(); // epoch 3 (stake B now active)
            // rewards paid for stake in epoch 2 (delegator A only)
            const { membersReward: reward1 } = await rewardPoolAsync({ poolId, membersStake: stakeA });
            await advanceEpochAsync(); // epoch 4
            await advanceEpochAsync(); // epoch 5
            // rewards paid for stake in epoch 4 (delegator A and B)
            const { membersReward: reward2 } = await rewardPoolAsync({ poolId, membersStake: totalStake });
            const delegatorRewardA = await getDelegatorRewardBalanceAsync(poolId, delegatorA);
            const expectedDelegatorRewardA = bigSum(
                computeDelegatorRewards(reward1, stakeA, stakeA),
                computeDelegatorRewards(reward2, stakeA, totalStake),
            );
            assertRoughlyEquals(delegatorRewardA, expectedDelegatorRewardA);
            const delegatorRewardB = await getDelegatorRewardBalanceAsync(poolId, delegatorB);
            const expectedDelegatorRewardB = computeDelegatorRewards(reward2, stakeB, totalStake);
            assertRoughlyEquals(delegatorRewardB, expectedDelegatorRewardB);
        });

        it('correct rewards for rewards with different stakes', async () => {
            const poolId = hexUtils.random();
            const { delegator, stake: delegatorStake } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake now active)
            await advanceEpochAsync(); // epoch 3
            // rewards paid for stake in epoch 2.
            const { membersReward: reward1, membersStake: rewardStake1 } = await rewardPoolAsync({
                poolId,
                membersStake: toBigInt(delegatorStake) * 2n,
            });
            await advanceEpochAsync(); // epoch 4
            // rewards paid for stake in epoch 3
            const { membersReward: reward2, membersStake: rewardStake2 } = await rewardPoolAsync({
                poolId,
                membersStake: toBigInt(delegatorStake) * 3n,
            });
            const delegatorReward = await getDelegatorRewardBalanceAsync(poolId, delegator);
            const expectedDelegatorReward = bigSum(
                computeDelegatorRewards(reward1, delegatorStake, rewardStake1),
                computeDelegatorRewards(reward2, delegatorStake, rewardStake2),
            );
            assertRoughlyEquals(delegatorReward, expectedDelegatorReward);
        });

        describe('with unfinalized rewards', async () => {
            it('nothing with only unfinalized rewards from epoch 2 for delegator with nothing delegated', async () => {
                const poolId = hexUtils.random();
                const { delegator, stake } = await delegateStakeAsync(poolId, { stake: 0 });
                await advanceEpochAsync(); // epoch 2
                await setUnfinalizedPoolRewardAsync({ poolId, membersStake: stake });
                const reward = await getDelegatorRewardBalanceAsync(poolId, delegator);
                expectBigIntEqual(toBigInt(reward), 0n);
            });

            it('nothing with only unfinalized rewards from epoch 2 for delegator delegating in epoch 1', async () => {
                const poolId = hexUtils.random();
                const { delegator, stake } = await delegateStakeAsync(poolId);
                await advanceEpochAsync(); // epoch 2
                await setUnfinalizedPoolRewardAsync({ poolId, membersStake: stake });
                const reward = await getDelegatorRewardBalanceAsync(poolId, delegator);
                expectBigIntEqual(toBigInt(reward), 0n);
            });

            it('returns unfinalized rewards from epoch 3 for delegator delegating in epoch 1', async () => {
                const poolId = hexUtils.random();
                const { delegator, stake } = await delegateStakeAsync(poolId);
                await advanceEpochAsync(); // epoch 2
                await advanceEpochAsync(); // epoch 3
                const { membersReward: unfinalizedReward } = await setUnfinalizedPoolRewardAsync({
                    poolId,
                    membersStake: stake,
                });
                const reward = await getDelegatorRewardBalanceAsync(poolId, delegator);
                assertRoughlyEquals(reward, unfinalizedReward);
            });

            it('returns unfinalized rewards from epoch 4 for delegator delegating in epoch 1', async () => {
                const poolId = hexUtils.random();
                const { delegator, stake } = await delegateStakeAsync(poolId);
                await advanceEpochAsync(); // epoch 2
                await advanceEpochAsync(); // epoch 3
                await advanceEpochAsync(); // epoch 4
                const { membersReward: unfinalizedReward } = await setUnfinalizedPoolRewardAsync({
                    poolId,
                    membersStake: stake,
                });
                const reward = await getDelegatorRewardBalanceAsync(poolId, delegator);
                assertRoughlyEquals(reward, unfinalizedReward);
            });

            it('returns unfinalized rewards from epoch 4 + rewards from epoch 3 for delegator delegating in epoch 1', async () => {
                const poolId = hexUtils.random();
                const { delegator, stake } = await delegateStakeAsync(poolId);
                await advanceEpochAsync(); // epoch 2
                await advanceEpochAsync(); // epoch 3
                const { membersReward: prevReward } = await rewardPoolAsync({ poolId, membersStake: stake });
                await advanceEpochAsync(); // epoch 4
                const { membersReward: unfinalizedReward } = await setUnfinalizedPoolRewardAsync({
                    poolId,
                    membersStake: stake,
                });
                const reward = await getDelegatorRewardBalanceAsync(poolId, delegator);
                const expectedReward = bigSum(prevReward, unfinalizedReward);
                assertRoughlyEquals(reward, expectedReward);
            });

            it('returns unfinalized rewards from epoch 5 + rewards from epoch 3 for delegator delegating in epoch 2', async () => {
                const poolId = hexUtils.random();
                const { delegator, stake } = await delegateStakeAsync(poolId);
                await advanceEpochAsync(); // epoch 2
                await advanceEpochAsync(); // epoch 3
                const { membersReward: prevReward } = await rewardPoolAsync({ poolId, membersStake: stake });
                await advanceEpochAsync(); // epoch 4
                await advanceEpochAsync(); // epoch 5
                const { membersReward: unfinalizedReward } = await setUnfinalizedPoolRewardAsync({
                    poolId,
                    membersStake: stake,
                });
                const reward = await getDelegatorRewardBalanceAsync(poolId, delegator);
                const expectedReward = bigSum(prevReward, unfinalizedReward);
                assertRoughlyEquals(reward, expectedReward);
            });

            it('returns correct rewards if unfinalized stake is different from previous rewards', async () => {
                const poolId = hexUtils.random();
                const { delegator, stake } = await delegateStakeAsync(poolId);
                await advanceEpochAsync(); // epoch 2
                await advanceEpochAsync(); // epoch 3
                const { membersReward: prevReward, membersStake: prevStake } = await rewardPoolAsync({
                    poolId,
                    membersStake: toBigInt(stake) * 2n,
                });
                await advanceEpochAsync(); // epoch 4
                await advanceEpochAsync(); // epoch 5
                const { membersReward: unfinalizedReward, membersStake: unfinalizedStake } =
                    await setUnfinalizedPoolRewardAsync({
                        poolId,
                        membersStake: toBigInt(stake) * 5n,
                    });
                const reward = await getDelegatorRewardBalanceAsync(poolId, delegator);
                const expectedReward = bigSum(
                    computeDelegatorRewards(prevReward, stake, prevStake),
                    computeDelegatorRewards(unfinalizedReward, stake, unfinalizedStake),
                );
                assertRoughlyEquals(reward, expectedReward);
            });
        });
    });

    describe('reward transfers', async () => {
        it('transfers all rewards to delegator when touching stake', async () => {
            const poolId = hexUtils.random();
            const { delegator, stake } = await delegateStakeAsync(poolId);
            await advanceEpochAsync(); // epoch 2 (stake now active)
            await advanceEpochAsync(); // epoch 3
            // rewards paid for stake in epoch 2
            const { membersReward: reward } = await rewardPoolAsync({ poolId, membersStake: stake });
            const { delegatorTransfers: withdrawal } = await touchStakeAsync(poolId, delegator);
            const finalRewardBalance = await getDelegatorRewardBalanceAsync(poolId, delegator);
            expectBigIntEqual(toBigInt(withdrawal), toBigInt(reward));
            expectBigIntEqual(toBigInt(finalRewardBalance), 0n);
        });

        it('does not collect extra rewards from delegating more stake in the reward epoch', async () => {
            const poolId = hexUtils.random();
            const stakeResults = [];
            // stake
            stakeResults.push(await delegateStakeAsync(poolId));
            const { delegator, stake } = stakeResults[0];
            const rewardStake = toBigInt(stake) * 2n;
            await advanceEpochAsync(); // epoch 2 (stake now active)
            // add more stake.
            stakeResults.push(await delegateStakeAsync(poolId, { delegator, stake }));
            await advanceEpochAsync(); // epoch 2 (2 * stake now active)
            // reward for epoch 2, using 2 * stake so delegator should
            // only be entitled to a fraction of the rewards.
            const { membersReward: reward } = await rewardPoolAsync({ poolId, membersStake: rewardStake });
            await advanceEpochAsync(); // epoch 3
            // touch the stake one last time
            stakeResults.push(await touchStakeAsync(poolId, delegator));
            // Should only see deposits for epoch 3.
            const allDeposits = stakeResults.map(r => r.delegatorTransfers);
            const expectedReward = computeDelegatorRewards(reward, stake, rewardStake);
            assertRoughlyEquals(bigSum(...allDeposits), expectedReward);
        });

        it('only collects rewards from staked epochs', async () => {
            const poolId = hexUtils.random();
            const stakeResults = [];
            // stake
            stakeResults.push(await delegateStakeAsync(poolId));
            const { delegator, stake } = stakeResults[0];
            const rewardStake = toBigInt(stake) * 2n;
            await advanceEpochAsync(); // epoch 2 (full stake now active)
            // reward for epoch 1
            await rewardPoolAsync({ poolId, membersStake: rewardStake });
            // unstake some
            const unstake = toBigInt(stake) / 2n;
            stakeResults.push(await undelegateStakeAsync(poolId, delegator, unstake));
            await advanceEpochAsync(); // epoch 3 (half active stake)
            // reward for epoch 2
            const { membersReward: reward1 } = await rewardPoolAsync({ poolId, membersStake: rewardStake });
            // re-stake
            stakeResults.push(await delegateStakeAsync(poolId, { delegator, stake: unstake }));
            await advanceEpochAsync(); // epoch 4 (full stake now active)
            // reward for epoch 3
            const { membersReward: reward2 } = await rewardPoolAsync({ poolId, membersStake: rewardStake });
            // touch the stake to claim rewards
            stakeResults.push(await touchStakeAsync(poolId, delegator));
            const allDeposits = stakeResults.map(r => r.delegatorTransfers);
            const expectedReward = bigSum(
                computeDelegatorRewards(reward1, stake, rewardStake),
                computeDelegatorRewards(reward2, toBigInt(stake) - toBigInt(unstake), rewardStake),
            );
            assertRoughlyEquals(bigSum(...allDeposits), expectedReward);
        });

        it('two delegators can collect split rewards as soon as available', async () => {
            const poolId = hexUtils.random();
            const { delegator: delegatorA, stake: stakeA } = await delegateStakeAsync(poolId);
            const { delegator: delegatorB, stake: stakeB } = await delegateStakeAsync(poolId);
            const totalStake = toBigInt(stakeA) + toBigInt(stakeB);
            await advanceEpochAsync(); // epoch 2 (stakes now active)
            await advanceEpochAsync(); // epoch 3
            // rewards paid for stake in epoch 2
            const { membersReward: reward } = await rewardPoolAsync({ poolId, membersStake: totalStake });
            // delegator A will finalize and collect rewards by touching stake.
            const { delegatorTransfers: withdrawalA } = await touchStakeAsync(poolId, delegatorA);
            assertRoughlyEquals(withdrawalA, computeDelegatorRewards(reward, stakeA, totalStake));
            // delegator B will collect rewards by touching stake
            const { delegatorTransfers: withdrawalB } = await touchStakeAsync(poolId, delegatorB);
            assertRoughlyEquals(withdrawalB, computeDelegatorRewards(reward, stakeB, totalStake));
        });

        it('delegator B collects correct rewards after delegator A finalizes', async () => {
            const poolId = hexUtils.random();
            const { delegator: delegatorA, stake: stakeA } = await delegateStakeAsync(poolId);
            const { delegator: delegatorB, stake: stakeB } = await delegateStakeAsync(poolId);
            const totalStake = toBigInt(stakeA) + toBigInt(stakeB);
            await advanceEpochAsync(); // epoch 2 (stakes now active)
            await advanceEpochAsync(); // epoch 3
            // rewards paid for stake in epoch 2
            const { membersReward: prevReward } = await rewardPoolAsync({ poolId, membersStake: totalStake });
            await advanceEpochAsync(); // epoch 4
            // unfinalized rewards for stake in epoch 3
            const { membersReward: unfinalizedReward } = await setUnfinalizedPoolRewardAsync({
                poolId,
                membersStake: totalStake,
            });
            const totalRewards = bigSum(prevReward, unfinalizedReward);
            await finalizePoolAsync(poolId);
            const { delegatorTransfers: withdrawalA } = await touchStakeAsync(poolId, delegatorA);
            assertRoughlyEquals(withdrawalA, computeDelegatorRewards(totalRewards, stakeA, totalStake));
            // delegator B will collect rewards by touching stake
            const { delegatorTransfers: withdrawalB } = await touchStakeAsync(poolId, delegatorB);
            assertRoughlyEquals(withdrawalB, computeDelegatorRewards(totalRewards, stakeB, totalStake));
        });

        it('delegator A and B collect correct rewards after external finalization', async () => {
            const poolId = hexUtils.random();
            const { delegator: delegatorA, stake: stakeA } = await delegateStakeAsync(poolId);
            const { delegator: delegatorB, stake: stakeB } = await delegateStakeAsync(poolId);
            const totalStake = toBigInt(stakeA) + toBigInt(stakeB);
            await advanceEpochAsync(); // epoch 2 (stakes now active)
            await advanceEpochAsync(); // epoch 3
            // rewards paid for stake in epoch 2
            const { membersReward: prevReward } = await rewardPoolAsync({ poolId, membersStake: totalStake });
            await advanceEpochAsync(); // epoch 4
            // unfinalized rewards for stake in epoch 3
            const { membersReward: unfinalizedReward } = await setUnfinalizedPoolRewardAsync({
                poolId,
                membersStake: totalStake,
            });
            const totalRewards = bigSum(prevReward, unfinalizedReward);
            // finalize
            await finalizePoolAsync(poolId);
            // delegator A will collect rewards by touching stake.
            const { delegatorTransfers: withdrawalA } = await touchStakeAsync(poolId, delegatorA);
            assertRoughlyEquals(withdrawalA, computeDelegatorRewards(totalRewards, stakeA, totalStake));
            // delegator B will collect rewards by touching stake
            const { delegatorTransfers: withdrawalB } = await touchStakeAsync(poolId, delegatorB);
            assertRoughlyEquals(withdrawalB, computeDelegatorRewards(totalRewards, stakeB, totalStake));
        });
    });
});
// tslint:disable: max-file-line-count
