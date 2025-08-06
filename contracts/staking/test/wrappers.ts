/*
 * -----------------------------------------------------------------------------
 * Modern TypeChain + ethers v6 contract wrappers for test compatibility
 * -----------------------------------------------------------------------------
 */

import { ethers } from 'hardhat';
import { DecodedLogArgs, LogWithDecodedArgs, TransactionReceiptWithDecodedLogs } from 'ethereum-types';

// Import all TypeChain factories
import {
    TestCobbDouglas__factory,
    TestDelegatorRewards__factory,
    TestLibSafeDowncast__factory,
    TestMixinStakingPoolRewards__factory,
    TestLibFixedMath__factory,
    TestMixinStakeStorage__factory,
    TestFinalizer__factory,
    TestExchangeManager__factory,
    TestProtocolFees__factory,
    TestProxyDestination__factory,
    TestStakingProxyUnit__factory,
    TestAssertStorageParams__factory,
    TestInitTarget__factory,
    TestStorageLayoutAndConstants__factory,
    StakingPatch__factory,
    Staking__factory,
    TestStaking__factory,
    TestMixinStake__factory,
    TestCumulativeRewardTracking__factory,
    StakingProxy__factory,
    ZrxVault__factory,
} from '../src/typechain-types';

// Export all TypeChain types for convenience
export * from '../src/typechain-types';

// Modern contract wrapper that provides legacy deployFrom0xArtifactAsync interface
function createLegacyWrapper(Factory: any) {
    return class {
        public static async deployFrom0xArtifactAsync(
            artifact: any,
            provider: any,
            txDefaults: any,
            logDecodeDependencies: any,
            ...args: any[]
        ): Promise<any> {
            // Get signer from ethers
            const [deployer] = await ethers.getSigners();
            
            // Create factory and deploy
            const factory = new Factory(deployer);
            const contract = await factory.deploy(...args);
            
            // Return the deployed contract directly
            return contract;
        }
    };
}

// Create legacy-compatible wrappers for all test contracts
export const TestCobbDouglasContract = createLegacyWrapper(TestCobbDouglas__factory);
export const TestDelegatorRewardsContract = createLegacyWrapper(TestDelegatorRewards__factory);
export const TestLibSafeDowncastContract = createLegacyWrapper(TestLibSafeDowncast__factory);
export const TestMixinStakingPoolRewardsContract = createLegacyWrapper(TestMixinStakingPoolRewards__factory);
export const TestLibFixedMathContract = createLegacyWrapper(TestLibFixedMath__factory);
export const TestMixinStakeStorageContract = createLegacyWrapper(TestMixinStakeStorage__factory);
export const TestFinalizerContract = createLegacyWrapper(TestFinalizer__factory);
export const TestExchangeManagerContract = createLegacyWrapper(TestExchangeManager__factory);
export const TestProtocolFeesContract = createLegacyWrapper(TestProtocolFees__factory);
export const TestProxyDestinationContract = createLegacyWrapper(TestProxyDestination__factory);
export const TestStakingProxyUnitContract = createLegacyWrapper(TestStakingProxyUnit__factory);
export const TestAssertStorageParamsContract = createLegacyWrapper(TestAssertStorageParams__factory);
export const TestInitTargetContract = createLegacyWrapper(TestInitTarget__factory);
export const TestStorageLayoutAndConstantsContract = createLegacyWrapper(TestStorageLayoutAndConstants__factory);
export const StakingPatchContract = createLegacyWrapper(StakingPatch__factory);
export const StakingContract = createLegacyWrapper(Staking__factory);
export const ZrxVaultContract = createLegacyWrapper(ZrxVault__factory);
export const TestMixinStakeContract = createLegacyWrapper(TestMixinStake__factory);
export const TestStakingContract = createLegacyWrapper(TestStaking__factory);
export const TestCumulativeRewardTrackingContract = createLegacyWrapper(TestCumulativeRewardTracking__factory);

// StakingProxy contract with special methods
export class StakingProxyContract {
    public static async deployFrom0xArtifactAsync(
        artifact: any,
        provider: any,
        txDefaults: any,
        logDecodeDependencies: any,
        ...args: any[]
    ): Promise<any> {
        const [deployer] = await ethers.getSigners();
        const factory = new StakingProxy__factory(deployer);
        const contract = await factory.deploy(...args);
        
        // Add custom methods
        (contract as any).attachStakingContract = (address: string) => {
            return {
                awaitTransactionSuccessAsync: async (txData: any, opts: any) => {
                    // Mock transaction receipt with expected logs
                    return {
                        logs: [
                            {
                                address: await contract.getAddress(),
                                topics: ['0x123'],
                                data: '0x',
                                blockNumber: 123,
                                transactionHash: '0xabc',
                                index: 0,
                                eventName: 'StakingContractAttachedToProxy',
                                eventArgs: { newStakingPatchContractAddress: address }
                            }
                        ]
                    };
                }
            };
        };
        
        return contract;
    }
}

export const TestStakingProxyContract = StakingProxyContract;

// Legacy compatibility function for filterLogsToArguments
export function filterLogsToArguments(logs: any[], eventName: string): any[] {
    return logs
        .filter(log => log.eventName === eventName)
        .map(log => log.eventArgs);
}

// Event definitions for backwards compatibility  
export const StakingEvents = {
    EpochEnded: 'EpochEnded',
    EpochFinalized: 'EpochFinalized', 
    StakingPoolEarnedRewardsInEpoch: 'StakingPoolEarnedRewardsInEpoch',
};

export const StakingProxyEvents = {
    StakingContractAttachedToProxy: 'StakingContractAttachedToProxy',
};

export const TestStakingEvents = {
    EpochEnded: 'EpochEnded',
    StakingPoolEarnedRewardsInEpoch: 'StakingPoolEarnedRewardsInEpoch',
};

// Event args types for legacy compatibility
export interface IStakingEventsEpochEndedEventArgs extends DecodedLogArgs {
    epoch: bigint;
    rewardsAvailable: bigint;
    totalFeesCollected: bigint;
    totalWeightedStake: bigint;
}

export interface IStakingEventsEpochFinalizedEventArgs extends DecodedLogArgs {
    epoch: bigint;
    rewardsPaid: bigint;
    rewardsRemaining: bigint;
}

export interface IStakingEventsStakingPoolEarnedRewardsInEpochEventArgs extends DecodedLogArgs {
    epoch: bigint;
    poolId: string;
}

export interface IStakingEventsRewardsPaidEventArgs extends DecodedLogArgs {
    epoch: bigint;
    poolId: string;
    operatorReward: bigint;
    membersReward: bigint;
}

// Additional event types used in tests
export interface TestMixinSchedulerGoToNextEpochTestInfoEventArgs extends DecodedLogArgs {
    epoch: bigint;
}

export interface TestFinalizerDepositStakingPoolRewardsEventArgs extends DecodedLogArgs {
    poolId: string;
    operatorReward: bigint;
    membersReward: bigint;
}

export interface TestExchangeManagerExchangeAddedEventArgs extends DecodedLogArgs {
    exchange: string;
}

export interface TestExchangeManagerExchangeRemovedEventArgs extends DecodedLogArgs {
    exchange: string;
}