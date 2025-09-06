import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import {
    constants as testUtilsConstants,
    filterLogsToArguments,
    getRandomInteger,
    Numberish,
    shortZip,
    toBaseUnitAmount,
    verifyEventsFromLogs,
    hexUtils,
} from '../test_constants';

// Local bigint assertion helpers
function expectBigIntEqual(actual: any, expected: any, message?: string): void {
    const actualBigInt = typeof actual === 'bigint' ? actual : BigInt(actual.toString());
    const expectedBigInt = typeof expected === 'bigint' ? expected : BigInt(expected.toString());
    expect(actualBigInt, message).to.equal(expectedBigInt);
}

// StakingRichErrors - 参考 zero-ex 的错误处理模式
class StakingRichErrors {
    static PreviousEpochNotFinalizedError = class {
        constructor(
            public unfinalizedEpoch: bigint,
            public unfinalizedPoolsRemaining: bigint,
        ) {}

        // 编码为 LibRichErrors 格式的错误数据
        encode(): string {
            // bytes4(keccak256("PreviousEpochNotFinalizedError(uint256,uint256)")) = 0x614b800a
            const selector = '0x614b800a';
            const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'uint256'],
                [this.unfinalizedEpoch, this.unfinalizedPoolsRemaining],
            );
            return selector + encodedParams.slice(2); // 移除 encodedParams 的 0x 前缀
        }

        toString() {
            return `PreviousEpochNotFinalizedError: epoch=${this.unfinalizedEpoch}, pools=${this.unfinalizedPoolsRemaining}`;
        }
    };
}

// 统一错误匹配器 - 参考 zero-ex 的 UnifiedErrorMatcher
class StakingErrorMatcher {
    static async expectError(txPromise: Promise<any>, expectedError: any): Promise<void> {
        try {
            await txPromise;
            throw new Error('交易应该失败但没有失败');
        } catch (error: any) {
            if (expectedError.encode && typeof expectedError.encode === 'function') {
                // 匹配 LibRichErrors 编码的错误
                if (!error.data) {
                    throw new Error(`未找到错误数据，实际错误: ${error.message}`);
                }
                const expectedEncoded = expectedError.encode();
                if (error.data !== expectedEncoded) {
                    throw new Error(`错误编码不匹配。期望: ${expectedEncoded}, 实际: ${error.data}`);
                }
            } else if (typeof expectedError === 'string') {
                // 匹配字符串错误消息
                if (!error.message || !error.message.includes(expectedError)) {
                    throw new Error(`错误消息不匹配。期望包含: "${expectedError}", 实际: "${error.message}"`);
                }
            } else {
                throw new Error(`不支持的错误类型: ${typeof expectedError}`);
            }
        }
    }
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
import { StakingRevertErrors } from '../../src';
// 移除对 @0x/utils 的依赖
// import { revertErrorHelper } from '@0x/utils';
// 注册 RevertError 匹配器，支持 .to.be.revertedWith(RevertError 实例)
// chai.use(revertErrorHelper);
import { LogEntry } from 'ethereum-types';
import * as _ from 'lodash';

import { constants as stakingConstants } from '../../src/constants';

import { TestFinalizer__factory, TestFinalizer } from '../../src/typechain-types';

// Remove legacy wrapper types; use plain event names

describe('Finalizer unit tests', () => {
    const { ZERO_AMOUNT } = testUtilsConstants;
    const INITIAL_BALANCE = toBaseUnitAmount(32);
    let operatorRewardsReceiver: string;
    let membersRewardsReceiver: string;
    let testContract: TestFinalizer;

    before(async () => {
        const [deployer, sender] = await ethers.getSigners();
        operatorRewardsReceiver = await sender.getAddress();
        membersRewardsReceiver = await deployer.getAddress();
        const factory = new TestFinalizer__factory(deployer);
        testContract = await factory.deploy(operatorRewardsReceiver, membersRewardsReceiver);
        // 合约充值 ETH 余额
        await (await deployer.sendTransaction({ to: await testContract.getAddress(), value: INITIAL_BALANCE })).wait();
        // 测试中不注册任何 exchange 地址，避免 endEpoch 时触发移除校验
    });

    beforeEach(async () => {
        // 直接部署新合约，且将奖励接收地址设为两个全新随机钱包地址（初始余额为 0），
        // 便于后续对余额进行精确等值断言。
        const [deployer] = await ethers.getSigners();
        const op = ethers.Wallet.createRandom();
        const mem = ethers.Wallet.createRandom();
        operatorRewardsReceiver = op.address;
        membersRewardsReceiver = mem.address;
        const fresh = await new TestFinalizer__factory(deployer).deploy(
            operatorRewardsReceiver,
            membersRewardsReceiver,
        );
        testContract = fresh;
        await (await deployer.sendTransaction({ to: await testContract.getAddress(), value: INITIAL_BALANCE })).wait();
    });

    // 移除 web3Wrapper，统一使用 ethers v6 发送 ETH

    interface ActivePoolOpts {
        poolId: string;
        operatorShare: number;
        feesCollected: Numberish;
        membersStake: Numberish;
        weightedStake: Numberish;
    }

    async function addActivePoolAsync(opts?: Partial<ActivePoolOpts>): Promise<ActivePoolOpts> {
        const maxAmount = toBaseUnitAmount(1000); // keep values safe for bigint
        const _opts = {
            poolId: hexUtils.random(),
            operatorShare: Math.random(),
            feesCollected: BigInt(getRandomInteger(1, 1000)) * 10n ** 18n,
            membersStake: BigInt(getRandomInteger(0, 1000)) * 10n ** 18n,
            weightedStake: BigInt(getRandomInteger(0, 1000)) * 10n ** 18n,
            ...opts,
        };
        const tx = await testContract.addActivePool(
            _opts.poolId,
            Math.floor(_opts.operatorShare * testUtilsConstants.PPM_100_PERCENT),
            toBigInt(_opts.feesCollected),
            toBigInt(_opts.membersStake),
            toBigInt(_opts.weightedStake),
        );
        await tx.wait();
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
        const s = await testContract.getAggregatedStatsForPreviousEpoch();
        return {
            rewardsAvailable: s.rewardsAvailable,
            numPoolsToFinalize: s.numPoolsToFinalize,
            totalFeesCollected: s.totalFeesCollected,
            totalWeightedStake: s.totalWeightedStake,
            totalRewardsFinalized: s.totalRewardsFinalized,
        };
    }

    async function finalizePoolsAsync(poolIds: string[]): Promise<any[]> {
        const logs: any[] = [];
        for (const poolId of poolIds) {
            const receipt = await (await testContract.finalizePool(poolId)).wait();
            logs.splice(logs.length, 0, ...(receipt?.logs ?? []));
        }
        return logs;
    }

    async function assertUnfinalizedStateAsync(expected: Partial<UnfinalizedState>): Promise<void> {
        const actual = await getUnfinalizedStateAsync();
        assertEqualNumberFields(actual, expected);
    }

    function assertEpochEndedEvent(logs: LogEntry[], args: any): void {
        const events = getEpochEndedEvents(logs);
        expect(events.length).to.eq(1);
        assertEqualNumberFields(events[0], args);
    }

    function assertEpochFinalizedEvent(logs: LogEntry[], args: any): void {
        const events = getEpochFinalizedEvents(logs);
        expect(events.length).to.eq(1);
        assertEqualNumberFields(events[0], args);
    }

    function assertEqualNumberFields<T>(actual: any, expected: Partial<T>): void {
        for (const key of Object.keys(actual)) {
            const a = actual[key] as any;
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
        const poolsWithStake = poolsToFinalize.filter(p => toBigInt(p.weightedStake) !== 0n);
        const poolRewards = await calculatePoolRewardsAsync(rewardsAvailable, poolsWithStake);
        const totalRewards = poolRewards.reduce((a, b) => a + toBigInt(b), 0n);
        const rewardsRemaining = toBigInt(rewardsAvailable) - totalRewards;
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
            expectBigIntEqual(toBigInt(event.operatorReward), toBigInt(operatorReward));
            expectBigIntEqual(toBigInt(event.membersReward), toBigInt(membersReward));
        }

        // Assert the `DepositStakingPoolRewards` logs.
        const depositStakingPoolRewardsEvents = getDepositStakingPoolRewardsEvents(finalizationLogs);
        expect(depositStakingPoolRewardsEvents.length).to.eq(poolsWithStake.length);
        for (const i of _.times(depositStakingPoolRewardsEvents.length)) {
            const event = depositStakingPoolRewardsEvents[i];
            const pool = poolsWithStake[i];
            const reward = poolRewards[i];
            expect(event.poolId).to.eq(pool.poolId);
            expectBigIntEqual(toBigInt(event.reward), toBigInt(reward));
            expectBigIntEqual(toBigInt(event.membersStake), toBigInt(pool.membersStake));
        }
        // Make sure they all sum up to the totals.
        if (depositStakingPoolRewardsEvents.length > 0) {
            const totalDepositRewards = depositStakingPoolRewardsEvents
                .map(e => toBigInt(e.reward))
                .reduce((a, b) => a + b, 0n);
            expectBigIntEqual(totalDepositRewards, toBigInt(totalRewards));
        }

        // Assert the `EpochFinalized` logs.
        const epochFinalizedEvents = getEpochFinalizedEvents(finalizationLogs);
        expect(epochFinalizedEvents.length).to.eq(1);
        expectBigIntEqual(toBigInt(epochFinalizedEvents[0].epoch), toBigInt(currentEpoch) - 1n);
        expectBigIntEqual(toBigInt(epochFinalizedEvents[0].rewardsPaid), toBigInt(totalRewards));
        expectBigIntEqual(toBigInt(epochFinalizedEvents[0].rewardsRemaining), toBigInt(rewardsRemaining));

        // Assert the receiver balances.
        await assertReceiverBalancesAsync(totalOperatorRewards, totalMembersRewards);
    }

    async function assertReceiverBalancesAsync(operatorRewards: Numberish, membersRewards: Numberish): Promise<void> {
        const operatorRewardsBalance = await getBalanceOfAsync(operatorRewardsReceiver);
        expectBigIntEqual(operatorRewardsBalance, toBigInt(operatorRewards));
        const membersRewardsBalance = await getBalanceOfAsync(membersRewardsReceiver);
        expectBigIntEqual(membersRewardsBalance, toBigInt(membersRewards));
    }

    async function calculatePoolRewardsAsync(
        rewardsAvailable: Numberish,
        poolsToFinalize: ActivePoolOpts[],
    ): Promise<bigint[]> {
        const totalFees = poolsToFinalize.map(p => toBigInt(p.feesCollected)).reduce((a, b) => a + b, 0n);
        const totalStake = poolsToFinalize.map(p => toBigInt(p.weightedStake)).reduce((a, b) => a + b, 0n);
        const rewardsArray: bigint[] = [];
        for (const pool of poolsToFinalize) {
            const feesCollected = toBigInt(pool.feesCollected);
            if (feesCollected === 0n) {
                rewardsArray.push(0n);
                continue;
            }
            const reward = await testContract.cobbDouglas(
                toBigInt(rewardsAvailable),
                feesCollected,
                totalFees,
                toBigInt(pool.weightedStake),
                totalStake,
            );
            rewardsArray.push(toBigInt(reward));
        }
        return rewardsArray;
    }

    function splitRewards(pool: ActivePoolOpts, totalReward: Numberish): [bigint, bigint] {
        const total = toBigInt(totalReward);
        if (toBigInt(pool.membersStake) === 0n) {
            return [total, 0n];
        }
        // operatorShare is a number in [0, PPM], we used ppm as integer percent
        const operatorSharePpm = BigInt(Math.floor(pool.operatorShare * testUtilsConstants.PPM_100_PERCENT));
        const operatorReward = (total * operatorSharePpm + 999_999n) / 1_000_000n; // round up
        const membersReward = total - operatorReward;
        return [operatorReward, membersReward];
    }

    // Calculates the split rewards for every pool and returns the operator
    // and member sums.
    function getTotalSplitRewards(pools: ActivePoolOpts[], rewards: Numberish[]): [bigint, bigint] {
        const splits = _.times(pools.length).map(i => splitRewards(pools[i], rewards[i] as any));
        const totalOperatorRewards = splits.map(s => s[0]).reduce((a, b) => a + b, 0n);
        const totalMembersRewards = splits.map(s => s[1]).reduce((a, b) => a + b, 0n);
        return [totalOperatorRewards, totalMembersRewards];
    }

    function getEpochEndedEvents(logs: LogEntry[]): any[] {
        return filterLogsToArguments(logs, 'EpochEnded');
    }

    function getEpochFinalizedEvents(logs: LogEntry[]): any[] {
        return filterLogsToArguments(logs, 'EpochFinalized');
    }

    function getDepositStakingPoolRewardsEvents(logs: LogEntry[]): any[] {
        return filterLogsToArguments(logs, 'DepositStakingPoolRewards');
    }

    function getRewardsPaidEvents(logs: LogEntry[]): any[] {
        return filterLogsToArguments(logs, 'RewardsPaid');
    }

    async function getCurrentEpochAsync(): Promise<bigint> {
        return toBigInt(await testContract.currentEpoch());
    }

    async function getBalanceOfAsync(whom: string): Promise<bigint> {
        return await ethers.provider.getBalance(whom);
    }

    describe('endEpoch()', () => {
        it('advances the epoch', async () => {
            await (await testContract.endEpoch()).wait();
            const currentEpoch = await testContract.currentEpoch();
            expectBigIntEqual(toBigInt(currentEpoch), toBigInt(stakingConstants.INITIAL_EPOCH) + 1n);
        });

        it('emits an `EpochEnded` event', async () => {
            const receipt = await (await testContract.endEpoch()).wait();
            assertEpochEndedEvent(receipt?.logs ?? [], {
                epoch: stakingConstants.INITIAL_EPOCH,
                numActivePools: ZERO_AMOUNT,
                rewardsAvailable: INITIAL_BALANCE,
                totalFeesCollected: ZERO_AMOUNT,
                totalWeightedStake: ZERO_AMOUNT,
            });
        });

        it('immediately finalizes if there are no pools to finalize', async () => {
            const receipt2 = await (await testContract.endEpoch()).wait();
            assertEpochFinalizedEvent(receipt2?.logs ?? [], {
                epoch: stakingConstants.INITIAL_EPOCH,
                rewardsPaid: ZERO_AMOUNT,
                rewardsRemaining: INITIAL_BALANCE,
            });
        });

        it('does not immediately finalize if there is a pool to finalize', async () => {
            await addActivePoolAsync();
            const receipt3 = await (await testContract.endEpoch()).wait();
            const events = filterLogsToArguments(receipt3?.logs ?? [], 'EpochFinalized');
            expect(events).to.deep.eq([]);
        });

        it('prepares unfinalized state', async () => {
            // Add a pool so there is state to clear.
            const pool = await addActivePoolAsync();
            await (await testContract.endEpoch()).wait();
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
            await (await testContract.endEpoch()).wait();
            const aggregatedStats = await testContract.aggregatedStatsByEpoch(epoch);
            expectBigIntEqual(toBigInt(aggregatedStats.rewardsAvailable), toBigInt(INITIAL_BALANCE));
            expectBigIntEqual(toBigInt(aggregatedStats.numPoolsToFinalize), 1n);
            expectBigIntEqual(toBigInt(aggregatedStats.totalFeesCollected), toBigInt(pool.feesCollected));
            expectBigIntEqual(toBigInt(aggregatedStats.totalWeightedStake), toBigInt(pool.weightedStake));
            expectBigIntEqual(toBigInt(aggregatedStats.totalRewardsFinalized), 0n);
        });

        it('reverts if the prior epoch is unfinalized', async () => {
            await addActivePoolAsync();
            await (await testContract.endEpoch()).wait();
            const tx = testContract.endEpoch();
            // ✅ 基于业务逻辑构造具体的 epoch 错误 - 参考 zero-ex 的错误处理模式
            // 测试意图：验证前一个 epoch 未完成时不能开始新的 epoch
            // 应该抛出 PreviousEpochNotFinalizedError，包含未完成的 epoch 和剩余池数量
            const currentEpoch = await testContract.currentEpoch();
            const prevEpoch = currentEpoch - 1n;
            const numPoolsToFinalize = 1n; // 我们添加了一个活跃池但没有完成
            const expectedError = new StakingRichErrors.PreviousEpochNotFinalizedError(prevEpoch, numPoolsToFinalize);
            return StakingErrorMatcher.expectError(tx, expectedError);
        });
    });

    describe('_finalizePool()', () => {
        it('does nothing if there were no pools to finalize', async () => {
            await (await testContract.endEpoch()).wait();
            const poolId = hexUtils.random();
            const logs = await finalizePoolsAsync([poolId]);
            expect(logs).to.deep.eq([]);
        });

        it('can finalize a pool', async () => {
            const pool = await addActivePoolAsync();
            await (await testContract.endEpoch()).wait();
            const logs = await finalizePoolsAsync([pool.poolId]);
            return assertFinalizationLogsAndBalancesAsync(INITIAL_BALANCE, [pool], logs);
        });

        it('can finalize multiple pools over multiple transactions', async () => {
            const pools = await Promise.all(_.times(2, async () => addActivePoolAsync()));
            await (await testContract.endEpoch()).wait();
            const logs = await finalizePoolsAsync(pools.map(p => p.poolId));
            return assertFinalizationLogsAndBalancesAsync(INITIAL_BALANCE, pools, logs);
        });

        it('ignores a finalized pool', async () => {
            const pools = await Promise.all(_.times(3, async () => addActivePoolAsync()));
            await (await testContract.endEpoch()).wait();
            const [finalizedPool] = _.sampleSize(pools, 1);
            await finalizePoolsAsync([finalizedPool.poolId]);
            const logs = await finalizePoolsAsync([finalizedPool.poolId]);
            const rewardsPaidEvents = getRewardsPaidEvents(logs);
            expect(rewardsPaidEvents).to.deep.eq([]);
        });

        it('resets pool state after finalizing it', async () => {
            const pools = await Promise.all(_.times(3, async () => addActivePoolAsync()));
            const pool = _.sample(pools) as ActivePoolOpts;
            await (await testContract.endEpoch()).wait();
            await finalizePoolsAsync([pool.poolId]);
            const poolState = await testContract.getPoolStatsFromEpoch(stakingConstants.INITIAL_EPOCH, pool.poolId);
            expectBigIntEqual(toBigInt(poolState.feesCollected), 0n);
            expectBigIntEqual(toBigInt(poolState.weightedStake), 0n);
            expectBigIntEqual(toBigInt(poolState.membersStake), 0n);
        });

        it('`rewardsPaid` <= `rewardsAvailable` <= contract balance at the end of the epoch', async () => {
            const pools = await Promise.all(_.times(3, async () => addActivePoolAsync()));
            const receipt = await (await testContract.endEpoch()).wait();
            const { rewardsAvailable } = getEpochEndedEvents(receipt?.logs ?? [])[0];
            expectBigIntLessThanOrEqual(toBigInt(rewardsAvailable), toBigInt(INITIAL_BALANCE));
            const logs = await finalizePoolsAsync(pools.map(r => r.poolId));
            const { rewardsPaid } = getEpochFinalizedEvents(logs)[0];
            expectBigIntLessThanOrEqual(toBigInt(rewardsPaid), toBigInt(rewardsAvailable));
        });

        it('`rewardsPaid` <= `rewardsAvailable` with two equal pools', async () => {
            const pool1 = await addActivePoolAsync();
            const pool2 = await addActivePoolAsync(_.omit(pool1, 'poolId'));
            const receipt = await (await testContract.endEpoch()).wait();
            const { rewardsAvailable } = getEpochEndedEvents(receipt?.logs ?? [])[0];
            const logs = await finalizePoolsAsync([pool1, pool2].map(r => r.poolId));
            const { rewardsPaid } = getEpochFinalizedEvents(logs)[0];
            expectBigIntLessThanOrEqual(toBigInt(rewardsPaid), toBigInt(rewardsAvailable));
        });

        describe('`rewardsPaid` fuzzing', () => {
            const numTests = 32;
            for (const i of _.times(numTests)) {
                const numPools = _.random(1, 32);
                it(`${i + 1}/${numTests} \`rewardsPaid\` <= \`rewardsAvailable\` (${numPools} pools)`, async () => {
                    const pools = await Promise.all(_.times(numPools, async () => addActivePoolAsync()));
                    const receipt = await (await testContract.endEpoch()).wait();
                    const { rewardsAvailable } = getEpochEndedEvents(receipt?.logs ?? [])[0];
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
            await (await testContract.endEpoch()).wait();
            await finalizePoolsAsync([pool.poolId]);
            await (await testContract.endEpoch()).wait();
            expectBigIntEqual(toBigInt(await getCurrentEpochAsync()), toBigInt(stakingConstants.INITIAL_EPOCH + 2n));
        });

        it('does not reward a pool that only earned rewards 2 epochs ago', async () => {
            const pool1 = await addActivePoolAsync();
            await (await testContract.endEpoch()).wait();
            await finalizePoolsAsync([pool1.poolId]);
            await addActivePoolAsync();
            await (await testContract.endEpoch()).wait();
            expectBigIntEqual(toBigInt(await getCurrentEpochAsync()), toBigInt(stakingConstants.INITIAL_EPOCH + 2n));
            const logs = await finalizePoolsAsync([pool1.poolId]);
            const rewardsPaidEvents = getRewardsPaidEvents(logs);
            expect(rewardsPaidEvents).to.deep.eq([]);
        });

        it('does not reward a pool that only earned rewards 3 epochs ago', async () => {
            const pool1 = await addActivePoolAsync();
            await (await testContract.endEpoch()).wait();
            await finalizePoolsAsync([pool1.poolId]);
            await (await testContract.endEpoch()).wait();
            await addActivePoolAsync();
            await (await testContract.endEpoch()).wait();
            expectBigIntEqual(toBigInt(await getCurrentEpochAsync()), toBigInt(stakingConstants.INITIAL_EPOCH + 3n));
            const logs = await finalizePoolsAsync([pool1.poolId]);
            const rewardsPaidEvents = getRewardsPaidEvents(logs);
            expect(rewardsPaidEvents).to.deep.eq([]);
        });

        it('rolls over leftover rewards into the next epoch', async () => {
            const poolIds = _.times(3, () => hexUtils.random());
            await Promise.all(poolIds.map(async id => addActivePoolAsync({ poolId: id })));
            const end1 = await (await testContract.endEpoch()).wait();
            const finalizeLogs = await finalizePoolsAsync(poolIds);
            const { rewardsRemaining: rolledOverRewards } = getEpochFinalizedEvents(finalizeLogs)[0];
            await Promise.all(poolIds.map(async id => addActivePoolAsync({ poolId: id })));
            const endReceipt = await (await testContract.endEpoch()).wait();
            const { rewardsAvailable } = getEpochEndedEvents(endReceipt?.logs ?? [])[0];
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
            await (await testContract.endEpoch()).wait();
            const poolId = hexUtils.random();
            return assertUnfinalizedPoolRewardsAsync(poolId, ZERO_REWARDS);
        });

        it('returns empty if pool is earned rewards only in the current epoch', async () => {
            const pool = await addActivePoolAsync();
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, ZERO_REWARDS);
        });

        it('returns empty if pool only earned rewards in the 2 epochs ago', async () => {
            const pool = await addActivePoolAsync();
            await (await testContract.endEpoch()).wait();
            await finalizePoolsAsync([pool.poolId]);
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, ZERO_REWARDS);
        });

        it('returns empty if pool was already finalized', async () => {
            const pools = await Promise.all(_.times(3, async () => addActivePoolAsync()));
            const [pool] = _.sampleSize(pools, 1);
            await (await testContract.endEpoch()).wait();
            await finalizePoolsAsync([pool.poolId]);
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, ZERO_REWARDS);
        });

        it('computes one reward among one pool', async () => {
            const pool = await addActivePoolAsync();
            await (await testContract.endEpoch()).wait();
            const expectedTotalRewards = INITIAL_BALANCE;
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, {
                totalReward: expectedTotalRewards,
                membersStake: pool.membersStake,
            });
        });

        it('computes one reward among multiple pools', async () => {
            const pools = await Promise.all(_.times(3, async () => addActivePoolAsync()));
            await (await testContract.endEpoch()).wait();
            const expectedPoolRewards = await calculatePoolRewardsAsync(INITIAL_BALANCE, pools);
            const [pool, reward] = _.sampleSize(shortZip(pools, expectedPoolRewards), 1)[0];
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, {
                totalReward: reward,
                membersStake: pool.membersStake,
            });
        });

        it('computes a reward with 0% operatorShare', async () => {
            const pool = await addActivePoolAsync({ operatorShare: 0 });
            const tx = await testContract.endEpoch();
            await tx.wait();
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, {
                totalReward: INITIAL_BALANCE,
                membersStake: pool.membersStake,
            });
        });

        it('computes a reward with 0% < operatorShare < 100%', async () => {
            const pool = await addActivePoolAsync({ operatorShare: Math.random() });
            const tx2 = await testContract.endEpoch();
            await tx2.wait();
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, {
                totalReward: INITIAL_BALANCE,
                membersStake: pool.membersStake,
            });
        });

        it('computes a reward with 100% operatorShare', async () => {
            const pool = await addActivePoolAsync({ operatorShare: 1 });
            const tx3 = await testContract.endEpoch();
            await tx3.wait();
            return assertUnfinalizedPoolRewardsAsync(pool.poolId, {
                totalReward: INITIAL_BALANCE,
                membersStake: pool.membersStake,
            });
        });
    });
});
// tslint:disable: max-file-line-count
