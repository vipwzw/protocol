import {
    blockchainTests,
    constants,
    expect,
    getRandomInteger,
    getRandomPortion,
    Numberish,
    randomAddress,
    verifyEventsFromLogs,
} from '@0x/test-utils';
import { ETH_TOKEN_ADDRESS } from '@0x/protocol-utils';
import { AbiEncoder, hexUtils, OwnableRevertErrors, ZeroExRevertErrors } from '@0x/utils';
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
    TransformERC20FeatureEvents,
} from '../wrappers';

blockchainTests('TransformERC20 feature', env => {
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
        feature = new TransformERC20FeatureContract(
            await zeroEx.getAddress(),
            env.provider,
            { ...env.txDefaults, from: sender },
            abis,
        );
        wallet = new FlashWalletContract(await feature.getTransformWallet(), env.provider, env.txDefaults);
        const ownerSigner = await env.provider.getSigner(owner);
        await feature.connect(ownerSigner).setQuoteSigner(callDataSigner);
    });

    const { MAX_UINT256, ZERO_AMOUNT } = constants;

    describe('wallets', () => {
        it('createTransformWallet() replaces the current wallet', async () => {
            const newWalletAddress = await feature.createTransformWallet()({ from: owner });
            expect(newWalletAddress).to.not.eq(wallet.address);
            await feature.createTransformWallet()({ from: owner });
            return expect(feature.getTransformWallet()()).to.eventually.eq(newWalletAddress);
        });

        it('createTransformWallet() cannot be called by non-owner', async () => {
            const notOwner = randomAddress();
            const tx = feature.createTransformWallet()({ from: notOwner });
            return expect(tx).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(notOwner, owner));
        });
    });

    describe('transformer deployer', () => {
        it('`getTransformerDeployer()` returns the transformer deployer', async () => {
            const actualDeployer = await feature.getTransformerDeployer()();
            expect(actualDeployer).to.eq(transformerDeployer);
        });

        it('owner can set the transformer deployer with `setTransformerDeployer()`', async () => {
            const newDeployer = randomAddress();
            const receipt = await feature
                .setTransformerDeployer(newDeployer)
                ({ from: owner });
            verifyEventsFromLogs(
                receipt.logs,
                [{ transformerDeployer: newDeployer }],
                TransformERC20FeatureEvents.TransformerDeployerUpdated,
            );
            const actualDeployer = await feature.getTransformerDeployer()();
            expect(actualDeployer).to.eq(newDeployer);
        });

        it('non-owner cannot set the transformer deployer with `setTransformerDeployer()`', async () => {
            const newDeployer = randomAddress();
            const notOwner = randomAddress();
            const tx = feature.setTransformerDeployer(newDeployer)({ from: notOwner });
            return expect(tx).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(notOwner, owner));
        });
    });

    describe('quote signer', () => {
        it('`getQuoteSigner()` returns the quote signer', async () => {
            const actualSigner = await feature.getQuoteSigner()();
            expect(actualSigner).to.eq(callDataSigner);
        });

        it('owner can set the quote signer with `setQuoteSigner()`', async () => {
            const newSigner = randomAddress();
            const receipt = await feature.setQuoteSigner(newSigner)({ from: owner });
            verifyEventsFromLogs(
                receipt.logs,
                [{ quoteSigner: newSigner }],
                TransformERC20FeatureEvents.QuoteSignerUpdated,
            );
            const actualSigner = await feature.getQuoteSigner()();
            expect(actualSigner).to.eq(newSigner);
        });

        it('non-owner cannot set the quote signer with `setQuoteSigner()`', async () => {
            const newSigner = randomAddress();
            const notOwner = randomAddress();
            const tx = feature.setQuoteSigner(newSigner)({ from: notOwner });
            return expect(tx).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(notOwner, owner));
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

            transformerNonce = await env.web3Wrapper.getAccountNonceAsync(transformerDeployer);
            
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

        const transformDataEncoder = AbiEncoder.create([
            {
                name: 'data',
                type: 'tuple',
                components: [
                    { name: 'inputToken', type: 'address' },
                    { name: 'outputToken', type: 'address' },
                    { name: 'burnAmount', type: 'uint256' },
                    { name: 'mintAmount', type: 'uint256' },
                    { name: 'feeAmount', type: 'uint256' },
                ],
            },
        ]);

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
                data: transformDataEncoder.encode([
                    {
                        inputToken: _opts.inputTokenAddress,
                        outputToken: _opts.outputTokenAddress,
                        burnAmount: _opts.inputTokenBurnAmunt,
                        mintAmount: _opts.outputTokenMintAmount,
                        feeAmount: _opts.outputTokenFeeAmount,
                    },
                ]),
            };
        }

        describe('_transformERC20()', () => {
            it("succeeds if taker's output token balance increases by exactly minOutputTokenAmount", async () => {
                const startingOutputTokenBalance = getRandomInteger(0, '100e18');
                const startingInputTokenBalance = getRandomInteger(0, '100e18');
                await outputToken.mint(taker, startingOutputTokenBalance)();
                await inputToken.mint(taker, startingInputTokenBalance)();
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = getRandomInteger(1, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount;
                const callValue = getRandomInteger(1, '1e18');
                const transformation = await createMintTokenTransformation({
                    outputTokenMintAmount,
                    inputTokenBurnAmunt: inputTokenAmount,
                });
                const receipt = await feature
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount,
                        minOutputTokenAmount,
                        transformations: [transformation],
                        useSelfBalance: false,
                        recipient: taker,
                    })
                    ({ value: callValue });
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
                    TransformERC20FeatureEvents.TransformedERC20,
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
                await inputToken.mint(taker, startingInputTokenBalance)();
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = getRandomInteger(1, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount;
                const callValue = outputTokenMintAmount;
                const transformation = await createMintTokenTransformation({
                    outputTokenMintAmount,
                    inputTokenBurnAmunt: inputTokenAmount,
                    outputTokenAddress: ETH_TOKEN_ADDRESS,
                });
                const startingOutputTokenBalance = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                const receipt = await feature
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: ETH_TOKEN_ADDRESS,
                        inputTokenAmount,
                        minOutputTokenAmount,
                        transformations: [transformation],
                        useSelfBalance: false,
                        recipient: taker,
                    })
                    ({ value: callValue });
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
                    TransformERC20FeatureEvents.TransformedERC20,
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
                expect(await env.web3Wrapper.getBalanceInWeiAsync(taker)).to.eq(
                    startingOutputTokenBalance + outputTokenMintAmount,
                );
            });

            it("succeeds if taker's output token balance increases by more than minOutputTokenAmount", async () => {
                const startingOutputTokenBalance = getRandomInteger(0, '100e18');
                const startingInputTokenBalance = getRandomInteger(0, '100e18');
                await outputToken.mint(taker, startingOutputTokenBalance)();
                await inputToken.mint(taker, startingInputTokenBalance)();
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = getRandomInteger(1, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount + 1;
                const callValue = getRandomInteger(1, '1e18');
                const transformation = await createMintTokenTransformation({
                    outputTokenMintAmount,
                    inputTokenBurnAmunt: inputTokenAmount,
                });
                const receipt = await feature
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount,
                        minOutputTokenAmount,
                        transformations: [transformation],
                        useSelfBalance: false,
                        recipient: taker,
                    })
                    ({ value: callValue });
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
                    TransformERC20FeatureEvents.TransformedERC20,
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
                await outputToken.mint(taker, startingOutputTokenBalance)();
                await inputToken.mint(taker, startingInputTokenBalance)();
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = getRandomInteger(1, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount - 1;
                const callValue = getRandomInteger(1, '1e18');
                const tx = feature
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
                    })
                    ({ value: callValue });
                const expectedError = new ZeroExRevertErrors.TransformERC20.IncompleteTransformERC20Error(
                    await outputToken.getAddress(),
                    outputTokenMintAmount,
                    minOutputTokenAmount,
                );
                return expect(tx).to.be.revertedWith(expectedError);
            });

            it("throws if taker's output token balance decreases", async () => {
                const startingOutputTokenBalance = getRandomInteger(0, '100e18');
                const startingInputTokenBalance = getRandomInteger(0, '100e18');
                await outputToken.mint(taker, startingOutputTokenBalance)();
                await inputToken.mint(taker, startingInputTokenBalance)();
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = ZERO_AMOUNT;
                const outputTokenFeeAmount = 1;
                const callValue = getRandomInteger(1, '1e18');
                const tx = feature
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
                    })
                    ({ value: callValue });
                const expectedError = new ZeroExRevertErrors.TransformERC20.NegativeTransformERC20OutputError(
                    await outputToken.getAddress(),
                    outputTokenFeeAmount,
                );
                return expect(tx).to.be.revertedWith(expectedError);
            });

            it('can call multiple transformers', async () => {
                const startingOutputTokenBalance = getRandomInteger(0, '100e18');
                const startingInputTokenBalance = getRandomInteger(2, '100e18');
                await outputToken.mint(taker, startingOutputTokenBalance)();
                await inputToken.mint(taker, startingInputTokenBalance)();
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
                        inputTokenBurnAmunt: inputTokenAmount - 1,
                        outputTokenMintAmount: outputTokenMintAmount - 1,
                    }),
                ];
                const receipt = await feature
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount,
                        minOutputTokenAmount,
                        transformations,
                        useSelfBalance: false,
                        recipient: taker,
                    })
                    ({ value: callValue });
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
                            inputTokenBalance: inputTokenAmount - 1,
                            ethBalance: callValue,
                        },
                    ],
                    TestMintTokenERC20TransformerEvents.MintTransform,
                );
            });

            it('fails with invalid transformer nonce', async () => {
                const startingOutputTokenBalance = getRandomInteger(0, '100e18');
                const startingInputTokenBalance = getRandomInteger(2, '100e18');
                await outputToken.mint(taker, startingOutputTokenBalance)();
                await inputToken.mint(taker, startingInputTokenBalance)();
                const inputTokenAmount = getRandomPortion(startingInputTokenBalance);
                const minOutputTokenAmount = getRandomInteger(2, '1e18');
                const callValue = getRandomInteger(1, '1e18');
                const transformations = [await createMintTokenTransformation({ deploymentNonce: 1337 })];
                const tx = feature
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount,
                        minOutputTokenAmount,
                        transformations,
                        useSelfBalance: false,
                        recipient: taker,
                    })
                    ({ value: callValue });
                return expect(tx).to.be.revertedWith(
                    new ZeroExRevertErrors.TransformERC20.TransformerFailedError(
                        undefined,
                        transformations[0].data,
                        constants.NULL_BYTES,
                    ),
                );
            });

            it('can sell entire taker balance', async () => {
                const startingInputTokenBalance = getRandomInteger(0, '100e18');
                await inputToken.mint(taker, startingInputTokenBalance)();
                const minOutputTokenAmount = getRandomInteger(1, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount;
                const callValue = getRandomInteger(1, '1e18');
                const transformation = await createMintTokenTransformation({
                    outputTokenMintAmount,
                    inputTokenBurnAmunt: startingInputTokenBalance,
                });
                const receipt = await feature
                    ._transformERC20({
                        taker,
                        inputToken: await inputToken.getAddress(),
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount: MAX_UINT256,
                        minOutputTokenAmount,
                        transformations: [transformation],
                        useSelfBalance: false,
                        recipient: taker,
                    })
                    ({ value: callValue });
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
                    TransformERC20FeatureEvents.TransformedERC20,
                );
            });

            it('can sell entire taker balance with ETH (but not really)', async () => {
                const ethAttchedAmount = getRandomInteger(0, '100e18');
                await inputToken.mint(taker, ethAttchedAmount)();
                const minOutputTokenAmount = getRandomInteger(1, '1e18');
                const outputTokenMintAmount = minOutputTokenAmount;
                const transformation = await createMintTokenTransformation({
                    outputTokenMintAmount,
                    inputTokenAddress: ETH_TOKEN_ADDRESS,
                    inputTokenBurnAmunt: ethAttchedAmount,
                });
                const receipt = await feature
                    ._transformERC20({
                        taker,
                        inputToken: ETH_TOKEN_ADDRESS,
                        outputToken: await outputToken.getAddress(),
                        inputTokenAmount: MAX_UINT256,
                        minOutputTokenAmount,
                        transformations: [transformation],
                        useSelfBalance: false,
                        recipient: taker,
                    })
                    ({ value: ethAttchedAmount });
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
                    TransformERC20FeatureEvents.TransformedERC20,
                );
            });
        });
    });
});
