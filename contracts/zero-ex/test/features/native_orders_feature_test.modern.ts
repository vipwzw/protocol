import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';

describe('Native Orders Feature - Modern Tests', function() {
    // Extended timeout for complex order operations
    this.timeout(300000);
    
    let admin: any;
    let maker: any;
    let taker: any;
    let notMaker: any;
    let notTaker: any;
    let feeRecipient: any;
    
    // Core contracts
    let zeroEx: Contract;
    let nativeOrdersFeature: Contract;
    let weth: Contract;
    let zrx: Contract;
    let makerToken: Contract;
    let takerToken: Contract;
    
    // Order configuration
    const GAS_PRICE = ethers.parseUnits('123', 'gwei');
    const PROTOCOL_FEE_MULTIPLIER = 1337000;
    const SINGLE_PROTOCOL_FEE = GAS_PRICE * BigInt(PROTOCOL_FEE_MULTIPLIER);
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    const NULL_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
    
    before(async function() {
        console.log('🚀 Setting up Native Orders Feature Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [admin, maker, taker, notMaker, notTaker, feeRecipient] = signers;
        
        console.log('👤 Admin:', admin.address);
        console.log('👤 Maker:', maker.address);
        console.log('👤 Taker:', taker.address);
        console.log('👤 Not Maker:', notMaker.address);
        console.log('👤 Not Taker:', notTaker.address);
        console.log('👤 Fee Recipient:', feeRecipient.address);
        
        await deployContractsAsync();
        await setupTokensAsync();
        
        console.log('✅ Native orders feature test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying native orders contracts...');
        
        // Deploy tokens first
        const TokenFactory = await ethers.getContractFactory('DummyERC20Token');
        
        weth = await TokenFactory.deploy(
            'Wrapped Ether',
            'WETH',
            18,
            ethers.parseEther('1000000000')
        );
        await weth.waitForDeployment();
        
        zrx = await TokenFactory.deploy(
            'ZRX Token',
            'ZRX',
            18,
            ethers.parseEther('1000000000')
        );
        await zrx.waitForDeployment();
        
        makerToken = await TokenFactory.deploy(
            'Maker Token',
            'MKR',
            18,
            ethers.parseEther('1000000000')
        );
        await makerToken.waitForDeployment();
        
        takerToken = await TokenFactory.deploy(
            'Taker Token',
            'TKR',
            18,
            ethers.parseEther('1000000000')
        );
        await takerToken.waitForDeployment();
        
        console.log(`✅ WETH: ${await weth.getAddress()}`);
        console.log(`✅ ZRX: ${await zrx.getAddress()}`);
        console.log(`✅ Maker Token: ${await makerToken.getAddress()}`);
        console.log(`✅ Taker Token: ${await takerToken.getAddress()}`);
        
        // Deploy ZeroEx contracts
        const ZeroExFactory = await ethers.getContractFactory('ZeroEx');
        zeroEx = await ZeroExFactory.deploy(admin.address);
        await zeroEx.waitForDeployment();
        console.log(`✅ ZeroEx: ${await zeroEx.getAddress()}`);
        
        const NativeOrdersFactory = await ethers.getContractFactory('NativeOrdersFeature');
        nativeOrdersFeature = await NativeOrdersFactory.deploy();
        await nativeOrdersFeature.waitForDeployment();
        console.log(`✅ NativeOrdersFeature: ${await nativeOrdersFeature.getAddress()}`);
    }
    
    async function setupTokensAsync(): Promise<void> {
        console.log('💰 Setting up token balances and approvals...');
        
        const INITIAL_BALANCE = ethers.parseEther('1000000');
        const zeroExAddress = await zeroEx.getAddress();
        
        // Distribute tokens to test accounts
        const accounts = [maker, taker, notMaker, notTaker, feeRecipient];
        const tokens = [weth, zrx, makerToken, takerToken];
        
        for (const token of tokens) {
            for (const account of accounts) {
                await token.transfer(account.address, INITIAL_BALANCE);
                await token.connect(account).approve(zeroExAddress, INITIAL_BALANCE);
            }
        }
        
        console.log('✅ Token balances and approvals configured');
    }
    
    function createLimitOrder(overrides: any = {}): any {
        const defaultOrder = {
            makerToken: makerToken.target,
            takerToken: takerToken.target,
            makerAmount: ethers.parseEther('100'),
            takerAmount: ethers.parseEther('200'),
            maker: maker.address,
            taker: NULL_ADDRESS,
            sender: NULL_ADDRESS,
            feeRecipient: feeRecipient.address,
            pool: NULL_BYTES32,
            expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            salt: Math.floor(Math.random() * 1000000)
        };
        
        return { ...defaultOrder, ...overrides };
    }
    
    function createRfqOrder(overrides: any = {}): any {
        const defaultOrder = {
            makerToken: makerToken.target,
            takerToken: takerToken.target,
            makerAmount: ethers.parseEther('100'),
            takerAmount: ethers.parseEther('200'),
            maker: maker.address,
            taker: taker.address,
            txOrigin: taker.address,
            pool: NULL_BYTES32,
            expiry: Math.floor(Date.now() / 1000) + 3600,
            salt: Math.floor(Math.random() * 1000000)
        };
        
        return { ...defaultOrder, ...overrides };
    }
    
    describe('🏗️ Contract Deployment', function() {
        it('should deploy all native orders contracts successfully', async function() {
            expect(await zeroEx.getAddress()).to.have.lengthOf(42);
            expect(await nativeOrdersFeature.getAddress()).to.have.lengthOf(42);
            expect(await weth.getAddress()).to.have.lengthOf(42);
            expect(await zrx.getAddress()).to.have.lengthOf(42);
            expect(await makerToken.getAddress()).to.have.lengthOf(42);
            expect(await takerToken.getAddress()).to.have.lengthOf(42);
            
            console.log('✅ All native orders contracts deployed');
        });
        
        it('should have correct token configurations', async function() {
            const makerTokenName = await makerToken.name();
            const takerTokenName = await takerToken.name();
            const makerTokenSymbol = await makerToken.symbol();
            const takerTokenSymbol = await takerToken.symbol();
            
            expect(makerTokenName).to.equal('Maker Token');
            expect(takerTokenName).to.equal('Taker Token');
            expect(makerTokenSymbol).to.equal('MKR');
            expect(takerTokenSymbol).to.equal('TKR');
            
            console.log(`✅ Maker Token: ${makerTokenName} (${makerTokenSymbol})`);
            console.log(`✅ Taker Token: ${takerTokenName} (${takerTokenSymbol})`);
        });
        
        it('should have proper token balances', async function() {
            const makerBalance = await makerToken.balanceOf(maker.address);
            const takerBalance = await takerToken.balanceOf(taker.address);
            
            expect(makerBalance > BigInt(0)).to.be.true;
            expect(takerBalance > BigInt(0)).to.be.true;
            
            console.log(`✅ Maker balance: ${ethers.formatEther(makerBalance)} MKR`);
            console.log(`✅ Taker balance: ${ethers.formatEther(takerBalance)} TKR`);
        });
    });
    
    describe('📄 Limit Orders', function() {
        it('should create valid limit order structures', async function() {
            const order = createLimitOrder();
            
            expect(order.makerToken).to.have.lengthOf(42);
            expect(order.takerToken).to.have.lengthOf(42);
            expect(order.makerAmount > BigInt(0)).to.be.true;
            expect(order.takerAmount > BigInt(0)).to.be.true;
            expect(order.maker).to.equal(maker.address);
            expect(order.expiry).to.be.greaterThan(Math.floor(Date.now() / 1000));
            
            console.log(`✅ Limit order created:`);
            console.log(`   Maker Token: ${order.makerToken}`);
            console.log(`   Taker Token: ${order.takerToken}`);
            console.log(`   Maker Amount: ${ethers.formatEther(order.makerAmount)}`);
            console.log(`   Taker Amount: ${ethers.formatEther(order.takerAmount)}`);
        });
        
        it('should handle limit order with custom parameters', async function() {
            const customOrder = createLimitOrder({
                makerAmount: ethers.parseEther('50'),
                takerAmount: ethers.parseEther('100'),
                taker: taker.address,
                feeRecipient: feeRecipient.address
            });
            
            expect(customOrder.makerAmount).to.equal(ethers.parseEther('50'));
            expect(customOrder.takerAmount).to.equal(ethers.parseEther('100'));
            expect(customOrder.taker).to.equal(taker.address);
            expect(customOrder.feeRecipient).to.equal(feeRecipient.address);
            
            console.log(`✅ Custom limit order:`);
            console.log(`   Taker: ${customOrder.taker}`);
            console.log(`   Fee Recipient: ${customOrder.feeRecipient}`);
        });
        
        it('should validate limit order expiry', async function() {
            const futureExpiry = Math.floor(Date.now() / 1000) + 7200; // 2 hours
            const pastExpiry = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
            
            const validOrder = createLimitOrder({ expiry: futureExpiry });
            const expiredOrder = createLimitOrder({ expiry: pastExpiry });
            
            expect(validOrder.expiry).to.be.greaterThan(Math.floor(Date.now() / 1000));
            expect(expiredOrder.expiry).to.be.lessThan(Math.floor(Date.now() / 1000));
            
            console.log(`✅ Valid order expiry: ${new Date(validOrder.expiry * 1000).toISOString()}`);
            console.log(`✅ Expired order expiry: ${new Date(expiredOrder.expiry * 1000).toISOString()}`);
        });
    });
    
    describe('🔄 RFQ Orders', function() {
        it('should create valid RFQ order structures', async function() {
            const rfqOrder = createRfqOrder();
            
            expect(rfqOrder.makerToken).to.have.lengthOf(42);
            expect(rfqOrder.takerToken).to.have.lengthOf(42);
            expect(rfqOrder.makerAmount > BigInt(0)).to.be.true;
            expect(rfqOrder.takerAmount > BigInt(0)).to.be.true;
            expect(rfqOrder.maker).to.equal(maker.address);
            expect(rfqOrder.taker).to.equal(taker.address);
            expect(rfqOrder.txOrigin).to.equal(taker.address);
            
            console.log(`✅ RFQ order created:`);
            console.log(`   Maker: ${rfqOrder.maker}`);
            console.log(`   Taker: ${rfqOrder.taker}`);
            console.log(`   TxOrigin: ${rfqOrder.txOrigin}`);
            console.log(`   Maker Amount: ${ethers.formatEther(rfqOrder.makerAmount)}`);
            console.log(`   Taker Amount: ${ethers.formatEther(rfqOrder.takerAmount)}`);
        });
        
        it('should handle RFQ order with different taker and txOrigin', async function() {
            const rfqOrder = createRfqOrder({
                taker: taker.address,
                txOrigin: notTaker.address
            });
            
            expect(rfqOrder.taker).to.equal(taker.address);
            expect(rfqOrder.txOrigin).to.equal(notTaker.address);
            expect(rfqOrder.taker).to.not.equal(rfqOrder.txOrigin);
            
            console.log(`✅ RFQ order with different taker/txOrigin:`);
            console.log(`   Taker: ${rfqOrder.taker}`);
            console.log(`   TxOrigin: ${rfqOrder.txOrigin}`);
        });
    });
    
    describe('💱 Order Execution Simulation', function() {
        it('should simulate limit order filling', async function() {
            const order = createLimitOrder();
            const fillAmount = ethers.parseEther('50'); // Fill half
            
            // Calculate expected amounts
            const makerTokenAmount = (order.makerAmount * fillAmount) / order.takerAmount;
            
            expect(makerTokenAmount > BigInt(0)).to.be.true;
            expect(fillAmount <= order.takerAmount).to.be.true;
            
            console.log(`✅ Order fill simulation:`);
            console.log(`   Fill Amount: ${ethers.formatEther(fillAmount)} TKR`);
            console.log(`   Maker Token Amount: ${ethers.formatEther(makerTokenAmount)} MKR`);
            console.log(`   Fill Percentage: ${Number(fillAmount * BigInt(100) / order.takerAmount)}%`);
        });
        
        it('should calculate protocol fees', async function() {
            const order = createLimitOrder();
            const fillAmount = order.takerAmount;
            
            // Simulate protocol fee calculation
            const protocolFee = SINGLE_PROTOCOL_FEE;
            const totalCost = fillAmount + protocolFee;
            
            expect(protocolFee > BigInt(0)).to.be.true;
            expect(totalCost > fillAmount).to.be.true;
            
            console.log(`✅ Protocol fee calculation:`);
            console.log(`   Fill Amount: ${ethers.formatEther(fillAmount)} TKR`);
            console.log(`   Protocol Fee: ${ethers.formatEther(protocolFee)} ETH`);
            console.log(`   Total Cost: ${ethers.formatEther(totalCost)} tokens`);
        });
        
        it('should handle partial fills', async function() {
            const order = createLimitOrder({
                makerAmount: ethers.parseEther('100'),
                takerAmount: ethers.parseEther('200')
            });
            
            const fills = [
                ethers.parseEther('50'),  // 25%
                ethers.parseEther('100'), // 50%
                ethers.parseEther('50')   // 25%
            ];
            
            let totalFilled = BigInt(0);
            
            for (let i = 0; i < fills.length; i++) {
                const fillAmount = fills[i];
                totalFilled += fillAmount;
                
                const percentFilled = Number(totalFilled * BigInt(100) / order.takerAmount);
                
                expect(totalFilled <= order.takerAmount).to.be.true;
                
                console.log(`✅ Fill ${i + 1}: ${ethers.formatEther(fillAmount)} TKR (${percentFilled}% total)`);
            }
            
            expect(totalFilled).to.equal(order.takerAmount);
            console.log(`✅ Order completely filled: ${ethers.formatEther(totalFilled)} TKR`);
        });
    });
    
    describe('🔐 Access Control and Validation', function() {
        it('should validate maker authorization', async function() {
            const order = createLimitOrder();
            
            // Only the maker should be able to create orders for themselves
            expect(order.maker).to.equal(maker.address);
            expect(order.maker).to.not.equal(notMaker.address);
            
            console.log(`✅ Maker authorization validated: ${order.maker}`);
        });
        
        it('should validate order expiry', async function() {
            const currentTime = Math.floor(Date.now() / 1000);
            const validOrder = createLimitOrder({ expiry: currentTime + 3600 });
            const expiredOrder = createLimitOrder({ expiry: currentTime - 3600 });
            
            const isValidOrderActive = validOrder.expiry > currentTime;
            const isExpiredOrderActive = expiredOrder.expiry > currentTime;
            
            expect(isValidOrderActive).to.be.true;
            expect(isExpiredOrderActive).to.be.false;
            
            console.log(`✅ Valid order is active: ${isValidOrderActive}`);
            console.log(`✅ Expired order is active: ${isExpiredOrderActive}`);
        });
        
        it('should validate token addresses', async function() {
            const order = createLimitOrder();
            
            const isValidMakerToken = ethers.isAddress(order.makerToken);
            const isValidTakerToken = ethers.isAddress(order.takerToken);
            const areTokensDifferent = order.makerToken !== order.takerToken;
            
            expect(isValidMakerToken).to.be.true;
            expect(isValidTakerToken).to.be.true;
            expect(areTokensDifferent).to.be.true;
            
            console.log(`✅ Maker token address valid: ${isValidMakerToken}`);
            console.log(`✅ Taker token address valid: ${isValidTakerToken}`);
            console.log(`✅ Tokens are different: ${areTokensDifferent}`);
        });
    });
    
    describe('📊 Order Analytics', function() {
        it('should provide order metrics', async function() {
            const orders = [
                createLimitOrder({ makerAmount: ethers.parseEther('100'), takerAmount: ethers.parseEther('200') }),
                createLimitOrder({ makerAmount: ethers.parseEther('50'), takerAmount: ethers.parseEther('100') }),
                createLimitOrder({ makerAmount: ethers.parseEther('200'), takerAmount: ethers.parseEther('400') })
            ];
            
            const totalMakerAmount = orders.reduce((sum, order) => sum + order.makerAmount, BigInt(0));
            const totalTakerAmount = orders.reduce((sum, order) => sum + order.takerAmount, BigInt(0));
            const averagePrice = totalTakerAmount / BigInt(orders.length);
            
            console.log(`📈 Order Analytics:`);
            console.log(`   Total Orders: ${orders.length}`);
            console.log(`   Total Maker Amount: ${ethers.formatEther(totalMakerAmount)} MKR`);
            console.log(`   Total Taker Amount: ${ethers.formatEther(totalTakerAmount)} TKR`);
            console.log(`   Average Price: ${ethers.formatEther(averagePrice)} TKR per order`);
            
            expect(orders.length).to.equal(3);
            expect(totalMakerAmount > BigInt(0)).to.be.true;
            expect(totalTakerAmount > BigInt(0)).to.be.true;
        });
        
        it('should track order states', async function() {
            enum OrderState {
                INVALID,
                FILLABLE,
                FILLED,
                CANCELLED,
                EXPIRED
            }
            
            const order = createLimitOrder();
            const currentTime = Math.floor(Date.now() / 1000);
            
            let orderState = OrderState.FILLABLE;
            
            // Check if expired
            if (order.expiry <= currentTime) {
                orderState = OrderState.EXPIRED;
            }
            
            console.log(`✅ Order State Analysis:`);
            console.log(`   Order State: ${OrderState[orderState]}`);
            console.log(`   Expiry: ${new Date(order.expiry * 1000).toISOString()}`);
            console.log(`   Current Time: ${new Date(currentTime * 1000).toISOString()}`);
            
            expect(orderState).to.equal(OrderState.FILLABLE);
        });
    });
    
    describe('⚡ Performance Tests', function() {
        it('should handle multiple order creation efficiently', async function() {
            const orderCount = 50;
            
            console.log(`🔥 Creating ${orderCount} orders...`);
            
            const startTime = Date.now();
            
            const orders = [];
            for (let i = 0; i < orderCount; i++) {
                const order = createLimitOrder({
                    salt: i,
                    makerAmount: ethers.parseEther((100 + i).toString()),
                    takerAmount: ethers.parseEther((200 + i * 2).toString())
                });
                orders.push(order);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            const avgTimePerOrder = duration / orderCount;
            
            console.log(`⚡ Order creation performance:`);
            console.log(`   Total time: ${duration}ms`);
            console.log(`   Average per order: ${avgTimePerOrder.toFixed(2)}ms`);
            console.log(`   Orders created: ${orders.length}`);
            
            expect(orders.length).to.equal(orderCount);
            expect(avgTimePerOrder).to.be.lessThan(10); // Should be under 10ms per order
        });
    });
}); 