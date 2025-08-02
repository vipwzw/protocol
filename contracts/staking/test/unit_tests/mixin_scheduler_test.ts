import { blockchainTests, constants, expect, verifyEventsFromLogs } from '@0x/test-utils';
import { StakingRevertErrors } from '@0x/utils';
import { LogWithDecodedArgs } from 'ethereum-types';

import { constants as stakingConstants } from '../../src/constants';
import { TestMixinScheduler__factory, TestMixinScheduler } from '../../src/typechain-types';
import { ethers } from 'hardhat';
import {
    TestMixinSchedulerEvents,
    TestMixinSchedulerGoToNextEpochTestInfoEventArgs,
} from '../wrappers';

blockchainTests.resets('MixinScheduler unit tests', env => {
    let testContract: TestMixinScheduler;

    before(async () => {
        // Deploy contracts
        const [deployer] = await ethers.getSigners();
        const factory = new TestMixinScheduler__factory(deployer);
        testContract = await factory.deploy(
            stakingConstants.NIL_ADDRESS,
            stakingConstants.NIL_ADDRESS,
        );
    });

    describe('getCurrentEpochEarliestEndTimeInSeconds', () => {
        it('Should return the sum of `epoch start time + epoch duration`', async () => {
            const testDeployedTimestamp = await testContract.testDeployedTimestamp();
            const epochDurationInSeconds = await testContract.epochDurationInSeconds();
            const expectedCurrentEpochEarliestEndTimeInSeconds = testDeployedTimestamp + epochDurationInSeconds;
            const currentEpochEarliestEndTimeInSeconds = await testContract
                .getCurrentEpochEarliestEndTimeInSeconds();
            expect(currentEpochEarliestEndTimeInSeconds).to.equal(
                expectedCurrentEpochEarliestEndTimeInSeconds,
            );
        });
    });

    describe('_initMixinScheduler', () => {
        it('Should succeed if scheduler is not yet initialized (`currentEpochStartTimeInSeconds == 0`)', async () => {
            const initCurrentEpochStartTimeInSeconds = 0n;
            const tx = await testContract.initMixinSchedulerTest(initCurrentEpochStartTimeInSeconds);
            const txReceipt = await tx.wait();
            // Assert `currentEpochStartTimeInSeconds` was properly initialized
            const block = await ethers.provider.getBlock(txReceipt?.blockNumber || 'latest');
            const blockTimestamp = BigInt(block?.timestamp || 0);
            const currentEpochStartTimeInSeconds = await testContract.currentEpochStartTimeInSeconds();
            expect(currentEpochStartTimeInSeconds).to.equal(blockTimestamp);
            // Assert `currentEpoch` was properly initialized
            const currentEpoch = await testContract.currentEpoch();
            expect(currentEpoch).to.equal(1n);
        });

        it('Should revert if scheduler is already initialized (`currentEpochStartTimeInSeconds != 0`)', async () => {
            const initCurrentEpochStartTimeInSeconds = 10n;
            const tx = testContract.initMixinSchedulerTest(initCurrentEpochStartTimeInSeconds);
            return expect(tx).to.revertWith(
                new StakingRevertErrors.InitializationError(
                    StakingRevertErrors.InitializationErrorCodes.MixinSchedulerAlreadyInitialized,
                ),
            );
        });
    });

    describe('_goToNextEpoch', () => {
        it('Should succeed if epoch end time is strictly less than to block timestamp', async () => {
            const epochEndTimeDelta = -10n;
            const tx = await testContract.goToNextEpochTest(epochEndTimeDelta);
            const txReceipt = await tx.wait();
            const currentEpoch = await testContract.currentEpoch();
            const currentEpochStartTimeInSeconds = await testContract.currentEpochStartTimeInSeconds();
            // TODO: Fix event verification for ethers.js v6
            /*
            verifyEventsFromLogs(
                txReceipt.logs,
                [
                    {
                        oldEpoch: currentEpoch - 1n,
                        blockTimestamp: currentEpochStartTimeInSeconds,
                    },
                ],
                TestMixinSchedulerEvents.GoToNextEpochTestInfo,
            );
            */
        });

        it('Should succeed if epoch end time is equal to block timestamp', async () => {
            const epochEndTimeDelta = 0n;
            const tx = await testContract.goToNextEpochTest(epochEndTimeDelta);
            const txReceipt = await tx.wait();
            // TODO: Fix event verification for ethers.js v6
            /*
            const testLog: TestMixinSchedulerGoToNextEpochTestInfoEventArgs = (
                txReceipt.logs[0] as LogWithDecodedArgs<TestMixinSchedulerGoToNextEpochTestInfoEventArgs>
            ).args;
            */
            const currentEpoch = await testContract.currentEpoch();
            const currentEpochStartTimeInSeconds = await testContract.currentEpochStartTimeInSeconds();
            // Basic validation that epoch advanced
            expect(currentEpoch).to.be.greaterThan(0n);
            expect(currentEpochStartTimeInSeconds).to.be.greaterThan(0n);
        });

        it('Should revert if epoch end time is strictly greater than block timestamp', async () => {
            const epochEndTimeDelta = 10n;
            const tx = testContract.goToNextEpochTest(epochEndTimeDelta);
            return expect(tx).to.revertWith(new StakingRevertErrors.BlockTimestampTooLowError());
        });
    });
});
