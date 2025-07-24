import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { randomBytes } from 'crypto';
import { LimitOrder, RfqOrder } from '@0x/protocol-utils';
import { BigNumber } from '@0x/utils';

// 内联的工具函数，替代 utils/orders 中的函数
function getRandomLimitOrder(fields: Partial<any> = {}): any {
    const now = Math.floor(Date.now() / 1000);
    return new LimitOrder({
        makerToken: '0x' + randomBytes(20).toString('hex'),
        takerToken: '0x' + randomBytes(20).toString('hex'), 
        makerAmount: new BigNumber(ethers.parseEther('100').toString()),
        takerAmount: new BigNumber(ethers.parseEther('1').toString()),
        takerTokenFeeAmount: new BigNumber(ethers.parseEther('0.01').toString()),
        maker: '0x' + randomBytes(20).toString('hex'),
        taker: '0x' + randomBytes(20).toString('hex'),
        sender: '0x' + randomBytes(20).toString('hex'),
        feeRecipient: '0x' + randomBytes(20).toString('hex'),
        pool: '0x' + randomBytes(32).toString('hex'),
        expiry: new BigNumber(now + 3600), // 1 hour from now
        salt: new BigNumber('0x' + randomBytes(32).toString('hex')),
        ...fields,
    });
}

function getRandomRfqOrder(fields: Partial<any> = {}): any {
    const now = Math.floor(Date.now() / 1000);
    return new RfqOrder({
        makerToken: '0x' + randomBytes(20).toString('hex'),
        takerToken: '0x' + randomBytes(20).toString('hex'),
        makerAmount: new BigNumber(ethers.parseEther('100').toString()),
        takerAmount: new BigNumber(ethers.parseEther('1').toString()),
        maker: '0x' + randomBytes(20).toString('hex'),
        txOrigin: '0x' + randomBytes(20).toString('hex'),
        pool: '0x' + randomBytes(32).toString('hex'),
        expiry: new BigNumber(now + 3600), // 1 hour from now
        salt: new BigNumber('0x' + randomBytes(32).toString('hex')),
        ...fields,
    });
}

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

    // Helper function to convert BigNumber fields to ethers-compatible format
    function convertOrderForContract(order: any): any {
        const converted = { ...order };
        // Convert BigNumber fields to strings for ethers v6 compatibility
        if (converted.makerAmount && typeof converted.makerAmount.toString === 'function') {
            converted.makerAmount = converted.makerAmount.toString();
        }
        if (converted.takerAmount && typeof converted.takerAmount.toString === 'function') {
            converted.takerAmount = converted.takerAmount.toString();
        }
        if (converted.takerTokenFeeAmount && typeof converted.takerTokenFeeAmount.toString === 'function') {
            converted.takerTokenFeeAmount = converted.takerTokenFeeAmount.toString();
        }
        if (converted.expiry && typeof converted.expiry.toString === 'function') {
            converted.expiry = converted.expiry.toString();
        }
        if (converted.salt && typeof converted.salt.toString === 'function') {
            converted.salt = converted.salt.toString();
        }
        return converted;
    }

    describe('getLimitOrderStructHash()', function() {
        it('returns the correct hash', async function() {
            const order = getRandomLimitOrder();
            const convertedOrder = convertOrderForContract(order);
            const structHash = await testContract.getLimitOrderStructHash(convertedOrder);
            expect(structHash).to.equal(order.getStructHash());
            
            console.log('✅ Limit order struct hash verified');
        });
    });

    describe('getRfqOrderStructHash()', function() {
        it('returns the correct hash', async function() {
            const order = getRandomRfqOrder();
            const convertedOrder = convertOrderForContract(order);
            const structHash = await testContract.getRfqOrderStructHash(convertedOrder);
            expect(structHash).to.equal(order.getStructHash());
            
            console.log('✅ RFQ order struct hash verified');
        });
    });
}); 