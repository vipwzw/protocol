import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { randomBytes } from 'crypto';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { OtcOrder } from '@0x/protocol-utils';
import { BigNumber } from '@0x/utils';
// 导入通用部署函数
import { 
    deployZeroExWithFullMigration, 
    deployTestTokens, 
    approveTokensForAccounts,
    type ZeroExDeploymentResult 
} from '../utils/deployment-helper';

// Configure chai-as-promised for proper async error handling
chai.use(chaiAsPromised);

describe('OtcOrdersFeature - Modern Tests', function() {
    // Extended timeout for OTC order operations
    this.timeout(300000);
    
    let maker: any;
    let taker: any;
    let notMaker: any;
    let notTaker: any;
    let contractWalletOwner: any;
    let contractWalletSigner: any;
    let txOrigin: any;
    let notTxOrigin: any;
    let owner: any;
    let deployment: ZeroExDeploymentResult;
    let makerToken: any;
    let takerToken: any;
    let wethToken: any;
    let contractWallet: any;
    let testUtils: any;
    let otcFeature: any; // OtcOrdersFeature interface pointing to ZeroEx
    
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    const MAX_UINT256 = ethers.MaxUint256;
    const ZERO = 0n;
    const ETH_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    
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
        console.log('🚀 Setting up OtcOrders Test...');
        
        // Get signers with zero gas price for ETH balance accounting
        const signers = await ethers.getSigners();
        [owner, maker, taker, notMaker, notTaker, contractWalletOwner, contractWalletSigner, txOrigin, notTxOrigin] = signers;
        
        console.log('👤 Owner:', owner.address);
        console.log('👤 Maker:', maker.address);
        console.log('👤 Taker:', taker.address);
        console.log('👤 TxOrigin:', txOrigin.address);
        
        await deployContractsAsync();
        await setupTestUtilsAsync();
        
        console.log('✅ OtcOrders test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 开始部署 OtcOrders 测试 (使用通用部署函数)...');
        
        // 1. 部署测试代币
        const tokens = await deployTestTokens();
        makerToken = tokens.makerToken;
        takerToken = tokens.takerToken;
        wethToken = tokens.wethToken;
        
        // 2. 使用通用函数部署完整的 ZeroEx 系统
        deployment = await deployZeroExWithFullMigration(owner, wethToken, {
            protocolFeeMultiplier: 70000,
            logProgress: true
        });
        
        // 3. 从通用部署结果获取 OTC 功能接口
        otcFeature = deployment.featureInterfaces.otcFeature;
        console.log(`✅ OtcFeature interface ready`);
        
        // 4. 批量授权代币给所有测试账户
        const accounts = [maker, notMaker, taker, notTaker];
        await approveTokensForAccounts(
            [makerToken, takerToken, wethToken],
            accounts,
            deployment.verifyingContract
        );
        
        // Deploy contract wallet for signer delegation
        const ContractWalletFactory = await ethers.getContractFactory('TestOrderSignerRegistryWithContractWallet');
        contractWallet = await ContractWalletFactory.connect(contractWalletOwner).deploy(deployment.verifyingContract);
        await contractWallet.waitForDeployment();
        console.log(`✅ ContractWallet: ${await contractWallet.getAddress()}`);
        
        // Approve tokens for contract wallet
        const contractTokens = [makerToken, takerToken, wethToken];
        for (const token of contractTokens) {
            await contractWallet.approveERC20(await token.getAddress(), deployment.verifyingContract, MAX_UINT256);
        }
        console.log(`✅ Approved tokens for contract wallet`);
    }

    async function setupTestUtilsAsync(): Promise<void> {
        // Create comprehensive test utilities
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
            
            // Fill OTC order
            fillOtcOrderAsync: async function(order: any, fillAmount?: bigint, txOriginAddr?: any, unwrapWeth: boolean = false) {
                await this.prepareBalancesForOrdersAsync([order]);
                const signature = await this.createOrderSignature(order);
                const amount = fillAmount || order.takerAmount;
                const fromAddr = txOriginAddr || taker;
                
                if (unwrapWeth) {
                    return await otcFeature.connect(fromAddr).fillOtcOrderForEth(order, signature, amount);
                } else {
                    return await otcFeature.connect(fromAddr).fillOtcOrder(order, signature, amount);
                }
            },
            
            // Fill OTC order with ETH
            fillOtcOrderWithEthAsync: async function(order: any, fillAmount?: bigint) {
                await this.prepareBalancesForOrdersAsync([order]);
                const signature = await this.createOrderSignature(order);
                const amount = fillAmount || order.takerAmount;
                
                return await deployment.zeroEx.connect(taker).fillOtcOrderWithEth(order, signature, amount, { value: amount });
            },
            
            // Fill taker signed OTC order
            fillTakerSignedOtcOrderAsync: async function(order: any, txOriginAddr?: any, takerAddr?: any, unwrapWeth: boolean = false) {
                await this.prepareBalancesForOrdersAsync([order], takerAddr);
                const makerSignature = await this.createOrderSignature(order);
                const takerSignature = await this.createTakerSignature(order, takerAddr);
                const fromAddr = txOriginAddr || txOrigin;
                
                if (unwrapWeth) {
                    return await otcFeature.connect(fromAddr).fillTakerSignedOtcOrderForEth(order, makerSignature, takerSignature);
                } else {
                    return await otcFeature.connect(fromAddr).fillTakerSignedOtcOrder(order, makerSignature, takerSignature);
                }
            },
            
            // Create order signature
            createOrderSignature: async function(order: any, signer?: any) {
                const signerAccount = signer || maker;
                const orderHash = this.getOrderHash(order);
                return await signerAccount.signMessage(ethers.getBytes(orderHash));
            },
            
            // Create taker signature
            createTakerSignature: async function(order: any, takerAddr?: any) {
                const signerAccount = takerAddr || taker;
                const orderHash = this.getOrderHash(order);
                return await signerAccount.signMessage(ethers.getBytes(orderHash));
            },
            
            // Get order hash
            getOrderHash: function(order: any): string {
                // Fix BigInt serialization issue by converting to string
                const orderHashData = JSON.stringify(order, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                );
                return ethers.keccak256(ethers.toUtf8Bytes(orderHashData));
            },
            
            // Create OTC order filled event args
            createOtcOrderFilledEventArgs: function(order: any, fillAmount?: bigint) {
                const filledAmount = fillAmount || order.takerAmount;
                const { makerTokenFilledAmount, takerTokenFilledAmount } = this.computeOtcOrderFilledAmounts(order, filledAmount);
                
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
            
            // Compute OTC order filled amounts
            computeOtcOrderFilledAmounts: function(order: any, fillAmount: bigint) {
                const takerTokenFilledAmount = fillAmount;
                const makerTokenFilledAmount = (fillAmount * order.makerAmount) / order.takerAmount;
                
                return { makerTokenFilledAmount, takerTokenFilledAmount };
            }
        };
    }

    function generateRandomBytes32(): string {
        return '0x' + randomBytes(32).toString('hex');
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

    function getTestOtcOrder(fields: any = {}): OtcOrder {
        const expiry = fields.expiry || new BigNumber(Math.floor(Date.now() / 1000 + 3600));
        const nonceBucket = fields.nonceBucket || new BigNumber(Math.floor(Math.random() * 1000000));
        const nonce = fields.nonce || new BigNumber(Math.floor(Math.random() * 1000000));
        
        return new OtcOrder({
            maker: fields.maker || maker.address,
            taker: fields.taker || NULL_ADDRESS,
            makerToken: fields.makerToken || (makerToken.target || makerToken.address),
            takerToken: fields.takerToken || (takerToken.target || takerToken.address),
            makerAmount: fields.makerAmount || ethers.parseEther('100'), // 100 ether
            takerAmount: fields.takerAmount || ethers.parseEther('50'), // 50 ether  
            txOrigin: fields.txOrigin || taker.address,
            expiryAndNonce: OtcOrder.encodeExpiryAndNonce(expiry, nonceBucket, nonce),
            verifyingContract: deployment.verifyingContract,
            chainId: 1337,
            ...fields
        });
    }

    async function assertExpectedFinalBalancesFromOtcOrderFillAsync(order: any, fillAmount?: bigint): Promise<void> {
        const filledAmount = fillAmount || order.takerAmount;
        const { makerTokenFilledAmount, takerTokenFilledAmount } = testUtils.computeOtcOrderFilledAmounts(order, filledAmount);
        
        const makerBalance = await takerToken.balanceOf(order.maker);
        const takerBalance = await makerToken.balanceOf(order.taker !== NULL_ADDRESS ? order.taker : taker.address);
        
        expect(makerBalance, 'maker balance').to.equal(takerTokenFilledAmount);
        expect(takerBalance, 'taker balance').to.equal(makerTokenFilledAmount);
    }

    describe('fillOtcOrder()', function() {
        it('can fully fill an order', async function() {
            const order = getTestOtcOrder();
            const result = await testUtils.fillOtcOrderAsync(order);
            const receipt = await result.wait();
            
            // Check for OtcOrderFilled event
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
            
            console.log(`✅ Fully filled OTC order`);
        });

        it('can partially fill an order', async function() {
            const order = getTestOtcOrder();
            const fillAmount = order.takerAmount - 1n;
            const result = await testUtils.fillOtcOrderAsync(order, fillAmount);
            const receipt = await result.wait();
            
            // Check for OtcOrderFilled event
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order, fillAmount);
            
            console.log(`✅ Partially filled OTC order: ${ethers.formatEther(fillAmount.toString())} / ${ethers.formatEther(order.takerAmount.toString())}`);
        });

        it('clamps fill amount to remaining available', async function() {
            const order = getTestOtcOrder();
            const fillAmount = order.takerAmount + 1n;
            const result = await testUtils.fillOtcOrderAsync(order, fillAmount);
            const receipt = await result.wait();
            
            // Should fill the full order amount despite requesting more
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order, fillAmount);
            
            console.log(`✅ Clamped fill amount to available`);
        });

        it('cannot fill an order with wrong tx.origin', async function() {
            const order = getTestOtcOrder();
            
            await expect(
                testUtils.fillOtcOrderAsync(order, order.takerAmount, notTaker)
            ).to.be.rejectedWith('OrderNotFillableByOriginError');
            
            console.log(`✅ Correctly rejected wrong tx.origin`);
        });

        it('cannot fill an order with wrong taker', async function() {
            const order = getTestOtcOrder({ taker: notTaker.address });
            
            await expect(
                testUtils.fillOtcOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillableByTakerError');
            
            console.log(`✅ Correctly rejected wrong taker`);
        });

        it('can fill an order from a different tx.origin if registered', async function() {
            const order = getTestOtcOrder();
            await deployment.zeroEx.connect(taker).registerAllowedRfqOrigins([notTaker.address], true);
            
            const result = await testUtils.fillOtcOrderAsync(order, order.takerAmount, notTaker);
            await result.wait();
            
            console.log(`✅ Filled order with registered tx.origin`);
        });

        it('cannot fill an order with registered then unregistered tx.origin', async function() {
            const order = getTestOtcOrder();
            await deployment.zeroEx.connect(taker).registerAllowedRfqOrigins([notTaker.address], true);
            await deployment.zeroEx.connect(taker).registerAllowedRfqOrigins([notTaker.address], false);
            
            await expect(
                testUtils.fillOtcOrderAsync(order, order.takerAmount, notTaker)
            ).to.be.rejectedWith('OrderNotFillableByOriginError');
            
            console.log(`✅ Correctly rejected unregistered tx.origin`);
        });

        it('cannot fill an order with a zero tx.origin', async function() {
            const order = getTestOtcOrder({ txOrigin: NULL_ADDRESS });
            
            await expect(
                testUtils.fillOtcOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillableByOriginError');
            
            console.log(`✅ Correctly rejected zero tx.origin`);
        });

        it('cannot fill an expired order', async function() {
            const order = getTestOtcOrder({ expiry: createExpiry(-60) });
            
            await expect(
                testUtils.fillOtcOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillableError');
            
            console.log(`✅ Correctly rejected expired order`);
        });

        it('cannot fill order with bad signature', async function() {
            const order = getTestOtcOrder();
            // Modify order to invalidate signature
            const badOrder = { ...order, makerAmount: order.makerAmount + 1n };
            
            await expect(
                testUtils.fillOtcOrderAsync(badOrder)
            ).to.be.rejectedWith('OrderNotSignedByMakerError');
            
            console.log(`✅ Correctly rejected bad signature`);
        });

        it('fails if ETH is attached', async function() {
            const order = getTestOtcOrder();
            await testUtils.prepareBalancesForOrdersAsync([order]);
            const signature = await testUtils.createOrderSignature(order);
            
            await expect(
                deployment.zeroEx.connect(taker).fillOtcOrder(order, signature, order.takerAmount, { value: 1 })
            ).to.be.rejected; // Revert at language level because function is not payable
            
            console.log(`✅ Correctly rejected ETH attachment`);
        });

        it('cannot fill the same order twice', async function() {
            const order = getTestOtcOrder();
            await testUtils.fillOtcOrderAsync(order);
            
            await expect(
                testUtils.fillOtcOrderAsync(order)
            ).to.be.rejectedWith('OrderNotFillableError');
            
            console.log(`✅ Correctly prevented double fill`);
        });

        it('cannot fill two orders with the same nonceBucket and nonce', async function() {
            const order1 = getTestOtcOrder();
            await testUtils.fillOtcOrderAsync(order1);
            
            const order2 = getTestOtcOrder({ 
                nonceBucket: order1.nonceBucket, 
                nonce: order1.nonce 
            });
            
            await expect(
                testUtils.fillOtcOrderAsync(order2)
            ).to.be.rejectedWith('OrderNotFillableError');
            
            console.log(`✅ Correctly rejected duplicate nonce`);
        });

        it('cannot fill an order whose nonce is less than the nonce last used in that bucket', async function() {
            const order1 = getTestOtcOrder();
            await testUtils.fillOtcOrderAsync(order1);
            
            const order2 = getTestOtcOrder({ 
                nonceBucket: order1.nonceBucket, 
                nonce: order1.nonce - 1n 
            });
            
            await expect(
                testUtils.fillOtcOrderAsync(order2)
            ).to.be.rejectedWith('OrderNotFillableError');
            
            console.log(`✅ Correctly rejected lower nonce`);
        });

        it('can fill two orders that use the same nonce bucket and increasing nonces', async function() {
            const order1 = getTestOtcOrder();
            const result1 = await testUtils.fillOtcOrderAsync(order1);
            const receipt1 = await result1.wait();
            
            const fillEvent1 = receipt1.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent1).to.not.be.undefined;
            
            const order2 = getTestOtcOrder({ 
                nonceBucket: order1.nonceBucket, 
                nonce: order1.nonce + 1n 
            });
            const result2 = await testUtils.fillOtcOrderAsync(order2);
            const receipt2 = await result2.wait();
            
            const fillEvent2 = receipt2.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent2).to.not.be.undefined;
            
            console.log(`✅ Filled orders with increasing nonces`);
        });

        it('can fill two orders that use the same nonce but different nonce buckets', async function() {
            const order1 = getTestOtcOrder();
            const result1 = await testUtils.fillOtcOrderAsync(order1);
            const receipt1 = await result1.wait();
            
            const fillEvent1 = receipt1.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent1).to.not.be.undefined;
            
            const order2 = getTestOtcOrder({ nonce: order1.nonce });
            const result2 = await testUtils.fillOtcOrderAsync(order2);
            const receipt2 = await result2.wait();
            
            const fillEvent2 = receipt2.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent2).to.not.be.undefined;
            
            console.log(`✅ Filled orders with same nonce, different buckets`);
        });

        it('can fill a WETH buy order and receive ETH', async function() {
            const takerEthBalanceBefore = await ethers.provider.getBalance(taker.address);
            const order = getTestOtcOrder({ 
                makerToken: await wethToken.getAddress(), 
                makerAmount: ethers.parseEther('1') 
            });
            
            // Deposit WETH for maker
            await wethToken.connect(maker).deposit({ value: order.makerAmount });
            
            const result = await testUtils.fillOtcOrderAsync(order, order.takerAmount, taker, true);
            await result.wait();
            
            const takerEthBalanceAfter = await ethers.provider.getBalance(taker.address);
            expect(takerEthBalanceAfter - takerEthBalanceBefore).to.equal(order.makerAmount);
            
            console.log(`✅ Filled WETH buy order and received ETH: ${ethers.formatEther(order.makerAmount.toString())}`);
        });

        it('reverts if `unwrapWeth` is true but maker token is not WETH', async function() {
            const order = getTestOtcOrder();
            
            await expect(
                testUtils.fillOtcOrderAsync(order, order.takerAmount, taker, true)
            ).to.be.rejectedWith('MAKER_TOKEN_NOT_WETH');
            
            console.log(`✅ Correctly rejected unwrapWeth with non-WETH token`);
        });

        it('allows for fills on orders signed by a approved signer', async function() {
            const order = getTestOtcOrder({ maker: await contractWallet.getAddress() });
            const sig = await testUtils.createOrderSignature(order, contractWalletSigner);
            
            // Prepare balances
            await testUtils.prepareBalancesForOrdersAsync([order]);
            // Provide contract wallet with balance
            await makerToken.mint(await contractWallet.getAddress(), order.makerAmount);
            // Allow signer
            await contractWallet.connect(contractWalletOwner).registerAllowedOrderSigner(contractWalletSigner.address, true);
            
            // Fill should succeed
            const result = await otcFeature.connect(taker).fillOtcOrder(order, sig, order.takerAmount);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
            
            console.log(`✅ Filled order with approved contract signer`);
        });

        it('disallows fills if the signer is revoked', async function() {
            const order = getTestOtcOrder({ maker: await contractWallet.getAddress() });
            const sig = await testUtils.createOrderSignature(order, contractWalletSigner);
            
            // Prepare balances
            await testUtils.prepareBalancesForOrdersAsync([order]);
            await makerToken.mint(await contractWallet.getAddress(), order.makerAmount);
            
            // First allow signer
            await contractWallet.connect(contractWalletOwner).registerAllowedOrderSigner(contractWalletSigner.address, true);
            // Then disallow signer
            await contractWallet.connect(contractWalletOwner).registerAllowedOrderSigner(contractWalletSigner.address, false);
            
            // Fill should revert
            await expect(
                otcFeature.connect(taker).fillOtcOrder(order, sig, order.takerAmount)
            ).to.be.rejectedWith('OrderNotSignedByMakerError');
            
            console.log(`✅ Correctly rejected revoked signer`);
        });

        it("doesn't allow fills with an unapproved signer", async function() {
            const order = getTestOtcOrder({ maker: await contractWallet.getAddress() });
            const sig = await testUtils.createOrderSignature(order, maker);
            
            // Prepare balances
            await testUtils.prepareBalancesForOrdersAsync([order]);
            await makerToken.mint(await contractWallet.getAddress(), order.makerAmount);
            
            // Fill should revert
            await expect(
                otcFeature.connect(taker).fillOtcOrder(order, sig, order.takerAmount)
            ).to.be.rejectedWith('OrderNotSignedByMakerError');
            
            console.log(`✅ Correctly rejected unapproved signer`);
        });
    });

    describe('fillOtcOrderWithEth()', function() {
        it('Can fill an order with ETH (takerToken=WETH)', async function() {
            const order = getTestOtcOrder({ takerToken: await wethToken.getAddress() });
            const result = await testUtils.fillOtcOrderWithEthAsync(order);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
            
            console.log(`✅ Filled order with ETH (taker token = WETH)`);
        });

        it('Can fill an order with ETH (takerToken=ETH)', async function() {
            const order = getTestOtcOrder({ takerToken: ETH_TOKEN_ADDRESS });
            const makerEthBalanceBefore = await ethers.provider.getBalance(maker.address);
            
            const result = await testUtils.fillOtcOrderWithEthAsync(order);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            const takerBalance = await makerToken.balanceOf(taker.address);
            expect(takerBalance, 'taker balance').to.equal(order.makerAmount);
            
            const makerEthBalanceAfter = await ethers.provider.getBalance(maker.address);
            expect(makerEthBalanceAfter - makerEthBalanceBefore, 'maker balance').to.equal(order.takerAmount);
            
            console.log(`✅ Filled order with ETH (taker token = ETH)`);
        });

        it('Can partially fill an order with ETH (takerToken=WETH)', async function() {
            const order = getTestOtcOrder({ takerToken: await wethToken.getAddress() });
            const fillAmount = order.takerAmount - 1n;
            
            const result = await testUtils.fillOtcOrderWithEthAsync(order, fillAmount);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order, fillAmount);
            
            console.log(`✅ Partially filled order with ETH (WETH): ${ethers.formatEther(fillAmount.toString())}`);
        });

        it('Can partially fill an order with ETH (takerToken=ETH)', async function() {
            const order = getTestOtcOrder({ takerToken: ETH_TOKEN_ADDRESS });
            const fillAmount = order.takerAmount - 1n;
            const makerEthBalanceBefore = await ethers.provider.getBalance(maker.address);
            
            const result = await testUtils.fillOtcOrderWithEthAsync(order, fillAmount);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            const { makerTokenFilledAmount, takerTokenFilledAmount } = testUtils.computeOtcOrderFilledAmounts(order, fillAmount);
            const takerBalance = await makerToken.balanceOf(taker.address);
            expect(takerBalance, 'taker balance').to.equal(makerTokenFilledAmount);
            
            const makerEthBalanceAfter = await ethers.provider.getBalance(maker.address);
            expect(makerEthBalanceAfter - makerEthBalanceBefore, 'maker balance').to.equal(takerTokenFilledAmount);
            
            console.log(`✅ Partially filled order with ETH (ETH): ${ethers.formatEther(fillAmount.toString())}`);
        });

        it('Can refund excess ETH is msg.value > order.takerAmount (takerToken=WETH)', async function() {
            const order = getTestOtcOrder({ takerToken: await wethToken.getAddress() });
            const fillAmount = order.takerAmount + 420n;
            const takerEthBalanceBefore = await ethers.provider.getBalance(taker.address);
            
            const result = await testUtils.fillOtcOrderWithEthAsync(order, fillAmount);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            const takerEthBalanceAfter = await ethers.provider.getBalance(taker.address);
            expect(takerEthBalanceBefore - takerEthBalanceAfter).to.equal(order.takerAmount);
            
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
            
            console.log(`✅ Refunded excess ETH (WETH): sent ${ethers.formatEther(fillAmount.toString())}, used ${ethers.formatEther(order.takerAmount.toString())}`);
        });

        it('Can refund excess ETH is msg.value > order.takerAmount (takerToken=ETH)', async function() {
            const order = getTestOtcOrder({ takerToken: ETH_TOKEN_ADDRESS });
            const fillAmount = order.takerAmount + 420n;
            const takerEthBalanceBefore = await ethers.provider.getBalance(taker.address);
            const makerEthBalanceBefore = await ethers.provider.getBalance(maker.address);
            
            const result = await testUtils.fillOtcOrderWithEthAsync(order, fillAmount);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            const takerEthBalanceAfter = await ethers.provider.getBalance(taker.address);
            expect(takerEthBalanceBefore - takerEthBalanceAfter, 'taker eth balance').to.equal(order.takerAmount);
            
            const takerBalance = await makerToken.balanceOf(taker.address);
            expect(takerBalance, 'taker balance').to.equal(order.makerAmount);
            
            const makerEthBalanceAfter = await ethers.provider.getBalance(maker.address);
            expect(makerEthBalanceAfter - makerEthBalanceBefore, 'maker balance').to.equal(order.takerAmount);
            
            console.log(`✅ Refunded excess ETH (ETH): sent ${ethers.formatEther(fillAmount.toString())}, used ${ethers.formatEther(order.takerAmount.toString())}`);
        });

        it('Cannot fill an order if taker token is not ETH or WETH', async function() {
            const order = getTestOtcOrder();
            
            await expect(
                testUtils.fillOtcOrderWithEthAsync(order)
            ).to.be.rejectedWith('INVALID_TAKER_TOKEN');
            
            console.log(`✅ Correctly rejected invalid taker token for ETH fill`);
        });
    });

    describe('fillTakerSignedOtcOrder()', function() {
        it('can fully fill an order', async function() {
            const order = getTestOtcOrder({ taker: taker.address, txOrigin: txOrigin.address });
            const result = await testUtils.fillTakerSignedOtcOrderAsync(order);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
            
            console.log(`✅ Filled taker signed order`);
        });

        it('cannot fill an order with wrong tx.origin', async function() {
            const order = getTestOtcOrder({ taker: taker.address, txOrigin: txOrigin.address });
            
            await expect(
                testUtils.fillTakerSignedOtcOrderAsync(order, notTxOrigin)
            ).to.be.rejectedWith('OrderNotFillableByOriginError');
            
            console.log(`✅ Correctly rejected wrong tx.origin for taker signed order`);
        });

        it('can fill an order from a different tx.origin if registered', async function() {
            const order = getTestOtcOrder({ taker: taker.address, txOrigin: txOrigin.address });
            await deployment.zeroEx.connect(txOrigin).registerAllowedRfqOrigins([notTxOrigin.address], true);
            
            const result = await testUtils.fillTakerSignedOtcOrderAsync(order, notTxOrigin);
            await result.wait();
            
            console.log(`✅ Filled taker signed order with registered tx.origin`);
        });

        it('cannot fill an order with registered then unregistered tx.origin', async function() {
            const order = getTestOtcOrder({ taker: taker.address, txOrigin: txOrigin.address });
            await deployment.zeroEx.connect(txOrigin).registerAllowedRfqOrigins([notTxOrigin.address], true);
            await deployment.zeroEx.connect(txOrigin).registerAllowedRfqOrigins([notTxOrigin.address], false);
            
            await expect(
                testUtils.fillTakerSignedOtcOrderAsync(order, notTxOrigin)
            ).to.be.rejectedWith('OrderNotFillableByOriginError');
            
            console.log(`✅ Correctly rejected unregistered tx.origin for taker signed order`);
        });

        it('can fill two orders that use the same nonce bucket and increasing nonces', async function() {
            const order1 = getTestOtcOrder({ taker: taker.address, txOrigin: txOrigin.address });
            const result1 = await testUtils.fillTakerSignedOtcOrderAsync(order1);
            const receipt1 = await result1.wait();
            
            const fillEvent1 = receipt1.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent1).to.not.be.undefined;
            
            const order2 = getTestOtcOrder({
                taker: taker.address,
                txOrigin: txOrigin.address,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce + 1n
            });
            const result2 = await testUtils.fillTakerSignedOtcOrderAsync(order2);
            const receipt2 = await result2.wait();
            
            const fillEvent2 = receipt2.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent2).to.not.be.undefined;
            
            console.log(`✅ Filled taker signed orders with increasing nonces`);
        });

        it('can fill two orders that use the same nonce but different nonce buckets', async function() {
            const order1 = getTestOtcOrder({ taker: taker.address, txOrigin: txOrigin.address });
            const result1 = await testUtils.fillTakerSignedOtcOrderAsync(order1);
            const receipt1 = await result1.wait();
            
            const fillEvent1 = receipt1.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent1).to.not.be.undefined;
            
            const order2 = getTestOtcOrder({ 
                taker: taker.address, 
                txOrigin: txOrigin.address, 
                nonce: order1.nonce 
            });
            const result2 = await testUtils.fillTakerSignedOtcOrderAsync(order2);
            const receipt2 = await result2.wait();
            
            const fillEvent2 = receipt2.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent2).to.not.be.undefined;
            
            console.log(`✅ Filled taker signed orders with same nonce, different buckets`);
        });

        it('can fill a WETH buy order and receive ETH', async function() {
            const takerEthBalanceBefore = await ethers.provider.getBalance(taker.address);
            const order = getTestOtcOrder({
                taker: taker.address,
                txOrigin: txOrigin.address,
                makerToken: await wethToken.getAddress(),
                makerAmount: ethers.parseEther('1')
            });
            
            await wethToken.connect(maker).deposit({ value: order.makerAmount });
            
            const result = await testUtils.fillTakerSignedOtcOrderAsync(order, txOrigin, taker, true);
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            const takerEthBalanceAfter = await ethers.provider.getBalance(taker.address);
            expect(takerEthBalanceAfter - takerEthBalanceBefore).to.equal(order.makerAmount);
            
            console.log(`✅ Filled taker signed WETH order and received ETH: ${ethers.formatEther(order.makerAmount.toString())}`);
        });

        it('reverts if `unwrapWeth` is true but maker token is not WETH', async function() {
            const order = getTestOtcOrder({ taker: taker.address, txOrigin: txOrigin.address });
            
            await expect(
                testUtils.fillTakerSignedOtcOrderAsync(order, txOrigin, taker, true)
            ).to.be.rejectedWith('MAKER_TOKEN_NOT_WETH');
            
            console.log(`✅ Correctly rejected unwrapWeth with non-WETH for taker signed order`);
        });
    });

    describe('batchFillTakerSignedOtcOrders()', function() {
        it('Fills multiple orders', async function() {
            const order1 = getTestOtcOrder({ taker: taker.address, txOrigin: txOrigin.address });
            const order2 = getTestOtcOrder({
                taker: notTaker.address,
                txOrigin: txOrigin.address,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce + 1n
            });
            
            await testUtils.prepareBalancesForOrdersAsync([order1], taker);
            await testUtils.prepareBalancesForOrdersAsync([order2], notTaker);
            
            const makerSig1 = await testUtils.createOrderSignature(order1);
            const makerSig2 = await testUtils.createOrderSignature(order2);
            const takerSig1 = await testUtils.createTakerSignature(order1, taker);
            const takerSig2 = await testUtils.createTakerSignature(order2, notTaker);
            
            const result = await otcFeature.connect(txOrigin).batchFillTakerSignedOtcOrders(
                [order1, order2],
                [makerSig1, makerSig2],
                [takerSig1, takerSig2],
                [false, false]
            );
            const receipt = await result.wait();
            
            const fillEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvents.length).to.equal(2);
            
            console.log(`✅ Batch filled ${fillEvents.length} taker signed orders`);
        });

        it('Fills multiple orders and unwraps WETH', async function() {
            const order1 = getTestOtcOrder({ taker: taker.address, txOrigin: txOrigin.address });
            const order2 = getTestOtcOrder({
                taker: notTaker.address,
                txOrigin: txOrigin.address,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce + 1n,
                makerToken: await wethToken.getAddress(),
                makerAmount: ethers.parseEther('1')
            });
            
            await testUtils.prepareBalancesForOrdersAsync([order1], taker);
            await testUtils.prepareBalancesForOrdersAsync([order2], notTaker);
            await wethToken.connect(maker).deposit({ value: order2.makerAmount });
            
            const makerSig1 = await testUtils.createOrderSignature(order1);
            const makerSig2 = await testUtils.createOrderSignature(order2);
            const takerSig1 = await testUtils.createTakerSignature(order1, taker);
            const takerSig2 = await testUtils.createTakerSignature(order2, notTaker);
            
            const result = await otcFeature.connect(txOrigin).batchFillTakerSignedOtcOrders(
                [order1, order2],
                [makerSig1, makerSig2],
                [takerSig1, takerSig2],
                [false, true] // Unwrap WETH for second order
            );
            const receipt = await result.wait();
            
            const fillEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvents.length).to.equal(2);
            
            console.log(`✅ Batch filled orders with WETH unwrapping`);
        });

        it('Skips over unfillable orders', async function() {
            const order1 = getTestOtcOrder({ taker: taker.address, txOrigin: txOrigin.address });
            const order2 = getTestOtcOrder({
                taker: notTaker.address,
                txOrigin: txOrigin.address,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce + 1n
            });
            
            await testUtils.prepareBalancesForOrdersAsync([order1], taker);
            await testUtils.prepareBalancesForOrdersAsync([order2], notTaker);
            
            const makerSig1 = await testUtils.createOrderSignature(order1);
            const makerSig2 = await testUtils.createOrderSignature(order2);
            const takerSig1 = await testUtils.createTakerSignature(order1, taker);
            const takerSig2 = await testUtils.createTakerSignature(order2, taker); // Invalid signature for order2
            
            const result = await otcFeature.connect(txOrigin).batchFillTakerSignedOtcOrders(
                [order1, order2],
                [makerSig1, makerSig2],
                [takerSig1, takerSig2],
                [false, false]
            );
            const receipt = await result.wait();
            
            // Should only fill order1, skip order2 due to invalid taker signature
            const fillEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'OtcOrderFilled');
            expect(fillEvents.length).to.equal(1);
            
            console.log(`✅ Batch fill skipped unfillable order, filled ${fillEvents.length} orders`);
        });
    });
}); 