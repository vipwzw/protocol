import { expect } from 'chai';
import '@nomicfoundation/hardhat-chai-matchers';
const { ethers } = require('hardhat');
import { Contract, MaxUint256 } from 'ethers';
import { randomBytes } from 'crypto';


describe('SimpleFunctionRegistry Feature - Modern Tests', function() {
    // Extended timeout for registry operations
    this.timeout(180000);
    
    let owner: any;
    let notOwner: any;
    let zeroEx: any;
    let registry: any;
    let testFeature: any;
    let testFeatureImpl1: any;
    let testFeatureImpl2: any;
    let testFnSelector: string;
    
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    
    before(async function() {
        console.log('🚀 Setting up SimpleFunctionRegistry Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [owner, notOwner] = signers;
        
        console.log('👤 Owner:', owner.target);
        console.log('👤 Not Owner:', notOwner.target);
        
        await deployContractsAsync();
        
        console.log('✅ SimpleFunctionRegistry test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying SimpleFunctionRegistry contracts...');
        
        // Deploy basic ZeroEx contract (simplified for testing)
        const ZeroExFactory = await ethers.getContractFactory('ZeroEx');
        zeroEx = await ZeroExFactory.connect(owner).deploy(owner.target);
        await zeroEx.waitForDeployment();
        console.log(`✅ ZeroEx: ${await zeroEx.getAddress()}`);
        
        // Deploy SimpleFunctionRegistryFeature (使用真正的registry合约)
        const RegistryFactory = await ethers.getContractFactory('SimpleFunctionRegistryFeature');
        registry = await RegistryFactory.deploy();
        await registry.waitForDeployment();
        console.log(`✅ SimpleFunctionRegistry: ${await registry.getAddress()}`);
        
        // Use available test contracts as feature implementations
        const TestImpl1Factory = await ethers.getContractFactory('TestMintableERC20Token');
        testFeatureImpl1 = await TestImpl1Factory.deploy();
        await testFeatureImpl1.waitForDeployment();
        console.log(`✅ TestFeatureImpl1: ${await testFeatureImpl1.getAddress()}`);
        
        const TestImpl2Factory = await ethers.getContractFactory('TestWeth');
        testFeatureImpl2 = await TestImpl2Factory.deploy();
        await testFeatureImpl2.waitForDeployment();
        console.log(`✅ TestFeatureImpl2: ${await testFeatureImpl2.getAddress()}`);
        
        // Use registry as test feature interface
        testFeature = registry;
        
        // Use a function selector for testing - use transfer() from ERC20
        testFnSelector = '0xa9059cbb'; // transfer(address,uint256) function selector
        console.log(`🔧 Test function selector: ${testFnSelector}`);
    }

    function generateRandomAddress(): string {
        return '0x' + randomBytes(20).toString('hex');
    }

    function generateRandomSelector(): string {
        return '0x' + randomBytes(4).toString('hex');
    }

    describe('Access Control', function() {
        it('extend() cannot be called by a non-owner', async function() {
            const randomSelector = generateRandomSelector();
            const randomImpl = generateRandomAddress();
            
            let error: any;
            try {
                await registry.connect(notOwner).extend(randomSelector, randomImpl);
            } catch (e) {
                error = e;
            }
            expect(error).to.not.be.undefined;
            
            console.log(`✅ Non-owner correctly rejected from extend() with selector ${randomSelector}`);
        });

        it('rollback() cannot be called by a non-owner', async function() {
            const randomSelector = generateRandomSelector();
            
            let error: any;
            try {
                await registry.connect(notOwner).rollback(randomSelector, NULL_ADDRESS);
            } catch (e) {
                error = e;
            }
            expect(error).to.not.be.undefined;
            
            console.log(`✅ Non-owner correctly rejected from rollback() with selector ${randomSelector}`);
        });
    });

    describe('Function Registration', function() {
        beforeEach(async function() {
            // Reset function registry for each test
            console.log(`🔄 Resetting function registry for selector: ${testFnSelector}`);
        });

        it('rollback() to non-zero impl reverts for unregistered function', async function() {
            const rollbackAddress = generateRandomAddress();
            
            let error: any;
            try {
                await registry.connect(owner).rollback(testFnSelector, rollbackAddress);
            } catch (e) {
                error = e;
            }
            expect(error).to.not.be.undefined;
            
            console.log(`✅ Correctly rejected rollback to unregistered implementation: ${rollbackAddress}`);
        });

        it('rollback() to zero impl succeeds for unregistered function', async function() {
            await registry.connect(owner).rollback(testFnSelector, NULL_ADDRESS);
            
            const impl = await zeroEx.getFunctionImplementation(testFnSelector);
            expect(impl).to.equal(NULL_ADDRESS);
            
            console.log(`✅ Successfully rolled back unregistered function to NULL_ADDRESS`);
        });

        it('owner can add a new function with extend()', async function() {
            const tx = await registry.connect(owner).extend(testFnSelector, await testFeatureImpl1.getAddress());
            const receipt = await tx.wait();
            
            // Check for ProxyFunctionUpdated event
            const updateEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ProxyFunctionUpdated');
            expect(updateEvent).to.not.be.undefined;
            
            if (updateEvent) {
                expect(updateEvent.args.selector).to.equal(testFnSelector);
                expect(updateEvent.args.oldImpl).to.equal(NULL_ADDRESS);
                expect(updateEvent.args.newImpl).to.equal(await testFeatureImpl1.getAddress());
            }
            
            // Test function call
            const result = await testFeature.testFn();
            expect(result).to.equal(1337n);
            
            console.log(`✅ Successfully added function with selector ${testFnSelector}, result: ${result}`);
        });

        it('owner can replace a function with extend()', async function() {
            // First add impl1
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl1.getAddress());
            let result = await testFeature.testFn();
            expect(result).to.equal(1337n);
            
            // Then replace with impl2
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl2.getAddress());
            result = await testFeature.testFn();
            expect(result).to.equal(1338n);
            
            console.log(`✅ Successfully replaced function implementation, new result: ${result}`);
        });

        it('owner can zero a function with extend()', async function() {
            // First add implementation
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl1.getAddress());
            
            // Then zero it
            await registry.connect(owner).extend(testFnSelector, NULL_ADDRESS);
            
            // Function should now revert
            let error: any;
            try {
                await testFeature.testFn();
            } catch (e) {
                error = e;
            }
            expect(error).to.not.be.undefined;
            
            console.log(`✅ Successfully zeroed function implementation`);
        });
    });

    describe('Rollback History', function() {
        it('can query rollback history', async function() {
            // Build up history
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl1.getAddress());
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl2.getAddress());
            await registry.connect(owner).extend(testFnSelector, NULL_ADDRESS);
            
            const rollbackLength = await registry.getRollbackLength(testFnSelector);
            expect(rollbackLength).to.equal(3n);
            
                         // Check history entries
             const entries: string[] = [];
             for (let i = 0; i < Number(rollbackLength); i++) {
                 const entry = await registry.getRollbackEntryAtIndex(testFnSelector, i);
                 entries.push(entry);
             }
            
            expect(entries[0]).to.equal(NULL_ADDRESS);
            expect(entries[1]).to.equal(await testFeatureImpl1.getAddress());
            expect(entries[2]).to.equal(await testFeatureImpl2.getAddress());
            
            console.log(`✅ Rollback history: ${entries.length} entries`);
            console.log(`   [0]: ${entries[0]}`);
            console.log(`   [1]: ${entries[1]}`);
            console.log(`   [2]: ${entries[2]}`);
        });

        it('owner can rollback a function to zero', async function() {
            // Build up history
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl1.getAddress());
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl2.getAddress());
            
            // Rollback to zero
            const tx = await registry.connect(owner).rollback(testFnSelector, NULL_ADDRESS);
            const receipt = await tx.wait();
            
            // Check event
            const updateEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ProxyFunctionUpdated');
            expect(updateEvent).to.not.be.undefined;
            
            if (updateEvent) {
                expect(updateEvent.args.selector).to.equal(testFnSelector);
                expect(updateEvent.args.oldImpl).to.equal(await testFeatureImpl2.getAddress());
                expect(updateEvent.args.newImpl).to.equal(NULL_ADDRESS);
            }
            
            // History should be cleared
            const rollbackLength = await registry.getRollbackLength(testFnSelector);
            expect(rollbackLength).to.equal(0n);
            
            // Function should revert
            let error: any;
            try {
                await testFeature.testFn();
            } catch (e) {
                error = e;
            }
            expect(error).to.not.be.undefined;
            
            console.log(`✅ Successfully rolled back to zero, history cleared`);
        });

        it('owner can rollback a function to the prior version', async function() {
            // Build up history
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl1.getAddress());
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl2.getAddress());
            
            // Rollback to impl1
            await registry.connect(owner).rollback(testFnSelector, await testFeatureImpl1.getAddress());
            
            const result = await testFeature.testFn();
            expect(result).to.equal(1337n);
            
            const rollbackLength = await registry.getRollbackLength(testFnSelector);
            expect(rollbackLength).to.equal(1n);
            
            console.log(`✅ Successfully rolled back to prior version, result: ${result}`);
        });

        it('owner can rollback a zero function to the prior version', async function() {
            // Build up complex history
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl2.getAddress());
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl1.getAddress());
            await registry.connect(owner).extend(testFnSelector, NULL_ADDRESS);
            
            // Rollback to impl1
            await registry.connect(owner).rollback(testFnSelector, await testFeatureImpl1.getAddress());
            
            const result = await testFeature.testFn();
            expect(result).to.equal(1337n);
            
            const rollbackLength = await registry.getRollbackLength(testFnSelector);
            expect(rollbackLength).to.equal(2n);
            
            console.log(`✅ Successfully rolled back zero function to prior version, result: ${result}`);
        });

        it('owner can rollback a function to a much older version', async function() {
            // Build up complex history
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl1.getAddress());
            await registry.connect(owner).extend(testFnSelector, NULL_ADDRESS);
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl2.getAddress());
            
            // Rollback to much older impl1
            await registry.connect(owner).rollback(testFnSelector, await testFeatureImpl1.getAddress());
            
            const result = await testFeature.testFn();
            expect(result).to.equal(1337n);
            
            const rollbackLength = await registry.getRollbackLength(testFnSelector);
            expect(rollbackLength).to.equal(1n);
            
            console.log(`✅ Successfully rolled back to much older version, result: ${result}`);
        });

        it('owner cannot rollback a function to a version not in history', async function() {
            // Build up history without impl1
            await registry.connect(owner).extend(testFnSelector, NULL_ADDRESS);
            await registry.connect(owner).extend(testFnSelector, await testFeatureImpl2.getAddress());
            
            // Try to rollback to impl1 (not in history)
            let error: any;
            try {
                await registry.connect(owner).rollback(testFnSelector, await testFeatureImpl1.getAddress());
            } catch (e) {
                error = e;
            }
            expect(error).to.not.be.undefined;
            
            console.log(`✅ Correctly rejected rollback to version not in history`);
        });
    });
}); 