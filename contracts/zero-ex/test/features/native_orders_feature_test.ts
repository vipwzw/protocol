import { ethers } from "ethers";
import {
    blockchainTests,
    constants,
    describe,
    expect,
    getRandomPortion,
    randomAddress,
    verifyEventsFromLogs,
} from '@0x/test-utils';
import {
    LimitOrder,
    LimitOrderFields,
    OrderStatus,
    RevertErrors,
    RfqOrder,
    RfqOrderFields,
    SignatureType,
} from '@0x/protocol-utils';
import { AnyRevertError } from '@0x/utils';
import { TransactionReceiptWithDecodedLogs } from 'ethereum-types';

import { 
    IZeroExContract, 
    IZeroExEvents,
    TestMintableERC20Token__factory,
    TestRfqOriginRegistration__factory,
    TestOrderSignerRegistryWithContractWallet__factory
} from '../../src/wrappers';
import { artifacts } from '../artifacts';
import { fullMigrateAsync } from '../utils/migration';
import {
    assertOrderInfoEquals,
    computeLimitOrderFilledAmounts,
    computeRfqOrderFilledAmounts,
    createExpiry,
    getActualFillableTakerTokenAmount,
    getFillableMakerTokenAmount,
    getRandomLimitOrder,
    getRandomRfqOrder,
    NativeOrdersTestEnvironment,
} from '../utils/orders';
import {
    TestMintableERC20TokenContract,
    TestOrderSignerRegistryWithContractWalletContract,
    TestRfqOriginRegistrationContract,
} from '../wrappers';

blockchainTests('NativeOrdersFeature', env => {
    const { NULL_ADDRESS, MAX_UINT256, NULL_BYTES32, ZERO_AMOUNT } = constants;
    const GAS_PRICE = 123000000000n;
    const PROTOCOL_FEE_MULTIPLIER = 1337000n;
    const SINGLE_PROTOCOL_FEE = GAS_PRICE * PROTOCOL_FEE_MULTIPLIER;
    let maker: string;
    let taker: string;
    let notMaker: string;
    let notTaker: string;
    let contractWalletOwner: string;
    let contractWalletSigner: string;
    let zeroEx: IZeroExContract;
    let verifyingContract: string;
    let makerToken: TestMintableERC20TokenContract;
    let takerToken: TestMintableERC20TokenContract;
    let wethToken: TestMintableERC20TokenContract;
    let testRfqOriginRegistration: TestRfqOriginRegistrationContract;
    let contractWallet: TestOrderSignerRegistryWithContractWalletContract;
    let testUtils: NativeOrdersTestEnvironment;

    before(async () => {
        let owner;
        [owner, maker, taker, notMaker, notTaker, contractWalletOwner, contractWalletSigner] =
            await env.getAccountAddressesAsync();
        
        const signer = await env.provider.getSigner(owner);
        const tokenFactories = [...new Array(3)].map(() => new TestMintableERC20Token__factory(signer));
        const tokenDeployments = await Promise.all(
            tokenFactories.map(factory => factory.deploy())
        );
        await Promise.all(tokenDeployments.map(token => token.waitForDeployment()));
        [makerToken, takerToken, wethToken] = tokenDeployments;
        
        zeroEx = await fullMigrateAsync(
            owner,
            env.provider,
            { ...env.txDefaults, gasPrice: GAS_PRICE },
            {},
            { wethAddress: await wethToken.getAddress(), protocolFeeMultiplier: PROTOCOL_FEE_MULTIPLIER },
            { nativeOrders: artifacts.TestNativeOrdersFeature },
        );
        verifyingContract = await zeroEx.getAddress();
        
        await Promise.all(
            [maker, notMaker].map(async a => {
                const aSigner = await env.provider.getSigner(a);
                return makerToken.connect(aSigner).approve(await zeroEx.getAddress(), MAX_UINT256);
            }),
        );
        await Promise.all(
            [taker, notTaker].map(async a => {
                const aSigner = await env.provider.getSigner(a);
                return takerToken.connect(aSigner).approve(await zeroEx.getAddress(), MAX_UINT256);
            }),
        );
        
        const testRfqOriginRegistrationFactory = new TestRfqOriginRegistration__factory(signer);
        testRfqOriginRegistration = await testRfqOriginRegistrationFactory.deploy();
        await testRfqOriginRegistration.waitForDeployment();
        
        // contract wallet for signer delegation
        const contractWalletOwnerSigner = await env.provider.getSigner(contractWalletOwner);
        const contractWalletFactory = new TestOrderSignerRegistryWithContractWallet__factory(contractWalletOwnerSigner);
        contractWallet = await contractWalletFactory.deploy(await zeroEx.getAddress());
        await contractWallet.waitForDeployment();

        await contractWallet
            .connect(contractWalletOwnerSigner)
            .approveERC20(await makerToken.getAddress(), await zeroEx.getAddress(), MAX_UINT256);

        testUtils = new NativeOrdersTestEnvironment(
            maker,
            taker,
            makerToken,
            takerToken,
            zeroEx,
            GAS_PRICE,
            SINGLE_PROTOCOL_FEE,
            env,
        );
    });

    async function getTestLimitOrder(fields: Partial<LimitOrderFields> = {}): Promise<LimitOrder> {
        return getRandomLimitOrder({
            maker,
            verifyingContract,
            chainId: 1337,
            takerToken: await takerToken.getAddress(),
            makerToken: await makerToken.getAddress(),
            taker: NULL_ADDRESS,
            sender: NULL_ADDRESS,
            ...fields,
        });
    }

    async function getTestRfqOrder(fields: Partial<RfqOrderFields> = {}): Promise<RfqOrder> {
        return getRandomRfqOrder({
            maker,
            verifyingContract,
            chainId: 1337,
            takerToken: await takerToken.getAddress(),
            makerToken: await makerToken.getAddress(),
            txOrigin: taker,
            ...fields,
        });
    }

    describe('getProtocolFeeMultiplier()', () => {
        it('returns the protocol fee multiplier', async () => {
            const r = await zeroEx.getProtocolFeeMultiplier()();
            expect(r).to.eq(PROTOCOL_FEE_MULTIPLIER);
        });
    });

    describe('getLimitOrderHash()', () => {
        it('returns the correct hash', async () => {
            const order = await getTestLimitOrder();
            const hash = await zeroEx.getLimitOrderHash(order)();
            expect(hash).to.eq(order.getHash());
        });
    });

    describe('getRfqOrderHash()', () => {
        it('returns the correct hash', async () => {
            const order = await getTestRfqOrder();
            const hash = await zeroEx.getRfqOrderHash(order)();
            expect(hash).to.eq(order.getHash());
        });
    });

    describe('getLimitOrderInfo()', () => {
        it('unfilled order', async () => {
            const order = await getTestLimitOrder();
            const info = await zeroEx.getLimitOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Fillable,
                orderHash: order.getHash(),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
        });

        it('unfilled cancelled order', async () => {
            const order = await getTestLimitOrder();
            await zeroEx.cancelLimitOrder(order)({ from: maker });
            const info = await zeroEx.getLimitOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Cancelled,
                orderHash: order.getHash(),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
        });

        it('unfilled expired order', async () => {
            const order = await getTestLimitOrder({ expiry: createExpiry(-60) });
            const info = await zeroEx.getLimitOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Expired,
                orderHash: order.getHash(),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
        });

        it('filled then expired order', async () => {
            const expiry = createExpiry(60);
            const order = await getTestLimitOrder({ expiry });
            // Fill the order first.
            await testUtils.fillLimitOrderAsync(order);
            // Advance time to expire the order.
            await env.web3Wrapper.increaseTimeAsync(61);
            const info = await zeroEx.getLimitOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled, // Still reports filled.
                orderHash: order.getHash(),
                takerTokenFilledAmount: order.takerAmount,
            });
        });

        it('filled order', async () => {
            const order = await getTestLimitOrder();
            // Fill the order first.
            await testUtils.fillLimitOrderAsync(order);
            const info = await zeroEx.getLimitOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled,
                orderHash: order.getHash(),
                takerTokenFilledAmount: order.takerAmount,
            });
        });

        it('partially filled order', async () => {
            const order = await getTestLimitOrder();
            const fillAmount = order.takerAmount - 1;
            // Fill the order first.
            await testUtils.fillLimitOrderAsync(order, { fillAmount });
            const info = await zeroEx.getLimitOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Fillable,
                orderHash: order.getHash(),
                takerTokenFilledAmount: fillAmount,
            });
        });

        it('filled then cancelled order', async () => {
            const order = await getTestLimitOrder();
            // Fill the order first.
            await testUtils.fillLimitOrderAsync(order);
            await zeroEx.cancelLimitOrder(order)({ from: maker });
            const info = await zeroEx.getLimitOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled, // Still reports filled.
                orderHash: order.getHash(),
                takerTokenFilledAmount: order.takerAmount,
            });
        });

        it('partially filled then cancelled order', async () => {
            const order = await getTestLimitOrder();
            const fillAmount = order.takerAmount - 1;
            // Fill the order first.
            await testUtils.fillLimitOrderAsync(order, { fillAmount });
            await zeroEx.cancelLimitOrder(order)({ from: maker });
            const info = await zeroEx.getLimitOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Cancelled,
                orderHash: order.getHash(),
                takerTokenFilledAmount: fillAmount,
            });
        });
    });

    describe('getRfqOrderInfo()', () => {
        it('unfilled order', async () => {
            const order = await getTestRfqOrder();
            const info = await zeroEx.getRfqOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Fillable,
                orderHash: order.getHash(),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
        });

        it('unfilled cancelled order', async () => {
            const order = await getTestRfqOrder();
            await zeroEx.cancelRfqOrder(order)({ from: maker });
            const info = await zeroEx.getRfqOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Cancelled,
                orderHash: order.getHash(),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
        });

        it('unfilled expired order', async () => {
            const expiry = createExpiry(-60);
            const order = await getTestRfqOrder({ expiry });
            const info = await zeroEx.getRfqOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Expired,
                orderHash: order.getHash(),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
        });

        it('filled then expired order', async () => {
            const expiry = createExpiry(60);
            const order = await getTestRfqOrder({ expiry });
            await testUtils.prepareBalancesForOrdersAsync([order]);
            const sig = await order.getSignatureWithProviderAsync(env.provider);
            // Fill the order first.
            await zeroEx.fillRfqOrder(order, sig, order.takerAmount)({ from: taker });
            // Advance time to expire the order.
            await env.web3Wrapper.increaseTimeAsync(61);
            const info = await zeroEx.getRfqOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled, // Still reports filled.
                orderHash: order.getHash(),
                takerTokenFilledAmount: order.takerAmount,
            });
        });

        it('filled order', async () => {
            const order = await getTestRfqOrder();
            // Fill the order first.
            await testUtils.fillRfqOrderAsync(order, order.takerAmount, taker);
            const info = await zeroEx.getRfqOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled,
                orderHash: order.getHash(),
                takerTokenFilledAmount: order.takerAmount,
            });
        });

        it('partially filled order', async () => {
            const order = await getTestRfqOrder();
            const fillAmount = order.takerAmount - 1;
            // Fill the order first.
            await testUtils.fillRfqOrderAsync(order, fillAmount);
            const info = await zeroEx.getRfqOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Fillable,
                orderHash: order.getHash(),
                takerTokenFilledAmount: fillAmount,
            });
        });

        it('filled then cancelled order', async () => {
            const order = await getTestRfqOrder();
            // Fill the order first.
            await testUtils.fillRfqOrderAsync(order);
            await zeroEx.cancelRfqOrder(order)({ from: maker });
            const info = await zeroEx.getRfqOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled, // Still reports filled.
                orderHash: order.getHash(),
                takerTokenFilledAmount: order.takerAmount,
            });
        });

        it('partially filled then cancelled order', async () => {
            const order = await getTestRfqOrder();
            const fillAmount = order.takerAmount - 1;
            // Fill the order first.
            await testUtils.fillRfqOrderAsync(order, fillAmount);
            await zeroEx.cancelRfqOrder(order)({ from: maker });
            const info = await zeroEx.getRfqOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Cancelled,
                orderHash: order.getHash(),
                takerTokenFilledAmount: fillAmount,
            });
        });

        it('invalid origin', async () => {
            const order = await getTestRfqOrder({ txOrigin: NULL_ADDRESS });
            const info = await zeroEx.getRfqOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Invalid,
                orderHash: order.getHash(),
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
        });
    });

    describe('cancelLimitOrder()', async () => {
        it('can cancel an unfilled order', async () => {
            const order = await getTestLimitOrder();
            const receipt = await zeroEx.cancelLimitOrder(order)({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [{ maker: order.maker, orderHash: order.getHash() }],
                IZeroExEvents.OrderCancelled,
            );
            const { status } = await zeroEx.getLimitOrderInfo(order)();
            expect(status).to.eq(OrderStatus.Cancelled);
        });

        it('can cancel a fully filled order', async () => {
            const order = await getTestLimitOrder();
            await testUtils.fillLimitOrderAsync(order);
            const receipt = await zeroEx.cancelLimitOrder(order)({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [{ maker: order.maker, orderHash: order.getHash() }],
                IZeroExEvents.OrderCancelled,
            );
            const { status } = await zeroEx.getLimitOrderInfo(order)();
            expect(status).to.eq(OrderStatus.Filled); // Still reports filled.
        });

        it('can cancel a partially filled order', async () => {
            const order = await getTestLimitOrder();
            await testUtils.fillLimitOrderAsync(order, { fillAmount: order.takerAmount - 1 });
            const receipt = await zeroEx.cancelLimitOrder(order)({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [{ maker: order.maker, orderHash: order.getHash() }],
                IZeroExEvents.OrderCancelled,
            );
            const { status } = await zeroEx.getLimitOrderInfo(order)();
            expect(status).to.eq(OrderStatus.Cancelled);
        });

        it('can cancel an expired order', async () => {
            const expiry = createExpiry(-60);
            const order = await getTestLimitOrder({ expiry });
            const receipt = await zeroEx.cancelLimitOrder(order)({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [{ maker: order.maker, orderHash: order.getHash() }],
                IZeroExEvents.OrderCancelled,
            );
            const { status } = await zeroEx.getLimitOrderInfo(order)();
            expect(status).to.eq(OrderStatus.Cancelled);
        });

        it('can cancel a cancelled order', async () => {
            const order = await getTestLimitOrder();
            await zeroEx.cancelLimitOrder(order)({ from: maker });
            const receipt = await zeroEx.cancelLimitOrder(order)({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [{ maker: order.maker, orderHash: order.getHash() }],
                IZeroExEvents.OrderCancelled,
            );
            const { status } = await zeroEx.getLimitOrderInfo(order)();
            expect(status).to.eq(OrderStatus.Cancelled);
        });

        it("cannot cancel someone else's order", async () => {
            const order = await getTestLimitOrder();
            const tx = zeroEx.cancelLimitOrder(order)({ from: notMaker });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OnlyOrderMakerAllowed(order.getHash(), notMaker, order.maker),
            );
        });
    });

    describe('cancelRfqOrder()', async () => {
        it('can cancel an unfilled order', async () => {
            const order = await getTestRfqOrder();
            const receipt = await zeroEx.cancelRfqOrder(order)({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [{ maker: order.maker, orderHash: order.getHash() }],
                IZeroExEvents.OrderCancelled,
            );
            const { status } = await zeroEx.getRfqOrderInfo(order)();
            expect(status).to.eq(OrderStatus.Cancelled);
        });

        it('can cancel a fully filled order', async () => {
            const order = await getTestRfqOrder();
            await testUtils.fillRfqOrderAsync(order);
            const receipt = await zeroEx.cancelRfqOrder(order)({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [{ maker: order.maker, orderHash: order.getHash() }],
                IZeroExEvents.OrderCancelled,
            );
            const { status } = await zeroEx.getRfqOrderInfo(order)();
            expect(status).to.eq(OrderStatus.Filled); // Still reports filled.
        });

        it('can cancel a partially filled order', async () => {
            const order = await getTestRfqOrder();
            await testUtils.fillRfqOrderAsync(order, order.takerAmount - 1);
            const receipt = await zeroEx.cancelRfqOrder(order)({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [{ maker: order.maker, orderHash: order.getHash() }],
                IZeroExEvents.OrderCancelled,
            );
            const { status } = await zeroEx.getRfqOrderInfo(order)();
            expect(status).to.eq(OrderStatus.Cancelled); // Still reports filled.
        });

        it('can cancel an expired order', async () => {
            const expiry = createExpiry(-60);
            const order = await getTestRfqOrder({ expiry });
            const receipt = await zeroEx.cancelRfqOrder(order)({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [{ maker: order.maker, orderHash: order.getHash() }],
                IZeroExEvents.OrderCancelled,
            );
            const { status } = await zeroEx.getRfqOrderInfo(order)();
            expect(status).to.eq(OrderStatus.Cancelled);
        });

        it('can cancel a cancelled order', async () => {
            const order = await getTestRfqOrder();
            await zeroEx.cancelRfqOrder(order)({ from: maker });
            const receipt = await zeroEx.cancelRfqOrder(order)({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [{ maker: order.maker, orderHash: order.getHash() }],
                IZeroExEvents.OrderCancelled,
            );
            const { status } = await zeroEx.getRfqOrderInfo(order)();
            expect(status).to.eq(OrderStatus.Cancelled);
        });

        it("cannot cancel someone else's order", async () => {
            const order = await getTestRfqOrder();
            const tx = zeroEx.cancelRfqOrder(order)({ from: notMaker });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OnlyOrderMakerAllowed(order.getHash(), notMaker, order.maker),
            );
        });
    });

    describe('batchCancelLimitOrders()', async () => {
        it('can cancel multiple orders', async () => {
            const orders = [...new Array(3)].map(() => getTestLimitOrder());
            const receipt = await zeroEx.batchCancelLimitOrders(orders)({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                orders.map(o => ({ maker: o.maker, orderHash: o.getHash() })),
                IZeroExEvents.OrderCancelled,
            );
            const infos = await Promise.all(orders.map(o => zeroEx.getLimitOrderInfo(o)()));
            expect(infos.map(i => i.status)).to.deep.eq(infos.map(() => OrderStatus.Cancelled));
        });

        it("cannot cancel someone else's orders", async () => {
            const orders = [...new Array(3)].map(() => getTestLimitOrder());
            const tx = zeroEx.batchCancelLimitOrders(orders)({ from: notMaker });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OnlyOrderMakerAllowed(orders[0].getHash(), notMaker, orders[0].maker),
            );
        });
    });

    describe('batchCancelRfqOrders()', async () => {
        it('can cancel multiple orders', async () => {
            const orders = [...new Array(3)].map(() => getTestRfqOrder());
            const receipt = await zeroEx.batchCancelRfqOrders(orders)({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                orders.map(o => ({ maker: o.maker, orderHash: o.getHash() })),
                IZeroExEvents.OrderCancelled,
            );
            const infos = await Promise.all(orders.map(o => zeroEx.getRfqOrderInfo(o)()));
            expect(infos.map(i => i.status)).to.deep.eq(infos.map(() => OrderStatus.Cancelled));
        });

        it("cannot cancel someone else's orders", async () => {
            const orders = [...new Array(3)].map(() => getTestRfqOrder());
            const tx = zeroEx.batchCancelRfqOrders(orders)({ from: notMaker });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OnlyOrderMakerAllowed(orders[0].getHash(), notMaker, orders[0].maker),
            );
        });
    });

    describe('cancelPairOrders()', async () => {
        it('can cancel multiple limit orders of the same pair with salt < minValidSalt', async () => {
            const orders = [...new Array(3)].map((_v, i) => getTestLimitOrder().clone({ salt: BigInt(i) }));
            // Cancel the first two orders.
            const minValidSalt = orders[2].salt;
            const receipt = await zeroEx
                .cancelPairLimitOrders(makerToken.address, takerToken.address, minValidSalt)
                ({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        maker,
                        makerToken: makerToken.address,
                        takerToken: takerToken.address,
                        minValidSalt,
                    },
                ],
                IZeroExEvents.PairCancelledLimitOrders,
            );
            const statuses = (await Promise.all(orders.map(o => zeroEx.getLimitOrderInfo(o)()))).map(
                oi => oi.status,
            );
            expect(statuses).to.deep.eq([OrderStatus.Cancelled, OrderStatus.Cancelled, OrderStatus.Fillable]);
        });

        it('does not cancel limit orders of a different pair', async () => {
            const order = getRandomLimitOrder({ salt: BigInt(1) });
            // Cancel salts <= the order's, but flip the tokens to be a different
            // pair.
            const minValidSalt = order.salt + 1;
            await zeroEx
                .cancelPairLimitOrders(takerToken.address, makerToken.address, minValidSalt)
                ({ from: maker });
            const { status } = await zeroEx.getLimitOrderInfo(order)();
            expect(status).to.eq(OrderStatus.Fillable);
        });

        it('can cancel multiple RFQ orders of the same pair with salt < minValidSalt', async () => {
            const orders = [...new Array(3)].map((_v, i) => getTestRfqOrder().clone({ salt: BigInt(i) }));
            // Cancel the first two orders.
            const minValidSalt = orders[2].salt;
            const receipt = await zeroEx
                .cancelPairRfqOrders(makerToken.address, takerToken.address, minValidSalt)
                ({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        maker,
                        makerToken: makerToken.address,
                        takerToken: takerToken.address,
                        minValidSalt,
                    },
                ],
                IZeroExEvents.PairCancelledRfqOrders,
            );
            const statuses = (await Promise.all(orders.map(o => zeroEx.getRfqOrderInfo(o)()))).map(
                oi => oi.status,
            );
            expect(statuses).to.deep.eq([OrderStatus.Cancelled, OrderStatus.Cancelled, OrderStatus.Fillable]);
        });

        it('does not cancel RFQ orders of a different pair', async () => {
            const order = getRandomRfqOrder({ salt: BigInt(1) });
            // Cancel salts <= the order's, but flip the tokens to be a different
            // pair.
            const minValidSalt = order.salt + 1;
            await zeroEx
                .cancelPairRfqOrders(takerToken.address, makerToken.address, minValidSalt)
                ({ from: maker });
            const { status } = await zeroEx.getRfqOrderInfo(order)();
            expect(status).to.eq(OrderStatus.Fillable);
        });
    });

    describe('batchCancelPairOrders()', async () => {
        it('can cancel multiple limit order pairs', async () => {
            const orders = [
                getTestLimitOrder({ salt: BigInt(1) }),
                // Flip the tokens for the other order.
                getTestLimitOrder({
                    makerToken: takerToken.address,
                    takerToken: makerToken.address,
                    salt: BigInt(1),
                }),
            ];
            const minValidSalt = BigInt(2);
            const receipt = await zeroEx
                .batchCancelPairLimitOrders(
                    [makerToken.address, takerToken.address],
                    [takerToken.address, makerToken.address],
                    [minValidSalt, minValidSalt],
                )
                ({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        maker,
                        makerToken: makerToken.address,
                        takerToken: takerToken.address,
                        minValidSalt,
                    },
                    {
                        maker,
                        makerToken: takerToken.address,
                        takerToken: makerToken.address,
                        minValidSalt,
                    },
                ],
                IZeroExEvents.PairCancelledLimitOrders,
            );
            const statuses = (await Promise.all(orders.map(o => zeroEx.getLimitOrderInfo(o)()))).map(
                oi => oi.status,
            );
            expect(statuses).to.deep.eq([OrderStatus.Cancelled, OrderStatus.Cancelled]);
        });

        it('can cancel multiple RFQ order pairs', async () => {
            const orders = [
                getTestRfqOrder({ salt: BigInt(1) }),
                // Flip the tokens for the other order.
                getTestRfqOrder({
                    makerToken: takerToken.address,
                    takerToken: makerToken.address,
                    salt: BigInt(1),
                }),
            ];
            const minValidSalt = BigInt(2);
            const receipt = await zeroEx
                .batchCancelPairRfqOrders(
                    [makerToken.address, takerToken.address],
                    [takerToken.address, makerToken.address],
                    [minValidSalt, minValidSalt],
                )
                ({ from: maker });
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        maker,
                        makerToken: makerToken.address,
                        takerToken: takerToken.address,
                        minValidSalt,
                    },
                    {
                        maker,
                        makerToken: takerToken.address,
                        takerToken: makerToken.address,
                        minValidSalt,
                    },
                ],
                IZeroExEvents.PairCancelledRfqOrders,
            );
            const statuses = (await Promise.all(orders.map(o => zeroEx.getRfqOrderInfo(o)()))).map(
                oi => oi.status,
            );
            expect(statuses).to.deep.eq([OrderStatus.Cancelled, OrderStatus.Cancelled]);
        });
    });

    async function assertExpectedFinalBalancesFromLimitOrderFillAsync(
        order: LimitOrder,
        opts: Partial<{
            takerTokenFillAmount: bigint;
            takerTokenAlreadyFilledAmount: bigint;
            receipt: TransactionReceiptWithDecodedLogs;
        }> = {},
    ): Promise<void> {
        const { takerTokenFillAmount, takerTokenAlreadyFilledAmount, receipt } = {
            takerTokenFillAmount: order.takerAmount,
            takerTokenAlreadyFilledAmount: ZERO_AMOUNT,
            receipt: undefined,
            ...opts,
        };
        const { makerTokenFilledAmount, takerTokenFilledAmount, takerTokenFeeFilledAmount } =
            computeLimitOrderFilledAmounts(order, takerTokenFillAmount, takerTokenAlreadyFilledAmount);
        const makerBalance = await takerToken.balanceOf(maker)();
        const takerBalance = await makerToken.balanceOf(taker)();
        const feeRecipientBalance = await takerToken.balanceOf(order.feeRecipient)();
        expect(makerBalance).to.eq(takerTokenFilledAmount);
        expect(takerBalance).to.eq(makerTokenFilledAmount);
        expect(feeRecipientBalance).to.eq(takerTokenFeeFilledAmount);
        if (receipt) {
            const balanceOfTakerNow = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            const balanceOfTakerBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker, receipt.blockNumber - 1);
            const protocolFee = order.taker === NULL_ADDRESS ? SINGLE_PROTOCOL_FEE : 0;
            const totalCost = GAS_PRICE * receipt.gasUsed + protocolFee;
            expect(balanceOfTakerBefore - totalCost).to.eq(balanceOfTakerNow);
        }
    }

    describe('fillLimitOrder()', () => {
        it('can fully fill an order', async () => {
            const order = await getTestLimitOrder();
            const receipt = await testUtils.fillLimitOrderAsync(order);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createLimitOrderFilledEventArgs(order)],
                IZeroExEvents.LimitOrderFilled,
            );
            assertOrderInfoEquals(await zeroEx.getLimitOrderInfo(order)(), {
                orderHash: order.getHash(),
                status: OrderStatus.Filled,
                takerTokenFilledAmount: order.takerAmount,
            });
            await assertExpectedFinalBalancesFromLimitOrderFillAsync(order, { receipt });
        });

        it('can partially fill an order', async () => {
            const order = await getTestLimitOrder();
            const fillAmount = order.takerAmount - 1;
            const receipt = await testUtils.fillLimitOrderAsync(order, { fillAmount });
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createLimitOrderFilledEventArgs(order, fillAmount)],
                IZeroExEvents.LimitOrderFilled,
            );
            assertOrderInfoEquals(await zeroEx.getLimitOrderInfo(order)(), {
                orderHash: order.getHash(),
                status: OrderStatus.Fillable,
                takerTokenFilledAmount: fillAmount,
            });
            await assertExpectedFinalBalancesFromLimitOrderFillAsync(order, {
                takerTokenFillAmount: fillAmount,
            });
        });

        it('can fully fill an order in two steps', async () => {
            const order = await getTestLimitOrder();
            let fillAmount = order.takerAmount.dividedToIntegerBy(2);
            let receipt = await testUtils.fillLimitOrderAsync(order, { fillAmount });
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createLimitOrderFilledEventArgs(order, fillAmount)],
                IZeroExEvents.LimitOrderFilled,
            );
            const alreadyFilledAmount = fillAmount;
            fillAmount = order.takerAmount - fillAmount;
            receipt = await testUtils.fillLimitOrderAsync(order, { fillAmount });
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createLimitOrderFilledEventArgs(order, fillAmount, alreadyFilledAmount)],
                IZeroExEvents.LimitOrderFilled,
            );
            assertOrderInfoEquals(await zeroEx.getLimitOrderInfo(order)(), {
                orderHash: order.getHash(),
                status: OrderStatus.Filled,
                takerTokenFilledAmount: order.takerAmount,
            });
        });

        it('clamps fill amount to remaining available', async () => {
            const order = await getTestLimitOrder();
            const fillAmount = order.takerAmount + 1;
            const receipt = await testUtils.fillLimitOrderAsync(order, { fillAmount });
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createLimitOrderFilledEventArgs(order, fillAmount)],
                IZeroExEvents.LimitOrderFilled,
            );
            assertOrderInfoEquals(await zeroEx.getLimitOrderInfo(order)(), {
                orderHash: order.getHash(),
                status: OrderStatus.Filled,
                takerTokenFilledAmount: order.takerAmount,
            });
            await assertExpectedFinalBalancesFromLimitOrderFillAsync(order, {
                takerTokenFillAmount: fillAmount,
            });
        });

        it('clamps fill amount to remaining available in partial filled order', async () => {
            const order = await getTestLimitOrder();
            let fillAmount = order.takerAmount.dividedToIntegerBy(2);
            let receipt = await testUtils.fillLimitOrderAsync(order, { fillAmount });
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createLimitOrderFilledEventArgs(order, fillAmount)],
                IZeroExEvents.LimitOrderFilled,
            );
            const alreadyFilledAmount = fillAmount;
            fillAmount = order.takerAmount - fillAmount + 1;
            receipt = await testUtils.fillLimitOrderAsync(order, { fillAmount });
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createLimitOrderFilledEventArgs(order, fillAmount, alreadyFilledAmount)],
                IZeroExEvents.LimitOrderFilled,
            );
            assertOrderInfoEquals(await zeroEx.getLimitOrderInfo(order)(), {
                orderHash: order.getHash(),
                status: OrderStatus.Filled,
                takerTokenFilledAmount: order.takerAmount,
            });
        });

        it('cannot fill an expired order', async () => {
            const order = await getTestLimitOrder({ expiry: createExpiry(-60) });
            const tx = testUtils.fillLimitOrderAsync(order);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Expired),
            );
        });

        it('cannot fill a cancelled order', async () => {
            const order = await getTestLimitOrder();
            await zeroEx.cancelLimitOrder(order)({ from: maker });
            const tx = testUtils.fillLimitOrderAsync(order);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Cancelled),
            );
        });

        it('cannot fill a salt/pair cancelled order', async () => {
            const order = await getTestLimitOrder();
            await zeroEx
                .cancelPairLimitOrders(makerToken.address, takerToken.address, order.salt + 1)
                ({ from: maker });
            const tx = testUtils.fillLimitOrderAsync(order);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Cancelled),
            );
        });

        it('non-taker cannot fill order', async () => {
            const order = await getTestLimitOrder({ taker });
            const tx = testUtils.fillLimitOrderAsync(order, { fillAmount: order.takerAmount, taker: notTaker });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableByTakerError(order.getHash(), notTaker, order.taker),
            );
        });

        it('non-sender cannot fill order', async () => {
            const order = await getTestLimitOrder({ sender: taker });
            const tx = testUtils.fillLimitOrderAsync(order, { fillAmount: order.takerAmount, taker: notTaker });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableBySenderError(order.getHash(), notTaker, order.sender),
            );
        });

        it('cannot fill order with bad signature', async () => {
            const order = await getTestLimitOrder();
            // Overwrite chainId to result in a different hash and therefore different
            // signature.
            const tx = testUtils.fillLimitOrderAsync(order.clone({ chainId: 1234 }));
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotSignedByMakerError(order.getHash(), undefined, order.maker),
            );
        });

        // TODO: dekz Ganache gasPrice opcode is returning 0, cannot influence it up to test this case
        it.skip('fails if no protocol fee attached', async () => {
            const order = await getTestLimitOrder();
            await testUtils.prepareBalancesForOrdersAsync([order]);
            const tx = zeroEx
                .fillLimitOrder(
                    order,
                    await order.getSignatureWithProviderAsync(env.provider),
                    BigInt(order.takerAmount),
                )
                ({ from: taker, value: ZERO_AMOUNT });
            // The exact revert error depends on whether we are still doing a
            // token spender fallthroigh, so we won't get too specific.
            return expect(tx).to.be.revertedWith(new AnyRevertError());
        });

        it('refunds excess protocol fee', async () => {
            const order = await getTestLimitOrder();
            const receipt = await testUtils.fillLimitOrderAsync(order, { protocolFee: SINGLE_PROTOCOL_FEE + 1 });
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createLimitOrderFilledEventArgs(order)],
                IZeroExEvents.LimitOrderFilled,
            );
            await assertExpectedFinalBalancesFromLimitOrderFillAsync(order, { receipt });
        });
    });

    describe('registerAllowedRfqOrigins()', () => {
        it('cannot register through a contract', async () => {
            const tx = testRfqOriginRegistration
                .registerAllowedRfqOrigins(zeroEx.address, [], true)
                ();
            expect(tx).to.be.revertedWith('NativeOrdersFeature/NO_CONTRACT_ORIGINS');
        });
    });

    async function assertExpectedFinalBalancesFromRfqOrderFillAsync(
        order: RfqOrder,
        takerTokenFillAmount: bigint = order.takerAmount,
        takerTokenAlreadyFilledAmount: bigint = ZERO_AMOUNT,
    ): Promise<void> {
        const { makerTokenFilledAmount, takerTokenFilledAmount } = computeRfqOrderFilledAmounts(
            order,
            takerTokenFillAmount,
            takerTokenAlreadyFilledAmount,
        );
        const makerBalance = await takerToken.balanceOf(maker)();
        const takerBalance = await makerToken.balanceOf(taker)();
        expect(makerBalance).to.eq(takerTokenFilledAmount);
        expect(takerBalance).to.eq(makerTokenFilledAmount);
    }

    describe('fillRfqOrder()', () => {
        it('can fully fill an order', async () => {
            const order = await getTestRfqOrder();
            const receipt = await testUtils.fillRfqOrderAsync(order);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createRfqOrderFilledEventArgs(order)],
                IZeroExEvents.RfqOrderFilled,
            );
            assertOrderInfoEquals(await zeroEx.getRfqOrderInfo(order)(), {
                orderHash: order.getHash(),
                status: OrderStatus.Filled,
                takerTokenFilledAmount: order.takerAmount,
            });
            await assertExpectedFinalBalancesFromRfqOrderFillAsync(order);
        });

        it('can partially fill an order', async () => {
            const order = await getTestRfqOrder();
            const fillAmount = order.takerAmount - 1;
            const receipt = await testUtils.fillRfqOrderAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createRfqOrderFilledEventArgs(order, fillAmount)],
                IZeroExEvents.RfqOrderFilled,
            );
            assertOrderInfoEquals(await zeroEx.getRfqOrderInfo(order)(), {
                orderHash: order.getHash(),
                status: OrderStatus.Fillable,
                takerTokenFilledAmount: fillAmount,
            });
            await assertExpectedFinalBalancesFromRfqOrderFillAsync(order, fillAmount);
        });

        it('can fully fill an order in two steps', async () => {
            const order = await getTestRfqOrder();
            let fillAmount = order.takerAmount.dividedToIntegerBy(2);
            let receipt = await testUtils.fillRfqOrderAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createRfqOrderFilledEventArgs(order, fillAmount)],
                IZeroExEvents.RfqOrderFilled,
            );
            const alreadyFilledAmount = fillAmount;
            fillAmount = order.takerAmount - fillAmount;
            receipt = await testUtils.fillRfqOrderAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createRfqOrderFilledEventArgs(order, fillAmount, alreadyFilledAmount)],
                IZeroExEvents.RfqOrderFilled,
            );
            assertOrderInfoEquals(await zeroEx.getRfqOrderInfo(order)(), {
                orderHash: order.getHash(),
                status: OrderStatus.Filled,
                takerTokenFilledAmount: order.takerAmount,
            });
        });

        it('clamps fill amount to remaining available', async () => {
            const order = await getTestRfqOrder();
            const fillAmount = order.takerAmount + 1;
            const receipt = await testUtils.fillRfqOrderAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createRfqOrderFilledEventArgs(order, fillAmount)],
                IZeroExEvents.RfqOrderFilled,
            );
            assertOrderInfoEquals(await zeroEx.getRfqOrderInfo(order)(), {
                orderHash: order.getHash(),
                status: OrderStatus.Filled,
                takerTokenFilledAmount: order.takerAmount,
            });
            await assertExpectedFinalBalancesFromRfqOrderFillAsync(order, fillAmount);
        });

        it('clamps fill amount to remaining available in partial filled order', async () => {
            const order = await getTestRfqOrder();
            let fillAmount = order.takerAmount.dividedToIntegerBy(2);
            let receipt = await testUtils.fillRfqOrderAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createRfqOrderFilledEventArgs(order, fillAmount)],
                IZeroExEvents.RfqOrderFilled,
            );
            const alreadyFilledAmount = fillAmount;
            fillAmount = order.takerAmount - fillAmount + 1;
            receipt = await testUtils.fillRfqOrderAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createRfqOrderFilledEventArgs(order, fillAmount, alreadyFilledAmount)],
                IZeroExEvents.RfqOrderFilled,
            );
            assertOrderInfoEquals(await zeroEx.getRfqOrderInfo(order)(), {
                orderHash: order.getHash(),
                status: OrderStatus.Filled,
                takerTokenFilledAmount: order.takerAmount,
            });
        });

        it('cannot fill an order with wrong tx.origin', async () => {
            const order = await getTestRfqOrder();
            const tx = testUtils.fillRfqOrderAsync(order, order.takerAmount, notTaker);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), notTaker, taker),
            );
        });

        it('can fill an order from a different tx.origin if registered', async () => {
            const order = await getTestRfqOrder();

            const receipt = await zeroEx
                .registerAllowedRfqOrigins([notTaker], true)
                ({ from: taker });
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        origin: taker,
                        addrs: [notTaker],
                        allowed: true,
                    },
                ],
                IZeroExEvents.RfqOrderOriginsAllowed,
            );
            return testUtils.fillRfqOrderAsync(order, order.takerAmount, notTaker);
        });

        it('cannot fill an order with registered then unregistered tx.origin', async () => {
            const order = await getTestRfqOrder();

            await zeroEx.registerAllowedRfqOrigins([notTaker], true)({ from: taker });
            const receipt = await zeroEx
                .registerAllowedRfqOrigins([notTaker], false)
                ({ from: taker });
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        origin: taker,
                        addrs: [notTaker],
                        allowed: false,
                    },
                ],
                IZeroExEvents.RfqOrderOriginsAllowed,
            );

            const tx = testUtils.fillRfqOrderAsync(order, order.takerAmount, notTaker);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), notTaker, taker),
            );
        });

        it('cannot fill an order with a zero tx.origin', async () => {
            const order = await getTestRfqOrder({ txOrigin: NULL_ADDRESS });
            const tx = testUtils.fillRfqOrderAsync(order, order.takerAmount, notTaker);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Invalid),
            );
        });

        it('non-taker cannot fill order', async () => {
            const order = await getTestRfqOrder({ taker, txOrigin: notTaker });
            const tx = testUtils.fillRfqOrderAsync(order, order.takerAmount, notTaker);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableByTakerError(order.getHash(), notTaker, order.taker),
            );
        });

        it('cannot fill an expired order', async () => {
            const order = await getTestRfqOrder({ expiry: createExpiry(-60) });
            const tx = testUtils.fillRfqOrderAsync(order);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Expired),
            );
        });

        it('cannot fill a cancelled order', async () => {
            const order = await getTestRfqOrder();
            await zeroEx.cancelRfqOrder(order)({ from: maker });
            const tx = testUtils.fillRfqOrderAsync(order);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Cancelled),
            );
        });

        it('cannot fill a salt/pair cancelled order', async () => {
            const order = await getTestRfqOrder();
            await zeroEx
                .cancelPairRfqOrders(makerToken.address, takerToken.address, order.salt + 1)
                ({ from: maker });
            const tx = testUtils.fillRfqOrderAsync(order);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Cancelled),
            );
        });

        it('cannot fill order with bad signature', async () => {
            const order = await getTestRfqOrder();
            // Overwrite chainId to result in a different hash and therefore different
            // signature.
            const tx = testUtils.fillRfqOrderAsync(order.clone({ chainId: 1234 }));
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotSignedByMakerError(order.getHash(), undefined, order.maker),
            );
        });

        it('fails if ETH is attached', async () => {
            const order = await getTestRfqOrder();
            await testUtils.prepareBalancesForOrdersAsync([order], taker);
            const tx = zeroEx
                .fillRfqOrder(order, await order.getSignatureWithProviderAsync(env.provider), order.takerAmount)
                ({ from: taker, value: 1 });
            // This will revert at the language level because the fill function is not payable.
            return expect(tx).to.be.rejectedWith('revert');
        });
    });

    describe('fillOrKillLimitOrder()', () => {
        it('can fully fill an order', async () => {
            const order = await getTestLimitOrder();
            await testUtils.prepareBalancesForOrdersAsync([order]);
            const receipt = await zeroEx
                .fillOrKillLimitOrder(order, await order.getSignatureWithProviderAsync(env.provider), order.takerAmount)
                ({ from: taker, value: SINGLE_PROTOCOL_FEE });
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createLimitOrderFilledEventArgs(order)],
                IZeroExEvents.LimitOrderFilled,
            );
        });

        it('reverts if cannot fill the exact amount', async () => {
            const order = await getTestLimitOrder();
            await testUtils.prepareBalancesForOrdersAsync([order]);
            const fillAmount = order.takerAmount + 1;
            const tx = zeroEx
                .fillOrKillLimitOrder(order, await order.getSignatureWithProviderAsync(env.provider), fillAmount)
                ({ from: taker, value: SINGLE_PROTOCOL_FEE });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.FillOrKillFailedError(order.getHash(), order.takerAmount, fillAmount),
            );
        });

        it('refunds excess protocol fee', async () => {
            const order = await getTestLimitOrder();
            await testUtils.prepareBalancesForOrdersAsync([order]);
            const takerBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            const receipt = await zeroEx
                .fillOrKillLimitOrder(order, await order.getSignatureWithProviderAsync(env.provider), order.takerAmount)
                ({ from: taker, value: SINGLE_PROTOCOL_FEE + 1 });
            const takerBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            const totalCost = GAS_PRICE * receipt.gasUsed + SINGLE_PROTOCOL_FEE;
            expect(takerBalanceBefore - totalCost).to.eq(takerBalanceAfter);
        });
    });

    describe('fillOrKillRfqOrder()', () => {
        it('can fully fill an order', async () => {
            const order = await getTestRfqOrder();
            await testUtils.prepareBalancesForOrdersAsync([order]);
            const receipt = await zeroEx
                .fillOrKillRfqOrder(order, await order.getSignatureWithProviderAsync(env.provider), order.takerAmount)
                ({ from: taker });
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createRfqOrderFilledEventArgs(order)],
                IZeroExEvents.RfqOrderFilled,
            );
        });

        it('reverts if cannot fill the exact amount', async () => {
            const order = await getTestRfqOrder();
            await testUtils.prepareBalancesForOrdersAsync([order]);
            const fillAmount = order.takerAmount + 1;
            const tx = zeroEx
                .fillOrKillRfqOrder(order, await order.getSignatureWithProviderAsync(env.provider), fillAmount)
                ({ from: taker });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.FillOrKillFailedError(order.getHash(), order.takerAmount, fillAmount),
            );
        });

        it('fails if ETH is attached', async () => {
            const order = await getTestRfqOrder();
            await testUtils.prepareBalancesForOrdersAsync([order]);
            const tx = zeroEx
                .fillOrKillRfqOrder(order, await order.getSignatureWithProviderAsync(env.provider), order.takerAmount)
                ({ from: taker, value: 1 });
            // This will revert at the language level because the fill function is not payable.
            return expect(tx).to.be.rejectedWith('revert');
        });
    });

    async function fundOrderMakerAsync(
        order: LimitOrder | RfqOrder,
        balance: bigint = order.makerAmount,
        allowance: bigint = order.makerAmount,
    ): Promise<void> {
        await makerToken.burn(maker, await makerToken.balanceOf(maker)())();
        await makerToken.mint(maker, balance)();
        await makerToken.approve(zeroEx.address, allowance)({ from: maker });
    }

    describe('getLimitOrderRelevantState()', () => {
        it('works with an empty order', async () => {
            const order = await getTestLimitOrder({
                takerAmount: ZERO_AMOUNT,
            });
            await fundOrderMakerAsync(order);
            const [orderInfo, fillableTakerAmount, isSignatureValid] = await zeroEx
                .getLimitOrderRelevantState(order, await order.getSignatureWithProviderAsync(env.provider))
                ();
            expect(orderInfo).to.deep.eq({
                orderHash: order.getHash(),
                status: OrderStatus.Filled,
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            expect(fillableTakerAmount).to.eq(0);
            expect(isSignatureValid).to.eq(true);
        });

        it('works with cancelled order', async () => {
            const order = await getTestLimitOrder();
            await fundOrderMakerAsync(order);
            await zeroEx.cancelLimitOrder(order)({ from: maker });
            const [orderInfo, fillableTakerAmount, isSignatureValid] = await zeroEx
                .getLimitOrderRelevantState(order, await order.getSignatureWithProviderAsync(env.provider))
                ();
            expect(orderInfo).to.deep.eq({
                orderHash: order.getHash(),
                status: OrderStatus.Cancelled,
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            expect(fillableTakerAmount).to.eq(0);
            expect(isSignatureValid).to.eq(true);
        });

        it('works with a bad signature', async () => {
            const order = await getTestLimitOrder();
            await fundOrderMakerAsync(order);
            const [orderInfo, fillableTakerAmount, isSignatureValid] = await zeroEx
                .getLimitOrderRelevantState(
                    order,
                    await order.clone({ maker: notMaker }).getSignatureWithProviderAsync(env.provider),
                )
                ();
            expect(orderInfo).to.deep.eq({
                orderHash: order.getHash(),
                status: OrderStatus.Fillable,
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            expect(fillableTakerAmount).to.eq(order.takerAmount);
            expect(isSignatureValid).to.eq(false);
        });

        it('works with an unfilled order', async () => {
            const order = await getTestLimitOrder();
            await fundOrderMakerAsync(order);
            const [orderInfo, fillableTakerAmount, isSignatureValid] = await zeroEx
                .getLimitOrderRelevantState(order, await order.getSignatureWithProviderAsync(env.provider))
                ();
            expect(orderInfo).to.deep.eq({
                orderHash: order.getHash(),
                status: OrderStatus.Fillable,
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            expect(fillableTakerAmount).to.eq(order.takerAmount);
            expect(isSignatureValid).to.eq(true);
        });

        it('works with a fully filled order', async () => {
            const order = await getTestLimitOrder();
            // Fully Fund maker and taker.
            await fundOrderMakerAsync(order);
            await takerToken
                .mint(taker, order.takerAmount + order.takerTokenFeeAmount)
                ();
            await testUtils.fillLimitOrderAsync(order);
            // Partially fill the order.
            const [orderInfo, fillableTakerAmount, isSignatureValid] = await zeroEx
                .getLimitOrderRelevantState(order, await order.getSignatureWithProviderAsync(env.provider))
                ();
            expect(orderInfo).to.deep.eq({
                orderHash: order.getHash(),
                status: OrderStatus.Filled,
                takerTokenFilledAmount: order.takerAmount,
            });
            expect(fillableTakerAmount).to.eq(0);
            expect(isSignatureValid).to.eq(true);
        });

        it('works with an under-funded, partially-filled order', async () => {
            const order = await getTestLimitOrder();
            // Fully Fund maker and taker.
            await fundOrderMakerAsync(order);
            await takerToken
                .mint(taker, order.takerAmount + order.takerTokenFeeAmount)
                ();
            // Partially fill the order.
            const fillAmount = getRandomPortion(order.takerAmount);
            await testUtils.fillLimitOrderAsync(order, { fillAmount });
            // Reduce maker funds to be < remaining.
            const remainingMakerAmount = getFillableMakerTokenAmount(order, fillAmount);
            const balance = getRandomPortion(remainingMakerAmount);
            const allowance = getRandomPortion(remainingMakerAmount);
            await fundOrderMakerAsync(order, balance, allowance);
            // Get order state.
            const [orderInfo, fillableTakerAmount, isSignatureValid] = await zeroEx
                .getLimitOrderRelevantState(order, await order.getSignatureWithProviderAsync(env.provider))
                ();
            expect(orderInfo).to.deep.eq({
                orderHash: order.getHash(),
                status: OrderStatus.Fillable,
                takerTokenFilledAmount: fillAmount,
            });
            expect(fillableTakerAmount).to.eq(
                getActualFillableTakerTokenAmount(order, balance, allowance, fillAmount),
            );
            expect(isSignatureValid).to.eq(true);
        });
    });

    describe('getRfqOrderRelevantState()', () => {
        it('works with an empty order', async () => {
            const order = await getTestRfqOrder({
                takerAmount: ZERO_AMOUNT,
            });
            await fundOrderMakerAsync(order);
            const [orderInfo, fillableTakerAmount, isSignatureValid] = await zeroEx
                .getRfqOrderRelevantState(order, await order.getSignatureWithProviderAsync(env.provider))
                ();
            expect(orderInfo).to.deep.eq({
                orderHash: order.getHash(),
                status: OrderStatus.Filled,
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            expect(fillableTakerAmount).to.eq(0);
            expect(isSignatureValid).to.eq(true);
        });

        it('works with cancelled order', async () => {
            const order = await getTestRfqOrder();
            await fundOrderMakerAsync(order);
            await zeroEx.cancelRfqOrder(order)({ from: maker });
            const [orderInfo, fillableTakerAmount, isSignatureValid] = await zeroEx
                .getRfqOrderRelevantState(order, await order.getSignatureWithProviderAsync(env.provider))
                ();
            expect(orderInfo).to.deep.eq({
                orderHash: order.getHash(),
                status: OrderStatus.Cancelled,
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            expect(fillableTakerAmount).to.eq(0);
            expect(isSignatureValid).to.eq(true);
        });

        it('works with a bad signature', async () => {
            const order = await getTestRfqOrder();
            await fundOrderMakerAsync(order);
            const [orderInfo, fillableTakerAmount, isSignatureValid] = await zeroEx
                .getRfqOrderRelevantState(
                    order,
                    await order.clone({ maker: notMaker }).getSignatureWithProviderAsync(env.provider),
                )
                ();
            expect(orderInfo).to.deep.eq({
                orderHash: order.getHash(),
                status: OrderStatus.Fillable,
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            expect(fillableTakerAmount).to.eq(order.takerAmount);
            expect(isSignatureValid).to.eq(false);
        });

        it('works with an unfilled order', async () => {
            const order = await getTestRfqOrder();
            await fundOrderMakerAsync(order);
            const [orderInfo, fillableTakerAmount, isSignatureValid] = await zeroEx
                .getRfqOrderRelevantState(order, await order.getSignatureWithProviderAsync(env.provider))
                ();
            expect(orderInfo).to.deep.eq({
                orderHash: order.getHash(),
                status: OrderStatus.Fillable,
                takerTokenFilledAmount: ZERO_AMOUNT,
            });
            expect(fillableTakerAmount).to.eq(order.takerAmount);
            expect(isSignatureValid).to.eq(true);
        });

        it('works with a fully filled order', async () => {
            const order = await getTestRfqOrder();
            // Fully Fund maker and taker.
            await fundOrderMakerAsync(order);
            await takerToken.mint(taker, order.takerAmount);
            await testUtils.fillRfqOrderAsync(order);
            // Partially fill the order.
            const [orderInfo, fillableTakerAmount, isSignatureValid] = await zeroEx
                .getRfqOrderRelevantState(order, await order.getSignatureWithProviderAsync(env.provider))
                ();
            expect(orderInfo).to.deep.eq({
                orderHash: order.getHash(),
                status: OrderStatus.Filled,
                takerTokenFilledAmount: order.takerAmount,
            });
            expect(fillableTakerAmount).to.eq(0);
            expect(isSignatureValid).to.eq(true);
        });

        it('works with an under-funded, partially-filled order', async () => {
            const order = await getTestRfqOrder();
            // Fully Fund maker and taker.
            await fundOrderMakerAsync(order);
            await takerToken.mint(taker, order.takerAmount)();
            // Partially fill the order.
            const fillAmount = getRandomPortion(order.takerAmount);
            await testUtils.fillRfqOrderAsync(order, fillAmount);
            // Reduce maker funds to be < remaining.
            const remainingMakerAmount = getFillableMakerTokenAmount(order, fillAmount);
            const balance = getRandomPortion(remainingMakerAmount);
            const allowance = getRandomPortion(remainingMakerAmount);
            await fundOrderMakerAsync(order, balance, allowance);
            // Get order state.
            const [orderInfo, fillableTakerAmount, isSignatureValid] = await zeroEx
                .getRfqOrderRelevantState(order, await order.getSignatureWithProviderAsync(env.provider))
                ();
            expect(orderInfo).to.deep.eq({
                orderHash: order.getHash(),
                status: OrderStatus.Fillable,
                takerTokenFilledAmount: fillAmount,
            });
            expect(fillableTakerAmount).to.eq(
                getActualFillableTakerTokenAmount(order, balance, allowance, fillAmount),
            );
            expect(isSignatureValid).to.eq(true);
        });
    });

    async function batchFundOrderMakerAsync(orders: Array<LimitOrder | RfqOrder>): Promise<void> {
        await makerToken.burn(maker, await makerToken.balanceOf(maker)())();
        const balance = orders.map(o => o.makerAmount).reduce((a, b) => a + b, 0n);
        await makerToken.mint(maker, balance)();
        await makerToken.approve(zeroEx.address, balance)({ from: maker });
    }

    describe('batchGetLimitOrderRelevantStates()', () => {
        it('works with multiple orders', async () => {
            const orders = new Array(3).fill(0).map(() => getTestLimitOrder());
            await batchFundOrderMakerAsync(orders);
            const [orderInfos, fillableTakerAmounts, isSignatureValids] = await zeroEx
                .batchGetLimitOrderRelevantStates(
                    orders,
                    await Promise.all(orders.map(async o => o.getSignatureWithProviderAsync(env.provider))),
                )
                ();
            expect(orderInfos).to.be.length(orders.length);
            expect(fillableTakerAmounts).to.be.length(orders.length);
            expect(isSignatureValids).to.be.length(orders.length);
            for (let i = 0; i < orders.length; ++i) {
                expect(orderInfos[i]).to.deep.eq({
                    orderHash: orders[i].getHash(),
                    status: OrderStatus.Fillable,
                    takerTokenFilledAmount: ZERO_AMOUNT,
                });
                expect(fillableTakerAmounts[i]).to.eq(orders[i].takerAmount);
                expect(isSignatureValids[i]).to.eq(true);
            }
        });
        it('swallows reverts', async () => {
            const orders = new Array(3).fill(0).map(() => getTestLimitOrder());
            // The second order will revert because its maker token is not valid.
            orders[1].makerToken = randomAddress();
            await batchFundOrderMakerAsync(orders);
            const [orderInfos, fillableTakerAmounts, isSignatureValids] = await zeroEx
                .batchGetLimitOrderRelevantStates(
                    orders,
                    await Promise.all(orders.map(async o => o.getSignatureWithProviderAsync(env.provider))),
                )
                ();
            expect(orderInfos).to.be.length(orders.length);
            expect(fillableTakerAmounts).to.be.length(orders.length);
            expect(isSignatureValids).to.be.length(orders.length);
            for (let i = 0; i < orders.length; ++i) {
                expect(orderInfos[i]).to.deep.eq({
                    orderHash: i === 1 ? NULL_BYTES32 : orders[i].getHash(),
                    status: i === 1 ? OrderStatus.Invalid : OrderStatus.Fillable,
                    takerTokenFilledAmount: ZERO_AMOUNT,
                });
                expect(fillableTakerAmounts[i]).to.eq(i === 1 ? ZERO_AMOUNT : orders[i].takerAmount);
                expect(isSignatureValids[i]).to.eq(i !== 1);
            }
        });
    });

    describe('batchGetRfqOrderRelevantStates()', () => {
        it('works with multiple orders', async () => {
            const orders = new Array(3).fill(0).map(() => getTestRfqOrder());
            await batchFundOrderMakerAsync(orders);
            const [orderInfos, fillableTakerAmounts, isSignatureValids] = await zeroEx
                .batchGetRfqOrderRelevantStates(
                    orders,
                    await Promise.all(orders.map(async o => o.getSignatureWithProviderAsync(env.provider))),
                )
                ();
            expect(orderInfos).to.be.length(orders.length);
            expect(fillableTakerAmounts).to.be.length(orders.length);
            expect(isSignatureValids).to.be.length(orders.length);
            for (let i = 0; i < orders.length; ++i) {
                expect(orderInfos[i]).to.deep.eq({
                    orderHash: orders[i].getHash(),
                    status: OrderStatus.Fillable,
                    takerTokenFilledAmount: ZERO_AMOUNT,
                });
                expect(fillableTakerAmounts[i]).to.eq(orders[i].takerAmount);
                expect(isSignatureValids[i]).to.eq(true);
            }
        });
    });

    describe('registerAllowedSigner()', () => {
        it('fires appropriate events', async () => {
            const receiptAllow = await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, true)
                ({ from: contractWalletOwner });

            verifyEventsFromLogs(
                receiptAllow.logs,
                [
                    {
                        maker: contractWallet.address,
                        signer: contractWalletSigner,
                        allowed: true,
                    },
                ],
                IZeroExEvents.OrderSignerRegistered,
            );

            // then disallow signer
            const receiptDisallow = await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, false)
                ({ from: contractWalletOwner });

            verifyEventsFromLogs(
                receiptDisallow.logs,
                [
                    {
                        maker: contractWallet.address,
                        signer: contractWalletSigner,
                        allowed: false,
                    },
                ],
                IZeroExEvents.OrderSignerRegistered,
            );
        });

        it('allows for fills on orders signed by a approved signer', async () => {
            const order = await getTestRfqOrder({ maker: contractWallet.address });
            const sig = await order.getSignatureWithProviderAsync(
                env.provider,
                SignatureType.EthSign,
                contractWalletSigner,
            );

            // covers taker
            await testUtils.prepareBalancesForOrdersAsync([order]);
            // need to provide contract wallet with a balance
            await makerToken.mint(contractWallet.address, order.makerAmount)();

            await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, true)
                ({ from: contractWalletOwner });

            await zeroEx.fillRfqOrder(order, sig, order.takerAmount)({ from: taker });

            const info = await zeroEx.getRfqOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Filled,
                orderHash: order.getHash(),
                takerTokenFilledAmount: order.takerAmount,
            });
        });

        it('disallows fills if the signer is revoked', async () => {
            const order = await getTestRfqOrder({ maker: contractWallet.address });
            const sig = await order.getSignatureWithProviderAsync(
                env.provider,
                SignatureType.EthSign,
                contractWalletSigner,
            );

            // covers taker
            await testUtils.prepareBalancesForOrdersAsync([order]);
            // need to provide contract wallet with a balance
            await makerToken.mint(contractWallet.address, order.makerAmount)();

            // first allow signer
            await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, true)
                ({ from: contractWalletOwner });

            // then disallow signer
            await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, false)
                ({ from: contractWalletOwner });

            const tx = zeroEx.fillRfqOrder(order, sig, order.takerAmount)({ from: taker });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotSignedByMakerError(
                    order.getHash(),
                    contractWalletSigner,
                    order.maker,
                ),
            );
        });

        it(`doesn't allow fills with an unapproved signer`, async () => {
            const order = await getTestRfqOrder({ maker: contractWallet.address });
            const sig = await order.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, maker);

            // covers taker
            await testUtils.prepareBalancesForOrdersAsync([order]);
            // need to provide contract wallet with a balance
            await makerToken.mint(contractWallet.address, order.makerAmount)();

            const tx = zeroEx.fillRfqOrder(order, sig, order.takerAmount)({ from: taker });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotSignedByMakerError(order.getHash(), maker, order.maker),
            );
        });

        it(`allows an approved signer to cancel an RFQ order`, async () => {
            const order = await getTestRfqOrder({ maker: contractWallet.address });

            await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, true)
                ({ from: contractWalletOwner });

            const receipt = await zeroEx
                .cancelRfqOrder(order)
                ({ from: contractWalletSigner });

            verifyEventsFromLogs(
                receipt.logs,
                [{ maker: contractWallet.address, orderHash: order.getHash() }],
                IZeroExEvents.OrderCancelled,
            );

            const info = await zeroEx.getRfqOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Cancelled,
                orderHash: order.getHash(),
                takerTokenFilledAmount: BigInt(0),
            });
        });

        it(`allows an approved signer to cancel a limit order`, async () => {
            const order = await getTestLimitOrder({ maker: contractWallet.address });

            await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, true)
                ({ from: contractWalletOwner });

            const receipt = await zeroEx
                .cancelLimitOrder(order)
                ({ from: contractWalletSigner });

            verifyEventsFromLogs(
                receipt.logs,
                [{ maker: contractWallet.address, orderHash: order.getHash() }],
                IZeroExEvents.OrderCancelled,
            );

            const info = await zeroEx.getLimitOrderInfo(order)();
            assertOrderInfoEquals(info, {
                status: OrderStatus.Cancelled,
                orderHash: order.getHash(),
                takerTokenFilledAmount: BigInt(0),
            });
        });

        it(`doesn't allow an unapproved signer to cancel an RFQ order`, async () => {
            const order = await getTestRfqOrder({ maker: contractWallet.address });

            const tx = zeroEx.cancelRfqOrder(order)({ from: maker });

            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OnlyOrderMakerAllowed(order.getHash(), maker, order.maker),
            );
        });

        it(`doesn't allow an unapproved signer to cancel a limit order`, async () => {
            const order = await getTestLimitOrder({ maker: contractWallet.address });

            const tx = zeroEx.cancelLimitOrder(order)({ from: maker });

            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OnlyOrderMakerAllowed(order.getHash(), maker, order.maker),
            );
        });

        it(`allows a signer to cancel pair RFQ orders`, async () => {
            const order = await getTestRfqOrder({ maker: contractWallet.address, salt: BigInt(1) });

            await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, true)
                ({ from: contractWalletOwner });

            // Cancel salts <= the order's
            const minValidSalt = order.salt + 1;

            const receipt = await zeroEx
                .cancelPairRfqOrdersWithSigner(
                    contractWallet.address,
                    makerToken.address,
                    takerToken.address,
                    minValidSalt,
                )
                ({ from: contractWalletSigner });
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        maker: contractWallet.address,
                        makerToken: makerToken.address,
                        takerToken: takerToken.address,
                        minValidSalt,
                    },
                ],
                IZeroExEvents.PairCancelledRfqOrders,
            );

            const info = await zeroEx.getRfqOrderInfo(order)();

            assertOrderInfoEquals(info, {
                status: OrderStatus.Cancelled,
                orderHash: order.getHash(),
                takerTokenFilledAmount: BigInt(0),
            });
        });

        it(`doesn't allow an unapproved signer to cancel pair RFQ orders`, async () => {
            const minValidSalt = BigInt(2);

            const tx = zeroEx
                .cancelPairRfqOrdersWithSigner(
                    contractWallet.address,
                    makerToken.address,
                    takerToken.address,
                    minValidSalt,
                )
                ({ from: maker });

            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.InvalidSignerError(contractWallet.address, maker),
            );
        });

        it(`allows a signer to cancel pair limit orders`, async () => {
            const order = await getTestLimitOrder({ maker: contractWallet.address, salt: BigInt(1) });

            await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, true)
                ({ from: contractWalletOwner });

            // Cancel salts <= the order's
            const minValidSalt = order.salt + 1;

            const receipt = await zeroEx
                .cancelPairLimitOrdersWithSigner(
                    contractWallet.address,
                    makerToken.address,
                    takerToken.address,
                    minValidSalt,
                )
                ({ from: contractWalletSigner });
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        maker: contractWallet.address,
                        makerToken: makerToken.address,
                        takerToken: takerToken.address,
                        minValidSalt,
                    },
                ],
                IZeroExEvents.PairCancelledLimitOrders,
            );

            const info = await zeroEx.getLimitOrderInfo(order)();

            assertOrderInfoEquals(info, {
                status: OrderStatus.Cancelled,
                orderHash: order.getHash(),
                takerTokenFilledAmount: BigInt(0),
            });
        });

        it(`doesn't allow an unapproved signer to cancel pair limit orders`, async () => {
            const minValidSalt = BigInt(2);

            const tx = zeroEx
                .cancelPairLimitOrdersWithSigner(
                    contractWallet.address,
                    makerToken.address,
                    takerToken.address,
                    minValidSalt,
                )
                ({ from: maker });

            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.InvalidSignerError(contractWallet.address, maker),
            );
        });

        it(`allows a signer to cancel multiple RFQ order pairs`, async () => {
            const orders = [
                getTestRfqOrder({ maker: contractWallet.address, salt: BigInt(1) }),
                // Flip the tokens for the other order.
                getTestRfqOrder({
                    makerToken: takerToken.address,
                    takerToken: makerToken.address,
                    maker: contractWallet.address,
                    salt: BigInt(1),
                }),
            ];

            await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, true)
                ({ from: contractWalletOwner });

            const minValidSalt = BigInt(2);
            const receipt = await zeroEx
                .batchCancelPairRfqOrdersWithSigner(
                    contractWallet.address,
                    [makerToken.address, takerToken.address],
                    [takerToken.address, makerToken.address],
                    [minValidSalt, minValidSalt],
                )
                ({ from: contractWalletSigner });
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        maker: contractWallet.address,
                        makerToken: makerToken.address,
                        takerToken: takerToken.address,
                        minValidSalt,
                    },
                    {
                        maker: contractWallet.address,
                        makerToken: takerToken.address,
                        takerToken: makerToken.address,
                        minValidSalt,
                    },
                ],
                IZeroExEvents.PairCancelledRfqOrders,
            );
            const statuses = (await Promise.all(orders.map(o => zeroEx.getRfqOrderInfo(o)()))).map(
                oi => oi.status,
            );
            expect(statuses).to.deep.eq([OrderStatus.Cancelled, OrderStatus.Cancelled]);
        });

        it(`doesn't allow an unapproved signer to batch cancel pair rfq orders`, async () => {
            const minValidSalt = BigInt(2);

            const tx = zeroEx
                .batchCancelPairRfqOrdersWithSigner(
                    contractWallet.address,
                    [makerToken.address, takerToken.address],
                    [takerToken.address, makerToken.address],
                    [minValidSalt, minValidSalt],
                )
                ({ from: maker });

            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.InvalidSignerError(contractWallet.address, maker),
            );
        });

        it(`allows a signer to cancel multiple limit order pairs`, async () => {
            const orders = [
                getTestLimitOrder({ maker: contractWallet.address, salt: BigInt(1) }),
                // Flip the tokens for the other order.
                getTestLimitOrder({
                    makerToken: takerToken.address,
                    takerToken: makerToken.address,
                    maker: contractWallet.address,
                    salt: BigInt(1),
                }),
            ];

            await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, true)
                ({ from: contractWalletOwner });

            const minValidSalt = BigInt(2);
            const receipt = await zeroEx
                .batchCancelPairLimitOrdersWithSigner(
                    contractWallet.address,
                    [makerToken.address, takerToken.address],
                    [takerToken.address, makerToken.address],
                    [minValidSalt, minValidSalt],
                )
                ({ from: contractWalletSigner });
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        maker: contractWallet.address,
                        makerToken: makerToken.address,
                        takerToken: takerToken.address,
                        minValidSalt,
                    },
                    {
                        maker: contractWallet.address,
                        makerToken: takerToken.address,
                        takerToken: makerToken.address,
                        minValidSalt,
                    },
                ],
                IZeroExEvents.PairCancelledLimitOrders,
            );
            const statuses = (await Promise.all(orders.map(o => zeroEx.getLimitOrderInfo(o)()))).map(
                oi => oi.status,
            );
            expect(statuses).to.deep.eq([OrderStatus.Cancelled, OrderStatus.Cancelled]);
        });

        it(`doesn't allow an unapproved signer to batch cancel pair limit orders`, async () => {
            const minValidSalt = BigInt(2);

            const tx = zeroEx
                .batchCancelPairLimitOrdersWithSigner(
                    contractWallet.address,
                    [makerToken.address, takerToken.address],
                    [takerToken.address, makerToken.address],
                    [minValidSalt, minValidSalt],
                )
                ({ from: maker });

            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.InvalidSignerError(contractWallet.address, maker),
            );
        });
    });
});
