import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { randomBytes } from 'crypto';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
// 导入通用部署函数
import { 
    deployZeroExWithFullMigration, 
    deployTestTokens, 
    approveTokensForAccounts,
    type ZeroExDeploymentResult 
} from '../utils/deployment-helper';

// Configure chai-as-promised for proper async error handling
chai.use(chaiAsPromised);

describe('MetaTransactions Feature - Complete Modern Tests', function() {
    // Extended timeout for meta transaction operations
    this.timeout(300000);
    
    let owner: any;
    let maker: any;
    let sender: any;
    let notSigner: any;
    let signers: any[];
    let deployment: ZeroExDeploymentResult;
    let feature: any; // MetaTransactionsFeature 接口
    let feeToken: any;
    let transformERC20Feature: any;
    let nativeOrdersFeature: any;
    
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    const ZERO_AMOUNT = 0n;
    const MAX_FEE_AMOUNT = ethers.parseEther('1');
    const TRANSFORM_ERC20_ONE_WEI_VALUE = 555n;
    const TRANSFORM_ERC20_FAILING_VALUE = 666n;
    const TRANSFORM_ERC20_REENTER_VALUE = 777n;
    const TRANSFORM_ERC20_BATCH_REENTER_VALUE = 888n;
    const REENTRANCY_FLAG_MTX = 0x1;
    const RAW_TRANSFORM_SUCCESS_RESULT = '0x' + '1'.repeat(64);
    
    before(async function() {
        console.log('🚀 Setting up Complete MetaTransactions Test...');
        
        // Get signers
        const allSigners = await ethers.getSigners();
        [owner, maker, sender, notSigner, ...signers] = allSigners;
        
        console.log('👤 Owner:', owner.address);
        console.log('👤 Maker:', maker.address);
        console.log('👤 Sender:', sender.address);
        console.log('👥 Available signers:', signers.length);
        
        await deployContractsAsync();
        
        console.log('✅ Complete MetaTransactions test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying Complete MetaTransactions contracts...');
        
        // Deploy mock TransformERC20 feature
        const TransformERC20Factory = await ethers.getContractFactory('TestMetaTransactionsTransformERC20Feature');
        transformERC20Feature = await TransformERC20Factory.deploy();
        await transformERC20Feature.waitForDeployment();
        console.log(`✅ TransformERC20Feature: ${await transformERC20Feature.getAddress()}`);
        
        // Deploy mock NativeOrders feature
        const NativeOrdersFactory = await ethers.getContractFactory('TestMetaTransactionsNativeOrdersFeature');
        nativeOrdersFeature = await NativeOrdersFactory.deploy();
        await nativeOrdersFeature.waitForDeployment();
        console.log(`✅ NativeOrdersFeature: ${await nativeOrdersFeature.getAddress()}`);
        
        // Deploy basic ZeroEx contract
        const ZeroExFactory = await ethers.getContractFactory('ZeroEx');
        const zeroEx = await ZeroExFactory.deploy(owner.address);
        await zeroEx.waitForDeployment();
        console.log(`✅ ZeroEx: ${await zeroEx.getAddress()}`);
        
        // Create deployment-like object for compatibility
        deployment = {
            zeroEx,
            verifyingContract: await zeroEx.getAddress(),
            features: {},
            featureInterfaces: {},
            migrator: null,
            dependencies: {}
        } as any;
        
        // Deploy MetaTransactions feature
        const MetaTransactionsFactory = await ethers.getContractFactory('MetaTransactionsFeature');
        feature = await MetaTransactionsFactory.deploy(await zeroEx.getAddress());
        await feature.waitForDeployment();
        console.log(`✅ MetaTransactionsFeature: ${await feature.getAddress()}`);
        
        // Deploy fee token using TestMintableERC20Token (no constructor params)
        const FeeTokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        feeToken = await FeeTokenFactory.deploy();
        await feeToken.waitForDeployment();
        console.log(`✅ FeeToken: ${await feeToken.getAddress()}`);
        
        // Setup fee tokens for signers
        for (const signer of signers.slice(0, 5)) { // Limit to first 5 signers
            await feeToken.mint(signer.address, MAX_FEE_AMOUNT);
            await feeToken.connect(signer).approve(await zeroEx.getAddress(), MAX_FEE_AMOUNT);
        }
        console.log(`✅ Setup fee tokens for ${Math.min(signers.length, 5)} signers`);
    }

    function generateRandomBytes32(): string {
        return '0x' + randomBytes(32).toString('hex');
    }

    function generateRandomAddress(): string {
        return '0x' + randomBytes(20).toString('hex');
    }

    function getRandomInteger(min: string, max: string): bigint {
        const minBig = ethers.parseEther(min);
        const maxBig = ethers.parseEther(max);
        const range = maxBig - minBig;
        const randomValue = BigInt(Math.floor(Math.random() * Number(range.toString())));
        return minBig + randomValue;
    }

    function getRandomMetaTransaction(fields: any = {}): any {
        const signer = fields.signer || signers[Math.floor(Math.random() * Math.min(signers.length, 5))];
        
        return {
            signer: signer.address,
            sender: fields.sender || sender.address,
            minGasPrice: fields.minGasPrice || ZERO_AMOUNT,
            maxGasPrice: fields.maxGasPrice || getRandomInteger('1', '100'),
            expirationTimeSeconds: fields.expirationTimeSeconds || Math.floor(Date.now() / 1000) + 3600,
            salt: fields.salt || generateRandomBytes32(),
            callData: fields.callData || '0x',
            value: fields.value || ZERO_AMOUNT,
            feeToken: fields.feeToken || generateRandomAddress(),
            feeAmount: fields.feeAmount || ethers.parseEther('0.01'),
            ...fields
        };
    }

    function getRandomTransformERC20Args(): any {
        return {
            inputToken: generateRandomAddress(),
            outputToken: generateRandomAddress(),
            inputTokenAmount: ethers.parseEther('10'),
            minOutputTokenAmount: ethers.parseEther('9'),
            transformations: []
        };
    }

    function getRandomLimitOrder(): any {
        return {
            maker: maker.address,
            taker: NULL_ADDRESS,
            makerToken: generateRandomAddress(),
            takerToken: generateRandomAddress(),
            makerAmount: ethers.parseEther('100').toString(),
            takerAmount: ethers.parseEther('50').toString(),
            takerTokenFeeAmount: ZERO_AMOUNT.toString(),
            sender: NULL_ADDRESS,
            feeRecipient: NULL_ADDRESS,
            pool: ethers.ZeroHash,
            expiry: Math.floor(Date.now() / 1000) + 3600,
            salt: ethers.hexlify(randomBytes(32))
        };
    }

    function getRandomRfqOrder(): any {
        return {
            maker: maker.address,
            taker: generateRandomAddress(),
            makerToken: generateRandomAddress(),
            takerToken: generateRandomAddress(),
            makerAmount: ethers.parseEther('100').toString(),
            takerAmount: ethers.parseEther('50').toString(),
            txOrigin: generateRandomAddress(),
            pool: ethers.ZeroHash,
            expiry: Math.floor(Date.now() / 1000) + 3600,
            salt: ethers.hexlify(randomBytes(32))
        };
    }

    async function createMetaTransactionSignature(mtx: any): Promise<string> {
        // Create a hash of the meta transaction (with safe BigInt serialization)
        const mtxForHashing = {
            ...mtx,
            minGasPrice: mtx.minGasPrice?.toString ? mtx.minGasPrice.toString() : mtx.minGasPrice,
            maxGasPrice: mtx.maxGasPrice?.toString ? mtx.maxGasPrice.toString() : mtx.maxGasPrice,
            value: mtx.value?.toString ? mtx.value.toString() : mtx.value,
            feeAmount: mtx.feeAmount?.toString ? mtx.feeAmount.toString() : mtx.feeAmount,
            expirationTimeSeconds: mtx.expirationTimeSeconds?.toString ? mtx.expirationTimeSeconds.toString() : mtx.expirationTimeSeconds
        };
        const mtxHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(mtxForHashing)));
        
        // Sign with the designated signer
        const signerAccount = signers.find((s: any) => s.address === mtx.signer);
        if (!signerAccount) {
            throw new Error(`Signer ${mtx.signer} not found`);
        }
        
        return await signerAccount.signMessage(ethers.getBytes(mtxHash));
    }

    function getMetaTransactionHash(mtx: any): string {
        // Convert bigint fields to strings for safe JSON serialization
        const mtxForHashing = {
            ...mtx,
            minGasPrice: mtx.minGasPrice?.toString ? mtx.minGasPrice.toString() : mtx.minGasPrice,
            maxGasPrice: mtx.maxGasPrice?.toString ? mtx.maxGasPrice.toString() : mtx.maxGasPrice,
            value: mtx.value?.toString ? mtx.value.toString() : mtx.value,
            feeAmount: mtx.feeAmount?.toString ? mtx.feeAmount.toString() : mtx.feeAmount,
            expirationTimeSeconds: mtx.expirationTimeSeconds?.toString ? mtx.expirationTimeSeconds.toString() : mtx.expirationTimeSeconds
        };
        return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(mtxForHashing)));
    }

    describe('executeMetaTransaction()', function() {
        it('can call `NativeOrders.fillLimitOrder()`', async function() {
            const order = getRandomLimitOrder();
            const sig = '0x' + '1'.repeat(130); // Mock signature  
            const fillAmount = order.takerAmount;
            
            const callData = nativeOrdersFeature.interface.encodeFunctionData('fillLimitOrder', [
                order,
                sig,
                fillAmount
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            const result = await feature.connect(sender).executeMetaTransaction(mtx, signature);
            const receipt = await result.wait();
            
            // Check for FillLimitOrderCalled event
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'FillLimitOrderCalled');
            expect(fillEvent).to.not.be.undefined;
            
            console.log(`✅ Called fillLimitOrder via meta transaction`);
        });

        it('can call `NativeOrders.fillRfqOrder()`', async function() {
            const order = getRandomRfqOrder();
            const sig = '0x' + '1'.repeat(130); // Mock signature
            const fillAmount = order.takerAmount;
            
            const callData = nativeOrdersFeature.interface.encodeFunctionData('fillRfqOrder', [
                order,
                sig,
                fillAmount
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            const result = await feature.connect(sender).executeMetaTransaction(mtx, signature);
            const receipt = await result.wait();
            
            // Check for FillRfqOrderCalled event
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'FillRfqOrderCalled');
            expect(fillEvent).to.not.be.undefined;
            
            console.log(`✅ Called fillRfqOrder via meta transaction`);
        });

        it('can call `TransformERC20.transformERC20()`', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            // First call to check return value
            const rawResult = await feature.connect(sender).executeMetaTransaction.staticCall(mtx, signature);
            expect(rawResult).to.equal(RAW_TRANSFORM_SUCCESS_RESULT);
            
            // Then execute
            const result = await feature.connect(sender).executeMetaTransaction(mtx, signature);
            const receipt = await result.wait();
            
            // Check for TransformERC20Called event
            const transformEvent = receipt.logs.find((log: any) => log.fragment?.name === 'TransformERC20Called');
            expect(transformEvent).to.not.be.undefined;
            
            console.log(`✅ Called transformERC20 via meta transaction`);
        });

        it('can call `TransformERC20.transformERC20()` with calldata', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({ callData });
            const signature = await createMetaTransactionSignature(mtx);
            
            const rawResult = await feature.connect(sender).executeMetaTransaction.staticCall(mtx, signature);
            expect(rawResult).to.equal(RAW_TRANSFORM_SUCCESS_RESULT);
            
            const result = await feature.connect(sender).executeMetaTransaction(mtx, signature);
            const receipt = await result.wait();
            
            const transformEvent = receipt.logs.find((log: any) => log.fragment?.name === 'TransformERC20Called');
            expect(transformEvent).to.not.be.undefined;
            
            console.log(`✅ Called transformERC20 with calldata via meta transaction`);
        });

        it('can call with any sender if `sender == 0`', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                sender: NULL_ADDRESS,
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            // Use a random account as sender
            const randomSender = signers[Math.floor(Math.random() * signers.length)];
            const rawResult = await feature.connect(randomSender).executeMetaTransaction.staticCall(mtx, signature);
            expect(rawResult).to.equal(RAW_TRANSFORM_SUCCESS_RESULT);
            
            console.log(`✅ Executed with random sender when mtx.sender == 0`);
        });

        it('works without fee', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                feeAmount: ZERO_AMOUNT,
                feeToken: generateRandomAddress(),
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            const rawResult = await feature.connect(sender).executeMetaTransaction.staticCall(mtx, signature);
            expect(rawResult).to.equal(RAW_TRANSFORM_SUCCESS_RESULT);
            
            console.log(`✅ Executed without fee`);
        });

        it('fails if the translated call fails', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                value: TRANSFORM_ERC20_FAILING_VALUE, // This should cause failure
                callData
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            await expect(
                feature.connect(sender).executeMetaTransaction(mtx, signature)
            ).to.be.rejectedWith('MetaTransactionCallFailedError');
            
            console.log(`✅ Correctly failed when translated call fails`);
        });

        it('fails with unsupported function', async function() {
            // Use an unsupported function selector
            const callData = '0x12345678'; // Invalid function selector
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            await expect(
                feature.connect(sender).executeMetaTransaction(mtx, signature)
            ).to.be.rejectedWith('MetaTransactionUnsupportedFunctionError');
            
            console.log(`✅ Correctly failed with unsupported function`);
        });

        it('cannot execute the same mtx twice', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            // Execute once
            await feature.connect(sender).executeMetaTransaction(mtx, signature);
            
            // Try to execute again
            await expect(
                feature.connect(sender).executeMetaTransaction(mtx, signature)
            ).to.be.rejectedWith('MetaTransactionAlreadyExecutedError');
            
            console.log(`✅ Correctly prevented double execution`);
        });

        it('reverts if wrong sender', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                sender: sender.address, // Specific sender required
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            await expect(
                feature.connect(notSigner).executeMetaTransaction(mtx, signature)
            ).to.be.rejectedWith('MetaTransactionWrongSenderError');
            
            console.log(`✅ Correctly rejected wrong sender`);
        });

        it('reverts if bad signature', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: ZERO_AMOUNT
            });
            
            const invalidSignature = '0x' + '0'.repeat(130); // Invalid signature
            
            await expect(
                feature.connect(sender).executeMetaTransaction(mtx, invalidSignature)
            ).to.be.rejectedWith('MetaTransactionInvalidSignatureError');
            
            console.log(`✅ Correctly rejected bad signature`);
        });

        it('reverts if expired', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                expirationTimeSeconds: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            await expect(
                feature.connect(sender).executeMetaTransaction(mtx, signature)
            ).to.be.rejectedWith('MetaTransactionExpiredError');
            
            console.log(`✅ Correctly rejected expired meta transaction`);
        });

        it('reverts if min gas price is not met', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                minGasPrice: ethers.parseUnits('20', 'gwei'),
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            await expect(
                feature.connect(sender).executeMetaTransaction(mtx, signature, {
                    gasPrice: ethers.parseUnits('10', 'gwei') // Below minimum
                })
            ).to.be.rejectedWith('MetaTransactionGasPriceError');
            
            console.log(`✅ Correctly rejected low gas price`);
        });

        it('reverts if max gas price is exceeded', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                maxGasPrice: ethers.parseUnits('50', 'gwei'),
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            await expect(
                feature.connect(sender).executeMetaTransaction(mtx, signature, {
                    gasPrice: ethers.parseUnits('100', 'gwei') // Above maximum
                })
            ).to.be.rejectedWith('MetaTransactionGasPriceError');
            
            console.log(`✅ Correctly rejected high gas price`);
        });

        it('cannot reenter `executeMetaTransaction()`', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: TRANSFORM_ERC20_REENTER_VALUE // This triggers reentrancy
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            await expect(
                feature.connect(sender).executeMetaTransaction(mtx, signature)
            ).to.be.rejectedWith('IllegalReentrancyError');
            
            console.log(`✅ Correctly prevented reentrancy in executeMetaTransaction`);
        });

        it('cannot reduce initial ETH balance', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: TRANSFORM_ERC20_ONE_WEI_VALUE
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            // Send pre-existing ETH to the contract
            await owner.sendTransaction({
                to: deployment.verifyingContract,
                value: 1
            });
            
            await expect(
                feature.connect(sender).executeMetaTransaction(mtx, signature)
            ).to.be.rejectedWith('ETH_LEAK');
            
            console.log(`✅ Correctly prevented ETH balance reduction`);
        });
    });

    describe('batchExecuteMetaTransactions()', function() {
        it('can execute multiple transactions', async function() {
            const mtxs: any[] = [];
            const signatures: string[] = [];
            
            for (let i = 0; i < 2; i++) {
                const args = getRandomTransformERC20Args();
                const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                    args.inputToken,
                    args.outputToken,
                    args.inputTokenAmount,
                    args.minOutputTokenAmount,
                    args.transformations
                ]);
                
                const mtx = getRandomMetaTransaction({
                    signer: signers[i],
                    callData,
                    value: ZERO_AMOUNT,
                    salt: generateRandomBytes32() // Ensure unique salts
                });
                
                mtxs.push(mtx);
                signatures.push(await createMetaTransactionSignature(mtx));
            }
            
            // Check static call first
            const rawResults = await feature.connect(sender).batchExecuteMetaTransactions.staticCall(mtxs, signatures);
            expect(rawResults).to.deep.equal(mtxs.map(() => RAW_TRANSFORM_SUCCESS_RESULT));
            
            // Then execute
            const result = await feature.connect(sender).batchExecuteMetaTransactions(mtxs, signatures);
            const receipt = await result.wait();
            
            // Check that multiple transactions were executed
            const executedEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'MetaTransactionExecuted');
            expect(executedEvents.length).to.equal(mtxs.length);
            
            console.log(`✅ Executed ${mtxs.length} meta transactions in batch`);
        });

        it('cannot execute the same transaction twice', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                signer: signers[0],
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            const mtxs: any[] = [mtx, mtx]; // Same transaction twice
            const signatures: string[] = [signature, signature];
            
            const block = await ethers.provider.getBlockNumber();
            
            await expect(
                feature.connect(sender).batchExecuteMetaTransactions.staticCall(mtxs, signatures)
            ).to.be.rejectedWith('MetaTransactionAlreadyExecutedError');
            
            console.log(`✅ Correctly prevented double execution in batch`);
        });

        it('fails if a meta-transaction fails', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                value: TRANSFORM_ERC20_FAILING_VALUE, // This will cause failure
                callData
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            await expect(
                feature.connect(sender).batchExecuteMetaTransactions.staticCall([mtx], [signature])
            ).to.be.rejectedWith('MetaTransactionCallFailedError');
            
            console.log(`✅ Correctly failed batch when one transaction fails`);
        });

        it('cannot reenter `executeMetaTransaction()`', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: TRANSFORM_ERC20_REENTER_VALUE // This triggers reentrancy
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            await expect(
                feature.connect(sender).batchExecuteMetaTransactions([mtx], [signature])
            ).to.be.rejectedWith('IllegalReentrancyError');
            
            console.log(`✅ Correctly prevented executeMetaTransaction reentrancy from batch`);
        });

        it('cannot reenter `batchExecuteMetaTransactions()`', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: TRANSFORM_ERC20_BATCH_REENTER_VALUE // This triggers batch reentrancy
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            await expect(
                feature.connect(sender).batchExecuteMetaTransactions([mtx], [signature])
            ).to.be.rejectedWith('IllegalReentrancyError');
            
            console.log(`✅ Correctly prevented batchExecuteMetaTransactions reentrancy`);
        });

        it('cannot reduce initial ETH balance', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: TRANSFORM_ERC20_ONE_WEI_VALUE
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            // Send pre-existing ETH to the contract
            await owner.sendTransaction({
                to: deployment.verifyingContract,
                value: 1
            });
            
            await expect(
                feature.connect(sender).batchExecuteMetaTransactions([mtx], [signature])
            ).to.be.rejectedWith('ETH_LEAK');
            
            console.log(`✅ Correctly prevented ETH balance reduction in batch`);
        });
    });

    describe('getMetaTransactionExecutedBlock()', function() {
        it('returns zero for an unexecuted mtx', async function() {
            const mtx = getRandomMetaTransaction();
            
            const block = await feature.getMetaTransactionExecutedBlock(mtx);
            expect(block).to.equal(0n);
            
            console.log(`✅ Returned zero for unexecuted meta transaction`);
        });

        it('returns the block it was executed in', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            const result = await feature.connect(sender).executeMetaTransaction(mtx, signature);
            const receipt = await result.wait();
            
            const block = await feature.getMetaTransactionExecutedBlock(mtx);
            expect(block).to.equal(BigInt(receipt.blockNumber));
            
            console.log(`✅ Returned correct execution block: ${receipt.blockNumber}`);
        });
    });

    describe('getMetaTransactionHashExecutedBlock()', function() {
        it('returns zero for an unexecuted mtx', async function() {
            const mtx = getRandomMetaTransaction();
            const mtxHash = getMetaTransactionHash(mtx);
            
            const block = await feature.getMetaTransactionHashExecutedBlock(mtxHash);
            expect(block).to.equal(0n);
            
            console.log(`✅ Returned zero for unexecuted meta transaction hash`);
        });

        it('returns the block it was executed in', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMetaTransactionSignature(mtx);
            
            const result = await feature.connect(sender).executeMetaTransaction(mtx, signature);
            const receipt = await result.wait();
            
            const mtxHash = getMetaTransactionHash(mtx);
            const block = await feature.getMetaTransactionHashExecutedBlock(mtxHash);
            expect(block).to.equal(BigInt(receipt.blockNumber));
            
            console.log(`✅ Returned correct execution block for hash: ${receipt.blockNumber}`);
        });
    });
});