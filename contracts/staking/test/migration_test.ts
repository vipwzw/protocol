import chai, { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { constants, filterLogsToArguments } from './test_constants';
// 移除对 @0x/utils 的依赖，使用简化的错误处理
// import { revertErrorHelper } from '@0x/utils';
// import { AuthorizableRevertErrors, StakingRevertErrors, StringRevertError } from '@0x/utils';

// 简单的 StringRevertError 替代
class StringRevertError {
    constructor(public message: string) {}
}

// AuthorizableRevertErrors - 参考 zero-ex 的错误处理模式
class AuthorizableRevertErrors {
    static SenderNotAuthorizedError = class {
        constructor(public sender: string) {}
        
        // 编码为 LibRichErrors 格式的错误数据
        encode(): string {
            // bytes4(keccak256("SenderNotAuthorizedError(address)")) = 0xb65a25b9
            const selector = '0xb65a25b9';
            const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [this.sender]);
            return selector + encodedParams.slice(2); // 移除 encodedParams 的 0x 前缀
        }
        
        toString() {
            return `SenderNotAuthorizedError: ${this.sender}`;
        }
    };
}

// 统一错误匹配器 - 参考 zero-ex 的 UnifiedErrorMatcher
class StakingErrorMatcher {
    static async expectError(txPromise: Promise<any>, expectedError: any): Promise<void> {
        try {
            await txPromise;
            throw new Error("交易应该失败但没有失败");
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

// 注册自定义 revert 比较助手（支持 RevertError 实例）
// chai.use(revertErrorHelper);

// 使用 @0x/utils 提供的 RevertError 类型与错误类

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
    let snapshotId: string;
    beforeEach(async () => {
        snapshotId = await network.provider.send('evm_snapshot');
    });
    afterEach(async () => {
        await network.provider.send('evm_revert', [snapshotId]);
    });
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
                artifacts.TestInitTarget.abi || artifacts.TestInitTarget.compilerOutput?.abi,
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
                return expect(tx).to.be.revertedWith('FORCED_INIT_REVERT');
            });

            it('reverts if assertValidStorageParams() fails', async () => {
                const tx = deployStakingProxyAsync(revertAddress);
                return expect(tx).to.be.revertedWith('FORCED_STORAGE_PARAMS_REVERT');
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
                artifacts.TestStaking.abi || artifacts.TestStaking.compilerOutput?.abi,
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
            return expect(tx).to.be.reverted;
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
                    expect(args.newStakingContractAddress).to.eq(await initTargetContract.getAddress());
                }
                await assertInitStateAsync(proxyContract);
            });

            it('reverts if init() reverts', async () => {
                await enableInitRevertsAsync();
                const tx = proxyContract.attachStakingContract(await initTargetContract.getAddress());
                return expect(tx).to.be.revertedWith('FORCED_INIT_REVERT');
            });

            it('reverts if assertValidStorageParams() fails', async () => {
                const tx = proxyContract.attachStakingContract(revertAddress);
                return expect(tx).to.be.revertedWith('FORCED_STORAGE_PARAMS_REVERT');
            });
        });

        describe('upgrades', () => {
            it('modifies prior state', async () => {
                const proxyContract = await deployStakingProxyAsync(await initTargetContract.getAddress());
                const tx = await proxyContract.attachStakingContract(await initTargetContract.getAddress());
                await tx.wait();
                const [deployer] = await ethers.getSigners();
                const proxyAsInitTarget = new ethers.Contract(
                    await proxyContract.getAddress(),
                    artifacts.TestInitTarget.abi || artifacts.TestInitTarget.compilerOutput?.abi,
                    deployer,
                );
                const initCounter = await proxyAsInitTarget.getInitCounter();
                expect(Number(initCounter)).to.equal(2);
            });
        });
    });

    describe('Staking.init()', () => {
        it('throws if not called by an authorized address', async () => {
            const tx = stakingContract.connect(await ethers.getSigner(notAuthorizedAddress)).init();
            // ✅ 基于业务逻辑构造具体的授权错误 - 参考 zero-ex 的错误处理模式
            // 测试意图：验证只有授权地址才能调用 init() 函数
            // 非授权地址调用应该抛出 SenderNotAuthorizedError，包含调用者地址
            const expectedError = new AuthorizableRevertErrors.SenderNotAuthorizedError(notAuthorizedAddress);
            return StakingErrorMatcher.expectError(tx, expectedError);
        });

        it('throws if already intitialized', async () => {
            const tx1 = await stakingContract.init();
            await tx1.wait();
            const tx = stakingContract.init();
            return expect(tx).to.be.reverted;
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
            return expect(tx).to.be.reverted;
        });
        it('reverts if epoch duration is > 30 days', async () => {
            const tx = proxyContract
                .setAndAssertParams({
                    ...stakingConstants.DEFAULT_PARAMS,
                    epochDurationInSeconds: thirtyDays + 1n,
                });
            return expect(tx).to.be.reverted;
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
            return expect(tx).to.be.reverted;
        });
        it('reverts if alpha > 1', async () => {
            const tx = proxyContract
                .setAndAssertParams({
                    ...stakingConstants.DEFAULT_PARAMS,
                                    cobbDouglasAlphaNumerator: 101n,
                cobbDouglasAlphaDenominator: 100n,
                });
            return expect(tx).to.be.reverted;
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
            return expect(tx).to.be.reverted;
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
