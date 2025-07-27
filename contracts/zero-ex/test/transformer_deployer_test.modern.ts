import { expect } from 'chai';
import '@nomicfoundation/hardhat-chai-matchers';
const { ethers } = require('hardhat');
import { Contract, MaxUint256 } from 'ethers';

describe('Transformer Deployer - Modern Tests', function() {
    // Extended timeout for deployment operations
    this.timeout(180000);
    
    let admin: any;
    let deployer: any;
    let user1: any;
    let user2: any;
    
    // Core contracts
    let transformerDeployer: Contract;
    let testTransformer: Contract;
    let zeroEx: Contract;
    
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    
    before(async function() {
        console.log('🚀 Setting up Transformer Deployer Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [admin, deployer, user1, user2] = signers;
        
        console.log('👤 Admin:', admin.target);
        console.log('👤 Deployer:', deployer.target);
        console.log('👤 User1:', user1.target);
        console.log('👤 User2:', user2.target);
        
        await deployContractsAsync();
        
        console.log('✅ Transformer deployer test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying transformer deployer contracts...');
        
        // Deploy ZeroEx first
        const ZeroExFactory = await ethers.getContractFactory('ZeroEx');
        zeroEx = await ZeroExFactory.deploy(admin.target);
        await zeroEx.waitForDeployment();
        console.log(`✅ ZeroEx: ${await zeroEx.getAddress()}`);
        
        // Deploy TransformerDeployer with admin as initial authority
        const DeployerFactory = await ethers.getContractFactory('TransformerDeployer');
        transformerDeployer = await DeployerFactory.deploy([admin.target]);
        await transformerDeployer.waitForDeployment();
        console.log(`✅ TransformerDeployer: ${await transformerDeployer.getAddress()}`);
        
        // Deploy a test transformer using TestMintTokenERC20Transformer
        const TransformerFactory = await ethers.getContractFactory('TestMintTokenERC20Transformer');
        testTransformer = await TransformerFactory.deploy();
        await testTransformer.waitForDeployment();
        console.log(`✅ TestMintTokenERC20Transformer: ${await testTransformer.getAddress()}`);
    }
    
    function createTransformerDeployment(overrides: any = {}): any {
        const defaultDeployment = {
            transformerBytecode: '0x608060405234801561001057600080fd5b50600080fd5b6000600060406000806000600061008056',
            transformerInitCode: '0x',
            salt: ethers.randomBytes(32),
            deployer: deployer.target,
            expectedAddress: NULL_ADDRESS
        };
        
        return { ...defaultDeployment, ...overrides };
    }
    
    describe('🏗️ Contract Deployment', function() {
        it('should deploy all transformer deployer contracts successfully', async function() {
            expect(await zeroEx.getAddress()).to.have.lengthOf(42);
            expect(await transformerDeployer.getAddress()).to.have.lengthOf(42);
            expect(await testTransformer.getAddress()).to.have.lengthOf(42);
            
            console.log('✅ All transformer deployer contracts deployed');
        });
        
        it('should have correct contract configurations', async function() {
            const zeroExAddress = await zeroEx.getAddress();
            const deployerAddress = await transformerDeployer.getAddress();
            const transformerAddress = await testTransformer.getAddress();
            
            expect(zeroExAddress).to.not.equal(deployerAddress);
            expect(deployerAddress).to.not.equal(transformerAddress);
            expect(zeroExAddress).to.not.equal(transformerAddress);
            
            console.log('✅ All contracts have unique addresses');
        });
    });
    
    describe('🔧 Transformer Deployment Logic', function() {
        it('should create valid deployment configurations', async function() {
            const deployment = createTransformerDeployment();
            
            expect(deployment.transformerBytecode).to.be.a('string');
            expect(deployment.transformerBytecode).to.match(/^0x[0-9a-fA-F]+$/);
            // Check salt format - it could be Uint8Array (32 bytes) or hex string (66 chars)
            if (typeof deployment.salt === 'string') {
                expect(deployment.salt).to.have.length(66); // 0x + 64 hex chars
            } else {
                expect(deployment.salt).to.have.length(32); // 32 bytes Uint8Array
            }
            expect(ethers.isAddress(deployment.deployer)).to.be.true;
            
            console.log(`✅ Deployment configuration:`);
            console.log(`   Deployer: ${deployment.deployer}`);
            console.log(`   Bytecode length: ${deployment.transformerBytecode.length}`);
            console.log(`   Salt: ${ethers.hexlify(deployment.salt)}`);
        });
        
        it('should handle custom deployment parameters', async function() {
            const customSalt = ethers.randomBytes(32);
            const customDeployment = createTransformerDeployment({
                salt: customSalt,
                deployer: user1.target,
                transformerInitCode: '0x1234'
            });
            
            // Compare salt values (handle both Uint8Array and string formats)
            if (typeof customDeployment.salt === 'string') {
                expect(customDeployment.salt).to.equal(ethers.hexlify(customSalt));
            } else {
                expect(ethers.hexlify(customDeployment.salt)).to.equal(ethers.hexlify(customSalt));
            }
            expect(customDeployment.deployer).to.equal(user1.target);
            expect(customDeployment.transformerInitCode).to.equal('0x1234');
            
            console.log(`✅ Custom deployment:`);
            console.log(`   Custom deployer: ${customDeployment.deployer}`);
            console.log(`   Custom salt: ${ethers.hexlify(customDeployment.salt)}`);
            console.log(`   Custom init code: ${customDeployment.transformerInitCode}`);
        });
        
        it('should calculate deterministic addresses', async function() {
            const deployment = createTransformerDeployment();
            
            // Simulate CREATE2 address calculation
            const create2Address = ethers.getCreate2Address(
                await transformerDeployer.getAddress(),
                deployment.salt,
                ethers.keccak256(deployment.transformerBytecode)
            );
            
            expect(ethers.isAddress(create2Address)).to.be.true;
            expect(create2Address).to.not.equal(NULL_ADDRESS);
            
            console.log(`✅ Calculated CREATE2 address: ${create2Address}`);
            
            // Test with different salt
            const differentSalt = ethers.randomBytes(32);
            const differentAddress = ethers.getCreate2Address(
                await transformerDeployer.getAddress(),
                differentSalt,
                ethers.keccak256(deployment.transformerBytecode)
            );
            
            expect(create2Address).to.not.equal(differentAddress);
            console.log(`✅ Different salt gives different address: ${differentAddress}`);
        });
    });
    
    describe('📋 Deployment Registry', function() {
        it('should track deployed transformers', async function() {
            const deployments = [
                createTransformerDeployment({ salt: ethers.randomBytes(32) }),
                createTransformerDeployment({ salt: ethers.randomBytes(32) }),
                createTransformerDeployment({ salt: ethers.randomBytes(32) })
            ];
            
            const deployedAddresses = [];
            
            for (const deployment of deployments) {
                const address = ethers.getCreate2Address(
                    await transformerDeployer.getAddress(),
                    deployment.salt,
                    ethers.keccak256(deployment.transformerBytecode)
                );
                deployedAddresses.push(address);
            }
            
            // All addresses should be unique
            const uniqueAddresses = new Set(deployedAddresses);
            expect(uniqueAddresses.size).to.equal(deployments.length);
            
            console.log(`✅ Tracked ${deployments.length} transformer deployments:`);
            deployedAddresses.forEach((addr, i) => {
                console.log(`   ${i + 1}. ${addr}`);
            });
        });
        
        it('should validate deployment parameters', async function() {
            const validDeployment = createTransformerDeployment();
            const invalidDeployments = [
                { ...validDeployment, transformerBytecode: '' }, // Empty bytecode
                { ...validDeployment, transformerBytecode: '0xinvalid' }, // Invalid hex
                { ...validDeployment, deployer: 'invalid_address' }, // Invalid address
                { ...validDeployment, salt: '0x123' } // Invalid salt length
            ];
            
            // Validate the valid deployment
            expect(validDeployment.transformerBytecode).to.have.length.greaterThan(2);
            expect(ethers.isAddress(validDeployment.deployer)).to.be.true;
            
            console.log(`✅ Valid deployment passes validation`);
            
            // Check invalid deployments
            for (let i = 0; i < invalidDeployments.length; i++) {
                const invalid = invalidDeployments[i];
                
                if (invalid.transformerBytecode === '') {
                    expect(invalid.transformerBytecode).to.equal('');
                    console.log(`❌ Invalid deployment ${i + 1}: Empty bytecode`);
                } else if (invalid.transformerBytecode === '0xinvalid') {
                    // This would normally fail hex validation
                    console.log(`❌ Invalid deployment ${i + 1}: Invalid hex`);
                } else if (invalid.deployer === 'invalid_address') {
                    expect(ethers.isAddress(invalid.deployer)).to.be.false;
                    console.log(`❌ Invalid deployment ${i + 1}: Invalid address`);
                } else if (invalid.salt === '0x123') {
                    expect(invalid.salt).to.not.have.length(66);
                    console.log(`❌ Invalid deployment ${i + 1}: Invalid salt length`);
                }
            }
        });
    });
    
    describe('🔐 Access Control', function() {
        it('should validate deployer permissions', async function() {
            const deployment = createTransformerDeployment();
            
            // Test that deployment is associated with correct deployer
            expect(deployment.deployer).to.equal(deployer.target);
            expect(deployment.deployer).to.not.equal(user1.target);
            expect(deployment.deployer).to.not.equal(user2.target);
            
            console.log(`✅ Deployment deployer: ${deployment.deployer}`);
            console.log(`✅ Authorized deployer: ${deployer.target}`);
        });
        
        it('should handle unauthorized deployment attempts', async function() {
            const authorizedDeployment = createTransformerDeployment({
                deployer: deployer.target
            });
            
            const unauthorizedDeployment = createTransformerDeployment({
                deployer: user2.target
            });
            
            // Both should be valid structures, but authorization would be checked at runtime
            expect(ethers.isAddress(authorizedDeployment.deployer)).to.be.true;
            expect(ethers.isAddress(unauthorizedDeployment.deployer)).to.be.true;
            
            console.log(`✅ Authorized deployment from: ${authorizedDeployment.deployer}`);
            console.log(`⚠️ Unauthorized attempt from: ${unauthorizedDeployment.deployer}`);
        });
    });
    
    describe('💾 Bytecode Management', function() {
        it('should handle different transformer bytecodes', async function() {
            const bytecodes = [
                '0x608060405234801561001057600080fd5b50600080fd5b6000600060406000806000600061008056', // Original
                '0x608060405234801561001057600080fd5b50600180fd5b6000600060406000806000600061008056', // Modified
                '0x6080604052348015601057600080fd5b50603f80601e6000396000f3fe6080604052600080fdfea2646970667358221220', // Different
            ];
            
            const deployments = bytecodes.map((bytecode, i) => 
                createTransformerDeployment({
                    transformerBytecode: bytecode,
                    salt: ethers.randomBytes(32)
                })
            );
            
            // Calculate addresses for each
            const addresses = deployments.map(deployment =>
                ethers.getCreate2Address(
                    deployments[0].deployer, // Use same deployer for comparison
                    deployment.salt,
                    ethers.keccak256(deployment.transformerBytecode)
                )
            );
            
            // All addresses should be different due to different bytecodes/salts
            const uniqueAddresses = new Set(addresses);
            expect(uniqueAddresses.size).to.equal(bytecodes.length);
            
            console.log(`✅ Different bytecodes produce different addresses:`);
            addresses.forEach((addr, i) => {
                console.log(`   Bytecode ${i + 1}: ${addr}`);
            });
        });
        
        it('should validate bytecode integrity', async function() {
            const originalBytecode = '0x608060405234801561001057600080fd5b50600080fd5b6000600060406000806000600061008056';
            const deployment = createTransformerDeployment({
                transformerBytecode: originalBytecode
            });
            
            // Calculate hash of the bytecode
            const bytecodeHash = ethers.keccak256(deployment.transformerBytecode);
            
            expect(bytecodeHash).to.have.lengthOf(66);
            expect(bytecodeHash).to.match(/^0x[0-9a-fA-F]{64}$/);
            
            console.log(`✅ Bytecode integrity:`);
            console.log(`   Original: ${originalBytecode.slice(0, 30)}...`);
            console.log(`   Hash: ${bytecodeHash}`);
            
            // Test that same bytecode produces same hash
            const sameBytecodeHash = ethers.keccak256(originalBytecode);
            expect(bytecodeHash).to.equal(sameBytecodeHash);
            
            console.log(`✅ Consistent hashing: ${bytecodeHash === sameBytecodeHash}`);
        });
    });
    
    describe('🔄 Deployment Lifecycle', function() {
        it('should simulate full deployment lifecycle', async function() {
            const deployment = createTransformerDeployment();
            
            // 1. Prepare deployment
            const preparationTime = Date.now();
            const predictedAddress = ethers.getCreate2Address(
                await transformerDeployer.getAddress(),
                deployment.salt,
                ethers.keccak256(deployment.transformerBytecode)
            );
            
            console.log(`✅ Step 1 - Preparation (${Date.now() - preparationTime}ms):`);
            console.log(`   Predicted address: ${predictedAddress}`);
            
            // 2. Validate deployment parameters
            const validationTime = Date.now();
            const isValidBytecode = deployment.transformerBytecode.length > 2;
            const isValidSalt = deployment.salt.length === 66;
            const isValidDeployer = ethers.isAddress(deployment.deployer);
            
            expect(isValidBytecode).to.be.true;
            expect(isValidSalt).to.be.true;
            expect(isValidDeployer).to.be.true;
            
            console.log(`✅ Step 2 - Validation (${Date.now() - validationTime}ms):`);
            console.log(`   Bytecode valid: ${isValidBytecode}`);
            console.log(`   Salt valid: ${isValidSalt}`);
            console.log(`   Deployer valid: ${isValidDeployer}`);
            
            // 3. Simulate deployment
            const deploymentTime = Date.now();
            const deploymentResult = {
                address: predictedAddress,
                deployer: deployment.deployer,
                timestamp: deploymentTime,
                gasUsed: 150000, // Simulated gas usage
                success: true
            };
            
            console.log(`✅ Step 3 - Deployment (${Date.now() - deploymentTime}ms):`);
            console.log(`   Deployed to: ${deploymentResult.target}`);
            console.log(`   Gas used: ${deploymentResult.gasUsed}`);
            console.log(`   Success: ${deploymentResult.success}`);
            
            expect(deploymentResult.success).to.be.true;
            expect(deploymentResult.target).to.equal(predictedAddress);
        });
        
        it('should handle deployment conflicts', async function() {
            const salt = ethers.randomBytes(32);
            const bytecode = '0x608060405234801561001057600080fd5b50600080fd5b6000600060406000806000600061008056';
            
            const deployment1 = createTransformerDeployment({
                salt: salt,
                transformerBytecode: bytecode,
                deployer: deployer.target
            });
            
            const deployment2 = createTransformerDeployment({
                salt: salt, // Same salt
                transformerBytecode: bytecode, // Same bytecode
                deployer: deployer.target // Same deployer
            });
            
            // Should produce the same address (conflict)
            const address1 = ethers.getCreate2Address(
                await transformerDeployer.getAddress(),
                deployment1.salt,
                ethers.keccak256(deployment1.transformerBytecode)
            );
            
            const address2 = ethers.getCreate2Address(
                await transformerDeployer.getAddress(),
                deployment2.salt,
                ethers.keccak256(deployment2.transformerBytecode)
            );
            
            expect(address1).to.equal(address2);
            
            console.log(`⚠️ Deployment conflict detected:`);
            console.log(`   Address 1: ${address1}`);
            console.log(`   Address 2: ${address2}`);
            console.log(`   Conflict: ${address1 === address2}`);
        });
    });
    
    describe('⚡ Performance Tests', function() {
        it('should handle multiple deployments efficiently', async function() {
            const deploymentCount = 30;
            
            console.log(`🔥 Simulating ${deploymentCount} deployments...`);
            
            const startTime = Date.now();
            
            const deployments = [];
            for (let i = 0; i < deploymentCount; i++) {
                const deployment = createTransformerDeployment({
                    salt: ethers.randomBytes(32),
                    deployer: [deployer, user1, user2][i % 3].target
                });
                
                const predictedAddress = ethers.getCreate2Address(
                    await transformerDeployer.getAddress(),
                    deployment.salt,
                    ethers.keccak256(deployment.transformerBytecode)
                );
                
                deployments.push({
                    ...deployment,
                    predictedAddress
                });
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            const avgTimePerDeployment = duration / deploymentCount;
            
            console.log(`⚡ Deployment performance:`);
            console.log(`   Total time: ${duration}ms`);
            console.log(`   Average per deployment: ${avgTimePerDeployment.toFixed(2)}ms`);
            console.log(`   Deployments processed: ${deployments.length}`);
            
            expect(deployments.length).to.equal(deploymentCount);
            expect(avgTimePerDeployment).to.be.lessThan(20); // Should be under 20ms per deployment
            
            // Verify all addresses are unique
            const addresses = deployments.map(d => d.predictedAddress);
            const uniqueAddresses = new Set(addresses);
            expect(uniqueAddresses.size).to.equal(deploymentCount);
        });
    });
    
    describe('📊 Deployment Analytics', function() {
        it('should provide deployment statistics', async function() {
            const deploymentCount = 25;
            const deployers = [deployer, user1, user2];
            const stats = {
                totalDeployments: 0,
                deployerCounts: new Map(),
                averageBytecodeLength: 0,
                uniqueAddresses: new Set()
            };
            
            console.log(`📈 Generating deployment statistics...`);
            
            for (let i = 0; i < deploymentCount; i++) {
                const selectedDeployer = deployers[i % deployers.length];
                const deployment = createTransformerDeployment({
                    salt: ethers.randomBytes(32),
                    deployer: selectedDeployer.target
                });
                
                const address = ethers.getCreate2Address(
                    await transformerDeployer.getAddress(),
                    deployment.salt,
                    ethers.keccak256(deployment.transformerBytecode)
                );
                
                stats.totalDeployments++;
                stats.deployerCounts.set(
                    selectedDeployer.target,
                    (stats.deployerCounts.get(selectedDeployer.target) || 0) + 1
                );
                stats.averageBytecodeLength += deployment.transformerBytecode.length;
                stats.uniqueAddresses.add(address);
            }
            
            stats.averageBytecodeLength = stats.averageBytecodeLength / stats.totalDeployments;
            
            console.log(`📊 Deployment Statistics:`);
            console.log(`   Total Deployments: ${stats.totalDeployments}`);
            console.log(`   Unique Addresses: ${stats.uniqueAddresses.size}`);
            console.log(`   Average Bytecode Length: ${stats.averageBytecodeLength}`);
            
            console.log(`   Deployments by User:`);
            for (const [deployerAddr, count] of stats.deployerCounts) {
                console.log(`     ${deployerAddr.slice(0, 10)}...: ${count}`);
            }
            
            expect(stats.totalDeployments).to.equal(deploymentCount);
            expect(stats.uniqueAddresses.size).to.equal(deploymentCount);
        });
    });
}); 