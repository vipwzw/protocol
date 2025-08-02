import { ethers } from "ethers";
import { blockchainTests, constants, describe, expect, verifyEventsFromLogs } from '@0x/test-utils';
import { OrderStatus, OtcOrder, RevertErrors, SignatureType } from '@0x/protocol-utils';
import { } from '@0x/utils';

import { 
    IOwnableFeatureContract, 
    IZeroExContract, 
    IZeroExEvents,
    TestMintableERC20Token__factory,
    TestWeth__factory,
    OtcOrdersFeature__factory,
    TestOrderSignerRegistryWithContractWallet__factory
} from '../../src/wrappers';
import { artifacts } from '../artifacts';
import { abis } from '../utils/abis';
import { fullMigrateAsync } from '../utils/migration';
import {
    computeOtcOrderFilledAmounts,
    createExpiry,
    getRandomOtcOrder,
    NativeOrdersTestEnvironment,
} from '../utils/orders';
import {
    OtcOrdersFeatureContract,
    TestMintableERC20TokenContract,
    TestOrderSignerRegistryWithContractWalletContract,
    TestWethContract,
} from '../wrappers';

blockchainTests('OtcOrdersFeature', env => {
    const { NULL_ADDRESS, MAX_UINT256, ZERO_AMOUNT: ZERO } = constants;
    const ETH_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    let maker: string;
    let taker: string;
    let notMaker: string;
    let notTaker: string;
    let contractWalletOwner: string;
    let contractWalletSigner: string;
    let txOrigin: string;
    let notTxOrigin: string;
    let zeroEx: IZeroExContract;
    let verifyingContract: string;
    let makerToken: TestMintableERC20TokenContract;
    let takerToken: TestMintableERC20TokenContract;
    let wethToken: TestWethContract;
    let contractWallet: TestOrderSignerRegistryWithContractWalletContract;
    let testUtils: NativeOrdersTestEnvironment;

    before(async () => {
        // Useful for ETH balance accounting
        const txDefaults = { ...env.txDefaults, gasPrice: 0 };
        let owner;
        [owner, maker, taker, notMaker, notTaker, contractWalletOwner, contractWalletSigner, txOrigin, notTxOrigin] =
            await env.getAccountAddressesAsync();
        
        const signer = await env.provider.getSigner(owner);
        const tokenFactories = [...new Array(2)].map(() => new TestMintableERC20Token__factory(signer));
        const tokenDeployments = await Promise.all(
            tokenFactories.map(factory => factory.deploy())
        );
        await Promise.all(tokenDeployments.map(token => token.waitForDeployment()));
        [makerToken, takerToken] = tokenDeployments;

        const wethFactory = new TestWeth__factory(signer);
        wethToken = await wethFactory.deploy();
        await wethToken.waitForDeployment();
        zeroEx = await fullMigrateAsync(owner, env.provider, txDefaults, {}, { wethAddress: await wethToken.getAddress() });
        
        const otcFeatureFactory = new OtcOrdersFeature__factory(signer);
        const otcFeatureImpl = await otcFeatureFactory.deploy(
            await zeroEx.getAddress(),
            await wethToken.getAddress()
        );
        await otcFeatureImpl.waitForDeployment();
        
        const ownableFeature = new IOwnableFeatureContract(await zeroEx.getAddress(), env.provider, txDefaults, abis);
        const ownerSigner = await env.provider.getSigner(owner);
        await ownableFeature
            .connect(ownerSigner)
            .migrate(await otcFeatureImpl.getAddress(), otcFeatureImpl.migrate().getABIEncodedTransactionData(), owner);
        verifyingContract = await zeroEx.getAddress();

        await Promise.all([
            makerToken.approve(await zeroEx.getAddress(), MAX_UINT256)({ from: maker }),
            makerToken.approve(await zeroEx.getAddress(), MAX_UINT256)({ from: notMaker }),
            takerToken.approve(await zeroEx.getAddress(), MAX_UINT256)({ from: taker }),
            takerToken.approve(await zeroEx.getAddress(), MAX_UINT256)({ from: notTaker }),
            wethToken.approve(await zeroEx.getAddress(), MAX_UINT256)({ from: maker }),
            wethToken.approve(await zeroEx.getAddress(), MAX_UINT256)({ from: notMaker }),
            wethToken.approve(await zeroEx.getAddress(), MAX_UINT256)({ from: taker }),
            wethToken.approve(await zeroEx.getAddress(), MAX_UINT256)({ from: notTaker }),
        ]);

        // contract wallet for signer delegation
        const contractWalletOwnerSigner = await env.provider.getSigner(contractWalletOwner);
        const contractWalletFactory = new TestOrderSignerRegistryWithContractWallet__factory(contractWalletOwnerSigner);
        contractWallet = await contractWalletFactory.deploy(await zeroEx.getAddress());
        await contractWallet.waitForDeployment();

        await contractWallet
            .approveERC20(await makerToken.getAddress(), await zeroEx.getAddress(), MAX_UINT256)
            ({ from: contractWalletOwner });
        await contractWallet
            .approveERC20(await takerToken.getAddress(), await zeroEx.getAddress(), MAX_UINT256)
            ({ from: contractWalletOwner });

        testUtils = new NativeOrdersTestEnvironment(maker, taker, makerToken, takerToken, zeroEx, ZERO, ZERO, env);
    });

    async function getTestOtcOrder(fields: Partial<OtcOrder> = {}): Promise<OtcOrder> {
        return getRandomOtcOrder({
            maker,
            verifyingContract,
            chainId: 1337,
            takerToken: await takerToken.getAddress(),
            makerToken: await makerToken.getAddress(),
            taker: NULL_ADDRESS,
            txOrigin: taker,
            ...fields,
        });
    }

    describe('getOtcOrderHash()', () => {
        it('returns the correct hash', async () => {
            const order = await getTestOtcOrder();
            const hash = await zeroEx.getOtcOrderHash(order)();
            expect(hash).to.eq(order.getHash());
        });
    });

    describe('lastOtcTxOriginNonce()', () => {
        it('returns 0 if bucket is unused', async () => {
            const nonce = await zeroEx.lastOtcTxOriginNonce(taker, ZERO)();
            expect(nonce).to.eq(0);
        });
        it('returns the last nonce used in a bucket', async () => {
            const order = await getTestOtcOrder();
            await testUtils.fillOtcOrderAsync(order);
            const nonce = await zeroEx.lastOtcTxOriginNonce(taker, order.nonceBucket)();
            expect(nonce).to.eq(order.nonce);
        });
    });

    describe('getOtcOrderInfo()', () => {
        it('unfilled order', async () => {
            const order = await getTestOtcOrder();
            const info = await zeroEx.getOtcOrderInfo(order)();
            expect(info).to.deep.equal({
                status: OrderStatus.Fillable,
                orderHash: order.getHash(),
            });
        });

        it('unfilled expired order', async () => {
            const expiry = createExpiry(-60);
            const order = await getTestOtcOrder({ expiry });
            const info = await zeroEx.getOtcOrderInfo(order)();
            expect(info).to.deep.equal({
                status: OrderStatus.Expired,
                orderHash: order.getHash(),
            });
        });

        it('filled then expired order', async () => {
            const expiry = createExpiry(60);
            const order = await getTestOtcOrder({ expiry });
            await testUtils.fillOtcOrderAsync(order);
            // Advance time to expire the order.
            await env.web3Wrapper.increaseTimeAsync(61);
            const info = await zeroEx.getOtcOrderInfo(order)();
            expect(info).to.deep.equal({
                status: OrderStatus.Invalid,
                orderHash: order.getHash(),
            });
        });

        it('filled order', async () => {
            const order = await getTestOtcOrder();
            // Fill the order first.
            await testUtils.fillOtcOrderAsync(order);
            const info = await zeroEx.getOtcOrderInfo(order)();
            expect(info).to.deep.equal({
                status: OrderStatus.Invalid,
                orderHash: order.getHash(),
            });
        });
    });

    async function assertExpectedFinalBalancesFromOtcOrderFillAsync(
        order: OtcOrder,
        takerTokenFillAmount: bigint = order.takerAmount,
    ): Promise<void> {
        const { makerTokenFilledAmount, takerTokenFilledAmount } = computeOtcOrderFilledAmounts(
            order,
            takerTokenFillAmount,
        );
        const makerBalance = await new TestMintableERC20TokenContract(order.takerToken, env.provider)
            .balanceOf(order.maker)
            ();
        const takerBalance = await new TestMintableERC20TokenContract(order.makerToken, env.provider)
            .balanceOf(order.taker !== NULL_ADDRESS ? order.taker : taker)
            ();
        expect(makerBalance, 'maker balance').to.eq(takerTokenFilledAmount);
        expect(takerBalance, 'taker balance').to.eq(makerTokenFilledAmount);
    }

    describe('fillOtcOrder()', () => {
        it('can fully fill an order', async () => {
            const order = await getTestOtcOrder();
            const receipt = await testUtils.fillOtcOrderAsync(order);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                IZeroExEvents.OtcOrderFilled,
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
        });

        it('can partially fill an order', async () => {
            const order = await getTestOtcOrder();
            const fillAmount = order.takerAmount - 1;
            const receipt = await testUtils.fillOtcOrderAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order, fillAmount)],
                IZeroExEvents.OtcOrderFilled,
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order, fillAmount);
        });

        it('clamps fill amount to remaining available', async () => {
            const order = await getTestOtcOrder();
            const fillAmount = order.takerAmount + 1;
            const receipt = await testUtils.fillOtcOrderAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order, fillAmount)],
                IZeroExEvents.OtcOrderFilled,
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order, fillAmount);
        });

        it('cannot fill an order with wrong tx.origin', async () => {
            const order = await getTestOtcOrder();
            const tx = testUtils.fillOtcOrderAsync(order, order.takerAmount, notTaker);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), notTaker, taker),
            );
        });

        it('cannot fill an order with wrong taker', async () => {
            const order = await getTestOtcOrder({ taker: notTaker });
            const tx = testUtils.fillOtcOrderAsync(order);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableByTakerError(order.getHash(), taker, notTaker),
            );
        });

        it('can fill an order from a different tx.origin if registered', async () => {
            const order = await getTestOtcOrder();
            await zeroEx.registerAllowedRfqOrigins([notTaker], true)({ from: taker });
            return testUtils.fillOtcOrderAsync(order, order.takerAmount, notTaker);
        });

        it('cannot fill an order with registered then unregistered tx.origin', async () => {
            const order = await getTestOtcOrder();
            await zeroEx.registerAllowedRfqOrigins([notTaker], true)({ from: taker });
            await zeroEx.registerAllowedRfqOrigins([notTaker], false)({ from: taker });
            const tx = testUtils.fillOtcOrderAsync(order, order.takerAmount, notTaker);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), notTaker, taker),
            );
        });

        it('cannot fill an order with a zero tx.origin', async () => {
            const order = await getTestOtcOrder({ txOrigin: NULL_ADDRESS });
            const tx = testUtils.fillOtcOrderAsync(order);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), taker, NULL_ADDRESS),
            );
        });

        it('cannot fill an expired order', async () => {
            const order = await getTestOtcOrder({ expiry: createExpiry(-60) });
            const tx = testUtils.fillOtcOrderAsync(order);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Expired),
            );
        });

        it('cannot fill order with bad signature', async () => {
            const order = await getTestOtcOrder();
            // Overwrite chainId to result in a different hash and therefore different
            // signature.
            const tx = testUtils.fillOtcOrderAsync(order.clone({ chainId: 1234 }));
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotSignedByMakerError(order.getHash(), undefined, order.maker),
            );
        });

        it('fails if ETH is attached', async () => {
            const order = await getTestOtcOrder();
            await testUtils.prepareBalancesForOrdersAsync([order], taker);
            const tx = zeroEx
                .fillOtcOrder(order, await order.getSignatureWithProviderAsync(env.provider), order.takerAmount)
                ({ from: taker, value: 1 });
            // This will revert at the language level because the fill function is not payable.
            return expect(tx).to.be.rejectedWith('revert');
        });

        it('cannot fill the same order twice', async () => {
            const order = await getTestOtcOrder();
            await testUtils.fillOtcOrderAsync(order);
            const tx = testUtils.fillOtcOrderAsync(order);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Invalid),
            );
        });

        it('cannot fill two orders with the same nonceBucket and nonce', async () => {
            const order1 = getTestOtcOrder();
            await testUtils.fillOtcOrderAsync(order1);
            const order2 = getTestOtcOrder({ nonceBucket: order1.nonceBucket, nonce: order1.nonce });
            const tx = testUtils.fillOtcOrderAsync(order2);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order2.getHash(), OrderStatus.Invalid),
            );
        });

        it('cannot fill an order whose nonce is less than the nonce last used in that bucket', async () => {
            const order1 = getTestOtcOrder();
            await testUtils.fillOtcOrderAsync(order1);
            const order2 = getTestOtcOrder({ nonceBucket: order1.nonceBucket, nonce: order1.nonce - 1 });
            const tx = testUtils.fillOtcOrderAsync(order2);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order2.getHash(), OrderStatus.Invalid),
            );
        });

        it('can fill two orders that use the same nonce bucket and increasing nonces', async () => {
            const order1 = getTestOtcOrder();
            const tx1 = await testUtils.fillOtcOrderAsync(order1);
            verifyEventsFromLogs(
                tx1.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1)],
                IZeroExEvents.OtcOrderFilled,
            );
            const order2 = getTestOtcOrder({ nonceBucket: order1.nonceBucket, nonce: order1.nonce + 1 });
            const tx2 = await testUtils.fillOtcOrderAsync(order2);
            verifyEventsFromLogs(
                tx2.logs,
                [testUtils.createOtcOrderFilledEventArgs(order2)],
                IZeroExEvents.OtcOrderFilled,
            );
        });

        it('can fill two orders that use the same nonce but different nonce buckets', async () => {
            const order1 = getTestOtcOrder();
            const tx1 = await testUtils.fillOtcOrderAsync(order1);
            verifyEventsFromLogs(
                tx1.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1)],
                IZeroExEvents.OtcOrderFilled,
            );
            const order2 = getTestOtcOrder({ nonce: order1.nonce });
            const tx2 = await testUtils.fillOtcOrderAsync(order2);
            verifyEventsFromLogs(
                tx2.logs,
                [testUtils.createOtcOrderFilledEventArgs(order2)],
                IZeroExEvents.OtcOrderFilled,
            );
        });

        it('can fill a WETH buy order and receive ETH', async () => {
            const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            const order = await getTestOtcOrder({ makerToken: await wethToken.getAddress(), makerAmount: ethers.parseEther('1') });
            await wethToken.deposit()({ from: maker, value: order.makerAmount });
            const receipt = await testUtils.fillOtcOrderAsync(order, order.takerAmount, taker, true);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                IZeroExEvents.OtcOrderFilled,
            );
            const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            expect(takerEthBalanceAfter - takerEthBalanceBefore).to.equal(order.makerAmount);
        });

        it('reverts if `unwrapWeth` is true but maker token is not WETH', async () => {
            const order = await getTestOtcOrder();
            const tx = testUtils.fillOtcOrderAsync(order, order.takerAmount, taker, true);
            return expect(tx).to.be.revertedWith('OtcOrdersFeature::fillOtcOrderForEth/MAKER_TOKEN_NOT_WETH');
        });

        it('allows for fills on orders signed by a approved signer', async () => {
            const order = await getTestOtcOrder({ maker: contractWallet.address });
            const sig = await order.getSignatureWithProviderAsync(
                env.provider,
                SignatureType.EthSign,
                contractWalletSigner,
            );
            // covers taker
            await testUtils.prepareBalancesForOrdersAsync([order]);
            // need to provide contract wallet with a balance
            await makerToken.mint(contractWallet.address, order.makerAmount)();
            // allow signer
            await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, true)
                ({ from: contractWalletOwner });
            // fill should succeed
            const receipt = await zeroEx
                .fillOtcOrder(order, sig, order.takerAmount)
                ({ from: taker });
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                IZeroExEvents.OtcOrderFilled,
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
        });

        it('disallows fills if the signer is revoked', async () => {
            const order = await getTestOtcOrder({ maker: contractWallet.address });
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
            // fill should revert
            const tx = zeroEx.fillOtcOrder(order, sig, order.takerAmount)({ from: taker });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotSignedByMakerError(
                    order.getHash(),
                    contractWalletSigner,
                    order.maker,
                ),
            );
        });

        it(`doesn't allow fills with an unapproved signer`, async () => {
            const order = await getTestOtcOrder({ maker: contractWallet.address });
            const sig = await order.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, maker);
            // covers taker
            await testUtils.prepareBalancesForOrdersAsync([order]);
            // need to provide contract wallet with a balance
            await makerToken.mint(contractWallet.address, order.makerAmount)();
            // fill should revert
            const tx = zeroEx.fillOtcOrder(order, sig, order.takerAmount)({ from: taker });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotSignedByMakerError(order.getHash(), maker, order.maker),
            );
        });
    });
    describe('fillOtcOrderWithEth()', () => {
        it('Can fill an order with ETH (takerToken=WETH)', async () => {
            const order = await getTestOtcOrder({ takerToken: await wethToken.getAddress() });
            const receipt = await testUtils.fillOtcOrderWithEthAsync(order);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                IZeroExEvents.OtcOrderFilled,
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
        });
        it('Can fill an order with ETH (takerToken=ETH)', async () => {
            const order = await getTestOtcOrder({ takerToken: ETH_TOKEN_ADDRESS });
            const makerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(maker);
            const receipt = await testUtils.fillOtcOrderWithEthAsync(order);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                IZeroExEvents.OtcOrderFilled,
            );
            const takerBalance = await new TestMintableERC20TokenContract(order.makerToken, env.provider)
                .balanceOf(taker)
                ();
            expect(takerBalance, 'taker balance').to.eq(order.makerAmount);
            const makerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(maker);
            expect(makerEthBalanceAfter - makerEthBalanceBefore, 'maker balance').to.equal(
                order.takerAmount,
            );
        });
        it('Can partially fill an order with ETH (takerToken=WETH)', async () => {
            const order = await getTestOtcOrder({ takerToken: await wethToken.getAddress() });
            const fillAmount = order.takerAmount - 1;
            const receipt = await testUtils.fillOtcOrderWithEthAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order, fillAmount)],
                IZeroExEvents.OtcOrderFilled,
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order, fillAmount);
        });
        it('Can partially fill an order with ETH (takerToken=ETH)', async () => {
            const order = await getTestOtcOrder({ takerToken: ETH_TOKEN_ADDRESS });
            const fillAmount = order.takerAmount - 1;
            const makerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(maker);
            const receipt = await testUtils.fillOtcOrderWithEthAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order, fillAmount)],
                IZeroExEvents.OtcOrderFilled,
            );
            const { makerTokenFilledAmount, takerTokenFilledAmount } = computeOtcOrderFilledAmounts(order, fillAmount);
            const takerBalance = await new TestMintableERC20TokenContract(order.makerToken, env.provider)
                .balanceOf(taker)
                ();
            expect(takerBalance, 'taker balance').to.eq(makerTokenFilledAmount);
            const makerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(maker);
            expect(makerEthBalanceAfter - makerEthBalanceBefore, 'maker balance').to.equal(
                takerTokenFilledAmount,
            );
        });
        it('Can refund excess ETH is msg.value > order.takerAmount (takerToken=WETH)', async () => {
            const order = await getTestOtcOrder({ takerToken: await wethToken.getAddress() });
            const fillAmount = order.takerAmount + 420;
            const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            const receipt = await testUtils.fillOtcOrderWithEthAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                IZeroExEvents.OtcOrderFilled,
            );
            const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            expect(takerEthBalanceBefore - takerEthBalanceAfter).to.equal(order.takerAmount);
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
        });
        it('Can refund excess ETH is msg.value > order.takerAmount (takerToken=ETH)', async () => {
            const order = await getTestOtcOrder({ takerToken: ETH_TOKEN_ADDRESS });
            const fillAmount = order.takerAmount + 420;
            const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            const makerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(maker);
            const receipt = await testUtils.fillOtcOrderWithEthAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                IZeroExEvents.OtcOrderFilled,
            );
            const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            expect(takerEthBalanceBefore - takerEthBalanceAfter, 'taker eth balance').to.equal(
                order.takerAmount,
            );
            const takerBalance = await new TestMintableERC20TokenContract(order.makerToken, env.provider)
                .balanceOf(taker)
                ();
            expect(takerBalance, 'taker balance').to.eq(order.makerAmount);
            const makerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(maker);
            expect(makerEthBalanceAfter - makerEthBalanceBefore, 'maker balance').to.equal(
                order.takerAmount,
            );
        });
        it('Cannot fill an order if taker token is not ETH or WETH', async () => {
            const order = await getTestOtcOrder();
            const tx = testUtils.fillOtcOrderWithEthAsync(order);
            return expect(tx).to.be.revertedWith('OtcOrdersFeature::fillOtcOrderWithEth/INVALID_TAKER_TOKEN');
        });
    });

    describe('fillTakerSignedOtcOrder()', () => {
        it('can fully fill an order', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            const receipt = await testUtils.fillTakerSignedOtcOrderAsync(order);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                IZeroExEvents.OtcOrderFilled,
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
        });

        it('cannot fill an order with wrong tx.origin', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order, notTxOrigin);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), notTxOrigin, txOrigin),
            );
        });

        it('can fill an order from a different tx.origin if registered', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            await zeroEx
                .registerAllowedRfqOrigins([notTxOrigin], true)
                ({ from: txOrigin });
            return testUtils.fillTakerSignedOtcOrderAsync(order, notTxOrigin);
        });

        it('cannot fill an order with registered then unregistered tx.origin', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            await zeroEx
                .registerAllowedRfqOrigins([notTxOrigin], true)
                ({ from: txOrigin });
            await zeroEx
                .registerAllowedRfqOrigins([notTxOrigin], false)
                ({ from: txOrigin });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order, notTxOrigin);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), notTxOrigin, txOrigin),
            );
        });

        it('cannot fill an order with a zero tx.origin', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin: NULL_ADDRESS });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order, txOrigin);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), txOrigin, NULL_ADDRESS),
            );
        });

        it('cannot fill an expired order', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin, expiry: createExpiry(-60) });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Expired),
            );
        });

        it('cannot fill an order with bad taker signature', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order, txOrigin, notTaker);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableByTakerError(order.getHash(), notTaker, taker),
            );
        });

        it('cannot fill order with bad maker signature', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            const anotherOrder = getTestOtcOrder({ taker, txOrigin });
            await testUtils.prepareBalancesForOrdersAsync([order], taker);
            const tx = zeroEx
                .fillTakerSignedOtcOrder(
                    order,
                    await anotherOrder.getSignatureWithProviderAsync(env.provider),
                    await order.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, taker),
                )
                ({ from: txOrigin });

            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotSignedByMakerError(order.getHash(), undefined, order.maker),
            );
        });

        it('fails if ETH is attached', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            await testUtils.prepareBalancesForOrdersAsync([order], taker);
            const tx = zeroEx
                .fillTakerSignedOtcOrder(
                    order,
                    await order.getSignatureWithProviderAsync(env.provider),
                    await order.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, taker),
                )
                ({ from: txOrigin, value: 1 });
            // This will revert at the language level because the fill function is not payable.
            return expect(tx).to.be.rejectedWith('revert');
        });

        it('cannot fill the same order twice', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            await testUtils.fillTakerSignedOtcOrderAsync(order);
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Invalid),
            );
        });

        it('cannot fill two orders with the same nonceBucket and nonce', async () => {
            const order1 = getTestOtcOrder({ taker, txOrigin });
            await testUtils.fillTakerSignedOtcOrderAsync(order1);
            const order2 = getTestOtcOrder({ taker, txOrigin, nonceBucket: order1.nonceBucket, nonce: order1.nonce });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order2);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order2.getHash(), OrderStatus.Invalid),
            );
        });

        it('cannot fill an order whose nonce is less than the nonce last used in that bucket', async () => {
            const order1 = getTestOtcOrder({ taker, txOrigin });
            await testUtils.fillTakerSignedOtcOrderAsync(order1);
            const order2 = getTestOtcOrder({
                taker,
                txOrigin,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce - 1,
            });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order2);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order2.getHash(), OrderStatus.Invalid),
            );
        });

        it('can fill two orders that use the same nonce bucket and increasing nonces', async () => {
            const order1 = getTestOtcOrder({ taker, txOrigin });
            const tx1 = await testUtils.fillTakerSignedOtcOrderAsync(order1);
            verifyEventsFromLogs(
                tx1.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1)],
                IZeroExEvents.OtcOrderFilled,
            );
            const order2 = getTestOtcOrder({
                taker,
                txOrigin,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce + 1,
            });
            const tx2 = await testUtils.fillTakerSignedOtcOrderAsync(order2);
            verifyEventsFromLogs(
                tx2.logs,
                [testUtils.createOtcOrderFilledEventArgs(order2)],
                IZeroExEvents.OtcOrderFilled,
            );
        });

        it('can fill two orders that use the same nonce but different nonce buckets', async () => {
            const order1 = getTestOtcOrder({ taker, txOrigin });
            const tx1 = await testUtils.fillTakerSignedOtcOrderAsync(order1);
            verifyEventsFromLogs(
                tx1.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1)],
                IZeroExEvents.OtcOrderFilled,
            );
            const order2 = getTestOtcOrder({ taker, txOrigin, nonce: order1.nonce });
            const tx2 = await testUtils.fillTakerSignedOtcOrderAsync(order2);
            verifyEventsFromLogs(
                tx2.logs,
                [testUtils.createOtcOrderFilledEventArgs(order2)],
                IZeroExEvents.OtcOrderFilled,
            );
        });

        it('can fill a WETH buy order and receive ETH', async () => {
            const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            const order = await getTestOtcOrder({
                taker,
                txOrigin,
                makerToken: await wethToken.getAddress(),
                makerAmount: ethers.parseEther('1'),
            });
            await wethToken.deposit()({ from: maker, value: order.makerAmount });
            const receipt = await testUtils.fillTakerSignedOtcOrderAsync(order, txOrigin, taker, true);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                IZeroExEvents.OtcOrderFilled,
            );
            const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            expect(takerEthBalanceAfter - takerEthBalanceBefore).to.equal(order.makerAmount);
        });

        it('reverts if `unwrapWeth` is true but maker token is not WETH', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order, txOrigin, taker, true);
            return expect(tx).to.be.revertedWith('OtcOrdersFeature::fillTakerSignedOtcOrder/MAKER_TOKEN_NOT_WETH');
        });
    });

    describe('batchFillTakerSignedOtcOrders()', () => {
        it('Fills multiple orders', async () => {
            const order1 = getTestOtcOrder({ taker, txOrigin });
            const order2 = getTestOtcOrder({
                taker: notTaker,
                txOrigin,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce + 1,
            });
            await testUtils.prepareBalancesForOrdersAsync([order1], taker);
            await testUtils.prepareBalancesForOrdersAsync([order2], notTaker);
            const tx = await zeroEx
                .batchFillTakerSignedOtcOrders(
                    [order1, order2],
                    [
                        await order1.getSignatureWithProviderAsync(env.provider),
                        await order2.getSignatureWithProviderAsync(env.provider),
                    ],
                    [
                        await order1.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, taker),
                        await order2.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, notTaker),
                    ],
                    [false, false],
                )
                ({ from: txOrigin });
            verifyEventsFromLogs(
                tx.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1), testUtils.createOtcOrderFilledEventArgs(order2)],
                IZeroExEvents.OtcOrderFilled,
            );
        });
        it('Fills multiple orders and unwraps WETH', async () => {
            const order1 = getTestOtcOrder({ taker, txOrigin });
            const order2 = getTestOtcOrder({
                taker: notTaker,
                txOrigin,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce + 1,
                makerToken: await wethToken.getAddress(),
                makerAmount: ethers.parseEther('1'),
            });
            await testUtils.prepareBalancesForOrdersAsync([order1], taker);
            await testUtils.prepareBalancesForOrdersAsync([order2], notTaker);
            await wethToken.deposit()({ from: maker, value: order2.makerAmount });
            const tx = await zeroEx
                .batchFillTakerSignedOtcOrders(
                    [order1, order2],
                    [
                        await order1.getSignatureWithProviderAsync(env.provider),
                        await order2.getSignatureWithProviderAsync(env.provider),
                    ],
                    [
                        await order1.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, taker),
                        await order2.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, notTaker),
                    ],
                    [false, true],
                )
                ({ from: txOrigin });
            verifyEventsFromLogs(
                tx.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1), testUtils.createOtcOrderFilledEventArgs(order2)],
                IZeroExEvents.OtcOrderFilled,
            );
        });
        it('Skips over unfillable orders', async () => {
            const order1 = getTestOtcOrder({ taker, txOrigin });
            const order2 = getTestOtcOrder({
                taker: notTaker,
                txOrigin,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce + 1,
            });
            await testUtils.prepareBalancesForOrdersAsync([order1], taker);
            await testUtils.prepareBalancesForOrdersAsync([order2], notTaker);
            const tx = await zeroEx
                .batchFillTakerSignedOtcOrders(
                    [order1, order2],
                    [
                        await order1.getSignatureWithProviderAsync(env.provider),
                        await order2.getSignatureWithProviderAsync(env.provider),
                    ],
                    [
                        await order1.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, taker),
                        await order2.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, taker), // Invalid signature for order2
                    ],
                    [false, false],
                )
                ({ from: txOrigin });
            verifyEventsFromLogs(
                tx.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1)],
                IZeroExEvents.OtcOrderFilled,
            );
        });
    });
});
