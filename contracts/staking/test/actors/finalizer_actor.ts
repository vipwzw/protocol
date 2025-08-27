import { expect } from 'chai';
import { constants } from '../test_constants';
import * as _ from 'lodash';

import {
    BalanceByOwner,
    DelegatorBalancesByPoolId,
    DelegatorsByPoolId,
    OperatorBalanceByPoolId,
    OperatorByPoolId,
    OperatorShareByPoolId,
    RewardBalanceByPoolId,
    RewardByPoolId,
} from '../../src/types';
import { StakingApiWrapper } from '../utils/api_wrapper';

import { BaseActor } from './base_actor';

const { PPM_100_PERCENT } = constants;

// tslint:disable: prefer-conditional-expression
export class FinalizerActor extends BaseActor {
    private readonly _poolIds: string[];
    private readonly _operatorByPoolId: OperatorByPoolId;
    private readonly _delegatorsByPoolId: DelegatorsByPoolId;

    constructor(
        owner: string,
        stakingApiWrapper: StakingApiWrapper,
        poolIds: string[],
        operatorByPoolId: OperatorByPoolId,
        delegatorsByPoolId: DelegatorsByPoolId,
    ) {
        super(owner, stakingApiWrapper);
        this._poolIds = _.cloneDeep(poolIds);
        this._operatorByPoolId = _.cloneDeep(operatorByPoolId);
        this._delegatorsByPoolId = _.cloneDeep(delegatorsByPoolId);
    }

    public async finalizeAsync(): Promise<void> {
        // cache initial info and balances
        const operatorShareByPoolId = await this._getOperatorShareByPoolIdAsync(this._poolIds);
        const rewardBalanceByPoolId = await this._getRewardBalanceByPoolIdAsync(this._poolIds);
        const delegatorBalancesByPoolId = await this._getDelegatorBalancesByPoolIdAsync(this._delegatorsByPoolId);
        const delegatorStakesByPoolId = await this._getDelegatorStakesByPoolIdAsync(this._delegatorsByPoolId);
        const operatorBalanceByPoolId = await this._getOperatorBalanceByPoolIdAsync(this._operatorByPoolId);
        const rewardByPoolId = await this._getRewardByPoolIdAsync(this._poolIds);
        // compute expected changes
        const [expectedOperatorBalanceByPoolId, expectedRewardBalanceByPoolId] =
            this._computeExpectedRewardBalanceByPoolId(
                rewardByPoolId,
                operatorBalanceByPoolId,
                rewardBalanceByPoolId,
                delegatorStakesByPoolId,
                operatorShareByPoolId,
            );
        const expectedDelegatorBalancesByPoolId = await this._computeExpectedDelegatorBalancesByPoolIdAsync(
            this._delegatorsByPoolId,
            delegatorBalancesByPoolId,
            delegatorStakesByPoolId,
            operatorShareByPoolId,
            rewardByPoolId,
        );
        // finalize
        await this._stakingApiWrapper.utils.skipToNextEpochAndFinalizeAsync();
        // assert reward changes
        const finalRewardBalanceByPoolId = await this._getRewardBalanceByPoolIdAsync(this._poolIds);
        expect(finalRewardBalanceByPoolId, 'final pool reward balances').to.be.deep.equal(
            expectedRewardBalanceByPoolId,
        );
        // assert delegator balances
        const finalDelegatorBalancesByPoolId = await this._getDelegatorBalancesByPoolIdAsync(this._delegatorsByPoolId);
        expect(finalDelegatorBalancesByPoolId, 'final delegator reward balances').to.be.deep.equal(
            expectedDelegatorBalancesByPoolId,
        );
        // assert operator balances
        const finalOperatorBalanceByPoolId = await this._getOperatorBalanceByPoolIdAsync(this._operatorByPoolId);
        expect(finalOperatorBalanceByPoolId, 'final operator weth balance').to.be.deep.equal(
            expectedOperatorBalanceByPoolId,
        );
    }

    private async _computeExpectedDelegatorBalancesByPoolIdAsync(
        delegatorsByPoolId: DelegatorsByPoolId,
        delegatorBalancesByPoolId: DelegatorBalancesByPoolId,
        delegatorStakesByPoolId: DelegatorBalancesByPoolId,
        operatorShareByPoolId: OperatorShareByPoolId,
        rewardByPoolId: RewardByPoolId,
    ): Promise<DelegatorBalancesByPoolId> {
        const expectedDelegatorBalancesByPoolId = _.cloneDeep(delegatorBalancesByPoolId);
        for (const poolId of Object.keys(delegatorsByPoolId)) {
            const operator = this._operatorByPoolId[poolId];
            const totalStakeInPool = Object.values(delegatorStakesByPoolId[poolId]).reduce((a: bigint, b: bigint) => a + b, 0n);
            const operatorStakeInPool = delegatorStakesByPoolId[poolId][operator];
            const membersStakeInPool = totalStakeInPool - operatorStakeInPool;
            const operatorShare = operatorShareByPoolId[poolId];
            const totalReward = rewardByPoolId[poolId];
            const operatorReward = membersStakeInPool === 0n
                ? totalReward
                : (totalReward * BigInt(operatorShare)) / BigInt(PPM_100_PERCENT);
            const membersTotalReward = totalReward - operatorReward;

            for (const delegator of delegatorsByPoolId[poolId]) {
                let delegatorReward = 0n;
                if (delegator !== operator && membersStakeInPool > 0n) {
                    const delegatorStake = delegatorStakesByPoolId[poolId][delegator];
                    delegatorReward = (delegatorStake * membersTotalReward) / membersStakeInPool;
                }
                const currentBalance = expectedDelegatorBalancesByPoolId[poolId][delegator] || 0n;
                expectedDelegatorBalancesByPoolId[poolId][delegator] = currentBalance + delegatorReward;
            }
        }
        return expectedDelegatorBalancesByPoolId;
    }

    private async _getDelegatorBalancesByPoolIdAsync(
        delegatorsByPoolId: DelegatorsByPoolId,
    ): Promise<DelegatorBalancesByPoolId> {
        const { computeRewardBalanceOfDelegator, computeRewardBalanceOfOperator } =
            this._stakingApiWrapper.stakingContract;
        const delegatorBalancesByPoolId: DelegatorBalancesByPoolId = {};

        for (const poolId of Object.keys(delegatorsByPoolId)) {
            const operator = this._operatorByPoolId[poolId];
            const delegators = delegatorsByPoolId[poolId];
            delegatorBalancesByPoolId[poolId] = {};
            for (const delegator of delegators) {
                let balance: bigint = delegatorBalancesByPoolId[poolId][delegator] || 0n;
                if (delegator === operator) {
                    const inc = await this._stakingApiWrapper.stakingContract.computeRewardBalanceOfOperator(poolId);
                    balance = balance + BigInt(inc);
                } else {
                    const inc = await this._stakingApiWrapper.stakingContract.computeRewardBalanceOfDelegator(poolId, delegator);
                    balance = balance + BigInt(inc);
                }
                delegatorBalancesByPoolId[poolId][delegator] = balance;
            }
        }
        return delegatorBalancesByPoolId;
    }

    private async _getDelegatorStakesByPoolIdAsync(
        delegatorsByPoolId: DelegatorsByPoolId,
    ): Promise<DelegatorBalancesByPoolId> {
        const delegatorBalancesByPoolId: DelegatorBalancesByPoolId = {};
        for (const poolId of Object.keys(delegatorsByPoolId)) {
            const delegators = delegatorsByPoolId[poolId];
            delegatorBalancesByPoolId[poolId] = {};
            for (const delegator of delegators) {
                delegatorBalancesByPoolId[poolId][delegator] = (
                    await this._stakingApiWrapper.stakingContract
                        .getStakeDelegatedToPoolByOwner(delegator, poolId)
                        
                ).currentEpochBalance;
            }
        }
        return delegatorBalancesByPoolId;
    }

    private _computeExpectedRewardBalanceByPoolId(
        rewardByPoolId: RewardByPoolId,
        operatorBalanceByPoolId: OperatorBalanceByPoolId,
        rewardBalanceByPoolId: RewardBalanceByPoolId,
        delegatorStakesByPoolId: DelegatorBalancesByPoolId,
        operatorShareByPoolId: OperatorShareByPoolId,
    ): [RewardBalanceByPoolId, OperatorBalanceByPoolId] {
        const expectedOperatorBalanceByPoolId = _.cloneDeep(operatorBalanceByPoolId);
        const expectedRewardBalanceByPoolId = _.cloneDeep(rewardBalanceByPoolId);
        for (const poolId of Object.keys(rewardByPoolId)) {
            const operatorShare = operatorShareByPoolId[poolId];
            [expectedOperatorBalanceByPoolId[poolId], expectedRewardBalanceByPoolId[poolId]] =
                this._computeExpectedRewardBalance(
                    poolId,
                    rewardByPoolId[poolId],
                    expectedOperatorBalanceByPoolId[poolId],
                    expectedRewardBalanceByPoolId[poolId],
                    delegatorStakesByPoolId[poolId],
                    operatorShare,
                );
        }
        return [expectedOperatorBalanceByPoolId, expectedRewardBalanceByPoolId];
    }

    private _computeExpectedRewardBalance(
        poolId: string,
        reward: bigint,
        operatorBalance: bigint,
        rewardBalance: bigint,
        stakeBalances: BalanceByOwner,
        operatorShare: bigint,
    ): [bigint, bigint] {
        const totalStakeDelegatedToPool = Object.values(stakeBalances).reduce((a: bigint, b: bigint) => a + b, 0n);
        const stakeDelegatedToPoolByOperator = stakeBalances[this._operatorByPoolId[poolId]];
        const membersStakeDelegatedToPool = totalStakeDelegatedToPool - stakeDelegatedToPoolByOperator;
        const operatorPortion = membersStakeDelegatedToPool === 0n
            ? reward
            : (reward * BigInt(operatorShare)) / BigInt(PPM_100_PERCENT);
        const membersPortion = reward - operatorPortion;
        return [operatorBalance + operatorPortion, rewardBalance + membersPortion];
    }

    private async _getOperatorBalanceByPoolIdAsync(
        operatorByPoolId: OperatorByPoolId,
    ): Promise<OperatorBalanceByPoolId> {
        const operatorBalanceByPoolId: OperatorBalanceByPoolId = {};
        for (const poolId of Object.keys(operatorByPoolId)) {
            operatorBalanceByPoolId[poolId] = await this._stakingApiWrapper.wethContract
                .balanceOf(operatorByPoolId[poolId])
                ;
        }
        return operatorBalanceByPoolId;
    }

    private async _getOperatorShareByPoolIdAsync(poolIds: string[]): Promise<OperatorShareByPoolId> {
        const operatorShareByPoolId: OperatorShareByPoolId = {};
        for (const poolId of poolIds) {
            operatorShareByPoolId[poolId] = BigInt((await this._stakingApiWrapper.stakingContract.getStakingPool(poolId)).operatorShare);
        }
        return operatorShareByPoolId;
    }

    private async _getRewardBalanceByPoolIdAsync(poolIds: string[]): Promise<RewardBalanceByPoolId> {
        const rewardBalanceByPoolId: RewardBalanceByPoolId = {};
        for (const poolId of poolIds) {
            rewardBalanceByPoolId[poolId] = await this._stakingApiWrapper.stakingContract
                .rewardsByPoolId(poolId)
                ;
        }
        return rewardBalanceByPoolId;
    }

    private async _getRewardByPoolIdAsync(poolIds: string[]): Promise<RewardByPoolId> {
        const activePools = await Promise.all(
            poolIds.map(async poolId =>
                this._stakingApiWrapper.stakingContract.getStakingPoolStatsThisEpoch(poolId),
            ),
        );
        const totalRewards = await this._stakingApiWrapper.utils.getAvailableRewardsBalanceAsync();
        const totalFeesCollected = activePools.reduce((acc, p) => acc + BigInt(p.feesCollected), 0n);
        const totalWeightedStake = activePools.reduce((acc, p) => acc + BigInt(p.weightedStake), 0n);
        if (totalRewards === 0n || totalFeesCollected === 0n || totalWeightedStake === 0n) {
            return _.zipObject(
                poolIds,
                _.times(poolIds.length, () => 0n),
            );
        }
        const rewards = await Promise.all(
            activePools.map(async pool =>
                this._stakingApiWrapper.utils.cobbDouglasAsync(
                    totalRewards,
                    BigInt(pool.feesCollected),
                    totalFeesCollected,
                    BigInt(pool.weightedStake),
                    totalWeightedStake,
                ),
            ),
        );
        return _.zipObject(poolIds, rewards);
    }
}
