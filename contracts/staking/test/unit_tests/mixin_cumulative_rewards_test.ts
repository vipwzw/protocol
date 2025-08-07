import { expect } from 'chai';
import { expect, toBaseUnitAmount } from '@0x/test-utils';
import * as _ from 'lodash';

import { constants as stakingConstants } from '../../src/constants';
import { TestMixinCumulativeRewards__factory, TestMixinCumulativeRewards } from '../../src/typechain-types';
import { ethers } from 'hardhat';

describe('MixinCumulativeRewards unit tests', env => {
    const ZERO = 0n;
    const testRewards = [
        {
            numerator: 1n,
            denominator: 2n,
        },
        {
            numerator: 3n,
            denominator: 4n,
        },
    ];
    const sumOfTestRewardsNormalized = {
        numerator: 10n,
        denominator: 8n,
    };
    let testPoolId: string;
    let testContract: TestMixinCumulativeRewards;

    before(async () => {
        // Deploy contracts
        const [deployer] = await ethers.getSigners();
        const factory = new TestMixinCumulativeRewards__factory(deployer);
        testContract = await factory.deploy(
            stakingConstants.NIL_ADDRESS,
            stakingConstants.NIL_ADDRESS,
        );

        // Create a test pool
        const operatorShare = 1n;
        const addOperatorAsMaker = true;
        const tx = await testContract.createStakingPool(operatorShare, addOperatorAsMaker);
        const txReceipt = await tx.wait();
        const createStakingPoolLog = txReceipt.logs[0];
        testPoolId = (createStakingPoolLog as any).args.poolId;
    });

    describe('_isCumulativeRewardSet', () => {
        it('Should return true iff denominator is non-zero', async () => {
            const isSet = await testContract
                .isCumulativeRewardSet({
                    numerator: ZERO,
                    denominator: 1n,
                })
                ();
            expect(isSet).to.be.true();
        });
        it('Should return false iff denominator is zero', async () => {
            const isSet = await testContract
                .isCumulativeRewardSet({
                    numerator: 1n,
                    denominator: ZERO,
                })
                ();
            expect(isSet).to.be.false();
        });
    });

    describe('_addCumulativeReward', () => {
        it('Should set value to `reward/stake` if this is the first cumulative reward', async () => {
            const tx = await testContract.addCumulativeReward(testPoolId, testRewards[0].numerator, testRewards[0].denominator);
            await tx.wait();
            const [mostRecentCumulativeReward] = await testContract.getMostRecentCumulativeReward(testPoolId);
            expect(mostRecentCumulativeReward).to.deep.equal(testRewards[0]);
        });

        it('Should do nothing if a cumulative reward has already been recorded in the current epoch (`lastStoredEpoch == currentEpoch_`)', async () => {
            const tx1 = await testContract.addCumulativeReward(testPoolId, testRewards[0].numerator, testRewards[0].denominator);
            await tx1.wait();
            // this call should not overwrite existing value (testRewards[0])
            const tx2 = await testContract.addCumulativeReward(testPoolId, testRewards[1].numerator, testRewards[1].denominator);
            await tx2.wait();
            const [mostRecentCumulativeReward] = await testContract
                .getMostRecentCumulativeReward(testPoolId)
                ();
            expect(mostRecentCumulativeReward).to.deep.equal(testRewards[0]);
        });

        it('Should set value to normalized sum of `reward/stake` plus most recent cumulative reward, given one exists', async () => {
            const tx1 = await testContract.addCumulativeReward(testPoolId, testRewards[0].numerator, testRewards[0].denominator);
            await tx1.wait();
            const tx2 = await testContract.incrementEpoch();
            await tx2.wait();
            const tx3 = await testContract.addCumulativeReward(testPoolId, testRewards[1].numerator, testRewards[1].denominator);
            await tx3.wait();
            const [mostRecentCumulativeReward] = await testContract
                .getMostRecentCumulativeReward(testPoolId)
                ();
            expect(mostRecentCumulativeReward).to.deep.equal(sumOfTestRewardsNormalized);
        });
    });

    describe('_updateCumulativeReward', () => {
        it('Should set current cumulative reward to most recent cumulative reward', async () => {
            const tx1 = await testContract.addCumulativeReward(testPoolId, testRewards[0].numerator, testRewards[0].denominator);
            await tx1.wait();
            const tx2 = await testContract.incrementEpoch();
            await tx2.wait();
            const tx3 = await testContract.updateCumulativeReward(testPoolId);
            await tx3.wait();
            const epoch = 2n;
            const mostRecentCumulativeReward = await testContract
                .getCumulativeRewardAtEpochRaw(testPoolId, epoch)
                ();
            expect(mostRecentCumulativeReward).to.deep.equal(testRewards[0]);
        });
    });

    describe('_computeMemberRewardOverInterval', () => {
        const runTest = async (
            amountToStake: bigint,
            epochOfFirstReward: bigint,
            epochOfSecondReward: bigint,
            epochOfIntervalStart: bigint,
            epochOfIntervalEnd: bigint,
        ): Promise<void> => {
            // Simulate earning reward
            const tx1 = await testContract.storeCumulativeReward(testPoolId, testRewards[0], epochOfFirstReward);
            await tx1.wait();
            const tx2 = await testContract.storeCumulativeReward(testPoolId, sumOfTestRewardsNormalized, epochOfSecondReward);
            await tx2.wait();
            const reward = await testContract
                .computeMemberRewardOverInterval(testPoolId, amountToStake, epochOfIntervalStart, epochOfIntervalEnd)
                ();
            // Compute expected reward
            const lhs = sumOfTestRewardsNormalized.numerator / sumOfTestRewardsNormalized.denominator;
            const rhs = testRewards[0].numerator / testRewards[0].denominator;
            const expectedReward = (lhs - rhs) * amountToStake;
            // Assert correctness
            expect(reward).to.equal(expectedReward);
        };

        it('Should successfully compute reward over a valid interval when staking non-zero ZRX', async () => {
            const amountToStake = BigInt(toBaseUnitAmount(1).toString());
            const epochOfFirstReward = 1n;
            const epochOfSecondReward = 2n;
            const epochOfIntervalStart = 1n;
            const epochOfIntervalEnd = 2n;
            await runTest(
                amountToStake,
                epochOfFirstReward,
                epochOfSecondReward,
                epochOfIntervalStart,
                epochOfIntervalEnd,
            );
        });

        it('Should successfully compute reward if no entry for current epoch, but there is an entry for epoch n-1', async () => {
            // End epoch = n-1 forces the code to query the previous epoch's cumulative reward
            const amountToStake = BigInt(toBaseUnitAmount(1).toString());
            const epochOfFirstReward = 1n;
            const epochOfSecondReward = 2n;
            const epochOfIntervalStart = 1n;
            const epochOfIntervalEnd = 3n;
            await runTest(
                amountToStake,
                epochOfFirstReward,
                epochOfSecondReward,
                epochOfIntervalStart,
                epochOfIntervalEnd,
            );
        });

        it('Should successfully compute reward if no entry for current epoch, but there is an entry for epoch n-2', async () => {
            // End epoch = n-2 forces the code to query the most recent cumulative reward
            const amountToStake = BigInt(toBaseUnitAmount(1).toString());
            const epochOfFirstReward = 1n;
            const epochOfSecondReward = 2n;
            const epochOfIntervalStart = 1n;
            const epochOfIntervalEnd = 4n;
            await runTest(
                amountToStake,
                epochOfFirstReward,
                epochOfSecondReward,
                epochOfIntervalStart,
                epochOfIntervalEnd,
            );
        });

        it('Should successfully compute reward are no cumulative reward entries', async () => {
            // No entries forces the default cumulatie reward to be used in computations
            const stake = BigInt(toBaseUnitAmount(1).toString());
            const beginEpoch = 1n;
            const endEpoch = 2n;
            const reward = await testContract
                .computeMemberRewardOverInterval(testPoolId, stake, beginEpoch, endEpoch)
                ();
            expect(reward).to.equal(ZERO);
        });

        it('Should return zero if no stake was delegated', async () => {
            const stake = toBaseUnitAmount(0);
            const beginEpoch = 1n;
            const endEpoch = 2n;
            const reward = await testContract
                .computeMemberRewardOverInterval(testPoolId, stake, beginEpoch, endEpoch)
                ();
            expect(reward).to.equal(ZERO);
        });

        it('Should return zero if the start/end of the interval are the same epoch', async () => {
            const stake = BigInt(toBaseUnitAmount(1).toString());
            const beginEpoch = 1n;
            const endEpoch = 1n;
            const reward = await testContract
                .computeMemberRewardOverInterval(testPoolId, stake, beginEpoch, endEpoch)
                ();
            expect(reward).to.equal(ZERO);
        });

        it('Should revert if start is greater than the end of the interval', async () => {
            const stake = BigInt(toBaseUnitAmount(1).toString());
            const beginEpoch = 2n;
            const endEpoch = 1n;
            const tx = testContract
                .computeMemberRewardOverInterval(testPoolId, stake, beginEpoch, endEpoch)
                ();
            return expect(tx).to.revertedWith('CR_INTERVAL_INVALID');
        });
    });
});
