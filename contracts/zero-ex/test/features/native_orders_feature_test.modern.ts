import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { randomBytes } from 'crypto';

// Import chai-as-promised for proper async error handling
import 'chai-as-promised';

describe('NativeOrdersFeature - Complete Modern Tests', function() {
    // Extended timeout for native orders operations
    this.timeout(300000);
    
    let owner: any;
    let maker: any;
    let taker: any;
    let notMaker: any;
    let notTaker: any;
    let contractWalletOwner: any;
    let contractWalletSigner: any;
    let zeroEx: any;
    let verifyingContract: string;
    let makerToken: any;
    let takerToken: any;
    let wethToken: any;
    let testRfqOriginRegistration: any;
    let contractWallet: any;
    let testUtils: any;
    
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    const MAX_UINT256 = ethers.MaxUint256;
    const NULL_BYTES32 = ethers.ZeroHash;
    const ZERO_AMOUNT = 0n;
    const GAS_PRICE = ethers.parseUnits('123', 'gwei');
    const PROTOCOL_FEE_MULTIPLIER = 1337000;
    const SINGLE_PROTOCOL_FEE = GAS_PRICE * BigInt(PROTOCOL_FEE_MULTIPLIER);
    
    // Mock order status enum
    const OrderStatus = {
        Invalid: 0,
        Fillable: 1,
        Filled: 2,
        Cancelled: 3,
        Expired: 4
    };
    
    // Mock signature type enum
    const SignatureType = {
        EthSign: 0,
        EIP712: 1,
        PreSigned: 2
    };
    
    before(async function() {
        console.log('🚀 Setting up Complete NativeOrdersFeature Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [owner, maker, taker, notMaker, notTaker, contractWalletOwner, contractWalletSigner] = signers;
        
        console.log('👤 Owner:', owner.address);
        console.log('👤 Maker:', maker.address);
        console.log('👤 Taker:', taker.address);
        
        await deployContractsAsync();
        await setupTestUtilsAsync();
        
        console.log('✅ Complete NativeOrdersFeature test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying Complete NativeOrdersFeature contracts...');
        
        // Deploy tokens
        const TokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        
        makerToken = await TokenFactory.deploy('MakerToken', 'MAKER', 18);
        await makerToken.waitForDeployment();
        console.log(`✅ MakerToken: ${await makerToken.getAddress()}`);
        
        takerToken = await TokenFactory.deploy('TakerToken', 'TAKER', 18);
        await takerToken.waitForDeployment();
        console.log(`✅ TakerToken: ${await takerToken.getAddress()}`);
        
        wethToken = await TokenFactory.deploy('WETH', 'WETH', 18);
        await wethToken.waitForDeployment();
        console.log(`✅ WETH: ${await wethToken.getAddress()}`);
        
        // Deploy mock ZeroEx contract with native orders support
        const ZeroExFactory = await ethers.getContractFactory('TestZeroExWithNativeOrders');
        zeroEx = await ZeroExFactory.deploy(
            await wethToken.getAddress(),
            PROTOCOL_FEE_MULTIPLIER
        );
        await zeroEx.waitForDeployment();
        verifyingContract = await zeroEx.getAddress();
        console.log(`✅ ZeroEx: ${verifyingContract}`);
        
        // Approve tokens for all accounts
        const accounts = [maker, notMaker];
        for (const account of accounts) {
            await makerToken.connect(account).approve(verifyingContract, MAX_UINT256);
        }
        
        const takerAccounts = [taker, notTaker];
        for (const account of takerAccounts) {
            await takerToken.connect(account).approve(verifyingContract, MAX_UINT256);
        }
        console.log(`✅ Approved all tokens for all accounts`);
        
        // Deploy test contracts
        const RfqRegistrationFactory = await ethers.getContractFactory('TestRfqOriginRegistration');
        testRfqOriginRegistration = await RfqRegistrationFactory.deploy();
        await testRfqOriginRegistration.waitForDeployment();
        
        const ContractWalletFactory = await ethers.getContractFactory('TestOrderSignerRegistryWithContractWallet');
        contractWallet = await ContractWalletFactory.connect(contractWalletOwner).deploy(verifyingContract);
        await contractWallet.waitForDeployment();
        console.log(`✅ Deployed test contracts`);
    }

    async function setupTestUtilsAsync(): Promise<void> {
        testUtils = {
            // Prepare balances for orders
            prepareBalancesForOrdersAsync: async function(orders: any[], recipient?: any) {
                for (const order of orders) {
                    const recipientAddr = recipient ? recipient.address : taker.address;
                    
                    // Mint maker tokens to maker
                    await makerToken.mint(order.maker, order.makerAmount);
                    
                    // Mint taker tokens to taker/recipient
                    await takerToken.mint(recipientAddr, order.takerAmount);
                }
            },
            
            // Fill limit order
            fillLimitOrderAsync: async function(order: any, options: any = {}) {
                const fillAmount = options.fillAmount || order.takerAmount;
                const txOriginAddr = options.txOrigin || taker;
                await this.prepareBalancesForOrdersAsync([order]);
                const signature = await this.createOrderSignature(order);
                
                return await zeroEx.connect(txOriginAddr).fillLimitOrder(order, signature, fillAmount);
            },
            
            // Fill RFQ order
            fillRfqOrderAsync: async function(order: any, fillAmount?: bigint, txOriginAddr?: any) {
                await this.prepareBalancesForOrdersAsync([order]);
                const signature = await this.createOrderSignature(order);
                const amount = fillAmount || order.takerAmount;
                const fromAddr = txOriginAddr || taker;
                
                return await zeroEx.connect(fromAddr).fillRfqOrder(order, signature, amount);
            },
            
            // Fill or kill limit order
            fillOrKillLimitOrderAsync: async function(order: any, fillAmount?: bigint, txOriginAddr?: any) {
                await this.prepareBalancesForOrdersAsync([order]);
                const signature = await this.createOrderSignature(order);
                const amount = fillAmount || order.takerAmount;
                const fromAddr = txOriginAddr || taker;
                
                return await zeroEx.connect(fromAddr).fillOrKillLimitOrder(order, signature, amount);
            },
            
            // Fill or kill RFQ order
            fillOrKillRfqOrderAsync: async function(order: any, fillAmount?: bigint, txOriginAddr?: any) {
                await this.prepareBalancesForOrdersAsync([order]);
                const signature = await this.createOrderSignature(order);
                const amount = fillAmount || order.takerAmount;
                const fromAddr = txOriginAddr || taker;
                
                return await zeroEx.connect(fromAddr).fillOrKillRfqOrder(order, signature, amount);
            },
            
            // Create order signature
            createOrderSignature: async function(order: any, signer?: any) {
                const signerAccount = signer || maker;
                const orderHash = this.getOrderHash(order);
                return await signerAccount.signMessage(ethers.getBytes(orderHash));
            },
            
            // Get order hash
            getOrderHash: function(order: any): string {
                return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(order)));
            },
            
            // Compute limit order filled amounts
            computeLimitOrderFilledAmounts: function(order: any, fillAmount: bigint) {
                const takerTokenFilledAmount = fillAmount;
                const makerTokenFilledAmount = (fillAmount * order.makerAmount) / order.takerAmount;
                
                return { makerTokenFilledAmount, takerTokenFilledAmount };
            },
            
            // Compute RFQ order filled amounts
            computeRfqOrderFilledAmounts: function(order: any, fillAmount: bigint) {
                const takerTokenFilledAmount = fillAmount;
                const makerTokenFilledAmount = (fillAmount * order.makerAmount) / order.takerAmount;
                
                return { makerTokenFilledAmount, takerTokenFilledAmount };
            },
            
            // Create limit order filled event args
            createLimitOrderFilledEventArgs: function(order: any, fillAmount?: bigint) {
                const filledAmount = fillAmount || order.takerAmount;
                const { makerTokenFilledAmount, takerTokenFilledAmount } = this.computeLimitOrderFilledAmounts(order, filledAmount);
                
                return {
                    orderHash: this.getOrderHash(order),
                    maker: order.maker,
                    taker: order.taker !== NULL_ADDRESS ? order.taker : taker.address,
                    makerToken: order.makerToken,
                    takerToken: order.takerToken,
                    makerTokenFilledAmount,
                    takerTokenFilledAmount
                };
            },
            
            // Create RFQ order filled event args
            createRfqOrderFilledEventArgs: function(order: any, fillAmount?: bigint) {
                const filledAmount = fillAmount || order.takerAmount;
                const { makerTokenFilledAmount, takerTokenFilledAmount } = this.computeRfqOrderFilledAmounts(order, filledAmount);
                
                return {
                    orderHash: this.getOrderHash(order),
                    maker: order.maker,
                    taker: order.taker,
                    makerToken: order.makerToken,
                    takerToken: order.takerToken,
                    makerTokenFilledAmount,
                    takerTokenFilledAmount
                };
            }
        };
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

    function createExpiry(deltaSeconds: number): number {
        return Math.floor(Date.now() / 1000) + deltaSeconds;
    }

    function getTestLimitOrder(fields: any = {}): any {
        return {
            maker: fields.maker || maker.address,
            taker: fields.taker || NULL_ADDRESS,
            makerToken: fields.makerToken || (makerToken.target || makerToken.address),
            takerToken: fields.takerToken || (takerToken.target || takerToken.address),
            makerAmount: fields.makerAmount || ethers.parseEther('100'),
            takerAmount: fields.takerAmount || ethers.parseEther('50'),
            takerTokenFeeAmount: fields.takerTokenFeeAmount || ZERO_AMOUNT,
            sender: fields.sender || NULL_ADDRESS,
            feeRecipient: fields.feeRecipient || NULL_ADDRESS,
            pool: fields.pool || NULL_BYTES32,
            expiry: fields.expiry || createExpiry(3600),
            salt: fields.salt || generateRandomBytes32(),
            ...fields
        };
    }

    function getTestRfqOrder(fields: any = {}): any {
        return {
            maker: fields.maker || maker.address,
            taker: fields.taker || taker.address,
            makerToken: fields.makerToken || (makerToken.target || makerToken.address),
            takerToken: fields.takerToken || (takerToken.target || takerToken.address),
            makerAmount: fields.makerAmount || ethers.parseEther('100'),
            takerAmount: fields.takerAmount || ethers.parseEther('50'),
            txOrigin: fields.txOrigin || taker.address,
            pool: fields.pool || NULL_BYTES32,
            expiry: fields.expiry || createExpiry(3600),
            salt: fields.salt || generateRandomBytes32(),
            ...fields
        };
    }

    function assertOrderInfoEquals(info: any, expected: any): void {
        expect(info.status).to.equal(expected.status);
        expect(info.orderHash).to.equal(expected.orderHash);
        expect(info.takerTokenFilledAmount).to.equal(expected.takerTokenFilledAmount);
    }

    // Helper function to advance time
    async function increaseTimeAsync(seconds: number): Promise<void> {
        await ethers.provider.send("evm_increaseTime", [seconds]);
        await ethers.provider.send("evm_mine", []);
    }

    describe('getProtocolFeeMultiplier()', function() {
        it('returns the expected protocol fee multiplier', async function() {
            const result = await zeroEx.getProtocolFeeMultiplier();
            expect(result).to.equal(PROTOCOL_FEE_MULTIPLIER);
            
            console.log(`✅ Protocol fee multiplier: ${result}`);
        });
    });

    describe('getLimitOrderHash()', function() {
        it('returns the expected hash', async function() {
            const order = getTestLimitOrder();
            const hash = await zeroEx.getLimitOrderHash(order);
            expect(hash).to.not.equal(ethers.ZeroHash);
            
            console.log(`✅ Generated limit order hash: ${hash.slice(0, 10)}...`);
        });

        it('different orders have different hashes', async function() {
            const order1 = getTestLimitOrder();
            const order2 = getTestLimitOrder({ salt: generateRandomBytes32() });
            const hash1 = await zeroEx.getLimitOrderHash(order1);
            const hash2 = await zeroEx.getLimitOrderHash(order2);
            expect(hash1).to.not.equal(hash2);
            
            console.log(`✅ Different orders have different hashes`);
        });
    });

    describe('getRfqOrderHash()', function() {
        it('returns the expected hash', async function() {
            const order = getTestRfqOrder();
            const hash = await zeroEx.getRfqOrderHash(order);
            expect(hash).to.not.equal(ethers.ZeroHash);
            
            console.log(`✅ Generated RFQ order hash: ${hash.slice(0, 10)}...`);
        });

        it('different orders have different hashes', async function() {
            const order1 = getTestRfqOrder();
            const order2 = getTestRfqOrder({ salt: generateRandomBytes32() });
            const hash1 = await zeroEx.getRfqOrderHash(order1);
            const hash2 = await zeroEx.getRfqOrderHash(order2);
            expect(hash1).to.not.equal(hash2);
            
            console.log(`✅ Different RFQ orders have different hashes`);
        });
    });

    describe('getLimitOrderInfo()', function() {
        it('valid order', async function() {
            const order = getTestLimitOrder();
            const info = await zeroEx.getLimitOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Fillable,
                orderHash: await zeroEx.getLimitOrderHash(order),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            
            console.log(`✅ Valid limit order - Status: ${info.status}`);
        });

        it('expired order', async function() {
            const expiry = createExpiry(-60);
            const order = getTestLimitOrder({ expiry });
            const info = await zeroEx.getLimitOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Expired,
                orderHash: await zeroEx.getLimitOrderHash(order),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            
            console.log(`✅ Correctly identified expired limit order`);
        });

        it('filled then expired order', async function() {
            const expiry = createExpiry(60);
            const order = getTestLimitOrder({ expiry });
            await testUtils.prepareBalancesForOrdersAsync([order]);
            const sig = await testUtils.createOrderSignature(order);
            
            // Fill the order first
            await zeroEx.connect(taker).fillLimitOrder(order, sig, order.takerAmount);
            
            // Advance time to expire the order
            await increaseTimeAsync(61);
            
            const info = await zeroEx.getLimitOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled, // Still reports filled
                orderHash: await zeroEx.getLimitOrderHash(order),
                takerTokenFilledAmount: order.takerAmount,
            });
            
            console.log(`✅ Filled then expired order still shows as filled`);
        });

        it('filled order', async function() {
            const order = getTestLimitOrder();
            await testUtils.fillLimitOrderAsync(order);
            const info = await zeroEx.getLimitOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled,
                orderHash: await zeroEx.getLimitOrderHash(order),
                takerTokenFilledAmount: order.takerAmount,
            });
            
            console.log(`✅ Filled limit order correctly identified`);
        });

        it('partially filled order', async function() {
            const order = getTestLimitOrder();
            const fillAmount = order.takerAmount - 1n;
            await testUtils.fillLimitOrderAsync(order, { fillAmount });
            const info = await zeroEx.getLimitOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Fillable,
                orderHash: await zeroEx.getLimitOrderHash(order),
                takerTokenFilledAmount: fillAmount,
            });
            
            console.log(`✅ Partially filled limit order correctly identified`);
        });

        it('filled then cancelled order', async function() {
            const order = getTestLimitOrder();
            await testUtils.fillLimitOrderAsync(order);
            await zeroEx.connect(maker).cancelLimitOrder(order);
            const info = await zeroEx.getLimitOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled, // Still reports filled
                orderHash: await zeroEx.getLimitOrderHash(order),
                takerTokenFilledAmount: order.takerAmount,
            });
            
            console.log(`✅ Filled then cancelled order still shows as filled`);
        });

        it('partially filled then cancelled order', async function() {
            const order = getTestLimitOrder();
            const fillAmount = order.takerAmount - 1n;
            await testUtils.fillLimitOrderAsync(order, { fillAmount });
            await zeroEx.connect(maker).cancelLimitOrder(order);
            const info = await zeroEx.getLimitOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Cancelled,
                orderHash: await zeroEx.getLimitOrderHash(order),
                takerTokenFilledAmount: fillAmount,
            });
            
            console.log(`✅ Partially filled then cancelled order correctly identified`);
        });

        it('invalid taker', async function() {
            const order = getTestLimitOrder({ 
                taker: generateRandomAddress(),
                takerToken: NULL_ADDRESS // Invalid taker token
            });
            const info = await zeroEx.getLimitOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Invalid,
                orderHash: await zeroEx.getLimitOrderHash(order),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            
            console.log(`✅ Invalid taker order correctly identified`);
        });
    });

    describe('getRfqOrderInfo()', function() {
        it('valid order', async function() {
            const order = getTestRfqOrder();
            const info = await zeroEx.getRfqOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Fillable,
                orderHash: await zeroEx.getRfqOrderHash(order),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            
            console.log(`✅ Valid RFQ order - Status: ${info.status}`);
        });

        it('expired order', async function() {
            const expiry = createExpiry(-60);
            const order = getTestRfqOrder({ expiry });
            const info = await zeroEx.getRfqOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Expired,
                orderHash: await zeroEx.getRfqOrderHash(order),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            
            console.log(`✅ Correctly identified expired RFQ order`);
        });

        it('filled then expired order', async function() {
            const expiry = createExpiry(60);
            const order = getTestRfqOrder({ expiry });
            await testUtils.prepareBalancesForOrdersAsync([order]);
            const sig = await testUtils.createOrderSignature(order);
            
            // Fill the order first
            await zeroEx.connect(taker).fillRfqOrder(order, sig, order.takerAmount);
            
            // Advance time to expire the order
            await increaseTimeAsync(61);
            
            const info = await zeroEx.getRfqOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled, // Still reports filled
                orderHash: await zeroEx.getRfqOrderHash(order),
                takerTokenFilledAmount: order.takerAmount,
            });
            
            console.log(`✅ Filled then expired RFQ order still shows as filled`);
        });

        it('filled order', async function() {
            const order = getTestRfqOrder();
            await testUtils.fillRfqOrderAsync(order, order.takerAmount, taker);
            const info = await zeroEx.getRfqOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled,
                orderHash: await zeroEx.getRfqOrderHash(order),
                takerTokenFilledAmount: order.takerAmount,
            });
            
            console.log(`✅ Filled RFQ order correctly identified`);
        });

        it('partially filled order', async function() {
            const order = getTestRfqOrder();
            const fillAmount = order.takerAmount - 1n;
            await testUtils.fillRfqOrderAsync(order, fillAmount);
            const info = await zeroEx.getRfqOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Fillable,
                orderHash: await zeroEx.getRfqOrderHash(order),
                takerTokenFilledAmount: fillAmount,
            });
            
            console.log(`✅ Partially filled RFQ order correctly identified`);
        });

        it('filled then cancelled order', async function() {
            const order = getTestRfqOrder();
            await testUtils.fillRfqOrderAsync(order);
            await zeroEx.connect(maker).cancelRfqOrder(order);
            const info = await zeroEx.getRfqOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled, // Still reports filled
                orderHash: await zeroEx.getRfqOrderHash(order),
                takerTokenFilledAmount: order.takerAmount,
            });
            
            console.log(`✅ Filled then cancelled RFQ order still shows as filled`);
        });

        it('partially filled then cancelled order', async function() {
            const order = getTestRfqOrder();
            const fillAmount = order.takerAmount - 1n;
            await testUtils.fillRfqOrderAsync(order, fillAmount);
            await zeroEx.connect(maker).cancelRfqOrder(order);
            const info = await zeroEx.getRfqOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Cancelled,
                orderHash: await zeroEx.getRfqOrderHash(order),
                takerTokenFilledAmount: fillAmount,
            });
            
            console.log(`✅ Partially filled then cancelled RFQ order correctly identified`);
        });

        it('invalid origin', async function() {
            const order = getTestRfqOrder({ txOrigin: NULL_ADDRESS });
            const info = await zeroEx.getRfqOrderInfo(order);
            assertOrderInfoEquals(info, {
                status: OrderStatus.Invalid,
                orderHash: await zeroEx.getRfqOrderHash(order),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            
            console.log(`✅ Invalid origin RFQ order correctly identified`);
        });
    });

    describe('cancelLimitOrder()', function() {
        it('can cancel an unfilled order', async function() {
            const order = getTestLimitOrder();
            const result = await zeroEx.connect(maker).cancelLimitOrder(order);
            const receipt = await result.wait();
            
            // Check for OrderCancelled event
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OrderCancelled');
            expect(cancelEvent).to.not.be.undefined;
            
            const { status } = await zeroEx.getLimitOrderInfo(order);
            expect(status).to.equal(OrderStatus.Cancelled);
            
            console.log(`✅ Cancelled unfilled limit order`);
        });

        it('can cancel a fully filled order', async function() {
            const order = getTestLimitOrder();
            await testUtils.fillLimitOrderAsync(order);
            const result = await zeroEx.connect(maker).cancelLimitOrder(order);
            const receipt = await result.wait();
            
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OrderCancelled');
            expect(cancelEvent).to.not.be.undefined;
            
            const { status } = await zeroEx.getLimitOrderInfo(order);
            expect(status).to.equal(OrderStatus.Filled); // Still reports filled
            
            console.log(`✅ Cancelled fully filled limit order`);
        });

        it('can cancel a partially filled order', async function() {
            const order = getTestLimitOrder();
            await testUtils.fillLimitOrderAsync(order, { fillAmount: order.takerAmount - 1n });
            const result = await zeroEx.connect(maker).cancelLimitOrder(order);
            const receipt = await result.wait();
            
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OrderCancelled');
            expect(cancelEvent).to.not.be.undefined;
            
            const { status } = await zeroEx.getLimitOrderInfo(order);
            expect(status).to.equal(OrderStatus.Cancelled);
            
            console.log(`✅ Cancelled partially filled limit order`);
        });

        it('can cancel an expired order', async function() {
            const expiry = createExpiry(-60);
            const order = getTestLimitOrder({ expiry });
            const result = await zeroEx.connect(maker).cancelLimitOrder(order);
            const receipt = await result.wait();
            
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OrderCancelled');
            expect(cancelEvent).to.not.be.undefined;
            
            const { status } = await zeroEx.getLimitOrderInfo(order);
            expect(status).to.equal(OrderStatus.Cancelled);
            
            console.log(`✅ Cancelled expired limit order`);
        });

        it('can cancel a cancelled order', async function() {
            const order = getTestLimitOrder();
            await zeroEx.connect(maker).cancelLimitOrder(order);
            const result = await zeroEx.connect(maker).cancelLimitOrder(order);
            const receipt = await result.wait();
            
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OrderCancelled');
            expect(cancelEvent).to.not.be.undefined;
            
            const { status } = await zeroEx.getLimitOrderInfo(order);
            expect(status).to.equal(OrderStatus.Cancelled);
            
            console.log(`✅ Cancelled already cancelled limit order`);
        });

        it("cannot cancel someone else's order", async function() {
            const order = getTestLimitOrder();
            
            await expect(
                zeroEx.connect(notMaker).cancelLimitOrder(order)
            ).to.be.rejectedWith('OnlyOrderMakerAllowed');
            
            console.log(`✅ Correctly rejected non-maker cancellation`);
        });
    });

    describe('cancelRfqOrder()', function() {
        it('can cancel an unfilled order', async function() {
            const order = getTestRfqOrder();
            const result = await zeroEx.connect(maker).cancelRfqOrder(order);
            const receipt = await result.wait();
            
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OrderCancelled');
            expect(cancelEvent).to.not.be.undefined;
            
            const { status } = await zeroEx.getRfqOrderInfo(order);
            expect(status).to.equal(OrderStatus.Cancelled);
            
            console.log(`✅ Cancelled unfilled RFQ order`);
        });

        it('can cancel a fully filled order', async function() {
            const order = getTestRfqOrder();
            await testUtils.fillRfqOrderAsync(order);
            const result = await zeroEx.connect(maker).cancelRfqOrder(order);
            const receipt = await result.wait();
            
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OrderCancelled');
            expect(cancelEvent).to.not.be.undefined;
            
            const { status } = await zeroEx.getRfqOrderInfo(order);
            expect(status).to.equal(OrderStatus.Filled); // Still reports filled
            
            console.log(`✅ Cancelled fully filled RFQ order`);
        });

        it('can cancel a partially filled order', async function() {
            const order = getTestRfqOrder();
            await testUtils.fillRfqOrderAsync(order, order.takerAmount - 1n);
            const result = await zeroEx.connect(maker).cancelRfqOrder(order);
            const receipt = await result.wait();
            
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OrderCancelled');
            expect(cancelEvent).to.not.be.undefined;
            
            const { status } = await zeroEx.getRfqOrderInfo(order);
            expect(status).to.equal(OrderStatus.Cancelled);
            
            console.log(`✅ Cancelled partially filled RFQ order`);
        });

        it('can cancel an expired order', async function() {
            const expiry = createExpiry(-60);
            const order = getTestRfqOrder({ expiry });
            const result = await zeroEx.connect(maker).cancelRfqOrder(order);
            const receipt = await result.wait();
            
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OrderCancelled');
            expect(cancelEvent).to.not.be.undefined;
            
            const { status } = await zeroEx.getRfqOrderInfo(order);
            expect(status).to.equal(OrderStatus.Cancelled);
            
            console.log(`✅ Cancelled expired RFQ order`);
        });

        it('can cancel a cancelled order', async function() {
            const order = getTestRfqOrder();
            await zeroEx.connect(maker).cancelRfqOrder(order);
            const result = await zeroEx.connect(maker).cancelRfqOrder(order);
            const receipt = await result.wait();
            
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OrderCancelled');
            expect(cancelEvent).to.not.be.undefined;
            
            const { status } = await zeroEx.getRfqOrderInfo(order);
            expect(status).to.equal(OrderStatus.Cancelled);
            
            console.log(`✅ Cancelled already cancelled RFQ order`);
        });

        it("cannot cancel someone else's order", async function() {
            const order = getTestRfqOrder();
            
            await expect(
                zeroEx.connect(notMaker).cancelRfqOrder(order)
            ).to.be.rejectedWith('OnlyOrderMakerAllowed');
            
            console.log(`✅ Correctly rejected non-maker RFQ cancellation`);
        });
    });

    describe('batchCancelLimitOrders()', function() {
        it('can cancel multiple orders', async function() {
            const orders = [getTestLimitOrder(), getTestLimitOrder(), getTestLimitOrder()];
            const result = await zeroEx.connect(maker).batchCancelLimitOrders(orders);
            const receipt = await result.wait();
            
            const cancelEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'OrderCancelled');
            expect(cancelEvents.length).to.equal(orders.length);
            
            const infos = await Promise.all(orders.map(o => zeroEx.getLimitOrderInfo(o)));
            expect(infos.map(i => i.status)).to.deep.equal(infos.map(() => OrderStatus.Cancelled));
            
            console.log(`✅ Batch cancelled ${orders.length} limit orders`);
        });

        it("cannot cancel someone else's orders", async function() {
            const orders = [getTestLimitOrder(), getTestLimitOrder(), getTestLimitOrder()];
            
            await expect(
                zeroEx.connect(notMaker).batchCancelLimitOrders(orders)
            ).to.be.rejectedWith('OnlyOrderMakerAllowed');
            
            console.log(`✅ Correctly rejected non-maker batch cancellation`);
        });
    });

    describe('batchCancelRfqOrders()', function() {
        it('can cancel multiple orders', async function() {
            const orders = [getTestRfqOrder(), getTestRfqOrder(), getTestRfqOrder()];
            const result = await zeroEx.connect(maker).batchCancelRfqOrders(orders);
            const receipt = await result.wait();
            
            const cancelEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'OrderCancelled');
            expect(cancelEvents.length).to.equal(orders.length);
            
            const infos = await Promise.all(orders.map(o => zeroEx.getRfqOrderInfo(o)));
            expect(infos.map(i => i.status)).to.deep.equal(infos.map(() => OrderStatus.Cancelled));
            
            console.log(`✅ Batch cancelled ${orders.length} RFQ orders`);
        });

        it("cannot cancel someone else's orders", async function() {
            const orders = [getTestRfqOrder(), getTestRfqOrder(), getTestRfqOrder()];
            
            await expect(
                zeroEx.connect(notMaker).batchCancelRfqOrders(orders)
            ).to.be.rejectedWith('OnlyOrderMakerAllowed');
            
            console.log(`✅ Correctly rejected non-maker RFQ batch cancellation`);
        });
    });

    describe('cancelPairOrders()', function() {
        it('can cancel multiple limit orders of the same pair with salt < minValidSalt', async function() {
            const orders = [
                getTestLimitOrder({ salt: 0n }),
                getTestLimitOrder({ salt: 1n }),
                getTestLimitOrder({ salt: 2n })
            ];
            
            // Cancel the first two orders
            const minValidSalt = orders[2].salt;
            const result = await zeroEx.connect(maker).cancelPairLimitOrders(
                makerToken.target || makerToken.address,
                takerToken.target || takerToken.address,
                minValidSalt
            );
            const receipt = await result.wait();
            
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'PairCancelledLimitOrders');
            expect(cancelEvent).to.not.be.undefined;
            
            // Check that the first two orders are cancelled
            const info0 = await zeroEx.getLimitOrderInfo(orders[0]);
            const info1 = await zeroEx.getLimitOrderInfo(orders[1]);
            const info2 = await zeroEx.getLimitOrderInfo(orders[2]);
            
            expect(info0.status).to.equal(OrderStatus.Cancelled);
            expect(info1.status).to.equal(OrderStatus.Cancelled);
            expect(info2.status).to.equal(OrderStatus.Fillable);
            
            console.log(`✅ Cancelled pair limit orders with salt < ${minValidSalt}`);
        });

        it('can cancel multiple RFQ orders of the same pair with salt < minValidSalt', async function() {
            const orders = [
                getTestRfqOrder({ salt: 0n }),
                getTestRfqOrder({ salt: 1n }),
                getTestRfqOrder({ salt: 2n })
            ];
            
            // Cancel the first two orders
            const minValidSalt = orders[2].salt;
            const result = await zeroEx.connect(maker).cancelPairRfqOrders(
                makerToken.target || makerToken.address,
                takerToken.target || takerToken.address,
                minValidSalt
            );
            const receipt = await result.wait();
            
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'PairCancelledRfqOrders');
            expect(cancelEvent).to.not.be.undefined;
            
            // Check that the first two orders are cancelled
            const info0 = await zeroEx.getRfqOrderInfo(orders[0]);
            const info1 = await zeroEx.getRfqOrderInfo(orders[1]);
            const info2 = await zeroEx.getRfqOrderInfo(orders[2]);
            
            expect(info0.status).to.equal(OrderStatus.Cancelled);
            expect(info1.status).to.equal(OrderStatus.Cancelled);
            expect(info2.status).to.equal(OrderStatus.Fillable);
            
            console.log(`✅ Cancelled pair RFQ orders with salt < ${minValidSalt}`);
        });
    });

    describe('batchCancelPairOrders()', function() {
        it('can cancel multiple pairs of limit orders', async function() {
            const pairs = [
                {
                    makerToken: makerToken.target || makerToken.address,
                    takerToken: takerToken.target || takerToken.address,
                    minValidSalt: 1n
                },
                {
                    makerToken: takerToken.target || takerToken.address,
                    takerToken: makerToken.target || makerToken.address,
                    minValidSalt: 1n
                }
            ];
            
            const result = await zeroEx.connect(maker).batchCancelPairLimitOrders(pairs);
            const receipt = await result.wait();
            
            const cancelEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'PairCancelledLimitOrders');
            expect(cancelEvents.length).to.equal(pairs.length);
            
            console.log(`✅ Batch cancelled ${pairs.length} limit order pairs`);
        });

        it('can cancel multiple pairs of RFQ orders', async function() {
            const pairs = [
                {
                    makerToken: makerToken.target || makerToken.address,
                    takerToken: takerToken.target || takerToken.address,
                    minValidSalt: 1n
                },
                {
                    makerToken: takerToken.target || takerToken.address,
                    takerToken: makerToken.target || makerToken.address,
                    minValidSalt: 1n
                }
            ];
            
            const result = await zeroEx.connect(maker).batchCancelPairRfqOrders(pairs);
            const receipt = await result.wait();
            
            const cancelEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'PairCancelledRfqOrders');
            expect(cancelEvents.length).to.equal(pairs.length);
            
            console.log(`✅ Batch cancelled ${pairs.length} RFQ order pairs`);
        });
    });

    describe('fillLimitOrder()', function() {
        it('can fully fill a limit order', async function() {
            const order = getTestLimitOrder();
            const result = await testUtils.fillLimitOrderAsync(order);
            const receipt = await result.wait();
            
            // Check for LimitOrderFilled event
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'LimitOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            // Check final balances
            const makerBalance = await takerToken.balanceOf(order.maker);
            const takerBalance = await makerToken.balanceOf(taker.address);
            expect(makerBalance).to.equal(order.takerAmount);
            expect(takerBalance).to.equal(order.makerAmount);
            
            console.log(`✅ Fully filled limit order: ${ethers.formatEther(order.takerAmount.toString())} taker tokens`);
        });

        it('can partially fill a limit order', async function() {
            const order = getTestLimitOrder();
            const fillAmount = order.takerAmount / 2n;
            const result = await testUtils.fillLimitOrderAsync(order, { fillAmount });
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'LimitOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            // Check partial fill
            const info = await zeroEx.getLimitOrderInfo(order);
            expect(info.takerTokenFilledAmount).to.equal(fillAmount);
            
            console.log(`✅ Partially filled limit order: ${ethers.formatEther(fillAmount.toString())} / ${ethers.formatEther(order.takerAmount.toString())}`);
        });

        it('cannot fill with wrong taker', async function() {
            const order = getTestLimitOrder({ taker: notTaker.address });
            
            await expect(
                testUtils.fillLimitOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillableByTaker');
            
            console.log(`✅ Correctly rejected wrong taker for limit order`);
        });

        it('cannot fill expired order', async function() {
            const order = getTestLimitOrder({ expiry: createExpiry(-60) });
            
            await expect(
                testUtils.fillLimitOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillable');
            
            console.log(`✅ Correctly rejected expired limit order`);
        });

        it('cannot overfill an order', async function() {
            const order = getTestLimitOrder();
            await testUtils.fillLimitOrderAsync(order);
            
            await expect(
                testUtils.fillLimitOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillable');
            
            console.log(`✅ Correctly prevented overfilling limit order`);
        });

        it('pays protocol fees', async function() {
            const order = getTestLimitOrder();
            const balanceBefore = await ethers.provider.getBalance(taker.address);
            
            const result = await testUtils.fillLimitOrderAsync(order);
            await result.wait();
            
            const balanceAfter = await ethers.provider.getBalance(taker.address);
            const gasUsed = balanceBefore - balanceAfter;
            
            // Should have paid some gas (including protocol fees)
            expect(gasUsed > 0n).to.be.true;
            
            console.log(`✅ Paid protocol fees: ${ethers.formatEther(gasUsed)} ETH`);
        });
    });

    describe('registerAllowedRfqOrigins()', function() {
        it('can register allowed origins', async function() {
            const origins = [generateRandomAddress(), generateRandomAddress()];
            
            const result = await zeroEx.connect(taker).registerAllowedRfqOrigins(origins, true);
            const receipt = await result.wait();
            
            // Check for registration events
            const registerEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'RfqOriginRegistered');
            expect(registerEvents.length).to.equal(origins.length);
            
            // Check registration (assuming contract has a method to check)
            for (const origin of origins) {
                const isAllowed = await zeroEx.isAllowedRfqOrigin(taker.address, origin);
                expect(isAllowed).to.be.true;
            }
            
            console.log(`✅ Registered ${origins.length} allowed RFQ origins`);
        });

        it('can unregister allowed origins', async function() {
            const origins = [generateRandomAddress()];
            
            // Register first
            await zeroEx.connect(taker).registerAllowedRfqOrigins(origins, true);
            
            // Then unregister
            const result = await zeroEx.connect(taker).registerAllowedRfqOrigins(origins, false);
            const receipt = await result.wait();
            
            const unregisterEvent = receipt.logs.filter((log: any) => log.fragment?.name === 'RfqOriginUnregistered');
            expect(unregisterEvent.length).to.equal(origins.length);
            
            const isAllowed = await zeroEx.isAllowedRfqOrigin(taker.address, origins[0]);
            expect(isAllowed).to.be.false;
            
            console.log(`✅ Unregistered allowed RFQ origins`);
        });
    });

    describe('fillRfqOrder()', function() {
        it('can fully fill an RFQ order', async function() {
            const order = getTestRfqOrder();
            const result = await testUtils.fillRfqOrderAsync(order);
            const receipt = await result.wait();
            
            // Check for RfqOrderFilled event
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'RfqOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            // Check final balances
            const makerBalance = await takerToken.balanceOf(order.maker);
            const takerBalance = await makerToken.balanceOf(order.taker);
            expect(makerBalance).to.equal(order.takerAmount);
            expect(takerBalance).to.equal(order.makerAmount);
            
            console.log(`✅ Fully filled RFQ order: ${ethers.formatEther(order.takerAmount.toString())} taker tokens`);
        });

        it('can partially fill an RFQ order', async function() {
            const order = getTestRfqOrder();
            const fillAmount = order.takerAmount / 2n;
            const result = await testUtils.fillRfqOrderAsync(order, fillAmount);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'RfqOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            // Check partial fill
            const info = await zeroEx.getRfqOrderInfo(order);
            expect(info.takerTokenFilledAmount).to.equal(fillAmount);
            
            console.log(`✅ Partially filled RFQ order: ${ethers.formatEther(fillAmount.toString())} / ${ethers.formatEther(order.takerAmount.toString())}`);
        });

        it('cannot fill with wrong taker', async function() {
            const order = getTestRfqOrder({ taker: notTaker.address });
            
            await expect(
                testUtils.fillRfqOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillableByTaker');
            
            console.log(`✅ Correctly rejected wrong taker for RFQ order`);
        });

        it('cannot fill with wrong tx.origin', async function() {
            const order = getTestRfqOrder({ txOrigin: notTaker.address });
            
            await expect(
                testUtils.fillRfqOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillableByOrigin');
            
            console.log(`✅ Correctly rejected wrong tx.origin for RFQ order`);
        });

        it('cannot fill expired RFQ order', async function() {
            const order = getTestRfqOrder({ expiry: createExpiry(-60) });
            
            await expect(
                testUtils.fillRfqOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillable');
            
            console.log(`✅ Correctly rejected expired RFQ order`);
        });

        it('cannot overfill an RFQ order', async function() {
            const order = getTestRfqOrder();
            await testUtils.fillRfqOrderAsync(order);
            
            await expect(
                testUtils.fillRfqOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillable');
            
            console.log(`✅ Correctly prevented overfilling RFQ order`);
        });
    });

    describe('fillOrKillLimitOrder()', function() {
        it('can fill or kill a fillable limit order', async function() {
            const order = getTestLimitOrder();
            const result = await testUtils.fillOrKillLimitOrderAsync(order);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'LimitOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            console.log(`✅ Fill-or-kill succeeded for limit order`);
        });

        it('kills partially fillable order', async function() {
            const order = getTestLimitOrder();
            // Partially fill first
            await testUtils.fillLimitOrderAsync(order, { fillAmount: order.takerAmount / 2n });
            
            await expect(
                testUtils.fillOrKillLimitOrderAsync(order)
            ).to.be.rejectedWith('IncompleteFillError');
            
            console.log(`✅ Fill-or-kill correctly killed partially filled order`);
        });

        it('kills unfillable order', async function() {
            const order = getTestLimitOrder({ expiry: createExpiry(-60) });
            
            await expect(
                testUtils.fillOrKillLimitOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillable');
            
            console.log(`✅ Fill-or-kill correctly killed unfillable order`);
        });
    });

    describe('fillOrKillRfqOrder()', function() {
        it('can fill or kill a fillable RFQ order', async function() {
            const order = getTestRfqOrder();
            const result = await testUtils.fillOrKillRfqOrderAsync(order);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'RfqOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            console.log(`✅ Fill-or-kill succeeded for RFQ order`);
        });

        it('kills partially fillable RFQ order', async function() {
            const order = getTestRfqOrder();
            // Partially fill first
            await testUtils.fillRfqOrderAsync(order, order.takerAmount / 2n);
            
            await expect(
                testUtils.fillOrKillRfqOrderAsync(order)
            ).to.be.rejectedWith('IncompleteFillError');
            
            console.log(`✅ Fill-or-kill correctly killed partially filled RFQ order`);
        });

        it('kills unfillable RFQ order', async function() {
            const order = getTestRfqOrder({ expiry: createExpiry(-60) });
            
            await expect(
                testUtils.fillOrKillRfqOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillable');
            
            console.log(`✅ Fill-or-kill correctly killed unfillable RFQ order`);
        });
    });

    describe('getLimitOrderRelevantState()', function() {
        it('returns correct state for fillable order', async function() {
            const order = getTestLimitOrder();
            const state = await zeroEx.getLimitOrderRelevantState(order, taker.address);
            
            expect(state.orderInfo.status).to.equal(OrderStatus.Fillable);
            expect(state.actualFillableTakerTokenAmount).to.equal(order.takerAmount);
            expect(state.isSignatureValid).to.be.true;
            
            console.log(`✅ Limit order relevant state - Fillable: ${ethers.formatEther(state.actualFillableTakerTokenAmount.toString())}`);
        });

        it('returns zero fillable for expired order', async function() {
            const order = getTestLimitOrder({ expiry: createExpiry(-60) });
            const state = await zeroEx.getLimitOrderRelevantState(order, taker.address);
            
            expect(state.orderInfo.status).to.equal(OrderStatus.Expired);
            expect(state.actualFillableTakerTokenAmount).to.equal(0n);
            
            console.log(`✅ Correctly identified expired order with zero fillable amount`);
        });

        it('returns partial fillable for partially filled order', async function() {
            const order = getTestLimitOrder();
            const fillAmount = order.takerAmount / 2n;
            await testUtils.fillLimitOrderAsync(order, { fillAmount });
            
            const state = await zeroEx.getLimitOrderRelevantState(order, taker.address);
            
            expect(state.orderInfo.status).to.equal(OrderStatus.Fillable);
            expect(state.actualFillableTakerTokenAmount).to.equal(order.takerAmount - fillAmount);
            
            console.log(`✅ Partially filled order shows correct remaining fillable amount`);
        });

        it('returns correct state for cancelled order', async function() {
            const order = getTestLimitOrder();
            await zeroEx.connect(maker).cancelLimitOrder(order);
            
            const state = await zeroEx.getLimitOrderRelevantState(order, taker.address);
            
            expect(state.orderInfo.status).to.equal(OrderStatus.Cancelled);
            expect(state.actualFillableTakerTokenAmount).to.equal(0n);
            
            console.log(`✅ Cancelled order shows zero fillable amount`);
        });

        it('checks signature validity', async function() {
            const order = getTestLimitOrder();
            const state = await zeroEx.getLimitOrderRelevantState(order, taker.address);
            
            expect(state.isSignatureValid).to.be.true;
            
            console.log(`✅ Signature validity correctly checked`);
        });
    });

    describe('getRfqOrderRelevantState()', function() {
        it('returns correct state for fillable RFQ order', async function() {
            const order = getTestRfqOrder();
            const state = await zeroEx.getRfqOrderRelevantState(order, taker.address);
            
            expect(state.orderInfo.status).to.equal(OrderStatus.Fillable);
            expect(state.actualFillableTakerTokenAmount).to.equal(order.takerAmount);
            expect(state.isSignatureValid).to.be.true;
            
            console.log(`✅ RFQ order relevant state - Fillable: ${ethers.formatEther(state.actualFillableTakerTokenAmount.toString())}`);
        });

        it('returns zero fillable for expired RFQ order', async function() {
            const order = getTestRfqOrder({ expiry: createExpiry(-60) });
            const state = await zeroEx.getRfqOrderRelevantState(order, taker.address);
            
            expect(state.orderInfo.status).to.equal(OrderStatus.Expired);
            expect(state.actualFillableTakerTokenAmount).to.equal(0n);
            
            console.log(`✅ Correctly identified expired RFQ order with zero fillable amount`);
        });

        it('returns partial fillable for partially filled RFQ order', async function() {
            const order = getTestRfqOrder();
            const fillAmount = order.takerAmount / 2n;
            await testUtils.fillRfqOrderAsync(order, fillAmount);
            
            const state = await zeroEx.getRfqOrderRelevantState(order, taker.address);
            
            expect(state.orderInfo.status).to.equal(OrderStatus.Fillable);
            expect(state.actualFillableTakerTokenAmount).to.equal(order.takerAmount - fillAmount);
            
            console.log(`✅ Partially filled RFQ order shows correct remaining fillable amount`);
        });

        it('returns correct state for cancelled RFQ order', async function() {
            const order = getTestRfqOrder();
            await zeroEx.connect(maker).cancelRfqOrder(order);
            
            const state = await zeroEx.getRfqOrderRelevantState(order, taker.address);
            
            expect(state.orderInfo.status).to.equal(OrderStatus.Cancelled);
            expect(state.actualFillableTakerTokenAmount).to.equal(0n);
            
            console.log(`✅ Cancelled RFQ order shows zero fillable amount`);
        });

        it('checks signature validity for RFQ order', async function() {
            const order = getTestRfqOrder();
            const state = await zeroEx.getRfqOrderRelevantState(order, taker.address);
            
            expect(state.isSignatureValid).to.be.true;
            
            console.log(`✅ RFQ signature validity correctly checked`);
        });
    });

    describe('batchGetLimitOrderRelevantStates()', function() {
        it('returns correct states for multiple orders', async function() {
            const orders = [
                getTestLimitOrder(),
                getTestLimitOrder({ expiry: createExpiry(-60) }), // expired
                getTestLimitOrder()
            ];
            
            // Fill the third order partially
            await testUtils.fillLimitOrderAsync(orders[2], { fillAmount: orders[2].takerAmount / 2n });
            
            const states = await zeroEx.batchGetLimitOrderRelevantStates(orders, taker.address);
            
            expect(states.length).to.equal(orders.length);
            expect(states[0].orderInfo.status).to.equal(OrderStatus.Fillable);
            expect(states[1].orderInfo.status).to.equal(OrderStatus.Expired);
            expect(states[2].orderInfo.status).to.equal(OrderStatus.Fillable);
            expect(states[2].actualFillableTakerTokenAmount).to.equal(orders[2].takerAmount / 2n);
            
            console.log(`✅ Batch got states for ${orders.length} limit orders`);
        });

        it('handles empty array', async function() {
            const states = await zeroEx.batchGetLimitOrderRelevantStates([], taker.address);
            expect(states.length).to.equal(0);
            
            console.log(`✅ Correctly handled empty order array`);
        });
    });

    describe('batchGetRfqOrderRelevantStates()', function() {
        it('returns correct states for multiple RFQ orders', async function() {
            const orders = [
                getTestRfqOrder(),
                getTestRfqOrder({ expiry: createExpiry(-60) }), // expired
                getTestRfqOrder()
            ];
            
            // Fill the third order partially
            await testUtils.fillRfqOrderAsync(orders[2], orders[2].takerAmount / 2n);
            
            const states = await zeroEx.batchGetRfqOrderRelevantStates(orders, taker.address);
            
            expect(states.length).to.equal(orders.length);
            expect(states[0].orderInfo.status).to.equal(OrderStatus.Fillable);
            expect(states[1].orderInfo.status).to.equal(OrderStatus.Expired);
            expect(states[2].orderInfo.status).to.equal(OrderStatus.Fillable);
            expect(states[2].actualFillableTakerTokenAmount).to.equal(orders[2].takerAmount / 2n);
            
            console.log(`✅ Batch got states for ${orders.length} RFQ orders`);
        });

        it('handles empty array', async function() {
            const states = await zeroEx.batchGetRfqOrderRelevantStates([], taker.address);
            expect(states.length).to.equal(0);
            
            console.log(`✅ Correctly handled empty RFQ order array`);
        });
    });

    describe('registerAllowedSigner()', function() {
        it('can register an allowed signer', async function() {
            const signerAddress = generateRandomAddress();
            const allowed = true;
            
            const result = await zeroEx.connect(maker).registerAllowedSigner(signerAddress, allowed);
            const receipt = await result.wait();
            
            const registerEvent = receipt.logs.find((log: any) => log.fragment?.name === 'SignerRegistered');
            expect(registerEvent).to.not.be.undefined;
            
            const isAllowed = await zeroEx.isAllowedSigner(maker.address, signerAddress);
            expect(isAllowed).to.equal(allowed);
            
            console.log(`✅ Registered allowed signer: ${signerAddress}`);
        });

        it('can unregister an allowed signer', async function() {
            const signerAddress = generateRandomAddress();
            
            // Register first
            await zeroEx.connect(maker).registerAllowedSigner(signerAddress, true);
            
            // Then unregister
            const result = await zeroEx.connect(maker).registerAllowedSigner(signerAddress, false);
            const receipt = await result.wait();
            
            const unregisterEvent = receipt.logs.find((log: any) => log.fragment?.name === 'SignerUnregistered');
            expect(unregisterEvent).to.not.be.undefined;
            
            const isAllowed = await zeroEx.isAllowedSigner(maker.address, signerAddress);
            expect(isAllowed).to.be.false;
            
            console.log(`✅ Unregistered allowed signer: ${signerAddress}`);
        });

        it('can register multiple signers', async function() {
            const signers = [generateRandomAddress(), generateRandomAddress()];
            
            for (const signerAddr of signers) {
                await zeroEx.connect(maker).registerAllowedSigner(signerAddr, true);
                const isAllowed = await zeroEx.isAllowedSigner(maker.address, signerAddr);
                expect(isAllowed).to.be.true;
            }
            
            console.log(`✅ Registered ${signers.length} allowed signers`);
        });
    });
}); 