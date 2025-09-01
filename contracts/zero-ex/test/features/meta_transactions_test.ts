import { ethers } from "hardhat";
import { constants, getRandomInteger, randomAddress, verifyEventsFromLogs } from '@0x/utils';
import { expect } from 'chai';
import { MetaTransaction, MetaTransactionFields } from '@0x/protocol-utils';
import { hexUtils, StringRevertError, ZeroExRevertErrors } from '@0x/utils';
import * as _ from 'lodash';

import { IZeroExContract, MetaTransactionsFeatureContract } from '../wrappers';
import { 
    TestMetaTransactionsTransformERC20Feature__factory,
    TestMetaTransactionsNativeOrdersFeature__factory,
} from '../../src/typechain-types/factories/contracts/test';
import { TestMintableERC20Token__factory } from '../../src/typechain-types/factories/contracts/test/tokens';
import { artifacts } from '../artifacts';
import { abis } from '../utils/abis';
import { fullMigrateAsync } from '../utils/migration';
import { getRandomLimitOrder, getRandomRfqOrder } from '../utils/orders';
import {
    TestMetaTransactionsNativeOrdersFeatureContract,
    TestMetaTransactionsNativeOrdersFeatureEvents,
    TestMetaTransactionsTransformERC20FeatureContract,
    TestMetaTransactionsTransformERC20FeatureEvents,
    TestMintableERC20TokenContract,
} from '../wrappers';

const { NULL_ADDRESS, ZERO_AMOUNT } = constants;

describe('MetaTransactions feature', () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
        web3Wrapper: {
            getBalanceInWeiAsync: async (addr: string, blockTag?: number) => ethers.provider.getBalance(addr, blockTag as any),
        },
    } as any;
    let owner: string;
    let maker: string;
    let sender: string;
    let notSigner: string;
    const signers: string[] = [];
    let zeroEx: IZeroExContract;
    let feature: MetaTransactionsFeatureContract;
    let feeToken: TestMintableERC20TokenContract;
    let transformERC20Feature: TestMetaTransactionsTransformERC20FeatureContract;
    let nativeOrdersFeature: TestMetaTransactionsNativeOrdersFeatureContract;

    const MAX_FEE_AMOUNT = ethers.parseEther('1');
    const TRANSFORM_ERC20_ONE_WEI_VALUE = 555n;
    const TRANSFORM_ERC20_FAILING_VALUE = 666n;
    const TRANSFORM_ERC20_REENTER_VALUE = 777n;
    const TRANSFORM_ERC20_BATCH_REENTER_VALUE = 888n;
    const REENTRANCY_FLAG_MTX = 0x1;

    before(async () => {
        const accounts = await env.getAccountAddressesAsync();
        env.txDefaults.from = accounts[0];
        let possibleSigners: string[];
        [owner, maker, sender, notSigner, ...possibleSigners] = await env.getAccountAddressesAsync();
        
        const signer = await env.provider.getSigner(owner);
        
        const transformERC20FeatureFactory = new TestMetaTransactionsTransformERC20Feature__factory(signer);
        transformERC20Feature = await transformERC20FeatureFactory.deploy();
        await transformERC20Feature.waitForDeployment();
        
        const nativeOrdersFeatureFactory = new TestMetaTransactionsNativeOrdersFeature__factory(signer);
        nativeOrdersFeature = await nativeOrdersFeatureFactory.deploy();
        await nativeOrdersFeature.waitForDeployment();
        
        zeroEx = await fullMigrateAsync(owner, env.provider, env.txDefaults, {
            transformERC20: await transformERC20Feature.getAddress(),
            nativeOrders: await nativeOrdersFeature.getAddress(),
        });
        // 🔧 使用ethers.getContractAt替代constructor
        feature = await ethers.getContractAt('IMetaTransactionsFeature', await zeroEx.getAddress()) as MetaTransactionsFeatureContract;
        
        const feeTokenFactory = new TestMintableERC20Token__factory(signer);
        feeToken = await feeTokenFactory.deploy();
        await feeToken.waitForDeployment();

        // some accounts returned can be unfunded
        for (const possibleSigner of possibleSigners) {
            const balance = await env.provider.getBalance(possibleSigner);
            if (balance > 0n) {
                signers.push(possibleSigner);
                // 🔧 使用正确的ethers v6语法
                const possibleSignerSigner = await env.provider.getSigner(possibleSigner);
                await feeToken.connect(possibleSignerSigner).approve(await zeroEx.getAddress(), MAX_FEE_AMOUNT);
                await feeToken.mint(possibleSigner, MAX_FEE_AMOUNT);
            }
        }
    });

    async function getRandomMetaTransaction(fields: Partial<MetaTransactionFields> = {}): Promise<MetaTransaction> {
        return new MetaTransaction({
            signer: _.sampleSize(signers)[0],
            sender,
            // TODO: dekz Ganache gasPrice opcode is returning 0, cannot influence it up to test this case
            minGasPrice: ZERO_AMOUNT,
            maxGasPrice: getRandomInteger('1e9', '100e9'),
            expirationTimeSeconds: BigInt(Math.floor(_.now() / 1000) + 360),
            salt: BigInt(hexUtils.random()),
            callData: hexUtils.random(4),
            value: getRandomInteger(1, '1e18'),
            feeToken: await feeToken.getAddress(),
            feeAmount: getRandomInteger(1, MAX_FEE_AMOUNT),
            chainId: (await ethers.provider.getNetwork()).chainId,
            verifyingContract: await zeroEx.getAddress(),
            ...fields,
        });
    }

    describe('getMetaTransactionHash()', () => {
        it('generates the correct hash', async () => {
            const mtx = await getRandomMetaTransaction();
            const expected = mtx.getHash();
            // 🔧 修复API语法，保持测试意图：验证hash计算的正确性
            const actual = await feature.getMetaTransactionHash(mtx);
            expect(actual).to.eq(expected);
        });
    });

    interface TransformERC20Args {
        inputToken: string;
        outputToken: string;
        inputTokenAmount: bigint;
        minOutputTokenAmount: bigint;
        transformations: Array<{ deploymentNonce: bigint; data: string }>;
    }

    function getRandomTransformERC20Args(fields: Partial<TransformERC20Args> = {}): TransformERC20Args {
        return {
            inputToken: randomAddress(),
            outputToken: randomAddress(),
            inputTokenAmount: getRandomInteger(1, '1e18'),
            minOutputTokenAmount: getRandomInteger(1, '1e18'),
            transformations: [{ deploymentNonce: 123n, data: hexUtils.random() }],
            ...fields,
        };
    }

    const RAW_TRANSFORM_SUCCESS_RESULT = hexUtils.leftPad(1337);
    const RAW_ORDER_SUCCESS_RESULT = hexUtils.leftPad(1337, 64);

    describe('executeMetaTransaction()', () => {
        it('can call NativeOrders.fillLimitOrder()', async () => {
            const order = getRandomLimitOrder({ maker });
            const fillAmount = 23456n;
            const sig = await order.getSignatureWithProviderAsync(env.provider);
            const mtx = await getRandomMetaTransaction({
                callData: nativeOrdersFeature.fillLimitOrder(order, sig, fillAmount).getABIEncodedTransactionData(),
            });
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: mtx.value,
            };

            const rawResult = await feature.executeMetaTransaction(mtx, signature)(callOpts);
            expect(rawResult).to.eq(RAW_ORDER_SUCCESS_RESULT);
            const receipt = await feature.executeMetaTransaction(mtx, signature)(callOpts);

            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        order: _.omit(order, ['verifyingContract', 'chainId']),
                        sender: mtx.sender,
                        taker: mtx.signer,
                        takerTokenFillAmount: fillAmount,
                        signatureType: sig.signatureType,
                        v: sig.v,
                        r: sig.r,
                        s: sig.s,
                    },
                ],
                TestMetaTransactionsNativeOrdersFeatureEvents.FillLimitOrderCalled,
            );
        });

        it('can call NativeOrders.fillRfqOrder()', async () => {
            const order = getRandomRfqOrder({ maker });
            const sig = await order.getSignatureWithProviderAsync(env.provider);
            const fillAmount = 23456n;
            const mtx = await getRandomMetaTransaction({
                callData: nativeOrdersFeature.fillRfqOrder(order, sig, fillAmount).getABIEncodedTransactionData(),
                value: ZERO_AMOUNT,
            });
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: 0,
            };
            const rawResult = await feature.executeMetaTransaction(mtx, signature)(callOpts);
            expect(rawResult).to.eq(RAW_ORDER_SUCCESS_RESULT);
            const receipt = await feature.executeMetaTransaction(mtx, signature)(callOpts);

            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        order: _.omit(order, ['verifyingContract', 'chainId']),
                        taker: mtx.signer,
                        takerTokenFillAmount: fillAmount,
                        signatureType: sig.signatureType,
                        v: sig.v,
                        r: sig.r,
                        s: sig.s,
                    },
                ],
                TestMetaTransactionsNativeOrdersFeatureEvents.FillRfqOrderCalled,
            );
        });

        it('can call `TransformERC20.transformERC20()`', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
            });
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: mtx.value,
            };
            const rawResult = await feature.executeMetaTransaction(mtx, signature)(callOpts);
            expect(rawResult).to.eq(RAW_TRANSFORM_SUCCESS_RESULT);
            const receipt = await feature.executeMetaTransaction(mtx, signature)(callOpts);
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        inputToken: args.inputToken,
                        outputToken: args.outputToken,
                        inputTokenAmount: args.inputTokenAmount,
                        minOutputTokenAmount: args.minOutputTokenAmount,
                        transformations: args.transformations,
                        sender: await zeroEx.getAddress(),
                        value: mtx.value,
                        taker: mtx.signer,
                    },
                ],
                TestMetaTransactionsTransformERC20FeatureEvents.TransformERC20Called,
            );
        });

        it('can call `TransformERC20.transformERC20()` with calldata', async () => {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature
                .transformERC20(
                    args.inputToken,
                    args.outputToken,
                    args.inputTokenAmount,
                    args.minOutputTokenAmount,
                    args.transformations,
                )
                .getABIEncodedTransactionData();
            const mtx = await getRandomMetaTransaction({ callData });
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: mtx.value,
            };
            const rawResult = await feature.executeMetaTransaction(mtx, signature)(callOpts);
            expect(rawResult).to.eq(RAW_TRANSFORM_SUCCESS_RESULT);
            const receipt = await feature.executeMetaTransaction(mtx, signature)(callOpts);
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        inputToken: args.inputToken,
                        outputToken: args.outputToken,
                        inputTokenAmount: args.inputTokenAmount,
                        minOutputTokenAmount: args.minOutputTokenAmount,
                        transformations: args.transformations,
                        sender: await zeroEx.getAddress(),
                        value: mtx.value,
                        taker: mtx.signer,
                    },
                ],
                TestMetaTransactionsTransformERC20FeatureEvents.TransformERC20Called,
            );
        });

        it('can call with any sender if `sender == 0`', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                sender: NULL_ADDRESS,
                value: ZERO_AMOUNT, // 设置为 0 避免余额不足问题
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
            });
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: mtx.value,
                from: randomAddress(),
            };
            const rawResult = await feature.executeMetaTransaction(mtx, signature)(callOpts);
            expect(rawResult).to.eq(RAW_TRANSFORM_SUCCESS_RESULT);
        });

        it('works without fee', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                feeAmount: ZERO_AMOUNT,
                feeToken: randomAddress(),
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
            });
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: mtx.value,
            };
            const rawResult = await feature.executeMetaTransaction(mtx, signature)(callOpts);
            expect(rawResult).to.eq(RAW_TRANSFORM_SUCCESS_RESULT);
        });

        it('fails if the translated call fails', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                value: BigInt(TRANSFORM_ERC20_FAILING_VALUE),
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
            });
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: mtx.value,
            };
            const tx = feature.executeMetaTransaction(mtx, signature)(callOpts);
            const actualCallData = transformERC20Feature
                ._transformERC20({
                    taker: mtx.signer,
                    inputToken: args.inputToken,
                    outputToken: args.outputToken,
                    inputTokenAmount: args.inputTokenAmount,
                    minOutputTokenAmount: args.minOutputTokenAmount,
                    transformations: args.transformations,
                    useSelfBalance: false,
                    recipient: mtx.signer,
                })
                .getABIEncodedTransactionData();
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionCallFailedError(
                    mtxHash,
                    actualCallData,
                    new StringRevertError('FAIL').encode(),
                ),
            );
        });

        it('fails with unsupported function', async () => {
            const mtx = await getRandomMetaTransaction({
                callData: transformERC20Feature.createTransformWallet().getABIEncodedTransactionData(),
            });
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: mtx.value,
            };
            const tx = feature.executeMetaTransaction(mtx, signature)(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionUnsupportedFunctionError(
                    mtxHash,
                    hexUtils.slice(mtx.callData, 0, 4),
                ),
            );
        });

        it('cannot execute the same mtx twice', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
            });
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: mtx.value,
            };
            const receipt = await feature.executeMetaTransaction(mtx, signature)(callOpts);
            const tx = feature.executeMetaTransaction(mtx, signature)(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionAlreadyExecutedError(
                    mtxHash,
                    receipt.blockNumber,
                ),
            );
        });

        it('fails if not enough ETH provided', async () => {
            const mtx = await getRandomMetaTransaction();
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: mtx.value - 1n,
            };
            const tx = feature.executeMetaTransaction(mtx, signature)(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionInsufficientEthError(
                    mtxHash,
                    callOpts.value,
                    mtx.value,
                ),
            );
        });

        // Ganache gasPrice opcode is returning 0, cannot influence it up to test this case
        it.skip('fails if gas price too low', async () => {
            const mtx = await getRandomMetaTransaction();
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice - 1n,
                value: mtx.value,
            };
            const tx = feature.executeMetaTransaction(mtx, signature)(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionGasPriceError(
                    mtxHash,
                    callOpts.gasPrice,
                    mtx.minGasPrice,
                    mtx.maxGasPrice,
                ),
            );
        });

        // Ganache gasPrice opcode is returning 0, cannot influence it up to test this case
        it.skip('fails if gas price too high', async () => {
            const mtx = await getRandomMetaTransaction();
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.maxGasPrice + 1n,
                value: mtx.value,
            };
            const tx = feature.executeMetaTransaction(mtx, signature)(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionGasPriceError(
                    mtxHash,
                    callOpts.gasPrice,
                    mtx.minGasPrice,
                    mtx.maxGasPrice,
                ),
            );
        });

        it('fails if expired', async () => {
            const mtx = await getRandomMetaTransaction({
                expirationTimeSeconds: BigInt(Math.floor(_.now() / 1000 - 60)),
            });
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.maxGasPrice,
                value: mtx.value,
            };
            const tx = feature.executeMetaTransaction(mtx, signature)(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
                    mtxHash,
                    undefined,
                    mtx.expirationTimeSeconds,
                ),
            );
        });

        it('fails if wrong sender', async () => {
            const requiredSender = randomAddress();
            const mtx = await getRandomMetaTransaction({
                sender: requiredSender,
            });
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.maxGasPrice,
                value: mtx.value,
            };
            const tx = feature.executeMetaTransaction(mtx, signature)(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionWrongSenderError(
                    mtxHash,
                    sender,
                    requiredSender,
                ),
            );
        });

        it('fails if signature is wrong', async () => {
            const mtx = await getRandomMetaTransaction({ signer: signers[0] });
            const mtxHash = mtx.getHash();
            const signature = await mtx.clone({ signer: notSigner }).getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.maxGasPrice,
                value: mtx.value,
            };
            const tx = feature.executeMetaTransaction(mtx, signature)(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.SignatureValidator.SignatureValidationError(
                    ZeroExRevertErrors.SignatureValidator.SignatureValidationErrorCodes.WrongSigner,
                    mtxHash,
                    signers[0],
                    '0x',
                ),
            );
        });

        it('cannot reenter `executeMetaTransaction()`', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
                value: TRANSFORM_ERC20_REENTER_VALUE,
            });
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.maxGasPrice,
                value: mtx.value,
            };
            const tx = feature.executeMetaTransaction(mtx, signature)(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionCallFailedError(
                    mtxHash,
                    undefined,
                    new ZeroExRevertErrors.Common.IllegalReentrancyError(
                        feature.getSelector('executeMetaTransaction'),
                        REENTRANCY_FLAG_MTX,
                    ).encode(),
                ),
            );
        });

        it('cannot reenter `batchExecuteMetaTransactions()`', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
                value: TRANSFORM_ERC20_BATCH_REENTER_VALUE,
            });
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.maxGasPrice,
                value: mtx.value,
            };
            const tx = feature.executeMetaTransaction(mtx, signature)(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionCallFailedError(
                    mtxHash,
                    undefined,
                    new ZeroExRevertErrors.Common.IllegalReentrancyError(
                        feature.getSelector('batchExecuteMetaTransactions'),
                        REENTRANCY_FLAG_MTX,
                    ).encode(),
                ),
            );
        });

        it('cannot reduce initial ETH balance', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
                value: TRANSFORM_ERC20_ONE_WEI_VALUE,
            });
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.maxGasPrice,
                value: mtx.value,
            };
            // Send pre-existing ETH to the EP.
            const ownerSigner = await env.provider.getSigner(owner);
            await (await ownerSigner.sendTransaction({
                to: await zeroEx.getAddress(),
                value: 1n
            })).wait();
            const tx = feature.batchExecuteMetaTransactions([mtx], [signature])(callOpts);
            return expect(tx).to.be.revertedWith('MetaTransactionsFeature/ETH_LEAK');
        });
    });

    describe('batchExecuteMetaTransactions()', () => {
        it('can execute multiple transactions', async () => {
            const mtxs = await Promise.all(_.times(2, async i => {
                const args = getRandomTransformERC20Args();
                return await getRandomMetaTransaction({
                    signer: signers[i],
                    callData: transformERC20Feature
                        .transformERC20(
                            args.inputToken,
                            args.outputToken,
                            args.inputTokenAmount,
                            args.minOutputTokenAmount,
                            args.transformations,
                        )
                        .getABIEncodedTransactionData(),
                });
            }));
            const signatures = await Promise.all(
                mtxs.map(async mtx => mtx.getSignatureWithProviderAsync(env.provider)),
            );
            const callOpts = {
                gasPrice: mtxs.map(mtx => mtx.minGasPrice).reduce((a, b) => (a > b ? a : b), 0n),
                value: mtxs.map(mtx => mtx.value).reduce((a, b) => a + b, 0n),
            };
            const rawResults = await feature.batchExecuteMetaTransactions(mtxs, signatures)(callOpts);
            expect(rawResults).to.eql(mtxs.map(() => RAW_TRANSFORM_SUCCESS_RESULT));
        });

        it('cannot execute the same transaction twice', async () => {
            const mtx = await (async () => {
                const args = getRandomTransformERC20Args();
                return await getRandomMetaTransaction({
                    signer: _.sampleSize(signers, 1)[0],
                    callData: transformERC20Feature
                        .transformERC20(
                            args.inputToken,
                            args.outputToken,
                            args.inputTokenAmount,
                            args.minOutputTokenAmount,
                            args.transformations,
                        )
                        .getABIEncodedTransactionData(),
                });
            })();
            const mtxHash = mtx.getHash();
            const mtxs = _.times(2, () => mtx);
            const signatures = await Promise.all(mtxs.map(async m => m.getSignatureWithProviderAsync(env.provider)));
            const callOpts = {
                gasPrice: mtxs.map(m => m.minGasPrice).reduce((a, b) => (a > b ? a : b), 0n),
                value: mtxs.map(m => m.value).reduce((a, b) => a + b, 0n),
            };
            const block = await env.provider.getBlockNumber();
            const tx = feature.batchExecuteMetaTransactions(mtxs, signatures)(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionAlreadyExecutedError(mtxHash, block),
            );
        });

        it('fails if a meta-transaction fails', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                value: BigInt(TRANSFORM_ERC20_FAILING_VALUE),
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
            });
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: mtx.value,
            };
            const tx = feature.batchExecuteMetaTransactions([mtx], [signature])(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionCallFailedError(
                    mtxHash,
                    undefined,
                    new StringRevertError('FAIL').encode(),
                ),
            );
        });

        it('cannot reenter `executeMetaTransaction()`', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
                value: TRANSFORM_ERC20_REENTER_VALUE,
            });
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.maxGasPrice,
                value: mtx.value,
            };
            const tx = feature.batchExecuteMetaTransactions([mtx], [signature])(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionCallFailedError(
                    mtxHash,
                    undefined,
                    new ZeroExRevertErrors.Common.IllegalReentrancyError(
                        feature.getSelector('executeMetaTransaction'),
                        REENTRANCY_FLAG_MTX,
                    ).encode(),
                ),
            );
        });

        it('cannot reenter `batchExecuteMetaTransactions()`', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
                value: TRANSFORM_ERC20_BATCH_REENTER_VALUE,
            });
            const mtxHash = mtx.getHash();
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.maxGasPrice,
                value: mtx.value,
            };
            const tx = feature.batchExecuteMetaTransactions([mtx], [signature])(callOpts);
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.MetaTransactions.MetaTransactionCallFailedError(
                    mtxHash,
                    undefined,
                    new ZeroExRevertErrors.Common.IllegalReentrancyError(
                        feature.getSelector('batchExecuteMetaTransactions'),
                        REENTRANCY_FLAG_MTX,
                    ).encode(),
                ),
            );
        });

        it('cannot reduce initial ETH balance', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
                value: TRANSFORM_ERC20_ONE_WEI_VALUE,
            });
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.maxGasPrice,
                value: mtx.value,
            };
            // Send pre-existing ETH to the EP.
            const ownerSigner = await env.provider.getSigner(owner);
            await (await ownerSigner.sendTransaction({
                to: await zeroEx.getAddress(),
                value: ethers.parseUnits('1')
            })).wait();
            const tx = feature.batchExecuteMetaTransactions([mtx], [signature])(callOpts);
            return expect(tx).to.be.revertedWith('MetaTransactionsFeature/ETH_LEAK');
        });
    });

    describe('getMetaTransactionExecutedBlock()', () => {
        it('returns zero for an unexecuted mtx', async () => {
            const mtx = await getRandomMetaTransaction();
            const block = await feature.getMetaTransactionExecutedBlock(mtx)();
            expect(block).to.eq(0);
        });

        it('returns the block it was executed in', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
            });
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: mtx.value,
            };
            const receipt = await feature.executeMetaTransaction(mtx, signature)(callOpts);
            const block = await feature.getMetaTransactionExecutedBlock(mtx)();
            expect(block).to.eq(receipt.blockNumber);
        });
    });

    describe('getMetaTransactionHashExecutedBlock()', () => {
        it('returns zero for an unexecuted mtx', async () => {
            const mtx = await getRandomMetaTransaction();
            const mtxHash = mtx.getHash();
            const block = await feature.getMetaTransactionHashExecutedBlock(mtxHash)();
            expect(block).to.eq(0);
        });

        it('returns the block it was executed in', async () => {
            const args = getRandomTransformERC20Args();
            const mtx = await getRandomMetaTransaction({
                callData: transformERC20Feature
                    .transformERC20(
                        args.inputToken,
                        args.outputToken,
                        args.inputTokenAmount,
                        args.minOutputTokenAmount,
                        args.transformations,
                    )
                    .getABIEncodedTransactionData(),
            });
            const signature = await mtx.getSignatureWithProviderAsync(env.provider);
            const callOpts = {
                gasPrice: mtx.minGasPrice,
                value: mtx.value,
            };
            const receipt = await feature.executeMetaTransaction(mtx, signature)(callOpts);
            const mtxHash = mtx.getHash();
            const block = await feature.getMetaTransactionHashExecutedBlock(mtxHash)();
            expect(block).to.eq(receipt.blockNumber);
        });
    });
});
