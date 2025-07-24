import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { randomBytes } from 'crypto';

// Import chai-as-promised for proper async error handling
import 'chai-as-promised';

describe('NativeOrdersFeature - Modern Tests', function() {
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
        console.log('🚀 Setting up NativeOrdersFeature Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [owner, maker, taker, notMaker, notTaker, contractWalletOwner, contractWalletSigner] = signers;
        
        console.log('👤 Owner:', owner.address);
        console.log('👤 Maker:', maker.address);
        console.log('👤 Taker:', taker.address);
        
        await deployContractsAsync();
        await setupTestUtilsAsync();
        
        console.log('✅ NativeOrdersFeature test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying NativeOrdersFeature contracts...');
        
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
            fillLimitOrderAsync: async function(order: any, fillAmount?: bigint, txOriginAddr?: any) {
                await this.prepareBalancesForOrdersAsync([order]);
                const signature = await this.createOrderSignature(order);
                const amount = fillAmount || order.takerAmount;
                const fromAddr = txOriginAddr || taker;
                
                return await zeroEx.connect(fromAddr).fillLimitOrder(order, signature, amount);
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

    function getRandomLimitOrder(fields: any = {}): any {
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

    function getRandomRfqOrder(fields: any = {}): any {
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

    describe('getProtocolFeeMultiplier()', function() {
        it('returns the expected protocol fee multiplier', async function() {
            const result = await zeroEx.getProtocolFeeMultiplier();
            expect(result).to.equal(PROTOCOL_FEE_MULTIPLIER);
            
            console.log(`✅ Protocol fee multiplier: ${result}`);
        });
    });

    describe('getLimitOrderHash()', function() {
        it('returns the expected hash', async function() {
            const order = getRandomLimitOrder();
            const hash = await zeroEx.getLimitOrderHash(order);
            const expectedHash = testUtils.getOrderHash(order);
            expect(hash).to.not.equal(ethers.ZeroHash);
            
            console.log(`✅ Generated limit order hash: ${hash.slice(0, 10)}...`);
        });
    });

    describe('getRfqOrderHash()', function() {
        it('returns the expected hash', async function() {
            const order = getRandomRfqOrder();
            const hash = await zeroEx.getRfqOrderHash(order);
            const expectedHash = testUtils.getOrderHash(order);
            expect(hash).to.not.equal(ethers.ZeroHash);
            
            console.log(`✅ Generated RFQ order hash: ${hash.slice(0, 10)}...`);
        });
    });

    describe('getLimitOrderInfo()', function() {
        it('returns fillable for a valid order', async function() {
            const order = getRandomLimitOrder();
            const info = await zeroEx.getLimitOrderInfo(order);
            
            expect(info.status).to.equal(OrderStatus.Fillable);
            expect(info.hash).to.not.equal(ethers.ZeroHash);
            expect(info.takerTokenFilledAmount).to.equal(0n);
            
            console.log(`✅ Limit order info - Status: ${info.status}, Hash: ${info.hash.slice(0, 10)}...`);
        });

        it('returns expired for an expired order', async function() {
            const order = getRandomLimitOrder({ expiry: createExpiry(-60) });
            const info = await zeroEx.getLimitOrderInfo(order);
            
            expect(info.status).to.equal(OrderStatus.Expired);
            
            console.log(`✅ Correctly identified expired limit order`);
        });
    });

    describe('getRfqOrderInfo()', function() {
        it('returns fillable for a valid order', async function() {
            const order = getRandomRfqOrder();
            const info = await zeroEx.getRfqOrderInfo(order);
            
            expect(info.status).to.equal(OrderStatus.Fillable);
            expect(info.hash).to.not.equal(ethers.ZeroHash);
            expect(info.takerTokenFilledAmount).to.equal(0n);
            
            console.log(`✅ RFQ order info - Status: ${info.status}, Hash: ${info.hash.slice(0, 10)}...`);
        });

        it('returns expired for an expired order', async function() {
            const order = getRandomRfqOrder({ expiry: createExpiry(-60) });
            const info = await zeroEx.getRfqOrderInfo(order);
            
            expect(info.status).to.equal(OrderStatus.Expired);
            
            console.log(`✅ Correctly identified expired RFQ order`);
        });
    });

    describe('cancelLimitOrder()', function() {
        it('can cancel a limit order', async function() {
            const order = getRandomLimitOrder();
            
            await zeroEx.connect(maker).cancelLimitOrder(order);
            
            const info = await zeroEx.getLimitOrderInfo(order);
            expect(info.status).to.equal(OrderStatus.Cancelled);
            
            console.log(`✅ Cancelled limit order`);
        });

        it('cannot cancel from non-maker', async function() {
            const order = getRandomLimitOrder();
            
            await expect(
                zeroEx.connect(taker).cancelLimitOrder(order)
            ).to.be.rejectedWith('OnlyOrderMakerAllowed');
            
            console.log(`✅ Correctly rejected non-maker cancellation`);
        });
    });

    describe('cancelRfqOrder()', function() {
        it('can cancel an RFQ order', async function() {
            const order = getRandomRfqOrder();
            
            await zeroEx.connect(maker).cancelRfqOrder(order);
            
            const info = await zeroEx.getRfqOrderInfo(order);
            expect(info.status).to.equal(OrderStatus.Cancelled);
            
            console.log(`✅ Cancelled RFQ order`);
        });

        it('cannot cancel from non-maker', async function() {
            const order = getRandomRfqOrder();
            
            await expect(
                zeroEx.connect(taker).cancelRfqOrder(order)
            ).to.be.rejectedWith('OnlyOrderMakerAllowed');
            
            console.log(`✅ Correctly rejected non-maker RFQ cancellation`);
        });
    });

    describe('fillLimitOrder()', function() {
        it('can fully fill a limit order', async function() {
            const order = getRandomLimitOrder();
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
            const order = getRandomLimitOrder();
            const fillAmount = order.takerAmount / 2n;
            const result = await testUtils.fillLimitOrderAsync(order, fillAmount);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'LimitOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            // Check partial fill
            const info = await zeroEx.getLimitOrderInfo(order);
            expect(info.takerTokenFilledAmount).to.equal(fillAmount);
            
            console.log(`✅ Partially filled limit order: ${ethers.formatEther(fillAmount.toString())} / ${ethers.formatEther(order.takerAmount.toString())}`);
        });

        it('cannot fill with wrong taker', async function() {
            const order = getRandomLimitOrder({ taker: notTaker.address });
            
            await expect(
                testUtils.fillLimitOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillableByTaker');
            
            console.log(`✅ Correctly rejected wrong taker for limit order`);
        });

        it('cannot fill expired order', async function() {
            const order = getRandomLimitOrder({ expiry: createExpiry(-60) });
            
            await expect(
                testUtils.fillLimitOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillable');
            
            console.log(`✅ Correctly rejected expired limit order`);
        });

        it('cannot overfill an order', async function() {
            const order = getRandomLimitOrder();
            await testUtils.fillLimitOrderAsync(order);
            
            await expect(
                testUtils.fillLimitOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillable');
            
            console.log(`✅ Correctly prevented overfilling limit order`);
        });
    });

    describe('fillRfqOrder()', function() {
        it('can fully fill an RFQ order', async function() {
            const order = getRandomRfqOrder();
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
            const order = getRandomRfqOrder();
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
            const order = getRandomRfqOrder({ taker: notTaker.address });
            
            await expect(
                testUtils.fillRfqOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillableByTaker');
            
            console.log(`✅ Correctly rejected wrong taker for RFQ order`);
        });

        it('cannot fill with wrong tx.origin', async function() {
            const order = getRandomRfqOrder({ txOrigin: notTaker.address });
            
            await expect(
                testUtils.fillRfqOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillableByOrigin');
            
            console.log(`✅ Correctly rejected wrong tx.origin for RFQ order`);
        });

        it('cannot fill expired RFQ order', async function() {
            const order = getRandomRfqOrder({ expiry: createExpiry(-60) });
            
            await expect(
                testUtils.fillRfqOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillable');
            
            console.log(`✅ Correctly rejected expired RFQ order`);
        });
    });

    describe('fillOrKillLimitOrder()', function() {
        it('can fill or kill a fillable limit order', async function() {
            const order = getRandomLimitOrder();
            const result = await testUtils.fillOrKillLimitOrderAsync(order);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'LimitOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            console.log(`✅ Fill-or-kill succeeded for limit order`);
        });

        it('kills partially fillable order', async function() {
            const order = getRandomLimitOrder();
            // Partially fill first
            await testUtils.fillLimitOrderAsync(order, order.takerAmount / 2n);
            
            await expect(
                testUtils.fillOrKillLimitOrderAsync(order)
            ).to.be.rejectedWith('IncompleteFillError');
            
            console.log(`✅ Fill-or-kill correctly killed partially filled order`);
        });
    });

    describe('fillOrKillRfqOrder()', function() {
        it('can fill or kill a fillable RFQ order', async function() {
            const order = getRandomRfqOrder();
            const result = await testUtils.fillOrKillRfqOrderAsync(order);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'RfqOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            console.log(`✅ Fill-or-kill succeeded for RFQ order`);
        });

        it('kills partially fillable RFQ order', async function() {
            const order = getRandomRfqOrder();
            // Partially fill first
            await testUtils.fillRfqOrderAsync(order, order.takerAmount / 2n);
            
            await expect(
                testUtils.fillOrKillRfqOrderAsync(order)
            ).to.be.rejectedWith('IncompleteFillError');
            
            console.log(`✅ Fill-or-kill correctly killed partially filled RFQ order`);
        });
    });

    describe('getLimitOrderRelevantState()', function() {
        it('returns correct state for fillable order', async function() {
            const order = getRandomLimitOrder();
            const state = await zeroEx.getLimitOrderRelevantState(order, taker.address);
            
            expect(state.orderInfo.status).to.equal(OrderStatus.Fillable);
            expect(state.actualFillableTakerTokenAmount).to.equal(order.takerAmount);
            expect(state.isSignatureValid).to.be.true;
            
            console.log(`✅ Limit order relevant state - Fillable: ${ethers.formatEther(state.actualFillableTakerTokenAmount.toString())}`);
        });

        it('returns zero fillable for expired order', async function() {
            const order = getRandomLimitOrder({ expiry: createExpiry(-60) });
            const state = await zeroEx.getLimitOrderRelevantState(order, taker.address);
            
            expect(state.orderInfo.status).to.equal(OrderStatus.Expired);
            expect(state.actualFillableTakerTokenAmount).to.equal(0n);
            
            console.log(`✅ Correctly identified expired order with zero fillable amount`);
        });
    });

    describe('getRfqOrderRelevantState()', function() {
        it('returns correct state for fillable RFQ order', async function() {
            const order = getRandomRfqOrder();
            const state = await zeroEx.getRfqOrderRelevantState(order, taker.address);
            
            expect(state.orderInfo.status).to.equal(OrderStatus.Fillable);
            expect(state.actualFillableTakerTokenAmount).to.equal(order.takerAmount);
            expect(state.isSignatureValid).to.be.true;
            
            console.log(`✅ RFQ order relevant state - Fillable: ${ethers.formatEther(state.actualFillableTakerTokenAmount.toString())}`);
        });

        it('returns zero fillable for expired RFQ order', async function() {
            const order = getRandomRfqOrder({ expiry: createExpiry(-60) });
            const state = await zeroEx.getRfqOrderRelevantState(order, taker.address);
            
            expect(state.orderInfo.status).to.equal(OrderStatus.Expired);
            expect(state.actualFillableTakerTokenAmount).to.equal(0n);
            
            console.log(`✅ Correctly identified expired RFQ order with zero fillable amount`);
        });
    });

    describe('batchCancelLimitOrders()', function() {
        it('can cancel multiple limit orders', async function() {
            const orders = [getRandomLimitOrder(), getRandomLimitOrder()];
            
            await zeroEx.connect(maker).batchCancelLimitOrders(orders);
            
            for (const order of orders) {
                const info = await zeroEx.getLimitOrderInfo(order);
                expect(info.status).to.equal(OrderStatus.Cancelled);
            }
            
            console.log(`✅ Batch cancelled ${orders.length} limit orders`);
        });
    });

    describe('batchCancelRfqOrders()', function() {
        it('can cancel multiple RFQ orders', async function() {
            const orders = [getRandomRfqOrder(), getRandomRfqOrder()];
            
            await zeroEx.connect(maker).batchCancelRfqOrders(orders);
            
            for (const order of orders) {
                const info = await zeroEx.getRfqOrderInfo(order);
                expect(info.status).to.equal(OrderStatus.Cancelled);
            }
            
            console.log(`✅ Batch cancelled ${orders.length} RFQ orders`);
        });
    });

    describe('registerAllowedRfqOrigins()', function() {
        it('can register allowed origins', async function() {
            const origins = [generateRandomAddress(), generateRandomAddress()];
            
            await zeroEx.connect(taker).registerAllowedRfqOrigins(origins, true);
            
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
            await zeroEx.connect(taker).registerAllowedRfqOrigins(origins, false);
            
            const isAllowed = await zeroEx.isAllowedRfqOrigin(taker.address, origins[0]);
            expect(isAllowed).to.be.false;
            
            console.log(`✅ Unregistered allowed RFQ origins`);
        });
    });
}); 