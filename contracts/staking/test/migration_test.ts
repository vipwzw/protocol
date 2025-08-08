import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants, filterLogsToArguments } from './test_constants';

// AuthorizableRevertErrors replacement
export class AuthorizableRevertErrors {
    static SenderNotAuthorizedError(): Error {
        return new Error('Authorizable: sender not authorized');
    }
}

// StakingRevertErrors replacement
export class StakingRevertErrors {
    static InitializationError(): Error {
        return new Error('Staking: initialization error');
    }
    
    static InvalidParamValueErrorCodes = {
        InvalidEpochDuration: 0,
        InvalidCobbDouglasAlpha: 1,
        InvalidRewardDelegatedStakeWeight: 2,
    };
    
    static InvalidParamValueError = class extends Error {
        constructor(errorCode: number) {
            super(`StakingRevertErrors: InvalidParamValueError ${errorCode}`);
            this.name = 'InvalidParamValueError';
        }
    };
}

// StringRevertError replacement
export class StringRevertError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StringRevertError';
    }
}

import { constants as stakingConstants } from '../src/constants';

import { artifacts } from './artifacts';
import {
    StakingContract,
    StakingProxyContract,
    TestAssertStorageParamsContract,
    TestInitTargetContract,
    TestStakingProxyContract,
    TestStakingProxyStakingContractAttachedToProxyEventArgs,
} from './wrappers';

describe('Migration tests', () => {
    let authorizedAddress: string;
    let notAuthorizedAddress: string;
    let stakingContract: StakingContract;

    before(async () => {
        const signers = await ethers.getSigners();
        [authorizedAddress, notAuthorizedAddress] = [signers[0].address, signers[1].address];
        
        stakingContract = await StakingContract.deployFrom0xArtifactAsync(
            artifacts.TestStakingNoWETH,
            signers[0],
            {},
            artifacts,
        );
        const tx = await stakingContract.addAuthorizedAddress(authorizedAddress);
        await tx.wait();
    });

    describe('StakingProxy', () => {
        const INIT_REVERT_ERROR = new StringRevertError('FORCED_INIT_REVERT');
        const STORAGE_PARAMS_REVERT_ERROR = new StringRevertError('FORCED_STORAGE_PARAMS_REVERT');
        let initTargetContract: TestInitTargetContract;
        let revertAddress: string;

        async function deployStakingProxyAsync(stakingContractAddress?: string): Promise<TestStakingProxyContract> {
            const [signer] = await ethers.getSigners();
            const proxyContract = await TestStakingProxyContract.deployFrom0xArtifactAsync(
                artifacts.TestStakingProxy,
                signer,
                {},
                artifacts,
                stakingContractAddress || constants.NULL_ADDRESS,
            );
            const tx1 = await proxyContract.addAuthorizedAddress(authorizedAddress);
            await tx1.wait();
            return proxyContract;
        }

        before(async () => {
            const [signer] = await ethers.getSigners();
            initTargetContract = await TestInitTargetContract.deployFrom0xArtifactAsync(
                artifacts.TestInitTarget,
                signer,
                {},
                artifacts,
            );
            revertAddress = await initTargetContract.SHOULD_REVERT_ADDRESS();
        });

        async function enableInitRevertsAsync(): Promise<void> {
            // Deposit some ether into `revertAddress` to signal `initTargetContract`
            // to fail.
            const [signer] = await ethers.getSigners();
            await signer.sendTransaction({
                to: revertAddress,
                value: 1,
            });
        }

        async function assertInitStateAsync(proxyContract: TestStakingProxyContract): Promise<void> {
            const [deployer] = await ethers.getSigners();
            const proxyAsInitTarget = new ethers.Contract(
                await proxyContract.getAddress(),
                artifacts.TestInitTarget.compilerOutput.abi,
                deployer,
            );
            const [senderAddress, thisAddress] = await proxyAsInitTarget.getInitState();
            expect(senderAddress).to.eq(authorizedAddress);
            expect(thisAddress).to.eq(await proxyContract.getAddress());
            const attachedAddress = await proxyContract.stakingContract();
            expect(attachedAddress).to.eq(await initTargetContract.getAddress());
        }

        describe('StakingProxy constructor', () => {
            it('calls init() and attaches the contract', async () => {
                const proxyContract = await deployStakingProxyAsync(await initTargetContract.getAddress());
                await assertInitStateAsync(proxyContract);
            });

            it('reverts if init() reverts', async () => {
                await enableInitRevertsAsync();
                const tx = deployStakingProxyAsync(await initTargetContract.getAddress());
                return expect(tx).to.revertedWith(INIT_REVERT_ERROR);
            });

            it('reverts if assertValidStorageParams() fails', async () => {
                const tx = deployStakingProxyAsync(revertAddress);
                return expect(tx).to.revertedWith(STORAGE_PARAMS_REVERT_ERROR);
            });

            it('should set the correct initial params', async () => {
                const stakingProxy = await StakingProxyContract.deployFrom0xArtifactAsync(
                    artifacts.StakingProxy,
                    await ethers.getSigners().then(signers => signers[0]),
                    {},
                    artifacts,
                    await stakingContract.getAddress(),
                );
                const stakingViaProxy = new ethers.Contract(
                    await stakingProxy.getAddress(),
                    artifacts.TestStaking.compilerOutput.abi,
                    await ethers.getSigners().then(signers => signers[0]),
                );
                const params = await stakingViaProxy.getParams();
                            expect(Number(params[0])).to.equal(Number(stakingConstants.DEFAULT_PARAMS.epochDurationInSeconds));
            expect(Number(params[1])).to.equal(Number(stakingConstants.DEFAULT_PARAMS.rewardDelegatedStakeWeight));
            expect(Number(params[2])).to.equal(Number(stakingConstants.DEFAULT_PARAMS.minimumPoolStake));
            expect(Number(params[3])).to.equal(Number(stakingConstants.DEFAULT_PARAMS.cobbDouglasAlphaNumerator));
            expect(Number(params[4])).to.equal(Number(stakingConstants.DEFAULT_PARAMS.cobbDouglasAlphaDenominator));
            });
        });

        describe('attachStakingContract()', () => {
            let proxyContract: TestStakingProxyContract;

            before(async () => {
                proxyContract = await deployStakingProxyAsync();
            });

            it('throws if not called by an authorized address', async () => {
                const tx = proxyContract.connect(await ethers.getSigner(notAuthorizedAddress)).attachStakingContract(await initTargetContract.getAddress());
                const expectedError = new AuthorizableRevertErrors.SenderNotAuthorizedError(notAuthorizedAddress);
                return expect(tx).to.revertedWith(expectedError);
            });

            it('calls init() and attaches the contract', async () => {
                const tx2 = await proxyContract.attachStakingContract(await initTargetContract.getAddress());
                await tx2.wait();
                await assertInitStateAsync(proxyContract);
            });

            it('emits a `StakingContractAttachedToProxy` event', async () => {
                const tx3 = await proxyContract.attachStakingContract(await initTargetContract.getAddress());
                const receipt = await tx3.wait();
                const logsArgs = filterLogsToArguments<TestStakingProxyStakingContractAttachedToProxyEventArgs>(
                    receipt.logs,
                    'StakingContractAttachedToProxy',
                );
                expect(logsArgs.length).to.eq(1);
                for (const args of logsArgs) {
                    expect(args.newStakingContractAddress).to.eq(initTargetContract.address);
                }
                await assertInitStateAsync(proxyContract);
            });

            it('reverts if init() reverts', async () => {
                await enableInitRevertsAsync();
                const tx = proxyContract.attachStakingContract(await initTargetContract.getAddress());
                return expect(tx).to.revertedWith(INIT_REVERT_ERROR);
            });

            it('reverts if assertValidStorageParams() fails', async () => {
                const tx = proxyContract.attachStakingContract(revertAddress);
                return expect(tx).to.revertedWith(STORAGE_PARAMS_REVERT_ERROR);
            });
        });

        describe('upgrades', () => {
            it('modifies prior state', async () => {
                const proxyContract = await deployStakingProxyAsync(await initTargetContract.getAddress());
                const tx = await proxyContract.attachStakingContract(await initTargetContract.getAddress());
                await tx.wait();
                const initCounter = await initTargetContract.getInitCounter();
                expect(Number(initCounter)).to.equal(2);
            });
        });
    });

    describe('Staking.init()', () => {
        it('throws if not called by an authorized address', async () => {
            const tx = stakingContract.connect(await ethers.getSigner(notAuthorizedAddress)).init();
            const expectedError = new AuthorizableRevertErrors.SenderNotAuthorizedError(notAuthorizedAddress);
            return expect(tx).to.revertedWith(expectedError);
        });

        it('throws if already intitialized', async () => {
            const tx1 = await stakingContract.init();
            await tx1.wait();
            const tx = stakingContract.init();
            const expectedError = new StakingRevertErrors.InitializationError();
            return expect(tx).to.revertedWith(expectedError);
        });
    });

    describe('assertValidStorageParams', () => {
        let proxyContract: TestAssertStorageParamsContract;
        const fiveDays = BigInt(5 * 24 * 60 * 60);
        const thirtyDays = BigInt(30 * 24 * 60 * 60);
        before(async () => {
            const [signer] = await ethers.getSigners();
            proxyContract = await TestAssertStorageParamsContract.deployFrom0xArtifactAsync(
                artifacts.TestAssertStorageParams,
                signer,
                {},
                artifacts,
            );
        });

        it('succeeds if all params are valid', async () => {
            const tx = await proxyContract.setAndAssertParams(stakingConstants.DEFAULT_PARAMS);
            await tx.wait();
        });

        it('reverts if epoch duration is < 5 days', async () => {
            const tx = proxyContract
                .setAndAssertParams({
                    ...stakingConstants.DEFAULT_PARAMS,
                    epochDurationInSeconds: fiveDays - 1n,
                });
            const expectedError = new StakingRevertErrors.InvalidParamValueError(
                StakingRevertErrors.InvalidParamValueErrorCodes.InvalidEpochDuration,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('reverts if epoch duration is > 30 days', async () => {
            const tx = proxyContract
                .setAndAssertParams({
                    ...stakingConstants.DEFAULT_PARAMS,
                    epochDurationInSeconds: thirtyDays + 1n,
                });
            const expectedError = new StakingRevertErrors.InvalidParamValueError(
                StakingRevertErrors.InvalidParamValueErrorCodes.InvalidEpochDuration,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('succeeds if epoch duration is 5 days', async () => {
            const tx = await proxyContract
                .setAndAssertParams({
                    ...stakingConstants.DEFAULT_PARAMS,
                    epochDurationInSeconds: fiveDays,
                });
            await tx.wait();
        });
        it('succeeds if epoch duration is 30 days', async () => {
            const tx = await proxyContract
                .setAndAssertParams({
                    ...stakingConstants.DEFAULT_PARAMS,
                    epochDurationInSeconds: thirtyDays,
                });
            await tx.wait();
        });
        it('reverts if alpha denominator is 0', async () => {
            const tx = proxyContract
                .setAndAssertParams({
                    ...stakingConstants.DEFAULT_PARAMS,
                    cobbDouglasAlphaDenominator: constants.ZERO_AMOUNT,
                });
            const expectedError = new StakingRevertErrors.InvalidParamValueError(
                StakingRevertErrors.InvalidParamValueErrorCodes.InvalidCobbDouglasAlpha,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('reverts if alpha > 1', async () => {
            const tx = proxyContract
                .setAndAssertParams({
                    ...stakingConstants.DEFAULT_PARAMS,
                                    cobbDouglasAlphaNumerator: 101n,
                cobbDouglasAlphaDenominator: 100n,
                });
            const expectedError = new StakingRevertErrors.InvalidParamValueError(
                StakingRevertErrors.InvalidParamValueErrorCodes.InvalidCobbDouglasAlpha,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('succeeds if alpha == 1', async () => {
            const tx = await proxyContract
                .setAndAssertParams({
                    ...stakingConstants.DEFAULT_PARAMS,
                                    cobbDouglasAlphaNumerator: 1n,
                cobbDouglasAlphaDenominator: 1n,
                });
            await tx.wait();
        });
        it('succeeds if alpha == 0', async () => {
            const tx = await proxyContract
                .setAndAssertParams({
                    ...stakingConstants.DEFAULT_PARAMS,
                    cobbDouglasAlphaNumerator: constants.ZERO_AMOUNT,
                    cobbDouglasAlphaDenominator: 1n,
                });
            await tx.wait();
        });
        it('reverts if delegation weight is > 100%', async () => {
            const tx = proxyContract
                .setAndAssertParams({
                    ...stakingConstants.DEFAULT_PARAMS,
                    rewardDelegatedStakeWeight: BigInt(stakingConstants.PPM) + 1n,
                });
            const expectedError = new StakingRevertErrors.InvalidParamValueError(
                StakingRevertErrors.InvalidParamValueErrorCodes.InvalidRewardDelegatedStakeWeight,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('succeeds if delegation weight is 100%', async () => {
            const tx = await proxyContract
                .setAndAssertParams({
                    ...stakingConstants.DEFAULT_PARAMS,
                    rewardDelegatedStakeWeight: BigInt(stakingConstants.PPM),
                });
            await tx.wait();
        });
    });
});
// tslint:enable:no-unnecessary-type-assertion
