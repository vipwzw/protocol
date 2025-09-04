import { ethers } from "hardhat";
import { constants, verifyEventsFromLogs } from '@0x/utils';
import { expect } from 'chai';
import { OrderStatus, OtcOrder, RevertErrors, SignatureType } from '@0x/protocol-utils';


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

describe('OtcOrdersFeature', () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => {
            const signers = await ethers.getSigners();
            return Promise.all(signers.map(s => s.getAddress()));
        },
    } as any;
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
    let snapshotId: string;

    before(async () => {
        // Useful for ETH balance accounting
        let owner;
        [owner, maker, taker, notMaker, notTaker, contractWalletOwner, contractWalletSigner, txOrigin, notTxOrigin] =
            await env.getAccountAddressesAsync();
        env.txDefaults.from = owner;
        const txDefaults = { ...env.txDefaults, gasPrice: 0 };
        
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
        
        const ownerSigner = await env.provider.getSigner(owner);
        const ownableFeature = await ethers.getContractAt('IOwnableFeature', await zeroEx.getAddress(), ownerSigner);
        await ownableFeature.migrate(await otcFeatureImpl.getAddress(), otcFeatureImpl.interface.encodeFunctionData('migrate'), owner);
        
        // 重新获取 zeroEx 实例以包含 OTC Orders 功能
        zeroEx = await ethers.getContractAt('IOtcOrdersFeature', await zeroEx.getAddress()) as any;
        verifyingContract = await zeroEx.getAddress();

        const makerSigner = await env.provider.getSigner(maker);
        const notMakerSigner = await env.provider.getSigner(notMaker);
        const takerSigner = await env.provider.getSigner(taker);
        const notTakerSigner = await env.provider.getSigner(notTaker);
        
        await Promise.all([
            makerToken.connect(makerSigner).approve(await zeroEx.getAddress(), MAX_UINT256),
            makerToken.connect(notMakerSigner).approve(await zeroEx.getAddress(), MAX_UINT256),
            takerToken.connect(takerSigner).approve(await zeroEx.getAddress(), MAX_UINT256),
            takerToken.connect(notTakerSigner).approve(await zeroEx.getAddress(), MAX_UINT256),
            wethToken.connect(makerSigner).approve(await zeroEx.getAddress(), MAX_UINT256),
            wethToken.connect(notMakerSigner).approve(await zeroEx.getAddress(), MAX_UINT256),
            wethToken.connect(takerSigner).approve(await zeroEx.getAddress(), MAX_UINT256),
            wethToken.connect(notTakerSigner).approve(await zeroEx.getAddress(), MAX_UINT256),
        ]);

        // contract wallet for signer delegation
        const contractWalletOwnerSigner = await env.provider.getSigner(contractWalletOwner);
        const contractWalletFactory = new TestOrderSignerRegistryWithContractWallet__factory(contractWalletOwnerSigner);
        contractWallet = await contractWalletFactory.deploy(await zeroEx.getAddress());
        await contractWallet.waitForDeployment();

        // 🔧 使用现代ethers v6语法
        await contractWallet
            .connect(contractWalletOwnerSigner)
            .approveERC20(await makerToken.getAddress(), await zeroEx.getAddress(), MAX_UINT256);
        await contractWallet
            .connect(contractWalletOwnerSigner)
            .approveERC20(await takerToken.getAddress(), await zeroEx.getAddress(), MAX_UINT256);

        testUtils = new NativeOrdersTestEnvironment(maker, taker, makerToken, takerToken, zeroEx, ZERO, ZERO, env);
        
        // 创建初始快照
        snapshotId = await ethers.provider.send('evm_snapshot', []);
    });

    beforeEach(async () => {
        // 🔄 状态重置：恢复到初始快照，完全重置所有状态
        // 这包括区块链时间、合约状态、账户余额等所有状态
        await ethers.provider.send('evm_revert', [snapshotId]);
        // 重新创建快照供下次使用
        snapshotId = await ethers.provider.send('evm_snapshot', []);
    });

    async function getTestOtcOrder(fields: Partial<OtcOrder> = {}): Promise<OtcOrder> {
        return getRandomOtcOrder({
            maker,
            verifyingContract,
            chainId: (await ethers.provider.getNetwork()).chainId,
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
            // 🔧 修复API语法：使用正确的合约接口
            const otcFeature = await ethers.getContractAt('IOtcOrdersFeature', await zeroEx.getAddress());
            const hash = await otcFeature.getOtcOrderHash(order);
            expect(hash).to.eq(order.getHash());
        });
    });

    describe('lastOtcTxOriginNonce()', () => {
        it('returns 0 if bucket is unused', async () => {
            const nonce = await zeroEx.lastOtcTxOriginNonce(taker, ZERO);
            expect(nonce).to.eq(0);
        });
        it('returns the last nonce used in a bucket', async () => {
            const order = await getTestOtcOrder();
            await testUtils.fillOtcOrderAsync(order);
            const nonce = await zeroEx.lastOtcTxOriginNonce(taker, order.nonceBucket);
            expect(nonce).to.eq(order.nonce);
        });
    });

    describe('getOtcOrderInfo()', () => {
        it('unfilled order', async () => {
            const order = await getTestOtcOrder();
            const info = await zeroEx.getOtcOrderInfo(order);
            // ethers v6 返回 Result 数组格式: [orderHash, status]
            expect(info[0]).to.equal(order.getHash()); // orderHash
            expect(info[1]).to.equal(BigInt(OrderStatus.Fillable)); // status
        });

        it('unfilled expired order', async () => {
            const expiry = await createExpiry(-60);
            const order = await getTestOtcOrder({ expiry });
            const info = await zeroEx.getOtcOrderInfo(order);
            // ethers v6 返回 Result 数组格式: [orderHash, status]
            expect(info[0]).to.equal(order.getHash()); // orderHash
            expect(info[1]).to.equal(BigInt(OrderStatus.Expired)); // status
        });

        it('filled then expired order', async () => {
            const expiry = await createExpiry(60);
            const order = await getTestOtcOrder({ expiry });
            await testUtils.fillOtcOrderAsync(order);
            // Advance time to expire the order.
            await ethers.provider.send('evm_increaseTime', [61]);
            await ethers.provider.send('evm_mine', []);
            const info = await zeroEx.getOtcOrderInfo(order);
            // ethers v6 返回 Result 数组格式: [orderHash, status]
            expect(info[0]).to.equal(order.getHash()); // orderHash
            expect(info[1]).to.equal(BigInt(OrderStatus.Invalid)); // status
        });

        it('filled order', async () => {
            const order = await getTestOtcOrder();
            // Fill the order first.
            await testUtils.fillOtcOrderAsync(order);
            const info = await zeroEx.getOtcOrderInfo(order);
            // ethers v6 返回 Result 数组格式: [orderHash, status]
            expect(info[0]).to.equal(order.getHash()); // orderHash
            expect(info[1]).to.equal(BigInt(OrderStatus.Invalid)); // status
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
                'OtcOrderFilled',
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
        });

        it('can partially fill an order', async () => {
            const order = await getTestOtcOrder();
            const fillAmount = order.takerAmount - 1n;
            const receipt = await testUtils.fillOtcOrderAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order, fillAmount)],
                'OtcOrderFilled',
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order, fillAmount);
        });

        it('clamps fill amount to remaining available', async () => {
            const order = await getTestOtcOrder();
            const fillAmount = order.takerAmount + 1n;
            const receipt = await testUtils.fillOtcOrderAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order, fillAmount)],
                'OtcOrderFilled',
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order, fillAmount);
        });

        it('cannot fill an order with wrong tx.origin', async () => {
            const order = await getTestOtcOrder();
            const tx = testUtils.fillOtcOrderAsync(order, order.takerAmount, notTaker);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), notTaker, taker);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('cannot fill an order with wrong taker', async () => {
            const order = await getTestOtcOrder({ taker: notTaker });
            const tx = testUtils.fillOtcOrderAsync(order);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableByTakerError(order.getHash(), taker, notTaker);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('can fill an order from a different tx.origin if registered', async () => {
            const order = await getTestOtcOrder();
            // 🔧 修复API语法，保持测试意图：注册allowed RFQ origins
            const nativeOrdersFeature = await ethers.getContractAt('INativeOrdersFeature', await zeroEx.getAddress());
            const takerSigner = await env.provider.getSigner(taker);
            await nativeOrdersFeature.connect(takerSigner).registerAllowedRfqOrigins([notTaker], true);
            return testUtils.fillOtcOrderAsync(order, order.takerAmount, notTaker);
        });

        it('cannot fill an order with registered then unregistered tx.origin', async () => {
            const order = await getTestOtcOrder();
            // 🔧 修复API语法，保持测试意图：注册allowed RFQ origins
            const nativeOrdersFeature = await ethers.getContractAt('INativeOrdersFeature', await zeroEx.getAddress());
            const takerSigner = await env.provider.getSigner(taker);
            await nativeOrdersFeature.connect(takerSigner).registerAllowedRfqOrigins([notTaker], true);
            await nativeOrdersFeature.connect(takerSigner).registerAllowedRfqOrigins([notTaker], false); // 🔧 修复API语法
            const tx = testUtils.fillOtcOrderAsync(order, order.takerAmount, notTaker);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), notTaker, taker);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('cannot fill an order with a zero tx.origin', async () => {
            const order = await getTestOtcOrder({ txOrigin: NULL_ADDRESS });
            const tx = testUtils.fillOtcOrderAsync(order);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), taker, NULL_ADDRESS);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('cannot fill an expired order', async () => {
            const order = await getTestOtcOrder({ expiry: await createExpiry(-60) });
            const tx = testUtils.fillOtcOrderAsync(order);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Expired);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('cannot fill order with bad signature', async () => {
            const order = await getTestOtcOrder();
            // Overwrite chainId to result in a different hash and therefore different
            // signature.
            const tx = testUtils.fillOtcOrderAsync(order.clone({ chainId: 1234 }));
            const expectedError = new RevertErrors.NativeOrders.OrderNotSignedByMakerError(order.getHash(), undefined, order.maker);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('fails if ETH is attached', async () => {
            const order = await getTestOtcOrder();
            await testUtils.prepareBalancesForOrdersAsync([order], taker);
            const otcOrdersFeature = await ethers.getContractAt('IOtcOrdersFeature', await zeroEx.getAddress());
            const takerSigner = await env.provider.getSigner(taker);
            const tx = otcOrdersFeature
                .connect(takerSigner)
                .fillOtcOrder(order, await order.getSignatureWithProviderAsync(env.provider), order.takerAmount, { value: 1 });
            // This will revert at the language level because the fill function is not payable.
            return expect(tx).to.be.rejectedWith('revert');
        });

        it('cannot fill the same order twice', async () => {
            const order = await getTestOtcOrder();
            await testUtils.fillOtcOrderAsync(order);
            const tx = testUtils.fillOtcOrderAsync(order);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Invalid);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('cannot fill two orders with the same nonceBucket and nonce', async () => {
            const order1 = await getTestOtcOrder();
            await testUtils.fillOtcOrderAsync(order1);
            const order2 = await getTestOtcOrder({ nonceBucket: order1.nonceBucket, nonce: order1.nonce });
            const tx = testUtils.fillOtcOrderAsync(order2);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableError(order2.getHash(), OrderStatus.Invalid);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('cannot fill an order whose nonce is less than the nonce last used in that bucket', async () => {
            const order1 = await getTestOtcOrder();
            await testUtils.fillOtcOrderAsync(order1);
            const order2 = await getTestOtcOrder({ nonceBucket: order1.nonceBucket, nonce: order1.nonce - 1n });
            const tx = testUtils.fillOtcOrderAsync(order2);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableError(order2.getHash(), OrderStatus.Invalid);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('can fill two orders that use the same nonce bucket and increasing nonces', async () => {
            const order1 = await getTestOtcOrder();
            const tx1 = await testUtils.fillOtcOrderAsync(order1);
            verifyEventsFromLogs(
                tx1.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1)],
                'OtcOrderFilled',
            );
            const order2 = await getTestOtcOrder({ nonceBucket: order1.nonceBucket, nonce: order1.nonce + 1n });
            const tx2 = await testUtils.fillOtcOrderAsync(order2);
            verifyEventsFromLogs(
                tx2.logs,
                [testUtils.createOtcOrderFilledEventArgs(order2)],
                'OtcOrderFilled',
            );
        });

        it('can fill two orders that use the same nonce but different nonce buckets', async () => {
            const order1 = await getTestOtcOrder();
            const tx1 = await testUtils.fillOtcOrderAsync(order1);
            verifyEventsFromLogs(
                tx1.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1)],
                'OtcOrderFilled',
            );
            const order2 = await getTestOtcOrder({ nonce: order1.nonce });
            const tx2 = await testUtils.fillOtcOrderAsync(order2);
            verifyEventsFromLogs(
                tx2.logs,
                [testUtils.createOtcOrderFilledEventArgs(order2)],
                'OtcOrderFilled',
            );
        });

        it('can fill a WETH buy order and receive ETH', async () => {
            const takerEthBalanceBefore = await ethers.provider.getBalance(taker);
            const order = await getTestOtcOrder({ makerToken: await wethToken.getAddress(), makerAmount: ethers.parseEther('1') });
            // 🔧 修复API语法，保持测试意图：maker deposit ETH获得WETH
            const makerSigner = await env.provider.getSigner(maker);
            await wethToken.connect(makerSigner).deposit({ value: order.makerAmount });
            const receipt = await testUtils.fillOtcOrderAsync(order, order.takerAmount, taker, true);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                'OtcOrderFilled',
            );
            const takerEthBalanceAfter = await ethers.provider.getBalance(taker);
            expect(takerEthBalanceAfter - takerEthBalanceBefore).to.equal(order.makerAmount);
        });

        it('reverts if `unwrapWeth` is true but maker token is not WETH', async () => {
            const order = await getTestOtcOrder();
            const tx = testUtils.fillOtcOrderAsync(order, order.takerAmount, taker, true);
            return expect(tx).to.be.revertedWith('OtcOrdersFeature::fillOtcOrderForEth/MAKER_TOKEN_NOT_WETH');
        });

        it('allows for fills on orders signed by a approved signer', async () => {
            const order = await getTestOtcOrder({ maker: await contractWallet.getAddress() });
            const sig = await order.getSignatureWithProviderAsync(
                env.provider,
                SignatureType.EthSign,
                contractWalletSigner,
            );
            // covers taker
            await testUtils.prepareBalancesForOrdersAsync([order]);
            // need to provide contract wallet with a balance
            await makerToken.mint(await contractWallet.getAddress(), order.makerAmount);
            // allow signer
            const contractWalletOwnerSigner = await env.provider.getSigner(contractWalletOwner);
            await contractWallet
                .connect(contractWalletOwnerSigner)
                .registerAllowedOrderSigner(contractWalletSigner, true);
            // fill should succeed
            const takerSigner = await env.provider.getSigner(taker);
            const tx = await zeroEx
                .connect(takerSigner)
                .fillOtcOrder(order, sig, order.takerAmount);
            const receipt = await tx.wait();
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                'OtcOrderFilled',
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
        });

        it('disallows fills if the signer is revoked', async () => {
            const order = await getTestOtcOrder({ maker: await contractWallet.getAddress() });
            const sig = await order.getSignatureWithProviderAsync(
                env.provider,
                SignatureType.EthSign,
                contractWalletSigner,
            );
            // covers taker
            await testUtils.prepareBalancesForOrdersAsync([order]);
            // need to provide contract wallet with a balance
            await makerToken.mint(await contractWallet.getAddress(), order.makerAmount);
            // first allow signer
            await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, true)
                ({ from: contractWalletOwner });
            // then disallow signer
            await contractWallet
                .registerAllowedOrderSigner(contractWalletSigner, false)
                ({ from: contractWalletOwner });
            // fill should revert
            // 🔧 修复API语法，保持测试意图：验证fillOtcOrder失败
            const takerSigner = await env.provider.getSigner(taker);
            const tx = zeroEx.connect(takerSigner).fillOtcOrder(order, sig, order.takerAmount);
            const expectedError = new RevertErrors.NativeOrders.OrderNotSignedByMakerError(
                order.getHash(),
                contractWalletSigner,
                order.maker,
            );
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it(`doesn't allow fills with an unapproved signer`, async () => {
            const order = await getTestOtcOrder({ maker: await contractWallet.getAddress() });
            const sig = await order.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, maker);
            // covers taker
            await testUtils.prepareBalancesForOrdersAsync([order]);
            // need to provide contract wallet with a balance
            await makerToken.mint(await contractWallet.getAddress(), order.makerAmount);
            // fill should revert
            // 🔧 修复API语法，保持测试意图：验证fillOtcOrder失败
            const takerSigner = await env.provider.getSigner(taker);
            const tx = zeroEx.connect(takerSigner).fillOtcOrder(order, sig, order.takerAmount);
            const expectedError = new RevertErrors.NativeOrders.OrderNotSignedByMakerError(order.getHash(), maker, order.maker);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });
    });
    describe('fillOtcOrderWithEth()', () => {
        it('Can fill an order with ETH (takerToken=WETH)', async () => {
            const order = await getTestOtcOrder({ takerToken: await wethToken.getAddress() });
            const receipt = await testUtils.fillOtcOrderWithEthAsync(order);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                'OtcOrderFilled',
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
        });
        it('Can fill an order with ETH (takerToken=ETH)', async () => {
            const order = await getTestOtcOrder({ takerToken: ETH_TOKEN_ADDRESS });
            const makerEthBalanceBefore = await ethers.provider.getBalance(maker);
            const receipt = await testUtils.fillOtcOrderWithEthAsync(order);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                'OtcOrderFilled',
            );
            const takerBalance = await new TestMintableERC20TokenContract(order.makerToken, env.provider)
                .balanceOf(taker)
                ();
            expect(takerBalance, 'taker balance').to.eq(order.makerAmount);
            const makerEthBalanceAfter = await ethers.provider.getBalance(maker);
            expect(makerEthBalanceAfter - makerEthBalanceBefore, 'maker balance').to.equal(
                order.takerAmount,
            );
        });
        it('Can partially fill an order with ETH (takerToken=WETH)', async () => {
            const order = await getTestOtcOrder({ takerToken: await wethToken.getAddress() });
            const fillAmount = order.takerAmount - 1n;
            const receipt = await testUtils.fillOtcOrderWithEthAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order, fillAmount)],
                'OtcOrderFilled',
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order, fillAmount);
        });
        it('Can partially fill an order with ETH (takerToken=ETH)', async () => {
            const order = await getTestOtcOrder({ takerToken: ETH_TOKEN_ADDRESS });
            const fillAmount = order.takerAmount - 1n;
            const makerEthBalanceBefore = await ethers.provider.getBalance(maker);
            const receipt = await testUtils.fillOtcOrderWithEthAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order, fillAmount)],
                'OtcOrderFilled',
            );
            const { makerTokenFilledAmount, takerTokenFilledAmount } = computeOtcOrderFilledAmounts(order, fillAmount);
            const takerBalance = await new TestMintableERC20TokenContract(order.makerToken, env.provider)
                .balanceOf(taker)
                ();
            expect(takerBalance, 'taker balance').to.eq(makerTokenFilledAmount);
            const makerEthBalanceAfter = await ethers.provider.getBalance(maker);
            expect(makerEthBalanceAfter - makerEthBalanceBefore, 'maker balance').to.equal(
                takerTokenFilledAmount,
            );
        });
        it('Can refund excess ETH is msg.value > order.takerAmount (takerToken=WETH)', async () => {
            const order = await getTestOtcOrder({ takerToken: await wethToken.getAddress() });
            const fillAmount = order.takerAmount + 420n;
            const takerEthBalanceBefore = await ethers.provider.getBalance(taker);
            const receipt = await testUtils.fillOtcOrderWithEthAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                'OtcOrderFilled',
            );
            const takerEthBalanceAfter = await ethers.provider.getBalance(taker);
            expect(takerEthBalanceBefore - takerEthBalanceAfter).to.equal(order.takerAmount);
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
        });
        it('Can refund excess ETH is msg.value > order.takerAmount (takerToken=ETH)', async () => {
            const order = await getTestOtcOrder({ takerToken: ETH_TOKEN_ADDRESS });
            const fillAmount = order.takerAmount + 420n;
            const takerEthBalanceBefore = await ethers.provider.getBalance(taker);
            const makerEthBalanceBefore = await ethers.provider.getBalance(maker);
            const receipt = await testUtils.fillOtcOrderWithEthAsync(order, fillAmount);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                'OtcOrderFilled',
            );
            const takerEthBalanceAfter = await ethers.provider.getBalance(taker);
            expect(takerEthBalanceBefore - takerEthBalanceAfter, 'taker eth balance').to.equal(
                order.takerAmount,
            );
            const takerBalance = await new TestMintableERC20TokenContract(order.makerToken, env.provider)
                .balanceOf(taker)
                ();
            expect(takerBalance, 'taker balance').to.eq(order.makerAmount);
            const makerEthBalanceAfter = await ethers.provider.getBalance(maker);
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
                'OtcOrderFilled',
            );
            await assertExpectedFinalBalancesFromOtcOrderFillAsync(order);
        });

        it('cannot fill an order with wrong tx.origin', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order, notTxOrigin);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), notTxOrigin, txOrigin);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('can fill an order from a different tx.origin if registered', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            const nativeOrdersFeature = await ethers.getContractAt('INativeOrdersFeature', await zeroEx.getAddress());
            await nativeOrdersFeature
                .connect(await env.provider.getSigner(txOrigin))
                .registerAllowedRfqOrigins([notTxOrigin], true);
            return testUtils.fillTakerSignedOtcOrderAsync(order, notTxOrigin);
        });

        it('cannot fill an order with registered then unregistered tx.origin', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            const nativeOrdersFeature = await ethers.getContractAt('INativeOrdersFeature', await zeroEx.getAddress());
            const txOriginSigner = await env.provider.getSigner(txOrigin);
            await nativeOrdersFeature
                .connect(txOriginSigner)
                .registerAllowedRfqOrigins([notTxOrigin], true);
            await nativeOrdersFeature
                .connect(txOriginSigner)
                .registerAllowedRfqOrigins([notTxOrigin], false);
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order, notTxOrigin);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), notTxOrigin, txOrigin);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('cannot fill an order with a zero tx.origin', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin: NULL_ADDRESS });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order, txOrigin);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableByOriginError(order.getHash(), txOrigin, NULL_ADDRESS);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('cannot fill an expired order', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin, expiry: await createExpiry(-60) });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Expired);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('cannot fill an order with bad taker signature', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order, txOrigin, notTaker);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableByTakerError(order.getHash(), notTaker, taker);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('cannot fill order with bad maker signature', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            const anotherOrder = await getTestOtcOrder({ taker, txOrigin });
            await testUtils.prepareBalancesForOrdersAsync([order], taker);
            const tx = zeroEx
                .fillTakerSignedOtcOrder(
                    order,
                    await anotherOrder.getSignatureWithProviderAsync(env.provider),
                    await order.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, taker),
                );

            const expectedError = new RevertErrors.NativeOrders.OrderNotSignedByMakerError(order.getHash(), undefined, order.maker);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('fails if ETH is attached', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            await testUtils.prepareBalancesForOrdersAsync([order], taker);
            const otcOrdersFeature = await ethers.getContractAt('IOtcOrdersFeature', await zeroEx.getAddress());
            const txOriginSigner = await env.provider.getSigner(txOrigin);
            const tx = otcOrdersFeature
                .connect(txOriginSigner)
                .fillTakerSignedOtcOrder(
                    order,
                    await order.getSignatureWithProviderAsync(env.provider),
                    await order.getSignatureWithProviderAsync(env.provider, SignatureType.EthSign, taker),
                    { value: 1 }
                );
            // This will revert at the language level because the fill function is not payable.
            return expect(tx).to.be.rejectedWith('revert');
        });

        it('cannot fill the same order twice', async () => {
            const order = await getTestOtcOrder({ taker, txOrigin });
            await testUtils.fillTakerSignedOtcOrderAsync(order);
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order);
            const expectedError = new RevertErrors.NativeOrders.OrderNotFillableError(order.getHash(), OrderStatus.Invalid);
            return expect(tx).to.be.revertedWith(expectedError.encode());
        });

        it('cannot fill two orders with the same nonceBucket and nonce', async () => {
            const order1 = await getTestOtcOrder({ taker, txOrigin });
            await testUtils.fillTakerSignedOtcOrderAsync(order1);
            const order2 = await getTestOtcOrder({ taker, txOrigin, nonceBucket: order1.nonceBucket, nonce: order1.nonce });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order2);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order2.getHash(), OrderStatus.Invalid),
            );
        });

        it('cannot fill an order whose nonce is less than the nonce last used in that bucket', async () => {
            const order1 = await getTestOtcOrder({ taker, txOrigin });
            await testUtils.fillTakerSignedOtcOrderAsync(order1);
            const order2 = await getTestOtcOrder({
                taker,
                txOrigin,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce - 1n,
            });
            const tx = testUtils.fillTakerSignedOtcOrderAsync(order2);
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NativeOrders.OrderNotFillableError(order2.getHash(), OrderStatus.Invalid),
            );
        });

        it('can fill two orders that use the same nonce bucket and increasing nonces', async () => {
            const order1 = await getTestOtcOrder({ taker, txOrigin });
            const tx1 = await testUtils.fillTakerSignedOtcOrderAsync(order1);
            verifyEventsFromLogs(
                tx1.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1)],
                'OtcOrderFilled',
            );
            const order2 = await getTestOtcOrder({
                taker,
                txOrigin,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce + 1n,
            });
            const tx2 = await testUtils.fillTakerSignedOtcOrderAsync(order2);
            verifyEventsFromLogs(
                tx2.logs,
                [testUtils.createOtcOrderFilledEventArgs(order2)],
                'OtcOrderFilled',
            );
        });

        it('can fill two orders that use the same nonce but different nonce buckets', async () => {
            const order1 = await getTestOtcOrder({ taker, txOrigin });
            const tx1 = await testUtils.fillTakerSignedOtcOrderAsync(order1);
            verifyEventsFromLogs(
                tx1.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1)],
                'OtcOrderFilled',
            );
            const order2 = await getTestOtcOrder({ taker, txOrigin, nonce: order1.nonce });
            const tx2 = await testUtils.fillTakerSignedOtcOrderAsync(order2);
            verifyEventsFromLogs(
                tx2.logs,
                [testUtils.createOtcOrderFilledEventArgs(order2)],
                'OtcOrderFilled',
            );
        });

        it('can fill a WETH buy order and receive ETH', async () => {
            const takerEthBalanceBefore = await ethers.provider.getBalance(taker);
            const order = await getTestOtcOrder({
                taker,
                txOrigin,
                makerToken: await wethToken.getAddress(),
                makerAmount: ethers.parseEther('1'),
            });
            // 🔧 修复API语法，保持测试意图：maker deposit ETH获得WETH
            const makerSigner = await env.provider.getSigner(maker);
            await wethToken.connect(makerSigner).deposit({ value: order.makerAmount });
            const receipt = await testUtils.fillTakerSignedOtcOrderAsync(order, txOrigin, taker, true);
            verifyEventsFromLogs(
                receipt.logs,
                [testUtils.createOtcOrderFilledEventArgs(order)],
                'OtcOrderFilled',
            );
            const takerEthBalanceAfter = await ethers.provider.getBalance(taker);
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
            const order1 = await getTestOtcOrder({ taker, txOrigin });
            const order2 = await getTestOtcOrder({
                taker: notTaker,
                txOrigin,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce + 1n,
            });
            await testUtils.prepareBalancesForOrdersAsync([order1], taker);
            await testUtils.prepareBalancesForOrdersAsync([order2], notTaker);
            const otcOrdersFeature = await ethers.getContractAt('IOtcOrdersFeature', await zeroEx.getAddress());
            const tx = await otcOrdersFeature
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
                );
            verifyEventsFromLogs(
                tx.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1), testUtils.createOtcOrderFilledEventArgs(order2)],
                'OtcOrderFilled',
            );
        });
        it('Fills multiple orders and unwraps WETH', async () => {
            const order1 = await getTestOtcOrder({ taker, txOrigin });
            const order2 = await getTestOtcOrder({
                taker: notTaker,
                txOrigin,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce + 1n,
                makerToken: await wethToken.getAddress(),
                makerAmount: ethers.parseEther('1'),
            });
            await testUtils.prepareBalancesForOrdersAsync([order1], taker);
            await testUtils.prepareBalancesForOrdersAsync([order2], notTaker);
            const makerSigner = await env.provider.getSigner(maker);
            await wethToken.connect(makerSigner).deposit({ value: order2.makerAmount });
            const otcOrdersFeature = await ethers.getContractAt('IOtcOrdersFeature', await zeroEx.getAddress());
            const tx = await otcOrdersFeature
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
                );
            verifyEventsFromLogs(
                tx.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1), testUtils.createOtcOrderFilledEventArgs(order2)],
                'OtcOrderFilled',
            );
        });
        it('Skips over unfillable orders', async () => {
            const order1 = await getTestOtcOrder({ taker, txOrigin });
            const order2 = await getTestOtcOrder({
                taker: notTaker,
                txOrigin,
                nonceBucket: order1.nonceBucket,
                nonce: order1.nonce + 1n,
            });
            await testUtils.prepareBalancesForOrdersAsync([order1], taker);
            await testUtils.prepareBalancesForOrdersAsync([order2], notTaker);
            const otcOrdersFeature = await ethers.getContractAt('IOtcOrdersFeature', await zeroEx.getAddress());
            const tx = await otcOrdersFeature
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
                );
            verifyEventsFromLogs(
                tx.logs,
                [testUtils.createOtcOrderFilledEventArgs(order1)],
                'OtcOrderFilled',
            );
        });
    });
});
