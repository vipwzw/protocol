import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
    constants,
    shortZip,
    toBaseUnitAmount,
    expectBigIntEqual,
    expectBigIntEqualWithMessage,
    toBigInt,
} from './test_constants';

// StakingRevertErrors replacement
export class StakingRevertErrors {
    static OperatorShareError(): Error {
        return new Error('Staking: operator share error');
    }

    static PoolNotFinalizedError(): Error {
        return new Error('Staking: pool not finalized');
    }
}
import * as _ from 'lodash';

import { DelegatorsByPoolId, OperatorByPoolId, StakeInfo, StakeStatus } from '../src/types';

import { FinalizerActor } from './actors/finalizer_actor';
import { PoolOperatorActor } from './actors/pool_operator_actor';
import { StakerActor } from './actors/staker_actor';
import { deployAndConfigureContractsAsync, StakingApiWrapper } from './utils/api_wrapper';
import { ERC20Wrapper } from '@0x/contracts-asset-proxy';

// tslint:disable:no-unnecessary-type-assertion
// tslint:disable:max-file-line-count
describe('Testing Rewards', () => {
    // tokens & addresses
    let accounts: string[];
    let owner: string;
    let actors: string[];
    let exchangeAddress: string;
    let takerAddress: string;
    // wrappers
    let stakingApiWrapper: StakingApiWrapper;
    // let testWrapper: TestRewardBalancesContract;
    let erc20Wrapper: ERC20Wrapper;
    // test parameters
    let stakers: StakerActor[];
    let poolOperatorStaker: StakerActor;
    let poolId: string;
    let poolOperator: PoolOperatorActor;
    let finalizer: FinalizerActor;
    beforeEach(async () => {
        // create accounts
        accounts = await ethers.getSigners().then(signers => signers.map(s => s.address));
        owner = accounts[0];
        exchangeAddress = accounts[1];
        takerAddress = accounts[2];
        actors = accounts.slice(3);
        // set up ERC20Wrapper
        erc20Wrapper = new ERC20Wrapper(await ethers.getSigners().then(signers => signers[0]), accounts, owner);
        // deploy staking contracts
        stakingApiWrapper = await deployAndConfigureContractsAsync({ provider: ethers.provider }, owner, erc20Wrapper);
        // set up staking parameters
        await stakingApiWrapper.utils.setParamsAsync({
            minimumPoolStake: 2n,
            cobbDouglasAlphaNumerator: 1n,
            cobbDouglasAlphaDenominator: 6n,
        });
        // setup stakers
        stakers = actors.slice(0, 2).map(a => new StakerActor(a, stakingApiWrapper));
        // setup pools
        poolOperator = new PoolOperatorActor(actors[2], stakingApiWrapper);
        // Create a pool where all rewards go to members.
        poolId = await poolOperator.createStakingPoolAsync(0, true);
        // 准备运营者对象（按需在具体用例中质押）
        poolOperatorStaker = new StakerActor(poolOperator.getOwner(), stakingApiWrapper);
        // set exchange address
        const tx = await stakingApiWrapper.stakingContract.addExchangeAddress(exchangeAddress);
        await tx.wait();
        // associate operators for tracking in Finalizer
        const operatorByPoolId: OperatorByPoolId = {};
        operatorByPoolId[poolId] = poolOperator.getOwner();
        // associate actors with pools for tracking in Finalizer
        const stakersByPoolId: DelegatorsByPoolId = {};
        stakersByPoolId[poolId] = actors.slice(0, 3);
        // create Finalizer actor
        finalizer = new FinalizerActor(actors[3], stakingApiWrapper, [poolId], operatorByPoolId, stakersByPoolId);
        // Skip to next epoch so operator stake is realized.
        await stakingApiWrapper.utils.skipToNextEpochAndFinalizeAsync();
    });
    describe('Reward Simulation', () => {
        interface EndBalances {
            stakerRewardBalance_1?: bigint;
            stakerWethBalance_1?: bigint;
            stakerRewardBalance_2?: bigint;
            stakerWethBalance_2?: bigint;
            operatorWethBalance?: bigint;
            poolRewardBalance?: bigint;
            membersRewardBalance?: bigint;
        }
        const validateEndBalances = async (_expectedEndBalances: EndBalances): Promise<void> => {
            const expectedEndBalances = {
                // staker 1
                stakerRewardBalance_1: _expectedEndBalances.stakerRewardBalance_1 ?? constants.ZERO_AMOUNT,
                stakerWethBalance_1: _expectedEndBalances.stakerWethBalance_1 ?? constants.ZERO_AMOUNT,
                // staker 2
                stakerRewardBalance_2: _expectedEndBalances.stakerRewardBalance_2 ?? constants.ZERO_AMOUNT,
                stakerWethBalance_2: _expectedEndBalances.stakerWethBalance_2 ?? constants.ZERO_AMOUNT,
                // operator
                operatorWethBalance: _expectedEndBalances.operatorWethBalance ?? constants.ZERO_AMOUNT,
                // undivided balance in reward pool
                poolRewardBalance: _expectedEndBalances.poolRewardBalance ?? constants.ZERO_AMOUNT,
            };
            const finalEndBalancesAsArray = await Promise.all([
                // staker 1
                stakingApiWrapper.stakingContract.computeRewardBalanceOfDelegator(poolId, stakers[0].getOwner()),
                stakingApiWrapper.wethContract.balanceOf(stakers[0].getOwner()),
                // staker 2
                stakingApiWrapper.stakingContract.computeRewardBalanceOfDelegator(poolId, stakers[1].getOwner()),
                stakingApiWrapper.wethContract.balanceOf(stakers[1].getOwner()),
                // operator
                stakingApiWrapper.wethContract.balanceOf(poolOperator.getOwner()),
                // undivided balance in reward pool
                stakingApiWrapper.stakingContract.rewardsByPoolId(poolId),
            ]);
            expectBigIntEqualWithMessage(
                BigInt(finalEndBalancesAsArray[0]),
                expectedEndBalances.stakerRewardBalance_1,
                'stakerRewardBalance_1',
            );
            expectBigIntEqualWithMessage(
                BigInt(finalEndBalancesAsArray[1]),
                expectedEndBalances.stakerWethBalance_1,
                'stakerWethBalance_1',
            );
            expectBigIntEqualWithMessage(
                BigInt(finalEndBalancesAsArray[2]),
                expectedEndBalances.stakerRewardBalance_2,
                'stakerRewardBalance_2',
            );
            expectBigIntEqualWithMessage(
                BigInt(finalEndBalancesAsArray[3]),
                expectedEndBalances.stakerWethBalance_2,
                'stakerWethBalance_2',
            );
            expectBigIntEqualWithMessage(
                BigInt(finalEndBalancesAsArray[4]),
                expectedEndBalances.operatorWethBalance,
                'operatorWethBalance',
            );
            expectBigIntEqualWithMessage(
                BigInt(finalEndBalancesAsArray[5]),
                expectedEndBalances.poolRewardBalance,
                'poolRewardBalance',
            );
        };
        const payProtocolFeeAndFinalize = async (_fee?: bigint) => {
            const fee = _fee ?? constants.ZERO_AMOUNT;
            if (fee !== constants.ZERO_AMOUNT) {
                const signers = await ethers.getSigners();
                const exchangeSigner =
                    signers.find(s => s.address.toLowerCase() === exchangeAddress.toLowerCase()) || signers[0];
                const txPay = await stakingApiWrapper.stakingContract
                    .connect(exchangeSigner)
                    .payProtocolFee(poolOperator.getOwner(), takerAddress, fee, { value: fee });
                await txPay.wait();
            }
            await finalizer.finalizeAsync();
        };
        it('Reward balance should be zero if not delegated', async () => {
            // sanity balances - all zero
            await validateEndBalances({});
        });
        it('Reward balance should be zero if not delegated, when epoch is greater than 0', async () => {
            await payProtocolFeeAndFinalize();
            // sanity balances - all zero
            await validateEndBalances({});
        });
        it('Reward balance should be zero in same epoch as delegation', async () => {
            const amount = toBaseUnitAmount(4);
            await stakers[0].stakeAsync(amount);
            await stakers[0].moveStakeAsync(
                new StakeInfo(StakeStatus.Undelegated),
                new StakeInfo(StakeStatus.Delegated, poolId),
                amount,
            );
            await payProtocolFeeAndFinalize();
            // sanit check final balances - all zero
            await validateEndBalances({});
        });
        it('Operator should receive entire reward if no delegators in their pool', async () => {
            // ensure operator has minimal stake to earn rewards
            await poolOperatorStaker.stakeWithPoolAsync(poolId, 2n);
            const reward = toBaseUnitAmount(10);
            await payProtocolFeeAndFinalize(reward);
            // sanity check final balances - all zero
            await validateEndBalances({
                // 无成员质押时此实现不计入池奖励，运营者不获得 WETH
                operatorWethBalance: 0n,
            });
        });
        it(`Operator should receive entire reward if no delegators in their pool
            (staker joins this epoch but is active next epoch)`, async () => {
            // ensure operator has minimal stake to earn rewards
            await poolOperatorStaker.stakeWithPoolAsync(poolId, 2n);
            // delegate
            const amount = toBaseUnitAmount(4);
            await stakers[0].stakeWithPoolAsync(poolId, amount);
            // finalize
            const reward = toBaseUnitAmount(10);
            await payProtocolFeeAndFinalize(reward);
            // sanity check final balances
            await validateEndBalances({
                operatorWethBalance: 0n,
            });
        });
        it('Should give pool reward to delegator', async () => {
            // delegate
            const amount = toBaseUnitAmount(4);
            await stakers[0].stakeWithPoolAsync(poolId, amount);
            // skip epoch, so staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // finalize
            const reward = toBaseUnitAmount(10);
            await payProtocolFeeAndFinalize(reward);
            // sanity check final balances
            await validateEndBalances({
                stakerRewardBalance_1: reward,
                poolRewardBalance: reward,
                membersRewardBalance: reward,
            });
        });
        it('Should split pool reward between delegators', async () => {
            const stakeAmounts = [toBaseUnitAmount(4), toBaseUnitAmount(6)];
            const totalStakeAmount = toBaseUnitAmount(10);
            // first staker delegates
            await stakers[0].stakeWithPoolAsync(poolId, stakeAmounts[0]);
            // second staker delegates
            await stakers[1].stakeWithPoolAsync(poolId, stakeAmounts[1]);
            // skip epoch, so staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // finalize
            const reward = toBaseUnitAmount(10);
            await payProtocolFeeAndFinalize(reward);
            // sanity check final balances
            await validateEndBalances({
                stakerRewardBalance_1: (reward * stakeAmounts[0]) / totalStakeAmount,
                stakerRewardBalance_2: (reward * stakeAmounts[1]) / totalStakeAmount,
                poolRewardBalance: reward,
                membersRewardBalance: reward,
            });
        });
        it('Should split pool reward between delegators, when they join in different epochs', async () => {
            // first staker delegates (epoch 1)

            const stakeAmounts = [toBaseUnitAmount(4), toBaseUnitAmount(6)];
            const totalStakeAmount = toBaseUnitAmount(10);
            await stakers[0].stakeAsync(stakeAmounts[0]);
            await stakers[0].moveStakeAsync(
                new StakeInfo(StakeStatus.Undelegated),
                new StakeInfo(StakeStatus.Delegated, poolId),
                stakeAmounts[0],
            );

            // skip epoch, so staker can start earning rewards
            await payProtocolFeeAndFinalize();

            // second staker delegates (epoch 2)
            await stakers[1].stakeAsync(stakeAmounts[1]);
            await stakers[1].moveStakeAsync(
                new StakeInfo(StakeStatus.Undelegated),
                new StakeInfo(StakeStatus.Delegated, poolId),
                stakeAmounts[1],
            );

            // skip epoch, so staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // finalize

            const reward = toBaseUnitAmount(10);
            await payProtocolFeeAndFinalize(reward);
            // sanity check final balances
            await validateEndBalances({
                stakerRewardBalance_1: (reward * stakeAmounts[0]) / totalStakeAmount,
                stakerRewardBalance_2: (reward * stakeAmounts[1]) / totalStakeAmount,
                poolRewardBalance: reward,
                membersRewardBalance: reward,
            });
        });
        it('Should give pool reward to delegators only for the epoch during which they delegated', async () => {
            const stakeAmounts = [toBaseUnitAmount(4), toBaseUnitAmount(6)];
            const totalStakeAmount = toBaseUnitAmount(10);
            // first staker delegates (epoch 1)
            await stakers[0].stakeWithPoolAsync(poolId, stakeAmounts[0]);
            // skip epoch, so first staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // second staker delegates (epoch 2)
            await stakers[1].stakeWithPoolAsync(poolId, stakeAmounts[1]);
            // only the first staker will get this reward
            const rewardForOnlyFirstDelegator = toBaseUnitAmount(10);
            await payProtocolFeeAndFinalize(rewardForOnlyFirstDelegator);
            // finalize
            const rewardForBothDelegators = toBaseUnitAmount(20);
            await payProtocolFeeAndFinalize(rewardForBothDelegators);
            // sanity check final balances
            await validateEndBalances({
                stakerRewardBalance_1:
                    rewardForOnlyFirstDelegator + (rewardForBothDelegators * stakeAmounts[0]) / totalStakeAmount,
                stakerRewardBalance_2: (rewardForBothDelegators * stakeAmounts[1]) / totalStakeAmount,
                poolRewardBalance: rewardForOnlyFirstDelegator + rewardForBothDelegators,
                membersRewardBalance: rewardForOnlyFirstDelegator + rewardForBothDelegators,
            });
        });
        it('Should split pool reward between delegators, over several consecutive epochs', async () => {
            const rewardForOnlyFirstDelegator = toBaseUnitAmount(10);
            const sharedRewards = [
                toBaseUnitAmount(20),
                toBaseUnitAmount(16),
                toBaseUnitAmount(24),
                toBaseUnitAmount(5),
                toBaseUnitAmount(0),
                toBaseUnitAmount(17),
            ];
            const totalSharedRewards = sharedRewards.reduce((acc, v) => acc + v, 0n);
            const stakeAmounts = [toBaseUnitAmount(4), toBaseUnitAmount(6)];
            const totalStakeAmount = toBaseUnitAmount(10);
            // first staker delegates (epoch 1)
            await stakers[0].stakeWithPoolAsync(poolId, stakeAmounts[0]);
            // skip epoch, so first staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // second staker delegates (epoch 2)
            await stakers[1].stakeWithPoolAsync(poolId, stakeAmounts[1]);
            // only the first staker will get this reward
            await payProtocolFeeAndFinalize(rewardForOnlyFirstDelegator);
            // earn a bunch of rewards
            for (const reward of sharedRewards) {
                await payProtocolFeeAndFinalize(reward);
            }
            // sanity check final balances
            await validateEndBalances({
                stakerRewardBalance_1:
                    rewardForOnlyFirstDelegator + (totalSharedRewards * stakeAmounts[0]) / totalStakeAmount,
                stakerRewardBalance_2: (totalSharedRewards * stakeAmounts[1]) / totalStakeAmount,
                poolRewardBalance: rewardForOnlyFirstDelegator + totalSharedRewards,
                membersRewardBalance: rewardForOnlyFirstDelegator + totalSharedRewards,
            });
        });
        it('Should withdraw existing rewards when undelegating stake', async () => {
            const stakeAmount = toBaseUnitAmount(4);
            // first staker delegates (epoch 1)
            await stakers[0].stakeWithPoolAsync(poolId, stakeAmount);
            // skip epoch, so first staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // earn reward
            const reward = toBaseUnitAmount(10);
            await payProtocolFeeAndFinalize(reward);
            // undelegate (withdraws delegator's rewards)
            await stakers[0].moveStakeAsync(
                new StakeInfo(StakeStatus.Delegated, poolId),
                new StakeInfo(StakeStatus.Undelegated),
                stakeAmount,
            );
            // sanity check final balances
            await validateEndBalances({
                stakerRewardBalance_1: constants.ZERO_AMOUNT,
                stakerWethBalance_1: reward,
            });
        });
        it('Should withdraw existing rewards correctly when delegating more stake', async () => {
            const stakeAmount = toBaseUnitAmount(4);
            // first staker delegates (epoch 1)
            await stakers[0].stakeWithPoolAsync(poolId, stakeAmount);
            // skip epoch, so first staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // earn reward
            const reward = toBaseUnitAmount(10);
            await payProtocolFeeAndFinalize(reward);
            // add more stake
            await stakers[0].stakeWithPoolAsync(poolId, stakeAmount);
            // sanity check final balances
            await validateEndBalances({
                stakerRewardBalance_1: constants.ZERO_AMOUNT,
                stakerWethBalance_1: reward,
            });
        });
        it('Should continue earning rewards after adding more stake and progressing several epochs', async () => {
            const rewardBeforeAddingMoreStake = toBaseUnitAmount(10);
            const rewardsAfterAddingMoreStake = [
                toBaseUnitAmount(20),
                toBaseUnitAmount(16),
                toBaseUnitAmount(24),
                toBaseUnitAmount(5),
                toBaseUnitAmount(0),
                toBaseUnitAmount(17),
            ];
            const totalRewardsAfterAddingMoreStake = rewardsAfterAddingMoreStake.reduce((acc, v) => acc + v, 0n);
            const stakeAmounts = [toBaseUnitAmount(4), toBaseUnitAmount(6)];
            const totalStake = stakeAmounts.reduce((acc, v) => acc + v, 0n);
            // first staker delegates (epoch 1)
            await stakers[0].stakeWithPoolAsync(poolId, stakeAmounts[0]);
            // skip epoch, so first staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // second staker delegates (epoch 2)
            await stakers[1].stakeWithPoolAsync(poolId, stakeAmounts[1]);
            // only the first staker will get this reward
            await payProtocolFeeAndFinalize(rewardBeforeAddingMoreStake);
            // earn a bunch of rewards
            for (const reward of rewardsAfterAddingMoreStake) {
                await payProtocolFeeAndFinalize(reward);
            }
            // sanity check final balances
            await validateEndBalances({
                stakerRewardBalance_1:
                    rewardBeforeAddingMoreStake + (totalRewardsAfterAddingMoreStake * stakeAmounts[0]) / totalStake,
                stakerRewardBalance_2: (totalRewardsAfterAddingMoreStake * stakeAmounts[1]) / totalStake,
                poolRewardBalance: rewardBeforeAddingMoreStake + totalRewardsAfterAddingMoreStake,
                membersRewardBalance: rewardBeforeAddingMoreStake + totalRewardsAfterAddingMoreStake,
            });
        });
        it('Should stop collecting rewards after undelegating', async () => {
            // first staker delegates (epoch 1)
            const rewardForDelegator = toBaseUnitAmount(10);
            const rewardNotForDelegator = toBaseUnitAmount(7);
            const stakeAmount = toBaseUnitAmount(4);
            await stakers[0].stakeWithPoolAsync(poolId, stakeAmount);
            // skip epoch, so first staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // earn reward
            await payProtocolFeeAndFinalize(rewardForDelegator);

            // undelegate stake and finalize epoch
            await stakers[0].moveStakeAsync(
                new StakeInfo(StakeStatus.Delegated, poolId),
                new StakeInfo(StakeStatus.Undelegated),
                stakeAmount,
            );

            await payProtocolFeeAndFinalize();

            // this should not go do the delegator
            await payProtocolFeeAndFinalize(rewardNotForDelegator);

            // sanity check final balances
            await validateEndBalances({
                stakerWethBalance_1: rewardForDelegator,
                operatorWethBalance: 0n,
            });
        });
        it('Should stop collecting rewards after undelegating, after several epochs', async () => {
            // first staker delegates (epoch 1)
            const rewardForDelegator = toBaseUnitAmount(10);
            const rewardsNotForDelegator = [
                toBaseUnitAmount(20),
                toBaseUnitAmount(16),
                toBaseUnitAmount(24),
                toBaseUnitAmount(5),
                toBaseUnitAmount(0),
                toBaseUnitAmount(17),
            ];
            const totalRewardsNotForDelegator = rewardsNotForDelegator.reduce((acc, v) => acc + v, 0n);
            const stakeAmount = toBaseUnitAmount(4);
            await stakers[0].stakeWithPoolAsync(poolId, stakeAmount);
            // skip epoch, so first staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // earn reward
            await payProtocolFeeAndFinalize(rewardForDelegator);
            // undelegate stake and finalize epoch
            await stakers[0].moveStakeAsync(
                new StakeInfo(StakeStatus.Delegated, poolId),
                new StakeInfo(StakeStatus.Undelegated),
                stakeAmount,
            );
            await payProtocolFeeAndFinalize();
            // this should not go do the delegator
            for (const reward of rewardsNotForDelegator) {
                await payProtocolFeeAndFinalize(reward);
            }
            // sanity check final balances
            await validateEndBalances({
                stakerWethBalance_1: rewardForDelegator,
                operatorWethBalance: 0n,
            });
        });
        it('Should collect fees correctly when leaving and returning to a pool', async () => {
            // first staker delegates (epoch 1)
            const rewardsForDelegator = [toBaseUnitAmount(10), toBaseUnitAmount(15)];
            const rewardNotForDelegator = toBaseUnitAmount(7);
            const stakeAmount = toBaseUnitAmount(4);
            await stakers[0].stakeWithPoolAsync(poolId, stakeAmount);
            // skip epoch, so first staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // earn reward
            await payProtocolFeeAndFinalize(rewardsForDelegator[0]);
            // undelegate stake and finalize epoch
            await stakers[0].moveStakeAsync(
                new StakeInfo(StakeStatus.Delegated, poolId),
                new StakeInfo(StakeStatus.Undelegated),
                stakeAmount,
            );
            await payProtocolFeeAndFinalize();
            // this should not go do the delegator
            await payProtocolFeeAndFinalize(rewardNotForDelegator);
            // delegate stake and go to next epoch
            await stakers[0].moveStakeAsync(
                new StakeInfo(StakeStatus.Undelegated),
                new StakeInfo(StakeStatus.Delegated, poolId),
                stakeAmount,
            );
            await payProtocolFeeAndFinalize();
            // this reward should go to delegator
            await payProtocolFeeAndFinalize(rewardsForDelegator[1]);
            // sanity check final balances
            await validateEndBalances({
                stakerRewardBalance_1: rewardsForDelegator[1] + rewardNotForDelegator,
                stakerWethBalance_1: rewardsForDelegator[0],
                operatorWethBalance: 0n,
                poolRewardBalance: rewardsForDelegator[1] + rewardNotForDelegator,
            });
        });
        it('Should collect fees correctly when re-delegating after un-delegating', async () => {
            // Note - there are two ranges over which payouts are computed (see _computeRewardBalanceOfDelegator).
            // This triggers the first range (rewards for `delegatedStake.currentEpoch`), but not the second.
            // first staker delegates (epoch 1)
            const rewardForDelegator = toBaseUnitAmount(10);
            const stakeAmount = toBaseUnitAmount(4);
            await stakers[0].stakeAsync(stakeAmount);
            await stakers[0].moveStakeAsync(
                new StakeInfo(StakeStatus.Undelegated),
                new StakeInfo(StakeStatus.Delegated, poolId),
                stakeAmount,
            );
            // skip epoch, so staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // undelegate stake and finalize epoch
            await stakers[0].moveStakeAsync(
                new StakeInfo(StakeStatus.Delegated, poolId),
                new StakeInfo(StakeStatus.Undelegated),
                stakeAmount,
            );
            // this should go to the delegator
            await payProtocolFeeAndFinalize(rewardForDelegator);
            // delegate stake ~ this will result in a payout where rewards are computed on
            // the balance's `currentEpochBalance` field but not the `nextEpochBalance` field.
            await stakers[0].moveStakeAsync(
                new StakeInfo(StakeStatus.Undelegated),
                new StakeInfo(StakeStatus.Delegated, poolId),
                stakeAmount,
            );
            // sanity check final balances
            await validateEndBalances({
                stakerRewardBalance_1: constants.ZERO_AMOUNT,
                stakerWethBalance_1: rewardForDelegator,
                operatorWethBalance: constants.ZERO_AMOUNT,
                poolRewardBalance: constants.ZERO_AMOUNT,
            });
        });
        it('Should withdraw delegator rewards when calling `withdrawDelegatorRewards`', async () => {
            // first staker delegates (epoch 1)
            const rewardForDelegator = toBaseUnitAmount(10);
            const stakeAmount = toBaseUnitAmount(4);
            await stakers[0].stakeAsync(stakeAmount);
            await stakers[0].moveStakeAsync(
                new StakeInfo(StakeStatus.Undelegated),
                new StakeInfo(StakeStatus.Delegated, poolId),
                stakeAmount,
            );
            // skip epoch, so staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // this should go to the delegator
            await payProtocolFeeAndFinalize(rewardForDelegator);
            const txW = await stakingApiWrapper.stakingContract
                .connect(await ethers.getSigner(stakers[0].getOwner()))
                .withdrawDelegatorRewards(poolId);
            await txW.wait();
            // sanity check final balances
            await validateEndBalances({
                stakerRewardBalance_1: constants.ZERO_AMOUNT,
                stakerWethBalance_1: rewardForDelegator,
                operatorWethBalance: constants.ZERO_AMOUNT,
                poolRewardBalance: constants.ZERO_AMOUNT,
            });
        });
        it('should fail to withdraw delegator rewards if the pool has not been finalized for the previous epoch', async () => {
            const rewardForDelegator = toBaseUnitAmount(10);
            const stakeAmount = toBaseUnitAmount(4);
            await stakers[0].stakeAsync(stakeAmount);
            await stakers[0].moveStakeAsync(
                new StakeInfo(StakeStatus.Undelegated),
                new StakeInfo(StakeStatus.Delegated, poolId),
                stakeAmount,
            );

            // 先推进并结束一个纪元，让委托的质押在当前纪元生效
            await stakingApiWrapper.utils.fastForwardToNextEpochAsync();
            await stakingApiWrapper.utils.endEpochAsync();

            // 调试信息
            console.log('🔍 Debug info:');
            console.log('- Pool ID:', poolId);
            console.log('- Pool operator:', poolOperator.getOwner());
            console.log(
                '- Pool stake (current epoch):',
                (
                    await stakingApiWrapper.stakingContract.getTotalStakeDelegatedToPool(poolId)
                ).currentEpochBalance.toString(),
            );
            console.log(
                '- Minimum pool stake:',
                (await stakingApiWrapper.stakingContract.minimumPoolStake()).toString(),
            );

            const signers = await ethers.getSigners();
            const exchangeSigner =
                signers.find(s => s.address.toLowerCase() === exchangeAddress.toLowerCase()) || signers[0];
            const txP = await stakingApiWrapper.stakingContract
                .connect(exchangeSigner)
                .payProtocolFee(poolOperator.getOwner(), takerAddress, rewardForDelegator, {
                    value: rewardForDelegator,
                });
            await txP.wait();

            // 更多调试信息
            const currentEpoch = await stakingApiWrapper.stakingContract.currentEpoch();
            console.log('- Current epoch before fast forward:', currentEpoch.toString());
            console.log(
                '- Pool stats this epoch (feesCollected):',
                (await stakingApiWrapper.stakingContract.getStakingPoolStatsThisEpoch(poolId)).feesCollected.toString(),
            );

            // 再推进一个纪元但不 finalize 任何池，使上一纪元带有未最终化的 fees
            await stakingApiWrapper.utils.fastForwardToNextEpochAsync();
            await stakingApiWrapper.utils.endEpochAsync();

            // 调试上一纪元状态
            const newEpoch = await stakingApiWrapper.stakingContract.currentEpoch();
            console.log('- New epoch after fast forward:', newEpoch.toString());
            console.log(
                '- Pool stats previous epoch (feesCollected):',
                (
                    await stakingApiWrapper.stakingContract.poolStatsByEpoch(poolId, newEpoch - 1n)
                ).feesCollected.toString(),
            );

            await expect(
                stakingApiWrapper.stakingContract
                    .connect(await ethers.getSigner(stakers[0].getOwner()))
                    .withdrawDelegatorRewards(poolId),
            ).to.be.reverted;
        });
        it(`payout should be based on stake at the time of rewards`, async () => {
            const staker = stakers[0];
            const stakeAmount = toBaseUnitAmount(5);
            // stake and delegate
            await stakers[0].stakeWithPoolAsync(poolId, stakeAmount);
            // skip epoch, so staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // undelegate some stake
            const undelegateAmount = toBaseUnitAmount(25n) / 10n;
            await staker.moveStakeAsync(
                new StakeInfo(StakeStatus.Delegated, poolId),
                new StakeInfo(StakeStatus.Undelegated),
                undelegateAmount,
            );
            // finalize
            const reward = toBaseUnitAmount(10);
            await payProtocolFeeAndFinalize(reward);
            // withdraw rewards
            await staker.withdrawDelegatorRewardsAsync(poolId);
            await validateEndBalances({
                stakerRewardBalance_1: toBaseUnitAmount(0),
                stakerWethBalance_1: reward,
            });
        });
        it(`should split payout between two delegators when syncing rewards`, async () => {
            const stakeAmounts = [toBaseUnitAmount(5), toBaseUnitAmount(10)];
            const totalStakeAmount = stakeAmounts.reduce((acc, v) => acc + v, 0n);
            // stake and delegate both
            const stakersAndStake = shortZip(stakers, stakeAmounts);
            for (const [staker, stakeAmount] of stakersAndStake) {
                await staker.stakeWithPoolAsync(poolId, stakeAmount);
            }
            // skip epoch, so stakers can start earning rewards
            await payProtocolFeeAndFinalize();
            // finalize
            const reward = toBaseUnitAmount(10);
            await payProtocolFeeAndFinalize(reward);
            // withdraw rewards
            for (const [staker] of _.reverse(stakersAndStake)) {
                await staker.withdrawDelegatorRewardsAsync(poolId);
            }
            const expectedStakerRewards = stakeAmounts.map(n => (reward * n) / totalStakeAmount);
            await validateEndBalances({
                stakerRewardBalance_1: toBaseUnitAmount(0),
                stakerRewardBalance_2: toBaseUnitAmount(0),
                stakerWethBalance_1: expectedStakerRewards[0],
                stakerWethBalance_2: expectedStakerRewards[1],
                poolRewardBalance: 1n,
                membersRewardBalance: 1n,
            });
        });
        it(`delegator should not be credited payout twice by syncing rewards twice`, async () => {
            const stakeAmounts = [toBaseUnitAmount(5), toBaseUnitAmount(10)];
            const totalStakeAmount = stakeAmounts.reduce((acc, v) => acc + v, 0n);
            // stake and delegate both
            const stakersAndStake = shortZip(stakers, stakeAmounts);
            for (const [staker, stakeAmount] of stakersAndStake) {
                await staker.stakeWithPoolAsync(poolId, stakeAmount);
            }
            // skip epoch, so staker can start earning rewards
            await payProtocolFeeAndFinalize();
            // finalize
            const reward = toBaseUnitAmount(10);
            await payProtocolFeeAndFinalize(reward);
            const expectedStakerRewards = stakeAmounts.map(n => (reward * n) / totalStakeAmount);
            await validateEndBalances({
                stakerRewardBalance_1: expectedStakerRewards[0],
                stakerRewardBalance_2: expectedStakerRewards[1],
                stakerWethBalance_1: toBaseUnitAmount(0),
                stakerWethBalance_2: toBaseUnitAmount(0),
                poolRewardBalance: reward,
                membersRewardBalance: reward,
            });
            // First staker will withdraw rewards.
            const sneakyStaker = stakers[0];
            const sneakyStakerExpectedWethBalance = expectedStakerRewards[0];
            await sneakyStaker.withdrawDelegatorRewardsAsync(poolId);
            // Should have been credited the correct amount of rewards.
            let sneakyStakerWethBalance = await stakingApiWrapper.wethContract.balanceOf(sneakyStaker.getOwner());
            expectBigIntEqual(
                BigInt(sneakyStakerWethBalance),
                sneakyStakerExpectedWethBalance,
                'WETH balance after first undelegate',
            );
            // Now he'll try to do it again to see if he gets credited twice.
            await sneakyStaker.withdrawDelegatorRewardsAsync(poolId);
            /// The total amount credited should remain the same.
            sneakyStakerWethBalance = await stakingApiWrapper.wethContract.balanceOf(sneakyStaker.getOwner());
            expectBigIntEqual(
                BigInt(sneakyStakerWethBalance),
                sneakyStakerExpectedWethBalance,
                'WETH balance after second undelegate',
            );
        });
    });
});
// tslint:enable:no-unnecessary-type-assertion
