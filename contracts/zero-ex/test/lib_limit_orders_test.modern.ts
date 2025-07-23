import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';

import { getRandomLimitOrder, getRandomRfqOrder } from './utils/orders';

describe('LibLimitOrder Tests - Modern', function() {
    // Extended timeout for blockchain operations
    this.timeout(180000);
    
    let admin: any;
    let testContract: Contract;
    
    before(async function() {
        console.log('🚀 Setting up LibLimitOrder Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [admin] = signers;
        
        console.log('👤 Admin:', admin.address);
        
        await deployContractsAsync();
        
        console.log('✅ LibLimitOrder test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying TestLibNativeOrder contract...');
        
        // Deploy TestLibNativeOrder
        const TestLibNativeOrderFactory = await ethers.getContractFactory('TestLibNativeOrder');
        testContract = await TestLibNativeOrderFactory.deploy();
        await testContract.waitForDeployment();
        console.log(`✅ TestLibNativeOrder: ${await testContract.getAddress()}`);
    }

    describe('getLimitOrderStructHash()', function() {
        it('returns the correct hash', async function() {
            const order = getRandomLimitOrder();
            const structHash = await testContract.getLimitOrderStructHash(order);
            expect(structHash).to.equal(order.getStructHash());
        });
    });

    describe('getRfqOrderStructHash()', function() {
        it('returns the correct hash', async function() {
            const order = getRandomRfqOrder();
            const structHash = await testContract.getRfqOrderStructHash(order);
            expect(structHash).to.equal(order.getStructHash());
        });
    });
}); 