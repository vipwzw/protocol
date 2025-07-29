import { constants, Numberish } from '@0x/contracts-test-utils';
import { DecodedLogArgs, LogWithDecodedArgs } from 'ethereum-types';

import { constants as stakingConstants } from './constants';

export { Numberish } from '@0x/contracts-test-utils';
// tslint:disable:max-classes-per-file

export interface StakingParams {
    epochDurationInSeconds: bigint;
    rewardDelegatedStakeWeight: bigint;
    minimumPoolStake: bigint;
    cobbDouglasAlphaNumerator: bigint;
    cobbDouglasAlphaDenominator: bigint;
}

export interface StakerBalances {
    currentEpoch: bigint;
    currentEpochBalance: bigint;
    nextEpochBalance: bigint;
}

// A DelegatorBalances contains the balances of a delegator across different state variables.
// Delegators have a balance of ZRX, but also a balance of stake
export interface DelegatorBalances extends StakerBalances {
    // The amount of ZRX the delegator has delegated to a certain pool
    delegatedStake: bigint;
}

export interface SimulationParams {
    epochDurationInSeconds: bigint;
    rewardDelegatedStakeWeight: bigint;
    minimumPoolStake: bigint;
    cobbDouglasAlphaNumerator: bigint;
    cobbDouglasAlphaDenominator: bigint;
}

export interface EndOfEpochInfo {
    numPoolsToFinalize: bigint;
    rewardsAvailable: bigint;
    totalFeesCollected: bigint;
    totalWeightedStake: bigint;
    totalRewardsFinalized: bigint;
}

export class StoredBalance {
    public epoch: bigint;
    constructor(
        public currentEpochBalance: bigint = stakingConstants.ZERO_AMOUNT,
        public nextEpochBalance: bigint = stakingConstants.ZERO_AMOUNT,
        epoch: Numberish = 0,
    ) {
        this.epoch = BigInt(epoch.toString());
    }
}

/**
 * Simulates _loadCurrentBalance. `shouldMutate` flag specifies whether or not to update the given
 * StoredBalance instance.
 */
export function loadCurrentBalance(balance: StoredBalance, epoch: bigint): StoredBalance {
    return new StoredBalance(
        epoch > balance.epoch ? balance.nextEpochBalance : balance.currentEpochBalance,
        balance.nextEpochBalance,
        epoch.toString(),
    );
}

/**
 * Simulates _increaseNextBalance
 */
export function increaseNextBalance(balance: StoredBalance, amount: Numberish, epoch: bigint): StoredBalance {
    const newBalance = loadCurrentBalance(balance, epoch);
    return {
        ...newBalance,
        nextEpochBalance: newBalance.nextEpochBalance + BigInt(amount.toString()),
    };
}

/**
 * Simulates _decreaseNextBalance
 */
export function decreaseNextBalance(balance: StoredBalance, amount: Numberish, epoch: bigint): StoredBalance {
    const newBalance = loadCurrentBalance(balance, epoch);
    return {
        ...newBalance,
        nextEpochBalance: newBalance.nextEpochBalance - BigInt(amount.toString()),
    };
}

/**
 * Simulates _increaseCurrentAndNextBalance
 */
export function increaseCurrentAndNextBalance(
    balance: StoredBalance,
    amount: Numberish,
    epoch: bigint,
): StoredBalance {
    const newBalance = loadCurrentBalance(balance, epoch);
    const amountBigInt = BigInt(amount.toString());
    return {
        ...newBalance,
        currentEpochBalance: newBalance.currentEpochBalance + amountBigInt,
        nextEpochBalance: newBalance.nextEpochBalance + amountBigInt,
    };
}

/**
 * Simulates _decreaseCurrentAndNextBalance
 */
export function decreaseCurrentAndNextBalance(
    balance: StoredBalance,
    amount: Numberish,
    epoch: bigint,
): StoredBalance {
    const newBalance = loadCurrentBalance(balance, epoch);
    const amountBigInt = BigInt(amount.toString());
    return {
        ...newBalance,
        currentEpochBalance: newBalance.currentEpochBalance - amountBigInt,
        nextEpochBalance: newBalance.nextEpochBalance - amountBigInt,
    };
}

export interface StakeBalanceByPool {
    [key: string]: StoredBalance;
}

export enum StakeStatus {
    Undelegated,
    Delegated,
}

export class StakeInfo {
    constructor(public status: StakeStatus, public poolId: string = stakingConstants.NIL_POOL_ID) {}
}

export interface StakeBalances {
    currentEpoch: bigint;
    zrxBalance: bigint;
    stakeBalance: bigint;
    stakeBalanceInVault: bigint;
    undelegatedStakeBalance: StoredBalance;
    delegatedStakeBalance: StoredBalance;
    globalUndelegatedStakeBalance: StoredBalance;
    globalDelegatedStakeBalance: StoredBalance;
    delegatedStakeByPool: StakeBalanceByPool;
    totalDelegatedStakeByPool: StakeBalanceByPool;
}

export interface RewardBalanceByPoolId {
    [key: string]: bigint;
}

export interface OperatorShareByPoolId {
    [key: string]: bigint;
}

export interface OperatorBalanceByPoolId {
    [key: string]: bigint;
}

export interface BalanceByOwner {
    [key: string]: bigint;
}

export interface RewardByPoolId {
    [key: string]: bigint;
}

export interface DelegatorBalancesByPoolId {
    [key: string]: BalanceByOwner;
}

export interface OperatorByPoolId {
    [key: string]: string;
}

export interface DelegatorsByPoolId {
    [key: string]: string[];
}

export type DecodedLogs = Array<LogWithDecodedArgs<DecodedLogArgs>>;

// mapping (uint8 => IStructs.StoredBalance) internal _globalStakeByStatus;
export interface GlobalStakeByStatus {
    [StakeStatus.Undelegated]: StoredBalance;
    [StakeStatus.Delegated]: StoredBalance;
}

/*
 * A combination of:
 * mapping (uint8 => mapping (address => IStructs.StoredBalance)) internal _ownerStakeByStatus;
 * and
 * mapping (address => mapping (bytes32 => IStructs.StoredBalance)) internal _delegatedStakeToPoolByOwner;
 */
export interface OwnerStakeByStatus {
    [StakeStatus.Undelegated]: StoredBalance;
    [StakeStatus.Delegated]: {
        total: StoredBalance;
        [poolId: string]: StoredBalance;
    };
}

export interface StakingPool {
    operator: string;
    operatorShare: number;
    delegatedStake: StoredBalance;
    lastFinalized: bigint; // Epoch during which the pool was most recently finalized
}

export interface StakingPoolById {
    [poolId: string]: StakingPool;
}

export class PoolStats {
    public feesCollected: bigint = stakingConstants.ZERO_AMOUNT;
    public weightedStake: bigint = stakingConstants.ZERO_AMOUNT;
    public membersStake: bigint = stakingConstants.ZERO_AMOUNT;

    public static fromArray(arr: [bigint, bigint, bigint]): PoolStats {
        const poolStats = new PoolStats();
        [poolStats.feesCollected, poolStats.weightedStake, poolStats.membersStake] = arr;
        return poolStats;
    }
}

export class AggregatedStats {
    public rewardsAvailable: bigint = stakingConstants.ZERO_AMOUNT;
    public numPoolsToFinalize: bigint = stakingConstants.ZERO_AMOUNT;
    public totalFeesCollected: bigint = stakingConstants.ZERO_AMOUNT;
    public totalWeightedStake: bigint = stakingConstants.ZERO_AMOUNT;
    public totalRewardsFinalized: bigint = stakingConstants.ZERO_AMOUNT;

    public static fromArray(arr: [bigint, bigint, bigint, bigint, bigint]): AggregatedStats {
        const aggregatedStats = new AggregatedStats();
        [
            aggregatedStats.rewardsAvailable,
            aggregatedStats.numPoolsToFinalize,
            aggregatedStats.totalFeesCollected,
            aggregatedStats.totalWeightedStake,
            aggregatedStats.totalRewardsFinalized,
        ] = arr;
        return aggregatedStats;
    }
}

export interface AggregatedStatsByEpoch {
    [epoch: string]: AggregatedStats;
}
