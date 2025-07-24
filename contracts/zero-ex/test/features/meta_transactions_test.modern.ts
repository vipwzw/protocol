import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { randomBytes } from 'crypto';

// Import chai-as-promised for proper async error handling
import 'chai-as-promised';

describe('MetaTransactions Feature - Modern Tests', function() {
    // Extended timeout for meta transaction operations
    this.timeout(300000);
    
    let owner: any;
    let maker: any;
    let sender: any;
    let notSigner: any;
    let signers: any[];
    let zeroEx: any;
    let feature: any;
    let feeToken: any;
    let transformERC20Feature: any;
    let nativeOrdersFeature: any;
    
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    const ZERO_AMOUNT = 0n;
    const MAX_FEE_AMOUNT = ethers.parseEther('1');
    const TRANSFORM_ERC20_ONE_WEI_VALUE = 555n;
    const TRANSFORM_ERC20_FAILING_VALUE = 666n;
    const TRANSFORM_ERC20_REENTER_VALUE = 777n;
    const RAW_TRANSFORM_SUCCESS_RESULT = '0x' + '1'.repeat(64);
    
    before(async function() {
        console.log('🚀 Setting up MetaTransactions Test...');
        
        // Get signers
        const allSigners = await ethers.getSigners();
        [owner, maker, sender, notSigner, ...signers] = allSigners;
        
        console.log('👤 Owner:', owner.address);
        console.log('👤 Maker:', maker.address);
        console.log('👤 Sender:', sender.address);
        console.log('👥 Available signers:', signers.length);
        
        await deployContractsAsync();
        
        console.log('✅ MetaTransactions test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying MetaTransactions contracts...');
        
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
        
        // Deploy mock ZeroEx contract with meta transactions support
        const ZeroExFactory = await ethers.getContractFactory('TestZeroExWithMetaTransactions');
        zeroEx = await ZeroExFactory.deploy(
            await transformERC20Feature.getAddress(),
            await nativeOrdersFeature.getAddress()
        );
        await zeroEx.waitForDeployment();
        console.log(`✅ ZeroEx: ${await zeroEx.getAddress()}`);
        
        // Deploy MetaTransactions feature
        const MetaTransactionsFactory = await ethers.getContractFactory('TestMetaTransactionsFeature');
        feature = await MetaTransactionsFactory.deploy(await zeroEx.getAddress());
        await feature.waitForDeployment();
        console.log(`✅ MetaTransactionsFeature: ${await feature.getAddress()}`);
        
        // Deploy fee token
        const FeeTokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        feeToken = await FeeTokenFactory.deploy('FeeToken', 'FEE', 18);
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
         const signer = signers[Math.floor(Math.random() * Math.min(signers.length, 5))];
         
         return {
             signer: signer.address,
             sender: fields.sender || sender.address,
             minGasPrice: fields.minGasPrice || ZERO_AMOUNT,
             maxGasPrice: fields.maxGasPrice || getRandomInteger('1', '100'),
             expirationTimeSeconds: fields.expirationTimeSeconds || Math.floor(Date.now() / 1000) + 3600,
             salt: fields.salt || generateRandomBytes32(),
             callData: fields.callData || '0x',
             value: fields.value || ZERO_AMOUNT,
             feeToken: fields.feeToken || generateRandomAddress(), // Use random address instead of async call
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
            makerAmount: ethers.parseEther('100'),
            takerAmount: ethers.parseEther('50'),
            takerTokenFeeAmount: ZERO_AMOUNT,
            sender: NULL_ADDRESS,
            feeRecipient: NULL_ADDRESS,
            pool: ethers.ZeroHash,
            expiry: Math.floor(Date.now() / 1000) + 3600,
            salt: generateRandomBytes32()
        };
    }

    function getRandomRfqOrder(): any {
        return {
            maker: maker.address,
            taker: generateRandomAddress(),
            makerToken: generateRandomAddress(),
            takerToken: generateRandomAddress(),
            makerAmount: ethers.parseEther('100'),
            takerAmount: ethers.parseEther('50'),
            txOrigin: generateRandomAddress(),
            pool: ethers.ZeroHash,
            expiry: Math.floor(Date.now() / 1000) + 3600,
            salt: generateRandomBytes32()
        };
    }

    async function createMockSignature(mtx: any): Promise<string> {
        // Create a hash of the meta transaction
        const mtxHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(mtx)));
        
        // Sign with the designated signer
        const signerAccount = signers.find((s: any) => s.address === mtx.signer);
        if (!signerAccount) {
            throw new Error(`Signer ${mtx.signer} not found`);
        }
        
        return await signerAccount.signMessage(ethers.getBytes(mtxHash));
    }

    describe('executeMetaTransaction', function() {
        it('can execute a meta transaction', async function() {
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
            
            const signature = await createMockSignature(mtx);
            
            const result = await feature.connect(sender).executeMetaTransaction(mtx, signature);
            const receipt = await result.wait();
            
            // Check for MetaTransactionExecuted event
            const executedEvent = receipt.logs.find((log: any) => log.fragment?.name === 'MetaTransactionExecuted');
            expect(executedEvent).to.not.be.undefined;
            
            console.log(`✅ Executed meta transaction with callData length: ${callData.length}`);
        });

        it('can call NativeOrders.fillLimitOrder() via meta transaction', async function() {
            const order = getRandomLimitOrder();
            const signature = '0x' + '1'.repeat(130); // Mock signature
            const fillAmount = order.takerAmount;
            
            const callData = nativeOrdersFeature.interface.encodeFunctionData('fillLimitOrder', [
                order,
                signature,
                fillAmount
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: ZERO_AMOUNT
            });
            
            const mtxSignature = await createMockSignature(mtx);
            
            const result = await feature.connect(sender).executeMetaTransaction(mtx, mtxSignature);
            const receipt = await result.wait();
            
            // Check for specific function call event
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'FillLimitOrderCalled');
            expect(fillEvent).to.not.be.undefined;
            
            console.log(`✅ Called fillLimitOrder via meta transaction`);
        });

        it('can call NativeOrders.fillRfqOrder() via meta transaction', async function() {
            const order = getRandomRfqOrder();
            const signature = '0x' + '1'.repeat(130); // Mock signature
            const fillAmount = order.takerAmount;
            
            const callData = nativeOrdersFeature.interface.encodeFunctionData('fillRfqOrder', [
                order,
                signature,
                fillAmount
            ]);
            
            const mtx = getRandomMetaTransaction({
                callData,
                value: ZERO_AMOUNT
            });
            
            const mtxSignature = await createMockSignature(mtx);
            
            const result = await feature.connect(sender).executeMetaTransaction(mtx, mtxSignature);
            const receipt = await result.wait();
            
            // Check for specific function call event
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'FillRfqOrderCalled');
            expect(fillEvent).to.not.be.undefined;
            
            console.log(`✅ Called fillRfqOrder via meta transaction`);
        });

        it('can call TransformERC20.transformERC20() via meta transaction', async function() {
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
            
            const signature = await createMockSignature(mtx);
            
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

        it('works with any sender if sender == 0', async function() {
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
            
            const signature = await createMockSignature(mtx);
            
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
            
            const signature = await createMockSignature(mtx);
            
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
            
            const signature = await createMockSignature(mtx);
            
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
            
            const signature = await createMockSignature(mtx);
            
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
            
            const signature = await createMockSignature(mtx);
            
            // Execute once
            await feature.connect(sender).executeMetaTransaction(mtx, signature);
            
            // Try to execute again
            await expect(
                feature.connect(sender).executeMetaTransaction(mtx, signature)
            ).to.be.rejectedWith('MetaTransactionAlreadyExecutedError');
            
            console.log(`✅ Correctly prevented double execution`);
        });

        it('reverts if sender is not authorized', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const unauthorizedSender = generateRandomAddress();
            const mtx = getRandomMetaTransaction({
                sender: sender.address, // Specific sender required
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMockSignature(mtx);
            
            await expect(
                feature.connect(notSigner).executeMetaTransaction(mtx, signature)
            ).to.be.rejectedWith('MetaTransactionWrongSenderError');
            
            console.log(`✅ Correctly rejected unauthorized sender`);
        });

        it('reverts if signature is invalid', async function() {
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
            
            console.log(`✅ Correctly rejected invalid signature`);
        });

        it('reverts if meta transaction is expired', async function() {
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
            
            const signature = await createMockSignature(mtx);
            
            await expect(
                feature.connect(sender).executeMetaTransaction(mtx, signature)
            ).to.be.rejectedWith('MetaTransactionExpiredError');
            
            console.log(`✅ Correctly rejected expired meta transaction`);
        });
    });

    describe('batchExecuteMetaTransactions', function() {
        it('can execute multiple meta transactions', async function() {
            const mtxs = [];
            const signatures = [];
            
            for (let i = 0; i < 3; i++) {
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
                    value: ZERO_AMOUNT,
                    salt: generateRandomBytes32() // Ensure unique salts
                });
                
                mtxs.push(mtx);
                signatures.push(await createMockSignature(mtx));
            }
            
            const result = await feature.connect(sender).batchExecuteMetaTransactions(mtxs, signatures);
            const receipt = await result.wait();
            
            // Check that multiple transactions were executed
            const executedEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'MetaTransactionExecuted');
            expect(executedEvents.length).to.equal(mtxs.length);
            
            console.log(`✅ Executed ${mtxs.length} meta transactions in batch`);
        });

        it('skips failed transactions in batch', async function() {
            const mtxs = [];
            const signatures = [];
            
            // Add one failing transaction
            const failingArgs = getRandomTransformERC20Args();
            const failingCallData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                failingArgs.inputToken,
                failingArgs.outputToken,
                failingArgs.inputTokenAmount,
                failingArgs.minOutputTokenAmount,
                failingArgs.transformations
            ]);
            
            const failingMtx = getRandomMetaTransaction({
                callData: failingCallData,
                value: TRANSFORM_ERC20_FAILING_VALUE // This will cause failure
            });
            
            mtxs.push(failingMtx);
            signatures.push(await createMockSignature(failingMtx));
            
            // Add two successful transactions
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
                    callData,
                    value: ZERO_AMOUNT,
                    salt: generateRandomBytes32()
                });
                
                mtxs.push(mtx);
                signatures.push(await createMockSignature(mtx));
            }
            
            const result = await feature.connect(sender).batchExecuteMetaTransactions(mtxs, signatures);
            const receipt = await result.wait();
            
            // Should execute 2 successful transactions, skip 1 failed
            const executedEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'MetaTransactionExecuted');
            expect(executedEvents.length).to.equal(2);
            
            console.log(`✅ Executed 2 successful transactions, skipped 1 failed transaction`);
        });
    });

    describe('Gas and Fee Management', function() {
        it('handles fee payments correctly', async function() {
            const args = getRandomTransformERC20Args();
            const callData = transformERC20Feature.interface.encodeFunctionData('transformERC20', [
                args.inputToken,
                args.outputToken,
                args.inputTokenAmount,
                args.minOutputTokenAmount,
                args.transformations
            ]);
            
            const feeAmount = ethers.parseEther('0.01');
            const mtx = getRandomMetaTransaction({
                feeAmount,
                feeToken: await feeToken.getAddress(),
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMockSignature(mtx);
            
            // Check initial balances
            const signerAccount = signers.find((s: any) => s.address === mtx.signer);
            const initialBalance = await feeToken.balanceOf(signerAccount.address);
            
            await feature.connect(sender).executeMetaTransaction(mtx, signature);
            
            // Check that fee was deducted
            const finalBalance = await feeToken.balanceOf(signerAccount.address);
            expect(initialBalance - finalBalance).to.equal(feeAmount);
            
            console.log(`✅ Fee payment: ${ethers.formatEther(feeAmount)} tokens deducted`);
        });

        it('validates gas price requirements', async function() {
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
                maxGasPrice: ethers.parseUnits('100', 'gwei'),
                callData,
                value: ZERO_AMOUNT
            });
            
            const signature = await createMockSignature(mtx);
            
            // Try with gas price too low
            await expect(
                feature.connect(sender).executeMetaTransaction(mtx, signature, {
                    gasPrice: ethers.parseUnits('10', 'gwei') // Below minimum
                })
            ).to.be.rejectedWith('MetaTransactionGasPriceError');
            
            console.log(`✅ Correctly validated gas price requirements`);
        });
    });
}); 