import {
    constants,
    getRandomInteger,
    getRandomPortion,
    Numberish,
    randomAddress,
    verifyEventsFromLogs,
} from '@0x/utils';
import { expect } from 'chai';
import { ETH_TOKEN_ADDRESS } from '@0x/protocol-utils';
import { hexUtils, OwnableRevertErrors, ZeroExRevertErrors } from '@0x/utils';
import { ethers } from 'hardhat';
import * as ethjs from 'ethereumjs-util';

import { 
    IZeroExContract, 
    TransformERC20FeatureContract,
    TestTransformERC20__factory,
    TestMintableERC20Token__factory,
    TestMintTokenERC20Transformer__factory
} from '../../src/wrappers';
import { artifacts } from '../artifacts';
import { abis } from '../utils/abis';

import { fullMigrateAsync } from '../utils/migration';
import {
    FlashWalletContract,
    TestMintableERC20TokenContract,
    TestMintTokenERC20TransformerContract,
    TestMintTokenERC20TransformerEvents,
    TestTransformERC20Contract,
} from '../wrappers';

describe('TransformERC20 feature', () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
    } as any;
    const callDataSignerKey = hexUtils.random();
    const callDataSigner = ethjs.bufferToHex(ethjs.privateToAddress(ethjs.toBuffer(callDataSignerKey)));
    let owner: string;
    let taker: string;
    let sender: string;
    let transformerDeployer: string;
    let zeroEx: IZeroExContract;
    let feature: TransformERC20FeatureContract;
    let wallet: FlashWalletContract;

    before(async () => {
        [owner, taker, sender, transformerDeployer] = await env.getAccountAddressesAsync();
        env.txDefaults.from = owner;
        const signer = await env.provider.getSigner(owner);
        const testTransformFactory = new TestTransformERC20__factory(signer);
        const testTransformContract = await testTransformFactory.deploy();
        await testTransformContract.waitForDeployment();
        
        zeroEx = await fullMigrateAsync(
            owner,
            env.provider,
            env.txDefaults,
            {
                transformERC20: await testTransformContract.getAddress(),
            },
            { transformerDeployer },
        );
        // 🔧 使用ethers.getContractAt替代constructor
        feature = await ethers.getContractAt('ITransformERC20Feature', await zeroEx.getAddress()) as TransformERC20FeatureContract;
        // 🔧 使用ethers.getContractAt获取FlashWallet
        const flashWalletAddress = await feature.getTransformWallet();
        wallet = await ethers.getContractAt('IFlashWallet', flashWalletAddress) as FlashWalletContract;
        const ownerSigner = await env.provider.getSigner(owner);
        await feature.connect(ownerSigner).setQuoteSigner(callDataSigner);
    });

    const { MAX_UINT256, ZERO_AMOUNT } = constants;

    describe('wallets', () => {
        it('createTransformWallet() replaces the current wallet', async () => {
            // 🔧 修复API语法，保持测试意图：验证owner可以创建新wallet
            const ownerSigner = await env.provider.getSigner(owner);
            await feature.connect(ownerSigner).createTransformWallet();
            const newWalletAddress = await feature.getTransformWallet();
            expect(newWalletAddress).to.not.eq(await wallet.getAddress()); // 🔧 使用getAddress()
            await feature.connect(ownerSigner).createTransformWallet();
            const newerWalletAddress = await feature.getTransformWallet();
            return expect(newerWalletAddress).to.not.eq(newWalletAddress); // 验证钱包被替换了
        });

        it('createTransformWallet() cannot be called by non-owner', async () => {
            // 🔧 修复账户问题，保持测试意图：验证非owner无法创建wallet
            const [, , notOwner] = await env.getAccountAddressesAsync(); // 使用实际账户
            const notOwnerSigner = await env.provider.getSigner(notOwner);
            const tx = feature.connect(notOwnerSigner).createTransformWallet(); // 🔧 修复API语法
            
            // 🔧 修复错误验证，保持测试意图
            try {
                await tx;
                expect.fail('Transaction should have reverted');
            } catch (error: any) {
                // 验证OnlyOwnerError
                expect(error.message).to.include('0x1de45ad1'); // OnlyOwnerError选择器
            }
        });
    });

    describe('transformer deployer', () => {
        it('`getTransformerDeployer()` returns the transformer deployer', async () => {
            const actualDeployer = await feature.getTransformerDeployer(); // 🔧 修复API语法
            expect(actualDeployer).to.eq(transformerDeployer);
        });

        it('owner can set the transformer deployer with `setTransformerDeployer()`', async () => {
            const newDeployer = randomAddress();
            const ownerSigner = await env.provider.getSigner(owner);
            const tx = await feature
                .connect(ownerSigner)
                .setTransformerDeployer(newDeployer);
            const receipt = await tx.wait();
            verifyEventsFromLogs(
                receipt.logs,
                [{ transformerDeployer: newDeployer }],
                'TransformerDeployerUpdated',
            );
            const actualDeployer = await feature.getTransformerDeployer(); // 🔧 修复API语法
            expect(actualDeployer).to.eq(newDeployer);
        });

        it('non-owner cannot set the transformer deployer with `setTransformerDeployer()`', async () => {
            const newDeployer = randomAddress();
            const notOwner = randomAddress();
            const notOwnerSigner = await env.provider.getSigner(notOwner);
            const tx = feature.connect(notOwnerSigner).setTransformerDeployer(newDeployer);
            const expectedError = new OwnableRevertErrors.OnlyOwnerError(notOwner, owner);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });
    });

    describe('quote signer', () => {
        it('`getQuoteSigner()` returns the quote signer', async () => {
            const actualSigner = await feature.getQuoteSigner(); // 🔧 修复API语法
            expect(actualSigner.toLowerCase()).to.eq(callDataSigner.toLowerCase());
        });

        it('owner can set the quote signer with `setQuoteSigner()`', async () => {
            const newSigner = randomAddress();
            const ownerSigner = await env.provider.getSigner(owner);
            const tx = await feature.connect(ownerSigner).setQuoteSigner(newSigner);
            const receipt = await tx.wait();
            verifyEventsFromLogs(
                receipt.logs,
                [{ quoteSigner: newSigner }],
                'QuoteSignerUpdated',
            );
            const actualSigner = await feature.getQuoteSigner(); // 🔧 修复API语法
            expect(actualSigner).to.eq(newSigner);
        });

        it('non-owner cannot set the quote signer with `setQuoteSigner()`', async () => {
            const newSigner = randomAddress();
            const notOwner = randomAddress();
            const notOwnerSigner = await env.provider.getSigner(notOwner);
            const tx = feature.connect(notOwnerSigner).setQuoteSigner(newSigner);
            const expectedError = new OwnableRevertErrors.OnlyOwnerError(notOwner, owner);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });
    });

    describe('_transformERC20()/transformERC20()', () => {
        let inputToken: TestMintableERC20TokenContract;
        let outputToken: TestMintableERC20TokenContract;
        let mintTransformer: TestMintTokenERC20TransformerContract;
        let transformerNonce: number;

        before(async () => {
            const signer = await env.provider.getSigner(owner);
            
            const inputTokenFactory = new TestMintableERC20Token__factory(signer);
            inputToken = await inputTokenFactory.deploy();
            await inputToken.waitForDeployment();

            const outputTokenFactory = new TestMintableERC20Token__factory(signer);
            outputToken = await outputTokenFactory.deploy();
            await outputToken.waitForDeployment();

            transformerNonce = await ethers.provider.getTransactionCount(transformerDeployer);
            
            const transformerDeployerSigner = await env.provider.getSigner(transformerDeployer);
            const mintTransformerFactory = new TestMintTokenERC20Transformer__factory(transformerDeployerSigner);
            mintTransformer = await mintTransformerFactory.deploy();
            await mintTransformer.waitForDeployment();

            const takerSigner = await env.provider.getSigner(taker);
            await inputToken.connect(takerSigner).approve(await zeroEx.getAddress(), MAX_UINT256);
        });

        interface Transformation {
            deploymentNonce: number;
            data: string;
        }

        // 使用 ethers v6 的 AbiCoder 替代 AbiEncoder
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const transformDataType = ['tuple(address inputToken, address outputToken, uint256 burnAmount, uint256 mintAmount, uint256 feeAmount)'];

        async function createMintTokenTransformation(
            opts: Partial<{
                transformer: string;
                outputTokenAddress: string;
                inputTokenAddress: string;
                inputTokenBurnAmunt: Numberish;
                outputTokenMintAmount: Numberish;
                outputTokenFeeAmount: Numberish;
                deploymentNonce: number;
            }> = {},
        ): Promise<Transformation> {
            const _opts = {
                outputTokenAddress: await outputToken.getAddress(),
                inputTokenAddress: await inputToken.getAddress(),
                inputTokenBurnAmunt: ZERO_AMOUNT,
                outputTokenMintAmount: ZERO_AMOUNT,
                outputTokenFeeAmount: ZERO_AMOUNT,
                transformer: await mintTransformer.getAddress(),
                deploymentNonce: transformerNonce,
                ...opts,
            };
            return {
                deploymentNonce: _opts.deploymentNonce,
                data: abiCoder.encode(transformDataType, [{
                    inputToken: _opts.inputTokenAddress,
                    outputToken: _opts.outputTokenAddress,
                    burnAmount: _opts.inputTokenBurnAmunt,
                    mintAmount: _opts.outputTokenMintAmount,
                    feeAmount: _opts.outputTokenFeeAmount,
                }]),
            };
        }

        describe('_transformERC20()', () => {
            it("succeeds if taker's output token balance increases by exactly minOutputTokenAmount", async () => {
                const startingOutputTokenBalance = getRandomInteger(0, '100e18');
                const startingInputTokenBalance = getRandomInteger(0, '100e18');
                await outputToken.mint(taker, startingOutputTokenBalance);
                await inputToken.mint(taker, startingInputTokenBalance);
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = getRandomInteger(1, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount;
                const callValue = getRandomInteger(1, '1e18');
                const transformation = await createMintTokenTransformation({
                    outputTokenMintAmount,
                    inputTokenBurnAmunt: inputTokenAmount,
                });
                const transformERC20Feature = await ethers.getContractAt('ITransformERC20Feature', await zeroEx.getAddress());
                const takerSigner = await env.provider.getSigner(taker);
                const tx = await transformERC20Feature
                    .connect(takerSigner)
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount,
                        minOutputTokenAmount,
                        transformations: [transformation],
                        useSelfBalance: false,
                        recipient: taker,
                    }, { value: callValue });
                const receipt = await tx.wait();
                verifyEventsFromLogs(
                    receipt.logs,
                    [
                        {
                            taker,
                            inputTokenAmount,
                            outputTokenAmount: outputTokenMintAmount,
                            inputToken: await inputToken.getAddress(),
                            outputToken: await outputToken.getAddress(),
                        },
                    ],
                    'TransformedERC20',
                );
                verifyEventsFromLogs(
                    receipt.logs,
                    [
                        {
                            sender,
                            taker,
                            context: wallet.address,
                            caller: zeroEx.address,
                            data: transformation.data,
                            inputTokenBalance: inputTokenAmount,
                            ethBalance: callValue,
                        },
                    ],
                    TestMintTokenERC20TransformerEvents.MintTransform,
                );
            });

            it("succeeds if taker's output token balance increases by exactly minOutputTokenAmount, with ETH", async () => {
                const startingInputTokenBalance = getRandomInteger(0, '100e18');
                await inputToken.mint(taker, startingInputTokenBalance);
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = getRandomInteger(1, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount;
                const callValue = outputTokenMintAmount;
                const transformation = await createMintTokenTransformation({
                    outputTokenMintAmount,
                    inputTokenBurnAmunt: inputTokenAmount,
                    outputTokenAddress: ETH_TOKEN_ADDRESS,
                });
                const startingOutputTokenBalance = await ethers.provider.getBalance(taker);
                const transformERC20Feature = await ethers.getContractAt('ITransformERC20Feature', await zeroEx.getAddress());
                const takerSigner = await env.provider.getSigner(taker);
                const tx = await transformERC20Feature
                    .connect(takerSigner)
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: ETH_TOKEN_ADDRESS,
                        inputTokenAmount,
                        minOutputTokenAmount,
                        transformations: [transformation],
                        useSelfBalance: false,
                        recipient: taker,
                    }, { value: callValue });
                const receipt = await tx.wait();
                verifyEventsFromLogs(
                    receipt.logs,
                    [
                        {
                            taker,
                            inputTokenAmount,
                            outputTokenAmount: outputTokenMintAmount,
                            inputToken: await inputToken.getAddress(),
                            outputToken: ETH_TOKEN_ADDRESS,
                        },
                    ],
                    'TransformedERC20',
                );
                verifyEventsFromLogs(
                    receipt.logs,
                    [
                        {
                            taker,
                            sender,
                            context: wallet.address,
                            caller: zeroEx.address,
                            data: transformation.data,
                            inputTokenBalance: inputTokenAmount,
                            ethBalance: callValue,
                        },
                    ],
                    TestMintTokenERC20TransformerEvents.MintTransform,
                );
                // 🎯 使用closeTo进行精确的ETH余额检查
                expect(await ethers.provider.getBalance(taker)).to.be.closeTo(
                    startingOutputTokenBalance + outputTokenMintAmount,
                    ethers.parseEther('0.001') // 允许gas费用差异
                );
            });

            it("succeeds if taker's output token balance increases by more than minOutputTokenAmount", async () => {
                const startingOutputTokenBalance = getRandomInteger(0, '100e18');
                const startingInputTokenBalance = getRandomInteger(0, '100e18');
                await outputToken.mint(taker, startingOutputTokenBalance);
                await inputToken.mint(taker, startingInputTokenBalance);
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = getRandomInteger(1, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount + 1n;
                const callValue = getRandomInteger(1, '1e18');
                const transformation = await createMintTokenTransformation({
                    outputTokenMintAmount,
                    inputTokenBurnAmunt: inputTokenAmount,
                });
                const transformERC20Feature = await ethers.getContractAt('ITransformERC20Feature', await zeroEx.getAddress());
                const takerSigner = await env.provider.getSigner(taker);
                const tx = await transformERC20Feature
                    .connect(takerSigner)
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount,
                        minOutputTokenAmount,
                        transformations: [transformation],
                        useSelfBalance: false,
                        recipient: taker,
                    }, { value: callValue });
                const receipt = await tx.wait();
                verifyEventsFromLogs(
                    receipt.logs,
                    [
                        {
                            taker,
                            inputTokenAmount,
                            outputTokenAmount: outputTokenMintAmount,
                            inputToken: await inputToken.getAddress(),
                            outputToken: await outputToken.getAddress(),
                        },
                    ],
                    'TransformedERC20',
                );
                verifyEventsFromLogs(
                    receipt.logs,
                    [
                        {
                            sender,
                            taker,
                            context: wallet.address,
                            caller: zeroEx.address,
                            data: transformation.data,
                            inputTokenBalance: inputTokenAmount,
                            ethBalance: callValue,
                        },
                    ],
                    TestMintTokenERC20TransformerEvents.MintTransform,
                );
            });

            it("throws if taker's output token balance increases by less than minOutputTokenAmount", async () => {
                const startingOutputTokenBalance = getRandomInteger(0, '100e18');
                const startingInputTokenBalance = getRandomInteger(0, '100e18');
                await outputToken.mint(taker, startingOutputTokenBalance);
                await inputToken.mint(taker, startingInputTokenBalance);
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = getRandomInteger(1, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount - 1n;
                const callValue = getRandomInteger(1, '1e18');
                const transformERC20Feature = await ethers.getContractAt('ITransformERC20Feature', await zeroEx.getAddress());
                const takerSigner = await env.provider.getSigner(taker);
                const tx = transformERC20Feature
                    .connect(takerSigner)
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount,
                        minOutputTokenAmount,
                        transformations: [
                            await createMintTokenTransformation({
                                outputTokenMintAmount,
                                inputTokenBurnAmunt: inputTokenAmount,
                            }),
                        ],
                        useSelfBalance: false,
                        recipient: taker,
                    }, { value: callValue });
                const expectedError = new ZeroExRevertErrors.TransformERC20.IncompleteTransformERC20Error(
                    await outputToken.getAddress(),
                    outputTokenMintAmount,
                    minOutputTokenAmount,
                );
                return expect(tx).to.be.revertedWith(expectedError.encode());
            });

            it("throws if taker's output token balance decreases", async () => {
                const startingOutputTokenBalance = getRandomInteger(0, '100e18');
                const startingInputTokenBalance = getRandomInteger(0, '100e18');
                await outputToken.mint(taker, startingOutputTokenBalance);
                await inputToken.mint(taker, startingInputTokenBalance);
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = ZERO_AMOUNT;
                const outputTokenFeeAmount = 1;
                const callValue = getRandomInteger(1, '1e18');
                const transformERC20Feature = await ethers.getContractAt('ITransformERC20Feature', await zeroEx.getAddress());
                const takerSigner = await env.provider.getSigner(taker);
                const tx = transformERC20Feature
                    .connect(takerSigner)
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount,
                        minOutputTokenAmount,
                        transformations: [
                            await createMintTokenTransformation({
                                outputTokenFeeAmount,
                                inputTokenBurnAmunt: inputTokenAmount,
                            }),
                        ],
                        useSelfBalance: false,
                        recipient: taker,
                    }, { value: callValue });
                const expectedError = new ZeroExRevertErrors.TransformERC20.NegativeTransformERC20OutputError(
                    await outputToken.getAddress(),
                    outputTokenFeeAmount,
                );
                return expect(tx).to.be.revertedWith(expectedError.encode());
            });

            it('can call multiple transformers', async () => {
                const startingOutputTokenBalance = getRandomInteger(0, '100e18');
                const startingInputTokenBalance = getRandomInteger(2, '100e18');
                await outputToken.mint(taker, startingOutputTokenBalance);
                await inputToken.mint(taker, startingInputTokenBalance);
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = getRandomInteger(2, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount;
                const callValue = getRandomInteger(1, '1e18');
                // Split the total minting between two transformers.
                const transformations = [
                    await createMintTokenTransformation({
                        inputTokenBurnAmunt: 1,
                        outputTokenMintAmount: 1,
                    }),
                    await createMintTokenTransformation({
                        inputTokenBurnAmunt: inputTokenAmount - 1n,
                        outputTokenMintAmount: outputTokenMintAmount - 1n,
                    }),
                ];
                const transformERC20Feature = await ethers.getContractAt('ITransformERC20Feature', await zeroEx.getAddress());
                const takerSigner = await env.provider.getSigner(taker);
                const tx = await transformERC20Feature
                    .connect(takerSigner)
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount,
                        minOutputTokenAmount,
                        transformations,
                        useSelfBalance: false,
                        recipient: taker,
                    }, { value: callValue });
                const receipt = await tx.wait();
                verifyEventsFromLogs(
                    receipt.logs,
                    [
                        {
                            sender,
                            taker,
                            context: wallet.address,
                            caller: zeroEx.address,
                            data: transformations[0].data,
                            inputTokenBalance: inputTokenAmount,
                            ethBalance: callValue,
                        },
                        {
                            sender,
                            taker,
                            context: wallet.address,
                            caller: zeroEx.address,
                            data: transformations[1].data,
                            inputTokenBalance: inputTokenAmount - 1n,
                            ethBalance: callValue,
                        },
                    ],
                    TestMintTokenERC20TransformerEvents.MintTransform,
                );
            });

            it('fails with invalid transformer nonce', async () => {
                const startingOutputTokenBalance = getRandomInteger(0, '100e18');
                const startingInputTokenBalance = getRandomInteger(2, '100e18');
                await outputToken.mint(taker, startingOutputTokenBalance);
                await inputToken.mint(taker, startingInputTokenBalance);
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = getRandomInteger(2, '1e18');
                const callValue = getRandomInteger(1, '1e18');
                const transformations = [await createMintTokenTransformation({ deploymentNonce: 1337 })];
                const transformERC20Feature = await ethers.getContractAt('ITransformERC20Feature', await zeroEx.getAddress());
                const takerSigner = await env.provider.getSigner(taker);
                const tx = transformERC20Feature
                    .connect(takerSigner)
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount,
                        minOutputTokenAmount,
                        transformations,
                        useSelfBalance: false,
                        recipient: taker,
                    }, { value: callValue });
                const expectedError = new ZeroExRevertErrors.TransformERC20.TransformerFailedError(
                    undefined,
                    transformations[0].data,
                    constants.NULL_BYTES,
                );
                return expect(tx).to.be.revertedWith(expectedError.encode());
            });

            it('can sell entire taker balance', async () => {
                const startingInputTokenBalance = getRandomInteger(0, '100e18');
                await inputToken.mint(taker, startingInputTokenBalance);
                const minOutputTokenAmount = getRandomInteger(1, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount;
                const callValue = getRandomInteger(1, '1e18');
                const transformation = await createMintTokenTransformation({
                    outputTokenMintAmount,
                    inputTokenBurnAmunt: startingInputTokenBalance,
                });
                const transformERC20Feature = await ethers.getContractAt('ITransformERC20Feature', await zeroEx.getAddress());
                const takerSigner = await env.provider.getSigner(taker);
                const tx = await transformERC20Feature
                    .connect(takerSigner)
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount: MAX_UINT256,
                        minOutputTokenAmount,
                        transformations: [transformation],
                        useSelfBalance: false,
                        recipient: taker,
                    }, { value: callValue });
                const receipt = await tx.wait();
                verifyEventsFromLogs(
                    receipt.logs,
                    [
                        {
                            taker,
                            inputTokenAmount: startingInputTokenBalance,
                            outputTokenAmount: outputTokenMintAmount,
                            inputToken: await inputToken.getAddress(),
                            outputToken: await outputToken.getAddress(),
                        },
                    ],
                    'TransformedERC20',
                );
            });

            it('can sell entire taker balance with ETH (but not really)', async () => {
                const ethAttchedAmount = getRandomInteger(0, '100e18');
                await inputToken.mint(taker, ethAttchedAmount);
                const minOutputTokenAmount = getRandomInteger(1, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount;
                const transformation = await createMintTokenTransformation({
                    outputTokenMintAmount,
                    inputTokenAddress: ETH_TOKEN_ADDRESS,
                    inputTokenBurnAmunt: ethAttchedAmount,
                });
                const transformERC20Feature = await ethers.getContractAt('ITransformERC20Feature', await zeroEx.getAddress());
                const takerSigner = await env.provider.getSigner(taker);
                const tx = await transformERC20Feature
                    .connect(takerSigner)
                    ._transformERC20({
                        taker,
                        inputToken: ETH_TOKEN_ADDRESS,
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount: MAX_UINT256,
                        minOutputTokenAmount,
                        transformations: [transformation],
                        useSelfBalance: false,
                        recipient: taker,
                    }, { value: ethAttchedAmount });
                const receipt = await tx.wait();
                verifyEventsFromLogs(
                    receipt.logs,
                    [
                        {
                            taker,
                            inputTokenAmount: ethAttchedAmount,
                            outputTokenAmount: outputTokenMintAmount,
                            inputToken: ETH_TOKEN_ADDRESS,
                            outputToken: await outputToken.getAddress(),
                        },
                    ],
                    'TransformedERC20',
                );
            });
        });
    });
});
