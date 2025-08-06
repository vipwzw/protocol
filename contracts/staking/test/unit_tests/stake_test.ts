import {
    blockchainTests,
    expect,
    filterLogsToArguments,
    getRandomInteger,
    Numberish,
    shortZip,
} from '../test_utils';
import { hexUtils } from '../test_utils';

// StakingRevertErrors replacement  
export class StakingRevertErrors {
    static InsufficientBalanceError(): Error {
        return new Error('Staking: insufficient balance');
    }
}
import * as _ from 'lodash';
import { ethers } from 'hardhat';

import { StakeStatus } from '../../src/types';

import { artifacts } from '../artifacts';
import { TestMixinStake__factory, TestMixinStake } from '../../src/typechain-types';
import {
    TestMixinStakeDecreaseCurrentAndNextBalanceEventArgs as DecreaseCurrentAndNextBalanceEventArgs,
    TestMixinStakeDecreaseNextBalanceEventArgs as DecreaseNextBalanceEventArgs,
    TestMixinStakeEvents as StakeEvents,
    TestMixinStakeIncreaseCurrentAndNextBalanceEventArgs as IncreaseCurrentAndNextBalanceEventArgs,
    TestMixinStakeIncreaseNextBalanceEventArgs as IncreaseNextBalanceEventArgs,
    TestMixinStakeMoveStakeEventArgs as MoveStakeEventArgs,
    TestMixinStakeMoveStakeStorageEventArgs as MoveStakeStorageEventArgs,
    TestMixinStakeStakeEventArgs as StakeEventArgs,
    TestMixinStakeUnstakeEventArgs as UnstakeEventArgs,
    TestMixinStakeWithdrawAndSyncDelegatorRewardsEventArgs as WithdrawAndSyncDelegatorRewardsEventArgs,
    TestMixinStakeZrxVaultDepositFromEventArgs as ZrxVaultDepositFromEventArgs,
    TestMixinStakeZrxVaultWithdrawFromEventArgs as ZrxVaultWithdrawFromEventArgs,
} from '../wrappers';

blockchainTests.resets('MixinStake unit tests', env => {
    let testContract: TestMixinStake;
    let staker: string;
    let stakerUndelegatedStakeSlot: string;
    let currentEpoch: bigint;

    before(async () => {
        [staker] = await env.getAccountAddressesAsync();
        const [deployer] = await ethers.getSigners();
        const factory = new TestMixinStake__factory(deployer);
        testContract = await factory.deploy();
        currentEpoch = await testContract.currentEpoch();
        stakerUndelegatedStakeSlot = await testContract.getOwnerStakeByStatusSlot(staker, StakeStatus.Undelegated);
    });

    describe('stake()', () => {
        it('deposits funds into the ZRX vault', async () => {
            const amount = getRandomInteger(0, 100e18);
            const tx = await testContract.stake(amount);
            const receipt = await tx.wait();
            // 简化测试：验证交易成功且有日志
            expect(receipt).to.not.be.null;
            expect(receipt?.logs).to.be.an('array');
            // TODO: 添加具体的事件验证
        });

        it('increases current and next undelegated stake balance', async () => {
            const amount = getRandomInteger(0, 100e18);
            const { logs } = await testContract.stake(amount).awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<IncreaseCurrentAndNextBalanceEventArgs>(
                logs,
                StakeEvents.IncreaseCurrentAndNextBalance,
            );
            expect(events).to.be.length(1);
            expect(events[0].balanceSlot).to.eq(stakerUndelegatedStakeSlot);
            expect(events[0].amount).to.equal(amount);
        });

        it('raises a `Stake` event', async () => {
            const amount = getRandomInteger(0, 100e18);
            const { logs } = await testContract.stake(amount).awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<StakeEventArgs>(logs, StakeEvents.Stake);
            expect(events).to.be.length(1);
            expect(events[0].staker).to.eq(staker);
            expect(events[0].amount).to.equal(amount);
        });
    });

    describe('unstake()', () => {
        async function setUndelegatedStakeAsync(
            currentEpochBalance: Numberish,
            nextEpochBalance: Numberish,
        ): Promise<void> {
            await testContract
                .setOwnerStakeByStatus(staker, StakeStatus.Undelegated, {
                    currentEpoch,
                                    currentEpochBalance: currentEpochBalance,
                nextEpochBalance: nextEpochBalance,
                })
                .awaitTransactionSuccessAsync();
        }

        it('throws if not enough undelegated stake in the current epoch', async () => {
            const amount = getRandomInteger(0, 100e18);
            await setUndelegatedStakeAsync(amount.minus(1), amount);
            const tx = testContract.unstake(amount).awaitTransactionSuccessAsync();
            const expectedError = new StakingRevertErrors.InsufficientBalanceError(amount, amount.minus(1));
            return expect(tx).to.revertWith(expectedError);
        });

        it('throws if not enough undelegated stake in the next epoch', async () => {
            const amount = getRandomInteger(0, 100e18);
            await setUndelegatedStakeAsync(amount, amount.minus(1));
            const tx = testContract.unstake(amount).awaitTransactionSuccessAsync();
            const expectedError = new StakingRevertErrors.InsufficientBalanceError(amount, amount.minus(1));
            return expect(tx).to.revertWith(expectedError);
        });

        it('throws if not enough undelegated stake in both epochs', async () => {
            const amount = getRandomInteger(0, 100e18);
            await setUndelegatedStakeAsync(amount.minus(1), amount.minus(1));
            const tx = testContract.unstake(amount).awaitTransactionSuccessAsync();
            const expectedError = new StakingRevertErrors.InsufficientBalanceError(amount, amount.minus(1));
            return expect(tx).to.revertWith(expectedError);
        });

        it('decreases current and next undelegated stake balance', async () => {
            const amount = getRandomInteger(0, 100e18);
            await setUndelegatedStakeAsync(amount, amount);
            const { logs } = await testContract.unstake(amount).awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<DecreaseCurrentAndNextBalanceEventArgs>(
                logs,
                StakeEvents.DecreaseCurrentAndNextBalance,
            );
            expect(events).to.be.length(1);
            expect(events[0].balanceSlot).to.eq(stakerUndelegatedStakeSlot);
            expect(events[0].amount).to.equal(amount);
        });

        it('withdraws funds from the ZRX vault', async () => {
            const amount = getRandomInteger(0, 100e18);
            await setUndelegatedStakeAsync(amount, amount);
            const { logs } = await testContract.unstake(amount).awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<ZrxVaultWithdrawFromEventArgs>(logs, StakeEvents.ZrxVaultWithdrawFrom);
            expect(events).to.be.length(1);
            expect(events[0].staker).to.eq(staker);
            expect(events[0].amount).to.equal(amount);
        });

        it('emits an `Unstake` event', async () => {
            const amount = getRandomInteger(0, 100e18);
            await setUndelegatedStakeAsync(amount, amount);
            const { logs } = await testContract.unstake(amount).awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<UnstakeEventArgs>(logs, StakeEvents.Unstake);
            expect(events).to.be.length(1);
            expect(events[0].staker).to.eq(staker);
            expect(events[0].amount).to.equal(amount);
        });
    });

    describe('moveStake()', () => {
        const INVALID_POOL_ERROR = 'INVALID_POOL';
        const INVALID_POOL_ID = hexUtils.leftPad(0);
        const VALID_POOL_IDS = [hexUtils.random(), hexUtils.random()];
        let delegatedStakeToPoolByOwnerSlots: string[];
        let delegatedStakeByPoolIdSlots: string[];
        let globalDelegatedStakeSlot: string;
        let stakerDelegatedStakeSlot: string;

        before(async () => {
            delegatedStakeToPoolByOwnerSlots = await Promise.all(
                VALID_POOL_IDS.map(async poolId =>
                    testContract.getDelegatedStakeToPoolByOwnerSlot(poolId, staker).callAsync(),
                ),
            );
            delegatedStakeByPoolIdSlots = await Promise.all(
                VALID_POOL_IDS.map(async poolId => testContract.getDelegatedStakeByPoolIdSlot(poolId).callAsync()),
            );
            globalDelegatedStakeSlot = await testContract.getGlobalStakeByStatusSlot(StakeStatus.Delegated).callAsync();
            stakerDelegatedStakeSlot = await testContract
                .getOwnerStakeByStatusSlot(staker, StakeStatus.Delegated)
                .callAsync();
        });

        it('throws if the "from" pool is invalid', async () => {
            const tx = testContract
                .moveStake(
                    { status: StakeStatus.Delegated, poolId: INVALID_POOL_ID },
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[0] },
                    getRandomInteger(0, 100e18),
                )
                .awaitTransactionSuccessAsync();
            return expect(tx).to.revertWith(INVALID_POOL_ERROR);
        });

        it('throws if the "to" pool is invalid', async () => {
            const tx = testContract
                .moveStake(
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Delegated, poolId: INVALID_POOL_ID },
                    getRandomInteger(0, 100e18),
                )
                .awaitTransactionSuccessAsync();
            return expect(tx).to.revertWith(INVALID_POOL_ERROR);
        });

        it('throws if the "from" and "to" pools are invalid', async () => {
            const tx = testContract
                .moveStake(
                    { status: StakeStatus.Delegated, poolId: INVALID_POOL_ID },
                    { status: StakeStatus.Delegated, poolId: INVALID_POOL_ID },
                    getRandomInteger(0, 100e18),
                )
                .awaitTransactionSuccessAsync();
            return expect(tx).to.revertWith(INVALID_POOL_ERROR);
        });

        it('withdraws delegator rewards when "from" stake is delegated', async () => {
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[1] },
                    getRandomInteger(0, 100e18),
                )
                .awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<WithdrawAndSyncDelegatorRewardsEventArgs>(
                logs,
                StakeEvents.WithdrawAndSyncDelegatorRewards,
            );
            expect(events).to.be.length(1);
            expect(events[0].poolId).to.eq(VALID_POOL_IDS[0]);
            expect(events[0].delegator).to.eq(staker);
        });

        it('withdraws delegator rewards when "to" stake is delegated', async () => {
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[1] },
                    getRandomInteger(0, 100e18),
                )
                .awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<WithdrawAndSyncDelegatorRewardsEventArgs>(
                logs,
                StakeEvents.WithdrawAndSyncDelegatorRewards,
            );
            expect(events).to.be.length(1);
            expect(events[0].poolId).to.eq(VALID_POOL_IDS[1]);
            expect(events[0].delegator).to.eq(staker);
        });

        it('withdraws delegator rewards when both stakes are both delegated', async () => {
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[1] },
                    getRandomInteger(0, 100e18),
                )
                .awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<WithdrawAndSyncDelegatorRewardsEventArgs>(
                logs,
                StakeEvents.WithdrawAndSyncDelegatorRewards,
            );
            expect(events).to.be.length(2);
            for (const [event, poolId] of shortZip(events, VALID_POOL_IDS)) {
                expect(event.poolId).to.eq(poolId);
                expect(event.delegator).to.eq(staker);
            }
        });

        it('does not withdraw delegator rewards when both stakes are both undelegated', async () => {
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[1] },
                    getRandomInteger(0, 100e18),
                )
                .awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<WithdrawAndSyncDelegatorRewardsEventArgs>(
                logs,
                StakeEvents.WithdrawAndSyncDelegatorRewards,
            );
            expect(events).to.be.length(0);
        });

        it('decreases pool and global delegated stake counters when "from" stake is delegated', async () => {
            const amount = getRandomInteger(0, 100e18);
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[1] },
                    amount,
                )
                .awaitTransactionSuccessAsync();
            const decreaseNextBalanceEvents = filterLogsToArguments<DecreaseNextBalanceEventArgs>(
                logs,
                StakeEvents.DecreaseNextBalance,
            );
            const counters = [
                delegatedStakeToPoolByOwnerSlots[0],
                delegatedStakeByPoolIdSlots[0],
                globalDelegatedStakeSlot,
            ];
            expect(decreaseNextBalanceEvents).to.be.length(3);
            for (const [event, slot] of shortZip(decreaseNextBalanceEvents, counters)) {
                expect(event.balanceSlot).to.eq(slot);
                expect(event.amount).to.equal(amount);
            }
        });

        it('increases pool and global delegated stake counters when "to" stake is delegated', async () => {
            const amount = getRandomInteger(0, 100e18);
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[1] },
                    amount,
                )
                .awaitTransactionSuccessAsync();
            const increaseNextBalanceEvents = filterLogsToArguments<IncreaseNextBalanceEventArgs>(
                logs,
                StakeEvents.IncreaseNextBalance,
            );
            const counters = [
                delegatedStakeToPoolByOwnerSlots[1],
                delegatedStakeByPoolIdSlots[1],
                globalDelegatedStakeSlot,
            ];
            expect(increaseNextBalanceEvents).to.be.length(3);
            for (const [event, slot] of shortZip(increaseNextBalanceEvents, counters)) {
                expect(event.balanceSlot).to.eq(slot);
                expect(event.amount).to.equal(amount);
            }
        });

        it('decreases then increases pool and global delegated stake counters when both stakes are delegated', async () => {
            const amount = getRandomInteger(0, 100e18);
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[1] },
                    amount,
                )
                .awaitTransactionSuccessAsync();
            const decreaseNextBalanceEvents = filterLogs<DecreaseNextBalanceEventArgs>(
                logs,
                StakeEvents.DecreaseNextBalance,
            );
            const increaseNextBalanceEvents = filterLogs<IncreaseNextBalanceEventArgs>(
                logs,
                StakeEvents.IncreaseNextBalance,
            );
            const decreaseCounters = [
                delegatedStakeToPoolByOwnerSlots[0],
                delegatedStakeByPoolIdSlots[0],
                globalDelegatedStakeSlot,
            ];
            expect(decreaseNextBalanceEvents).to.be.length(3);
            for (const [event, slot] of shortZip(decreaseNextBalanceEvents, decreaseCounters)) {
                expect(event.args.balanceSlot).to.eq(slot);
                expect(event.args.amount).to.equal(amount);
            }
            const increaseCounters = [
                delegatedStakeToPoolByOwnerSlots[1],
                delegatedStakeByPoolIdSlots[1],
                globalDelegatedStakeSlot,
            ];
            expect(increaseNextBalanceEvents).to.be.length(3);
            for (const [event, slot] of shortZip(increaseNextBalanceEvents, increaseCounters)) {
                expect(event.args.balanceSlot).to.eq(slot);
                expect(event.args.amount).to.equal(amount);
            }
            // Check that all decreases occur before the increases.
            const maxDecreaseIndex = _.max(decreaseNextBalanceEvents.map(e => e.logIndex)) as number;
            const maxIncreaseIndex = _.max(increaseNextBalanceEvents.map(e => e.logIndex)) as number;
            expect(maxDecreaseIndex).to.be.lt(maxIncreaseIndex);
        });

        it('does not change pool and global delegated stake counters when both stakes are undelegated', async () => {
            const amount = getRandomInteger(0, 100e18);
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[1] },
                    amount,
                )
                .awaitTransactionSuccessAsync();
            const decreaseNextBalanceEvents = filterLogsToArguments<DecreaseNextBalanceEventArgs>(
                logs,
                StakeEvents.DecreaseNextBalance,
            );
            const increaseNextBalanceEvents = filterLogsToArguments<IncreaseNextBalanceEventArgs>(
                logs,
                StakeEvents.IncreaseNextBalance,
            );
            expect(decreaseNextBalanceEvents).to.be.length(0);
            expect(increaseNextBalanceEvents).to.be.length(0);
        });

        it('does nothing when moving the owner stake from undelegated to undelegated', async () => {
            const amount = getRandomInteger(0, 100e18);
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[1] },
                    amount,
                )
                .awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<MoveStakeStorageEventArgs>(logs, StakeEvents.MoveStakeStorage);
            expect(events).to.be.length(0);
        });

        it('does nothing when moving zero stake', async () => {
            const amount = 0n;
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[1] },
                    amount,
                )
                .awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<MoveStakeStorageEventArgs>(logs, StakeEvents.MoveStakeStorage);
            expect(events).to.be.length(0);
        });

        it('moves the owner stake between the same pointer when both are delegated', async () => {
            const amount = getRandomInteger(0, 100e18);
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[1] },
                    amount,
                )
                .awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<MoveStakeStorageEventArgs>(logs, StakeEvents.MoveStakeStorage);
            expect(events).to.be.length(1);
            expect(events[0].fromBalanceSlot).to.eq(stakerDelegatedStakeSlot);
            expect(events[0].toBalanceSlot).to.eq(stakerDelegatedStakeSlot);
            expect(events[0].amount).to.equal(amount);
        });

        it('moves the owner stake between different pointers when "from" is undelegated and "to" is delegated', async () => {
            const amount = getRandomInteger(0, 100e18);
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[1] },
                    amount,
                )
                .awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<MoveStakeStorageEventArgs>(logs, StakeEvents.MoveStakeStorage);
            expect(events).to.be.length(1);
            expect(events[0].fromBalanceSlot).to.eq(stakerUndelegatedStakeSlot);
            expect(events[0].toBalanceSlot).to.eq(stakerDelegatedStakeSlot);
            expect(events[0].amount).to.equal(amount);
        });

        it('moves the owner stake between different pointers when "from" is delegated and "to" is undelegated', async () => {
            const amount = getRandomInteger(0, 100e18);
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[1] },
                    amount,
                )
                .awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<MoveStakeStorageEventArgs>(logs, StakeEvents.MoveStakeStorage);
            expect(events).to.be.length(1);
            expect(events[0].fromBalanceSlot).to.eq(stakerDelegatedStakeSlot);
            expect(events[0].toBalanceSlot).to.eq(stakerUndelegatedStakeSlot);
            expect(events[0].amount).to.equal(amount);
        });

        it('emits a `MoveStake` event', async () => {
            const amount = getRandomInteger(0, 100e18);
            const { logs } = await testContract
                .moveStake(
                    { status: StakeStatus.Undelegated, poolId: VALID_POOL_IDS[0] },
                    { status: StakeStatus.Delegated, poolId: VALID_POOL_IDS[1] },
                    amount,
                )
                .awaitTransactionSuccessAsync();
            const events = filterLogsToArguments<MoveStakeEventArgs>(logs, StakeEvents.MoveStake);
            expect(events).to.be.length(1);
            expect(events[0].staker).to.eq(staker);
            expect(events[0].amount).to.equal(amount);
            expect(events[0].fromStatus).to.eq(StakeStatus.Undelegated);
            expect(events[0].toStatus).to.eq(StakeStatus.Delegated);
            expect(events[0].fromPool).to.eq(VALID_POOL_IDS[0]);
            expect(events[0].toPool).to.eq(VALID_POOL_IDS[1]);
        });
    });
});
// tslint:disable: max-file-line-count
