import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { randomBytes } from 'crypto';

// Import chai-as-promised for proper async error handling
import 'chai-as-promised';

describe('Transformer (Base) - Modern Tests', function() {
    // Extended timeout for transformer operations
    this.timeout(180000);
    
    let deployer: any;
    let notDeployer: any;
    let delegateCaller: any;
    let transformer: any;
    
    before(async function() {
        console.log('🚀 Setting up TransformerBase Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [deployer, notDeployer] = signers;
        
        console.log('👤 Deployer:', deployer.address);
        console.log('👤 Not Deployer:', notDeployer.address);
        
        await deployContractsAsync();
        
        console.log('✅ TransformerBase test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying TransformerBase contracts...');
        
        // Deploy TestDelegateCaller
        const DelegateCallerFactory = await ethers.getContractFactory('TestDelegateCaller');
        delegateCaller = await DelegateCallerFactory.deploy();
        await delegateCaller.waitForDeployment();
        console.log(`✅ TestDelegateCaller: ${await delegateCaller.getAddress()}`);
        
        // Deploy TestTransformerBase
        const TransformerBaseFactory = await ethers.getContractFactory('TestTransformerBase');
        transformer = await TransformerBaseFactory.connect(deployer).deploy();
        await transformer.waitForDeployment();
        console.log(`✅ TestTransformerBase: ${await transformer.getAddress()}`);
    }

    function generateRandomAddress(): string {
        return '0x' + randomBytes(20).toString('hex');
    }

    describe('die()', function() {
        it('cannot be called by non-deployer', async function() {
            const recipient = generateRandomAddress();
            
            await expect(
                transformer.connect(notDeployer).die(recipient)
            ).to.be.rejectedWith('OnlyCallableByDeployerError');
        });

        it('cannot be called outside of its own context', async function() {
            const recipient = generateRandomAddress();
            
            // Get the call data for die() method
            const iface = new ethers.Interface([
                "function die(address recipient)"
            ]);
            const callData = iface.encodeFunctionData("die", [recipient]);
            
            await expect(
                delegateCaller.connect(deployer).executeDelegateCall(
                    await transformer.getAddress(),
                    callData
                )
            ).to.be.rejectedWith('InvalidExecutionContextError');
        });

        it('destroys the transformer', async function() {
            const recipient = generateRandomAddress();
            
            // Call die() method
            await transformer.connect(deployer).die(recipient);
            
            // Check that the contract code is now empty
            const code = await ethers.provider.getCode(await transformer.getAddress());
            expect(code).to.equal('0x');
            
            console.log('✅ Transformer successfully destroyed');
        });
    });
}); 