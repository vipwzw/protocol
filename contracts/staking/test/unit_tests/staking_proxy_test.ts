import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants, expect, verifyEventsFromLogs, expectBigIntEqual, toBigInt } from '../test_constants';

// AuthorizableRevertErrors replacement
export class AuthorizableRevertErrors {
    static SenderNotAuthorizedError(): Error {
        return new Error('Authorizable: sender not authorized');
    }
}
// StakingRevertErrors replacement
export class StakingRevertErrors {
    static ProxyError(): Error {
        return new Error('Staking: proxy error');
    }
}
import * as _ from 'lodash';

import { artifacts } from '../artifacts';
import {
    StakingProxyEvents,
    TestProxyDestinationContract,
    TestProxyDestinationEvents,
    TestStakingProxyUnitContract,
} from '../wrappers';

import { constants as stakingConstants } from '../../src/constants';

// TODO: Fix BigNumber usage in this file
/*
describe('StakingProxy unit tests', env => {
    const testString = 'Hello, World!';
    const testRevertString = 'Goodbye, World!';
    let accounts: string[];
    let owner: string;
    let authorizedAddress: string;
    let notAuthorizedAddresses: string[];
    let testProxyContract: TestStakingProxyUnitContract;
    let testContractViaProxy: TestProxyDestinationContract;
    let testContract: TestProxyDestinationContract;
    let testContract2: TestProxyDestinationContract;

    before(async () => {
        // Create accounts
        accounts = await ethers.getSigners().then(signers => signers.map(s => s.address));
        [owner, authorizedAddress, ...notAuthorizedAddresses] = accounts;

        // Deploy contracts
        testContract = await TestProxyDestinationContract.deployFrom0xArtifactAsync(
            artifacts.TestProxyDestination,
            await ethers.getSigners().then(signers => signers[0]),
            {},
            artifacts,
        );
        testContract2 = await TestProxyDestinationContract.deployFrom0xArtifactAsync(
            artifacts.TestProxyDestination,
            await ethers.getSigners().then(signers => signers[0]),
            {},
            artifacts,
        );
        testProxyContract = await TestStakingProxyUnitContract.deployFrom0xArtifactAsync(
            artifacts.TestStakingProxyUnit,
            await ethers.getSigners().then(signers => signers[0]),
            {},
            artifacts,
            testContract.address,
        );
        const logDecoderDependencies = _.mapValues(artifacts, v => v.compilerOutput.abi);
        testContractViaProxy = new TestProxyDestinationContract(
            testProxyContract.address,
            await ethers.getSigners().then(signers => signers[0]),
            {},
            logDecoderDependencies,
        );

        // Add authorized address to Staking Proxy
        await testProxyContract.addAuthorizedAddress(authorizedAddress).sendTransactionAsync({ from: owner });
    });

    describe('Fallback function', () => {
        it('should pass back the return value of the destination contract', async () => {
            const returnValue = await testContractViaProxy.echo(testString);
            expect(returnValue).to.equal(testString);
        });

        it('should revert with correct value when destination reverts', async () => {
            return expect(testContractViaProxy.die()).to.revertedWith(testRevertString);
        });

        it('should revert if no staking contract is attached', async () => {
            await testProxyContract.detachStakingContract().awaitTransactionSuccessAsync({ from: authorizedAddress });
            const expectedError = new StakingRevertErrors.ProxyDestinationCannotBeNilError();
            const tx = testContractViaProxy.echo(testString);
            return expect(tx).to.revertedWith(expectedError);
        });
    });

    describe('attachStakingContract', () => {
        it('should successfully attaching a new staking contract', async () => {
            // Cache existing staking contract and attach a new one
            const initStakingContractAddress = await testProxyContract.stakingContract();
            const txReceipt = await testProxyContract
                .attachStakingContract(testContract2.address)
                .awaitTransactionSuccessAsync({ from: authorizedAddress });

            // Validate `ContractAttachedToProxy` event
            verifyEventsFromLogs(
                txReceipt.logs,
                [
                    {
                        newStakingContractAddress: testContract2.address,
                    },
                ],
                StakingProxyEvents.StakingContractAttachedToProxy,
            );

            // Check that `init` was called on destination contract
            verifyEventsFromLogs(
                txReceipt.logs,
                [
                    {
                        initCalled: true,
                    },
                ],
                TestProxyDestinationEvents.InitCalled,
            );

            // Validate new staking contract address
            const finalStakingContractAddress = await testProxyContract.stakingContract();
            expect(finalStakingContractAddress).to.be.equal(testContract2.address);
            expect(finalStakingContractAddress).to.not.equal(initStakingContractAddress);
        });

        it('should revert if call to `init` on new staking contract fails', async () => {
            await testProxyContract.setInitFailFlag(); await tx.wait();
            const tx = testProxyContract.attachStakingContract(testContract2.address).awaitTransactionSuccessAsync({
                from: authorizedAddress,
            });
            const expectedError = 'INIT_FAIL_FLAG_SET';
            return expect(tx).to.revertedWith(expectedError);
        });

        it('should revert if called by unauthorized address', async () => {
            const tx = testProxyContract.attachStakingContract(testContract2.address).awaitTransactionSuccessAsync({
                from: notAuthorizedAddresses[0],
            });
            const expectedError = new AuthorizableRevertErrors.SenderNotAuthorizedError(notAuthorizedAddresses[0]);
            return expect(tx).to.revertedWith(expectedError);
        });
    });

    describe('detachStakingContract', () => {
        it('should detach staking contract', async () => {
            // Cache existing staking contract and attach a new one
            const initStakingContractAddress = await testProxyContract.stakingContract();
            const txReceipt = await testProxyContract.detachStakingContract().awaitTransactionSuccessAsync({
                from: authorizedAddress,
            });

            // Validate that event was emitted
            verifyEventsFromLogs(txReceipt.logs, [{}], StakingProxyEvents.StakingContractDetachedFromProxy);

            // Validate staking contract address was unset
            const finalStakingContractAddress = await testProxyContract.stakingContract();
            expect(finalStakingContractAddress).to.be.equal(stakingConstants.NIL_ADDRESS);
            expect(finalStakingContractAddress).to.not.equal(initStakingContractAddress);
        });

        it('should revert if called by unauthorized address', async () => {
            const tx = testProxyContract.detachStakingContract().awaitTransactionSuccessAsync({
                from: notAuthorizedAddresses[0],
            });
            const expectedError = new AuthorizableRevertErrors.SenderNotAuthorizedError(notAuthorizedAddresses[0]);
            return expect(tx).to.revertedWith(expectedError);
        });
    });

    describe('batchExecute', () => {
        it('should execute no-op if no calls to make', async () => {
            await testProxyContract.batchExecute([]); await tx.wait();
        });

        it('should call one function and return the output', async () => {
            const calls = [testContract.echo(testString).getABIEncodedTransactionData()];
            const rawResults = await testProxyContract.batchExecute(calls);
            expect(rawResults.length).to.equal(1);
            const returnValues = [testContract.getABIDecodedReturnData<{}>('echo', rawResults[0])];
            expect(returnValues[0]).to.equal(testString);
        });

        it('should call multiple functions and return their outputs', async () => {
            const calls = [
                testContract.echo(testString).getABIEncodedTransactionData(),
                testContract.doMath(2n, 1n).getABIEncodedTransactionData(),
            ];
            const rawResults = await testProxyContract.batchExecute(calls);
            expect(rawResults.length).to.equal(2);
            const returnValues = [
                testContract.getABIDecodedReturnData<string>('echo', rawResults[0]),
                testContract.getABIDecodedReturnData<BigNumber[]>('doMath', rawResults[1]),
            ];
            expect(returnValues[0]).to.equal(testString);
            expectBigIntEqual(toBigInt(returnValues[1][0]), 3n);
            expectBigIntEqual(toBigInt(returnValues[1][1]), 1n);
        });

        it('should revert if a call reverts', async () => {
            const calls = [
                testContract.echo(testString).getABIEncodedTransactionData(),
                testContract.die().getABIEncodedTransactionData(),
                testContract.doMath(2n, 1n).getABIEncodedTransactionData(),
            ];
            const tx = testProxyContract.batchExecute(calls);
            const expectedError = testRevertString;
            return expect(tx).to.revertedWith(expectedError);
        });

        it('should revert if no staking contract is attached', async () => {
            await testProxyContract.detachStakingContract().awaitTransactionSuccessAsync({ from: authorizedAddress });
            const calls = [testContract.echo(testString).getABIEncodedTransactionData()];

            const tx = testProxyContract.batchExecute(calls);
            const expectedError = new StakingRevertErrors.ProxyDestinationCannotBeNilError();
            return expect(tx).to.revertedWith(expectedError);
        });
    });

    describe('assertValidStorageParams', () => {
        const validStorageParams = {
            epochDurationInSeconds: stakingConstants.ONE_DAY_IN_SECONDS * 5n,
            cobbDouglasAlphaNumerator: 1n,
            cobbDouglasAlphaDenominator: 1n,
            rewardDelegatedStakeWeight: constants.PPM_DENOMINATOR,
            minimumPoolStake: 100n,
        };
        it('should not revert if all storage params are valid', async () => {
            await testProxyContract.setTestStorageParams(validStorageParams); await tx.wait();
            await testProxyContract.assertValidStorageParams();
        });
        it('should revert if `epochDurationInSeconds` is less than 5 days', async () => {
            const invalidStorageParams = {
                ...validStorageParams,
                epochDurationInSeconds: 0n,
            };
            await testProxyContract.setTestStorageParams(invalidStorageParams); await tx.wait();
            const tx = testProxyContract.assertValidStorageParams();
            const expectedError = new StakingRevertErrors.InvalidParamValueError(
                StakingRevertErrors.InvalidParamValueErrorCodes.InvalidEpochDuration,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('should revert if `epochDurationInSeconds` is greater than 30 days', async () => {
            const invalidStorageParams = {
                ...validStorageParams,
                epochDurationInSeconds: stakingConstants.ONE_DAY_IN_SECONDS * 31n,
            };
            await testProxyContract.setTestStorageParams(invalidStorageParams); await tx.wait();
            const tx = testProxyContract.assertValidStorageParams();
            const expectedError = new StakingRevertErrors.InvalidParamValueError(
                StakingRevertErrors.InvalidParamValueErrorCodes.InvalidEpochDuration,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('should revert if `cobbDouglasAlphaNumerator` is greater than `cobbDouglasAlphaDenominator`', async () => {
            const invalidStorageParams = {
                ...validStorageParams,
                cobbDouglasAlphaNumerator: 2n,
                cobbDouglasAlphaDenominator: 1n,
            };
            await testProxyContract.setTestStorageParams(invalidStorageParams); await tx.wait();
            const tx = testProxyContract.assertValidStorageParams();
            const expectedError = new StakingRevertErrors.InvalidParamValueError(
                StakingRevertErrors.InvalidParamValueErrorCodes.InvalidCobbDouglasAlpha,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('should revert if `cobbDouglasAlphaDenominator` equals zero', async () => {
            const invalidStorageParams = {
                ...validStorageParams,
                cobbDouglasAlphaDenominator: 0n,
            };
            await testProxyContract.setTestStorageParams(invalidStorageParams); await tx.wait();
            const tx = testProxyContract.assertValidStorageParams();
            const expectedError = new StakingRevertErrors.InvalidParamValueError(
                StakingRevertErrors.InvalidParamValueErrorCodes.InvalidCobbDouglasAlpha,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('should revert if `rewardDelegatedStakeWeight` is greater than PPM_DENOMINATOR', async () => {
            const invalidStorageParams = {
                ...validStorageParams,
                rewardDelegatedStakeWeight: constants.PPM_DENOMINATOR + 1n,
            };
            await testProxyContract.setTestStorageParams(invalidStorageParams); await tx.wait();
            const tx = testProxyContract.assertValidStorageParams();
            const expectedError = new StakingRevertErrors.InvalidParamValueError(
                StakingRevertErrors.InvalidParamValueErrorCodes.InvalidRewardDelegatedStakeWeight,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('should revert if `minimumPoolStake` is less than two', async () => {
            const invalidStorageParams = {
                ...validStorageParams,
                minimumPoolStake: 1n,
            };
            await testProxyContract.setTestStorageParams(invalidStorageParams); await tx.wait();
            const tx = testProxyContract.assertValidStorageParams();
            const expectedError = new StakingRevertErrors.InvalidParamValueError(
                StakingRevertErrors.InvalidParamValueErrorCodes.InvalidMinimumPoolStake,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
    });
});
// tslint:disable: max-file-line-count
*/
