import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Signer, Contract } from 'ethers';
import {
    encodeFillQuoteTransformerData,
    FillQuoteTransformerBridgeOrder as BridgeOrder,
    FillQuoteTransformerData,
    FillQuoteTransformerLimitOrderInfo,
    FillQuoteTransformerOrderType as OrderType,
    FillQuoteTransformerRfqOrderInfo,
    FillQuoteTransformerSide as Side,
    LimitOrder,
    RfqOrder,
    Signature,
} from '@0x/protocol-utils';

describe('FillQuoteTransformer - Complete Modern Tests', function() {
    this.timeout(60000);
    
    let accounts: Signer[];
    let maker: Signer, feeRecipient: Signer, sender: Signer, taker: Signer;
    let makerAddress: string, feeRecipientAddress: string, senderAddress: string, takerAddress: string;
    
    let exchange: Contract;
    let bridge: Contract;
    let transformer: Contract;
    let host: Contract;
    let makerToken: Contract;
    let takerToken: Contract;
    let takerFeeToken: Contract;
    
    let singleProtocolFee: bigint;
    
    const GAS_PRICE = 1337n;
    const TEST_BRIDGE_SOURCE = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const HIGH_BIT = 2n ** 255n;
    const REVERT_AMOUNT = 0xdeadbeefn;
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    const NULL_BYTES = '0x';
    const MAX_UINT256 = 2n ** 256n - 1n;
    const ZERO_AMOUNT = 0n;
    
    interface QuoteFillResults {
        takerTokensSpent: bigint;
        makerTokensBought: bigint;
        protocolFeePaid: bigint;
    }
    
    interface FillOrderResults {
        takerTokenSoldAmount: bigint;
        makerTokenBoughtAmount: bigint;
        protocolFeePaid: bigint;
    }
    
    interface SimulationState {
        ethBalance: bigint;
        takerTokenBalance: bigint;
    }
    
    interface Balances {
        makerTokenBalance: bigint;
        takerTokensBalance: bigint;
        takerFeeBalance: bigint;
        ethBalance: bigint;
    }
    
    const EMPTY_FILL_ORDER_RESULTS: FillOrderResults = {
        takerTokenSoldAmount: ZERO_AMOUNT,
        makerTokenBoughtAmount: ZERO_AMOUNT,
        protocolFeePaid: ZERO_AMOUNT,
    };
    
    const ZERO_BALANCES: Balances = {
        makerTokenBalance: ZERO_AMOUNT,
        takerTokensBalance: ZERO_AMOUNT,
        takerFeeBalance: ZERO_AMOUNT,
        ethBalance: ZERO_AMOUNT,
    };
    
    before(async function() {
        console.log('🚀 Setting up FillQuoteTransformer test environment...');
        
        accounts = await ethers.getSigners();
        [maker, feeRecipient, sender, taker] = accounts.slice(0, 4);
        
        makerAddress = await maker.getAddress();
        feeRecipientAddress = await feeRecipient.getAddress();
        senderAddress = await sender.getAddress();
        takerAddress = await taker.getAddress();
        
        // Deploy test contracts
        const TestFillQuoteTransformerExchange = await ethers.getContractFactory('TestFillQuoteTransformerExchange');
        exchange = await TestFillQuoteTransformerExchange.deploy();
        await exchange.waitForDeployment();
        
        const EthereumBridgeAdapter = await ethers.getContractFactory('EthereumBridgeAdapter');
        const bridgeAdapter = await EthereumBridgeAdapter.deploy(NULL_ADDRESS);
        await bridgeAdapter.waitForDeployment();
        
        const FillQuoteTransformer = await ethers.getContractFactory('FillQuoteTransformer');
        transformer = await FillQuoteTransformer.deploy(
            await bridgeAdapter.getAddress(),
            await exchange.getAddress()
        );
        await transformer.waitForDeployment();
        
        const TestFillQuoteTransformerHost = await ethers.getContractFactory('TestFillQuoteTransformerHost');
        host = await TestFillQuoteTransformerHost.deploy();
        await host.waitForDeployment();
        
        const TestFillQuoteTransformerBridge = await ethers.getContractFactory('TestFillQuoteTransformerBridge');
        bridge = await TestFillQuoteTransformerBridge.connect(sender).deploy();
        await bridge.waitForDeployment();
        
        // Deploy test tokens
        const TestMintableERC20Token = await ethers.getContractFactory('TestMintableERC20Token');
        
        makerToken = await TestMintableERC20Token.deploy();
        await makerToken.waitForDeployment();
        
        takerToken = await TestMintableERC20Token.deploy();
        await takerToken.waitForDeployment();
        
        takerFeeToken = await TestMintableERC20Token.deploy();
        await takerFeeToken.waitForDeployment();
        
        // Get protocol fee
        singleProtocolFee = BigInt((await exchange.getProtocolFeeMultiplier()).toString()) * GAS_PRICE;
        
        console.log('✅ Test environment setup complete!');
    });
    
    function createBridgeOrder(fields: Partial<BridgeOrder> = {}): BridgeOrder {
        return {
            source: TEST_BRIDGE_SOURCE,
            takerTokenAmount: ethers.parseEther('1'),
            makerTokenAmount: ethers.parseEther('2'),
            bridgeData: encodeBridgeData(ethers.parseEther('2')),
            ...fields,
        };
    }
    
    function createLimitOrder(fields: Partial<LimitOrder> = {}): LimitOrder {
        return {
            makerToken: makerToken.target || makerToken.address,
            takerToken: takerToken.target || takerToken.address,
            makerAmount: ethers.parseEther('2'),
            takerAmount: ethers.parseEther('1'),
            takerTokenFeeAmount: ethers.parseEther('0.1'),
            maker: makerAddress,
            taker: NULL_ADDRESS,
            sender: NULL_ADDRESS,
            feeRecipient: feeRecipientAddress,
            pool: NULL_BYTES,
            expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
            salt: BigInt(Date.now()),
            ...fields,
        };
    }
    
    function createRfqOrder(fields: Partial<RfqOrder> = {}): RfqOrder {
        return {
            makerToken: makerToken.target || makerToken.address,
            takerToken: takerToken.target || takerToken.address,
            makerAmount: ethers.parseEther('2'),
            takerAmount: ethers.parseEther('1'),
            maker: makerAddress,
            taker: takerAddress,
            txOrigin: senderAddress,
            pool: NULL_BYTES,
            expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
            salt: BigInt(Date.now()),
            ...fields,
        };
    }
    
    function createOrderSignature(preFilledTakerAmount: bigint = ZERO_AMOUNT): Signature {
        // Simple signature for testing
        return {
            signatureType: 2, // EthSign
            v: 27,
            r: `0x${preFilledTakerAmount.toString(16).padStart(64, '0')}`,
            s: '0x0000000000000000000000000000000000000000000000000000000000000000',
        };
    }
    
    function encodeBridgeData(boughtAmount: bigint): string {
        return ethers.solidityPacked(['bytes32', 'bytes32'], [
            TEST_BRIDGE_SOURCE,
            `0x${boughtAmount.toString(16).padStart(64, '0')}`
        ]);
    }
    
    function decodeBridgeData(encoded: string): { bridge: string; boughtAmount: bigint } {
        return {
            bridge: encoded.slice(0, 66), // 0x + 64 chars
            boughtAmount: BigInt(encoded.slice(66, 130)), // next 64 chars
        };
    }
    
    function createTransformData(fields: Partial<FillQuoteTransformerData> = {}): FillQuoteTransformerData {
        return {
            side: Side.Sell,
            sellToken: takerToken.target || takerToken.address,
            buyToken: makerToken.target || makerToken.address,
            bridgeOrders: [],
            limitOrders: [],
            otcOrders: [],
            rfqOrders: [],
            fillSequence: [],
            fillAmount: MAX_UINT256,
            refundReceiver: NULL_ADDRESS,
            ...fields,
        };
    }
    
    function createSimulationState(fields: Partial<SimulationState> = {}): SimulationState {
        return {
            ethBalance: ZERO_AMOUNT,
            takerTokenBalance: ZERO_AMOUNT,
            ...fields,
        };
    }
    
    function orderSignatureToPreFilledTakerAmount(signature: Signature): bigint {
        return BigInt(signature.r);
    }
    
    function normalizeFillAmount(raw: bigint, balance: bigint): bigint {
        if (raw >= HIGH_BIT) {
            return ((raw - HIGH_BIT) * balance) / (10n ** 18n);
        }
        return raw;
    }
    
    function encodeFractionalFillAmount(frac: number): bigint {
        return HIGH_BIT + BigInt(Math.floor(frac * 1e18));
    }
    
    function getExpectedQuoteFillResults(
        data: FillQuoteTransformerData,
        state: SimulationState = createSimulationState()
    ): QuoteFillResults {
        let takerTokenBalanceRemaining = state.takerTokenBalance;
        if (data.side === Side.Sell && data.fillAmount !== MAX_UINT256) {
            takerTokenBalanceRemaining = data.fillAmount;
        }
        let ethBalanceRemaining = state.ethBalance;
        let soldAmount = ZERO_AMOUNT;
        let boughtAmount = ZERO_AMOUNT;
        const fillAmount = normalizeFillAmount(data.fillAmount, state.takerTokenBalance);
        const orderIndices = [0, 0, 0];
        
        function computeTakerTokenFillAmount(
            orderTakerTokenAmount: bigint,
            orderMakerTokenAmount: bigint,
            orderTakerTokenFeeAmount: bigint = ZERO_AMOUNT
        ): bigint {
            let takerTokenFillAmount = ZERO_AMOUNT;
            if (data.side === Side.Sell) {
                takerTokenFillAmount = fillAmount - soldAmount;
                if (orderTakerTokenFeeAmount > 0n) {
                    takerTokenFillAmount = (takerTokenFillAmount * orderTakerTokenAmount) / 
                        (orderTakerTokenAmount + orderTakerTokenFeeAmount);
                }
            } else {
                // Buy
                takerTokenFillAmount = ((fillAmount - boughtAmount) * orderTakerTokenAmount) / orderMakerTokenAmount;
            }
            
            if (takerTokenFillAmount > orderTakerTokenAmount) takerTokenFillAmount = orderTakerTokenAmount;
            if (takerTokenFillAmount > takerTokenBalanceRemaining) takerTokenFillAmount = takerTokenBalanceRemaining;
            
            return takerTokenFillAmount;
        }
        
        function fillBridgeOrder(order: BridgeOrder): FillOrderResults {
            const bridgeBoughtAmount = decodeBridgeData(order.bridgeData).boughtAmount;
            if (bridgeBoughtAmount === REVERT_AMOUNT) {
                return EMPTY_FILL_ORDER_RESULTS;
            }
            return {
                ...EMPTY_FILL_ORDER_RESULTS,
                takerTokenSoldAmount: computeTakerTokenFillAmount(order.takerTokenAmount, order.makerTokenAmount),
                makerTokenBoughtAmount: bridgeBoughtAmount,
            };
        }
        
        function fillLimitOrder(oi: FillQuoteTransformerLimitOrderInfo): FillOrderResults {
            const preFilledTakerAmount = orderSignatureToPreFilledTakerAmount(oi.signature);
            if (preFilledTakerAmount >= oi.order.takerAmount || preFilledTakerAmount === REVERT_AMOUNT) {
                return EMPTY_FILL_ORDER_RESULTS;
            }
            if (ethBalanceRemaining < singleProtocolFee) {
                return EMPTY_FILL_ORDER_RESULTS;
            }
            const takerTokenFillAmount = computeTakerTokenFillAmount(
                oi.order.takerAmount, 
                oi.order.makerAmount, 
                oi.order.takerTokenFeeAmount
            );
            
            if (takerTokenFillAmount > oi.order.takerAmount - preFilledTakerAmount) {
                return EMPTY_FILL_ORDER_RESULTS;
            }
            if (takerTokenFillAmount > oi.maxTakerTokenFillAmount) {
                return EMPTY_FILL_ORDER_RESULTS;
            }
            
            const fillRatio = takerTokenFillAmount * 10n ** 18n / oi.order.takerAmount;
            return {
                ...EMPTY_FILL_ORDER_RESULTS,
                takerTokenSoldAmount: takerTokenFillAmount + (fillRatio * oi.order.takerTokenFeeAmount / 10n ** 18n),
                makerTokenBoughtAmount: fillRatio * oi.order.makerAmount / 10n ** 18n,
                protocolFeePaid: singleProtocolFee,
            };
        }
        
        function fillRfqOrder(oi: FillQuoteTransformerRfqOrderInfo): FillOrderResults {
            const preFilledTakerAmount = orderSignatureToPreFilledTakerAmount(oi.signature);
            if (preFilledTakerAmount >= oi.order.takerAmount || preFilledTakerAmount === REVERT_AMOUNT) {
                return EMPTY_FILL_ORDER_RESULTS;
            }
            const takerTokenFillAmount = computeTakerTokenFillAmount(oi.order.takerAmount, oi.order.makerAmount);
            
            if (takerTokenFillAmount > oi.order.takerAmount - preFilledTakerAmount) {
                return EMPTY_FILL_ORDER_RESULTS;
            }
            if (takerTokenFillAmount > oi.maxTakerTokenFillAmount) {
                return EMPTY_FILL_ORDER_RESULTS;
            }
            
            const fillRatio = takerTokenFillAmount * 10n ** 18n / oi.order.takerAmount;
            return {
                ...EMPTY_FILL_ORDER_RESULTS,
                takerTokenSoldAmount: takerTokenFillAmount,
                makerTokenBoughtAmount: fillRatio * oi.order.makerAmount / 10n ** 18n,
            };
        }
        
        for (let i = 0; i < data.fillSequence.length; ++i) {
            const orderType = data.fillSequence[i];
            if (data.side === Side.Sell) {
                if (soldAmount >= fillAmount) break;
            } else {
                if (boughtAmount >= fillAmount) break;
            }
            
            let results = EMPTY_FILL_ORDER_RESULTS;
            switch (orderType) {
                case OrderType.Bridge:
                    results = fillBridgeOrder(data.bridgeOrders[orderIndices[orderType]]);
                    break;
                case OrderType.Limit:
                    results = fillLimitOrder(data.limitOrders[orderIndices[orderType]]);
                    break;
                case OrderType.Rfq:
                    results = fillRfqOrder(data.rfqOrders[orderIndices[orderType]]);
                    break;
                default:
                    throw new Error('Unknown order type');
            }
            
            soldAmount += results.takerTokenSoldAmount;
            boughtAmount += results.makerTokenBoughtAmount;
            ethBalanceRemaining -= results.protocolFeePaid;
            takerTokenBalanceRemaining -= results.takerTokenSoldAmount;
            orderIndices[orderType]++;
        }
        
        return {
            takerTokensSpent: soldAmount,
            makerTokensBought: boughtAmount,
            protocolFeePaid: state.ethBalance - ethBalanceRemaining,
        };
    }
    
    async function getBalancesAsync(owner: string): Promise<Balances> {
        const [makerBalance, takerBalance, feeBalance, ethBalance] = await Promise.all([
            makerToken.balanceOf(owner),
            takerToken.balanceOf(owner),
            takerFeeToken.balanceOf(owner),
            ethers.provider.getBalance(owner),
        ]);
        
        return {
            makerTokenBalance: BigInt(makerBalance.toString()),
            takerTokensBalance: BigInt(takerBalance.toString()),
            takerFeeBalance: BigInt(feeBalance.toString()),
            ethBalance: BigInt(ethBalance.toString()),
        };
    }
    
    function assertBalances(actual: Balances, expected: Balances): void {
        // Allow for small rounding differences
        const tolerance = 10n;
        
        function assertClose(actualVal: bigint, expectedVal: bigint, name: string): void {
            const diff = actualVal > expectedVal ? actualVal - expectedVal : expectedVal - actualVal;
            expect(diff).to.be.lte(tolerance, `${name} balance mismatch: ${actualVal} vs ${expectedVal}`);
        }
        
        assertClose(actual.makerTokenBalance, expected.makerTokenBalance, 'makerToken');
        assertClose(actual.takerTokensBalance, expected.takerTokensBalance, 'takerToken');
        assertClose(actual.takerFeeBalance, expected.takerFeeBalance, 'takerFee');
        assertClose(actual.ethBalance, expected.ethBalance, 'eth');
    }
    
    async function assertCurrentBalancesAsync(owner: string, expected: Balances): Promise<void> {
        assertBalances(await getBalancesAsync(owner), expected);
    }
    
    interface ExecuteTransformParams {
        takerTokenBalance: bigint;
        ethBalance: bigint;
        sender: string;
        taker: string;
        data: FillQuoteTransformerData;
    }
    
    async function executeTransformAsync(params: Partial<ExecuteTransformParams> = {}): Promise<any> {
        const data = params.data || createTransformData(params.data);
        const finalParams = {
            takerTokenBalance: data.fillAmount,
            sender: senderAddress,
            taker: takerAddress,
            data,
            ethBalance: ZERO_AMOUNT,
            ...params,
        };
        
        const result = await host.executeTransform(
            await transformer.getAddress(),
            takerToken.target || takerToken.address,
            finalParams.takerTokenBalance,
            finalParams.sender,
            finalParams.taker,
            encodeFillQuoteTransformerData(finalParams.data),
            { value: finalParams.ethBalance }
        );
        
        return result.wait();
    }
    
    async function assertFinalBalancesAsync(qfr: QuoteFillResults): Promise<void> {
        await assertCurrentBalancesAsync(await host.getAddress(), {
            ...ZERO_BALANCES,
            makerTokenBalance: qfr.makerTokensBought,
        });
        await assertCurrentBalancesAsync(await exchange.getAddress(), {
            ...ZERO_BALANCES,
            ethBalance: qfr.protocolFeePaid
        });
    }
    
    describe('sell quotes', function() {
        it('can fully sell to a single bridge order with -1 fillAmount', async function() {
            console.log('🔄 Testing full sell to single bridge order with max fillAmount...');
            
            const bridgeOrders = [createBridgeOrder()];
            const data = createTransformData({
                bridgeOrders,
                fillAmount: bridgeOrders.reduce((sum, o) => sum + o.takerTokenAmount, 0n),
                fillSequence: bridgeOrders.map(() => OrderType.Bridge),
            });
            
            const qfr = getExpectedQuoteFillResults(data);
            await executeTransformAsync({
                takerTokenBalance: data.fillAmount,
                data: { ...data, fillAmount: MAX_UINT256 },
            });
            
            await assertFinalBalancesAsync(qfr);
            console.log('✅ Successfully sold to bridge order with max fillAmount');
        });
        
        it('can partially sell to a single bridge order with a fractional fillAmount', async function() {
            console.log('🔄 Testing partial sell to single bridge order with fractional fillAmount...');
            
            const bridgeOrders = [createBridgeOrder()];
            const totalTakerBalance = bridgeOrders.reduce((sum, o) => sum + o.takerTokenAmount, 0n);
            const data = createTransformData({
                bridgeOrders,
                fillAmount: encodeFractionalFillAmount(0.5),
                fillSequence: bridgeOrders.map(() => OrderType.Bridge),
            });
            
            const qfr = getExpectedQuoteFillResults(
                data,
                createSimulationState({ takerTokenBalance: totalTakerBalance })
            );
            
            await executeTransformAsync({
                takerTokenBalance: totalTakerBalance,
                data,
            });
            
            await assertCurrentBalancesAsync(await host.getAddress(), {
                ...ZERO_BALANCES,
                takerTokensBalance: totalTakerBalance - qfr.takerTokensSpent,
                makerTokenBalance: qfr.makerTokensBought,
            });
            
            console.log('✅ Successfully executed partial sell with fractional fillAmount');
        });
        
        it('fails if incomplete sell', async function() {
            console.log('🔄 Testing incomplete sell failure...');
            
            const bridgeOrders = [createBridgeOrder()];
            const data = createTransformData({
                bridgeOrders,
                fillAmount: bridgeOrders.reduce((sum, o) => sum + o.takerTokenAmount, 0n),
                fillSequence: bridgeOrders.map(() => OrderType.Bridge),
            });
            
            await expect(
                executeTransformAsync({
                    takerTokenBalance: data.fillAmount,
                    data: { ...data, fillAmount: data.fillAmount + 1n },
                })
            ).to.be.revertedWith('IncompleteFillSellQuoteError');
            
            console.log('✅ Correctly failed on incomplete sell');
        });
        
        it('can fully sell to a single bridge order', async function() {
            console.log('🔄 Testing full sell to single bridge order...');
            
            const bridgeOrders = [createBridgeOrder()];
            const data = createTransformData({
                bridgeOrders,
                fillAmount: bridgeOrders.reduce((sum, o) => sum + o.takerTokenAmount, 0n),
                fillSequence: bridgeOrders.map(() => OrderType.Bridge),
            });
            
            const qfr = getExpectedQuoteFillResults(data);
            await executeTransformAsync({
                takerTokenBalance: data.fillAmount,
                data,
            });
            
            await assertFinalBalancesAsync(qfr);
            console.log('✅ Successfully sold to single bridge order');
        });
        
        it('can fully sell to a single limit order', async function() {
            console.log('🔄 Testing full sell to single limit order...');
            
            const limitOrders = [createLimitOrder()];
            const data = createTransformData({
                limitOrders: limitOrders.map(o => ({
                    order: o,
                    maxTakerTokenFillAmount: MAX_UINT256,
                    signature: createOrderSignature(),
                })),
                fillAmount: limitOrders.reduce((sum, o) => sum + o.takerAmount + o.takerTokenFeeAmount, 0n),
                fillSequence: limitOrders.map(() => OrderType.Limit),
            });
            
            const qfr = getExpectedQuoteFillResults(
                data,
                createSimulationState({
                    ethBalance: singleProtocolFee * BigInt(limitOrders.length),
                })
            );
            
            await executeTransformAsync({
                data,
                takerTokenBalance: qfr.takerTokensSpent,
                ethBalance: qfr.protocolFeePaid,
            });
            
            await assertFinalBalancesAsync(qfr);
            console.log('✅ Successfully sold to single limit order');
        });
        
        it('can partial sell to a single limit order without fees', async function() {
            console.log('🔄 Testing partial sell to single limit order without fees...');
            
            const limitOrders = [createLimitOrder({ takerTokenFeeAmount: ZERO_AMOUNT })];
            const data = createTransformData({
                limitOrders: limitOrders.map(o => ({
                    order: o,
                    maxTakerTokenFillAmount: MAX_UINT256,
                    signature: createOrderSignature(),
                })),
                fillAmount: limitOrders.reduce((sum, o) => sum + o.takerAmount + o.takerTokenFeeAmount, 0n) / 2n,
                fillSequence: limitOrders.map(() => OrderType.Limit),
            });
            
            const qfr = getExpectedQuoteFillResults(
                data,
                createSimulationState({
                    ethBalance: singleProtocolFee * BigInt(limitOrders.length),
                })
            );
            
            await executeTransformAsync({
                data,
                takerTokenBalance: qfr.takerTokensSpent,
                ethBalance: qfr.protocolFeePaid,
            });
            
            await assertFinalBalancesAsync(qfr);
            console.log('✅ Successfully executed partial sell to limit order without fees');
        });
        
        it('can fully sell to a single RFQ order', async function() {
            console.log('🔄 Testing full sell to single RFQ order...');
            
            const rfqOrders = [createRfqOrder()];
            const data = createTransformData({
                rfqOrders: rfqOrders.map(o => ({
                    order: o,
                    maxTakerTokenFillAmount: MAX_UINT256,
                    signature: createOrderSignature(),
                })),
                fillAmount: rfqOrders.reduce((sum, o) => sum + o.takerAmount, 0n),
                fillSequence: rfqOrders.map(() => OrderType.Rfq),
            });
            
            const qfr = getExpectedQuoteFillResults(data, createSimulationState());
            await executeTransformAsync({
                data,
                takerTokenBalance: qfr.takerTokensSpent,
            });
            
            await assertFinalBalancesAsync(qfr);
            console.log('✅ Successfully sold to single RFQ order');
        });
        
        it('can fully sell to one of each order type', async function() {
            console.log('🔄 Testing full sell to mixed order types...');
            
            const rfqOrders = [createRfqOrder()];
            const limitOrders = [createLimitOrder()];
            const bridgeOrders = [createBridgeOrder()];
            
            const data = createTransformData({
                bridgeOrders,
                rfqOrders: rfqOrders.map(o => ({
                    order: o,
                    maxTakerTokenFillAmount: MAX_UINT256,
                    signature: createOrderSignature(),
                })),
                limitOrders: limitOrders.map(o => ({
                    order: o,
                    maxTakerTokenFillAmount: MAX_UINT256,
                    signature: createOrderSignature(),
                })),
                fillAmount: rfqOrders.reduce((sum, o) => sum + o.takerAmount, 0n) +
                          limitOrders.reduce((sum, o) => sum + o.takerAmount + o.takerTokenFeeAmount, 0n) +
                          bridgeOrders.reduce((sum, o) => sum + o.takerTokenAmount, 0n),
                fillSequence: [
                    ...bridgeOrders.map(() => OrderType.Bridge),
                    ...rfqOrders.map(() => OrderType.Rfq),
                    ...limitOrders.map(() => OrderType.Limit),
                ].sort(() => Math.random() - 0.5), // Random shuffle
            });
            
            const qfr = getExpectedQuoteFillResults(
                data,
                createSimulationState({
                    ethBalance: singleProtocolFee * BigInt(limitOrders.length),
                })
            );
            
            await executeTransformAsync({
                data,
                takerTokenBalance: qfr.takerTokensSpent,
                ethBalance: qfr.protocolFeePaid,
            });
            
            await assertFinalBalancesAsync(qfr);
            console.log('✅ Successfully sold to mixed order types');
        });
        
        it('can recover from a failed order', async function() {
            console.log('🔄 Testing recovery from failed order...');
            
            const rfqOrder = createRfqOrder();
            const limitOrder = createLimitOrder();
            const bridgeOrder = createBridgeOrder();
            
            // Make one order fail
            const failedOrderType = OrderType.Bridge;
            const fillSequence = [failedOrderType, OrderType.Rfq, OrderType.Limit];
            
            const data = createTransformData({
                fillSequence,
                bridgeOrders: [{
                    ...bridgeOrder,
                    bridgeData: failedOrderType === OrderType.Bridge ? 
                        encodeBridgeData(REVERT_AMOUNT) : bridgeOrder.bridgeData,
                }],
                rfqOrders: [{
                    order: rfqOrder,
                    maxTakerTokenFillAmount: MAX_UINT256,
                    signature: createOrderSignature(
                        failedOrderType === OrderType.Rfq ? REVERT_AMOUNT : ZERO_AMOUNT
                    ),
                }],
                limitOrders: [{
                    order: limitOrder,
                    maxTakerTokenFillAmount: MAX_UINT256,
                    signature: createOrderSignature(
                        failedOrderType === OrderType.Limit ? REVERT_AMOUNT : ZERO_AMOUNT
                    ),
                }],
                fillAmount: rfqOrder.takerAmount + limitOrder.takerAmount + limitOrder.takerTokenFeeAmount,
            });
            
            const qfr = getExpectedQuoteFillResults(
                data,
                createSimulationState({
                    ethBalance: singleProtocolFee,
                })
            );
            
            await executeTransformAsync({
                data,
                takerTokenBalance: qfr.takerTokensSpent,
                ethBalance: qfr.protocolFeePaid,
            });
            
            await assertFinalBalancesAsync(qfr);
            console.log('✅ Successfully recovered from failed order');
        });
    });
    
    describe('buy quotes', function() {
        it('fails if incomplete buy', async function() {
            console.log('🔄 Testing incomplete buy failure...');
            
            const bridgeOrders = [createBridgeOrder()];
            const data = createTransformData({
                bridgeOrders,
                side: Side.Buy,
                fillAmount: bridgeOrders.reduce((sum, o) => sum + o.makerTokenAmount, 0n),
                fillSequence: bridgeOrders.map(() => OrderType.Bridge),
            });
            
            await expect(
                executeTransformAsync({
                    takerTokenBalance: bridgeOrders.reduce((sum, o) => sum + o.takerTokenAmount, 0n),
                    data: { ...data, fillAmount: data.fillAmount + 1n },
                })
            ).to.be.revertedWith('IncompleteFillBuyQuoteError');
            
            console.log('✅ Correctly failed on incomplete buy');
        });
        
        it('can fully buy to a single bridge order', async function() {
            console.log('🔄 Testing full buy from single bridge order...');
            
            const bridgeOrders = [createBridgeOrder()];
            const totalTakerTokens = bridgeOrders.reduce((sum, o) => sum + o.takerTokenAmount, 0n);
            const data = createTransformData({
                bridgeOrders,
                side: Side.Buy,
                fillAmount: bridgeOrders.reduce((sum, o) => sum + o.makerTokenAmount, 0n),
                fillSequence: bridgeOrders.map(() => OrderType.Bridge),
            });
            
            const qfr = getExpectedQuoteFillResults(
                data,
                createSimulationState({ takerTokenBalance: totalTakerTokens })
            );
            
            await executeTransformAsync({
                takerTokenBalance: totalTakerTokens,
                data,
            });
            
            await assertFinalBalancesAsync(qfr);
            console.log('✅ Successfully bought from single bridge order');
        });
        
        it('can fully buy to a single limit order', async function() {
            console.log('🔄 Testing full buy from single limit order...');
            
            const limitOrders = [createLimitOrder()];
            const totalTakerTokens = limitOrders.reduce((sum, o) => sum + o.takerAmount + o.takerTokenFeeAmount, 0n);
            const data = createTransformData({
                side: Side.Buy,
                limitOrders: limitOrders.map(o => ({
                    order: o,
                    maxTakerTokenFillAmount: MAX_UINT256,
                    signature: createOrderSignature(),
                })),
                fillAmount: limitOrders.reduce((sum, o) => sum + o.makerAmount, 0n),
                fillSequence: limitOrders.map(() => OrderType.Limit),
            });
            
            const qfr = getExpectedQuoteFillResults(
                data,
                createSimulationState({
                    ethBalance: singleProtocolFee * BigInt(limitOrders.length),
                    takerTokenBalance: totalTakerTokens,
                })
            );
            
            await executeTransformAsync({
                data,
                takerTokenBalance: totalTakerTokens,
                ethBalance: qfr.protocolFeePaid,
            });
            
            await assertFinalBalancesAsync(qfr);
            console.log('✅ Successfully bought from single limit order');
        });
        
        it('can fully buy to a single RFQ order', async function() {
            console.log('🔄 Testing full buy from single RFQ order...');
            
            const rfqOrders = [createRfqOrder()];
            const totalTakerTokens = rfqOrders.reduce((sum, o) => sum + o.takerAmount, 0n);
            const data = createTransformData({
                side: Side.Buy,
                rfqOrders: rfqOrders.map(o => ({
                    order: o,
                    maxTakerTokenFillAmount: MAX_UINT256,
                    signature: createOrderSignature(),
                })),
                fillAmount: rfqOrders.reduce((sum, o) => sum + o.makerAmount, 0n),
                fillSequence: rfqOrders.map(() => OrderType.Rfq),
            });
            
            const qfr = getExpectedQuoteFillResults(
                data,
                createSimulationState({ takerTokenBalance: totalTakerTokens })
            );
            
            await executeTransformAsync({
                data,
                takerTokenBalance: qfr.takerTokensSpent,
            });
            
            await assertFinalBalancesAsync(qfr);
            console.log('✅ Successfully bought from single RFQ order');
        });
        
        it('can partially buy to a single RFQ order', async function() {
            console.log('🔄 Testing partial buy from single RFQ order...');
            
            const rfqOrders = [createRfqOrder()];
            const totalTakerTokens = rfqOrders.reduce((sum, o) => sum + o.takerAmount, 0n);
            const data = createTransformData({
                side: Side.Buy,
                rfqOrders: rfqOrders.map(o => ({
                    order: o,
                    maxTakerTokenFillAmount: MAX_UINT256,
                    signature: createOrderSignature(),
                })),
                fillAmount: rfqOrders.reduce((sum, o) => sum + o.makerAmount, 0n) / 2n,
                fillSequence: rfqOrders.map(() => OrderType.Rfq),
            });
            
            const qfr = getExpectedQuoteFillResults(
                data,
                createSimulationState({ takerTokenBalance: totalTakerTokens })
            );
            
            await executeTransformAsync({
                data,
                takerTokenBalance: qfr.takerTokensSpent,
            });
            
            await assertFinalBalancesAsync(qfr);
            console.log('✅ Successfully executed partial buy from RFQ order');
        });
        
        it('can fully buy to one of each order type', async function() {
            console.log('🔄 Testing full buy from mixed order types...');
            
            const rfqOrders = [createRfqOrder()];
            const limitOrders = [createLimitOrder()];
            const bridgeOrders = [createBridgeOrder()];
            const totalTakerTokens = rfqOrders.reduce((sum, o) => sum + o.takerAmount, 0n) +
                                  limitOrders.reduce((sum, o) => sum + o.takerAmount + o.takerTokenFeeAmount, 0n) +
                                  bridgeOrders.reduce((sum, o) => sum + o.takerTokenAmount, 0n);
            
            const data = createTransformData({
                side: Side.Buy,
                bridgeOrders,
                rfqOrders: rfqOrders.map(o => ({
                    order: o,
                    maxTakerTokenFillAmount: MAX_UINT256,
                    signature: createOrderSignature(),
                })),
                limitOrders: limitOrders.map(o => ({
                    order: o,
                    maxTakerTokenFillAmount: MAX_UINT256,
                    signature: createOrderSignature(),
                })),
                fillAmount: rfqOrders.reduce((sum, o) => sum + o.makerAmount, 0n) +
                          limitOrders.reduce((sum, o) => sum + o.makerAmount, 0n) +
                          bridgeOrders.reduce((sum, o) => sum + o.makerTokenAmount, 0n),
                fillSequence: [
                    ...bridgeOrders.map(() => OrderType.Bridge),
                    ...rfqOrders.map(() => OrderType.Rfq),
                    ...limitOrders.map(() => OrderType.Limit),
                ].sort(() => Math.random() - 0.5), // Random shuffle
            });
            
            const qfr = getExpectedQuoteFillResults(
                data,
                createSimulationState({
                    ethBalance: singleProtocolFee * BigInt(limitOrders.length),
                    takerTokenBalance: totalTakerTokens,
                })
            );
            
            await executeTransformAsync({
                data,
                takerTokenBalance: qfr.takerTokensSpent,
                ethBalance: qfr.protocolFeePaid,
            });
            
            await assertFinalBalancesAsync(qfr);
            console.log('✅ Successfully bought from mixed order types');
        });
    });
    
    afterEach(function() {
        // Log test completion
        console.log(`✅ Test completed: ${this.currentTest?.title}`);
    });
}); 