import { ethers } from "ethers";
import {
    blockchainTests,
    constants,
    describe,
    expect,
    getRandomInteger,
    getRandomPortion,
    randomAddress,
    verifyEventsFromLogs,
} from '@0x/test-utils';
import { ERC1155Order, NFTOrder, RevertErrors, SIGNATURE_ABI, SignatureType } from '@0x/protocol-utils';
import { AbiEncoder,  hexUtils, NULL_BYTES, StringRevertError } from '@0x/utils';

import {
    IOwnableFeatureContract,
    IZeroExContract,
    IZeroExERC1155OrderFilledEventArgs,
    IZeroExEvents,
    TestWeth__factory,
    TestMintableERC20Token__factory,
    TestMintableERC1155Token__factory,
    ERC1155OrdersFeature__factory,
    TestFeeRecipient__factory,
    TestPropertyValidator__factory,
    TestNFTOrderPresigner__factory
} from '../../src/wrappers';
import { artifacts } from '../artifacts';
import { abis } from '../utils/abis';
import { fullMigrateAsync } from '../utils/migration';
import { getRandomERC1155Order } from '../utils/nft_orders';

import {
    ERC1155OrdersFeatureContract,
    TestFeeRecipientContract,
    TestMintableERC1155TokenContract,
    TestMintableERC20TokenContract,
    TestNFTOrderPresignerContract,
    TestPropertyValidatorContract,
    TestWethContract,
} from '../wrappers';

blockchainTests('ERC1155OrdersFeature', env => {
    const { NULL_ADDRESS, MAX_UINT256, ZERO_AMOUNT: ZERO } = constants;
    const ETH_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    let owner: string;
    let maker: string;
    let taker: string;
    let otherMaker: string;
    let otherTaker: string;
    let feeRecipient: TestFeeRecipientContract;
    let zeroEx: IZeroExContract;
    let weth: TestWethContract;
    let erc20Token: TestMintableERC20TokenContract;
    let erc1155Token: TestMintableERC1155TokenContract;

    async function sendEtherAsync(to: string, amount: bigint): Promise<void> {
        await env.web3Wrapper(
            await env.web3Wrapper.sendTransactionAsync({
                ...env.txDefaults,
                to,
                from: owner,
                value: amount,
            }),
        );
    }

    before(async () => {
        // Useful for ETH balance accounting
        const txDefaults = { ...env.txDefaults, gasPrice: 0 };
        [owner, maker, taker, otherMaker, otherTaker] = await env.getAccountAddressesAsync();

        const signer = await env.provider.getSigner(owner);
        
        const wethFactory = new TestWeth__factory(signer);
        weth = await wethFactory.deploy();
        await weth.waitForDeployment();

        const erc20TokenFactory = new TestMintableERC20Token__factory(signer);
        erc20Token = await erc20TokenFactory.deploy();
        await erc20Token.waitForDeployment();

        const erc1155TokenFactory = new TestMintableERC1155Token__factory(signer);
        erc1155Token = await erc1155TokenFactory.deploy();
        await erc1155Token.waitForDeployment();

        zeroEx = await fullMigrateAsync(owner, env.provider, txDefaults, {}, { wethAddress: await weth.getAddress() });
        zeroEx = new IZeroExContract(await zeroEx.getAddress(), env.provider, txDefaults, abis);

        const featureFactory = new ERC1155OrdersFeature__factory(signer);
        const featureImpl = await featureFactory.deploy(
            await zeroEx.getAddress(),
            await weth.getAddress()
        );
        await featureImpl.waitForDeployment();
        
        const ownableFeature = new IOwnableFeatureContract(await zeroEx.getAddress(), env.provider, txDefaults, abis);
        const ownerSigner = await env.provider.getSigner(owner);
        await ownableFeature
            .connect(ownerSigner)
            .migrate(await featureImpl.getAddress(), featureImpl.migrate().getABIEncodedTransactionData(), owner);

        await Promise.all([
            erc20Token.approve(await zeroEx.getAddress(), MAX_UINT256)({
                from: maker,
            }),
            erc20Token.approve(await zeroEx.getAddress(), MAX_UINT256)({
                from: otherMaker,
            }),
            erc20Token.approve(await zeroEx.getAddress(), MAX_UINT256)({
                from: taker,
            }),
            erc20Token.approve(await zeroEx.getAddress(), MAX_UINT256)({
                from: otherTaker,
            }),
            weth.approve(await zeroEx.getAddress(), MAX_UINT256)({
                from: maker,
            }),
            weth.approve(await zeroEx.getAddress(), MAX_UINT256)({
                from: otherMaker,
            }),
            weth.approve(await zeroEx.getAddress(), MAX_UINT256)({
                from: taker,
            }),
            weth.approve(await zeroEx.getAddress(), MAX_UINT256)({
                from: otherTaker,
            }),
            erc1155Token.setApprovalForAll(await zeroEx.getAddress(), true)({
                from: maker,
            }),
            erc1155Token.setApprovalForAll(await zeroEx.getAddress(), true)({
                from: otherMaker,
            }),
            erc1155Token.setApprovalForAll(await zeroEx.getAddress(), true)({
                from: taker,
            }),
            erc1155Token.setApprovalForAll(await zeroEx.getAddress(), true)({
                from: otherTaker,
            }),
        ]);

        const feeRecipientFactory = new TestFeeRecipient__factory(signer);
        feeRecipient = await feeRecipientFactory.deploy();
        await feeRecipient.waitForDeployment();
    });

    async function mintAssetsAsync(
        order: ERC1155Order,
        tokenId: bigint = order.erc1155TokenId,
        amount: bigint = order.erc1155TokenAmount,
        _taker: string = taker,
    ): Promise<void> {
        const totalFeeAmount = order.fees.length > 0 ? order.fees.map(fee => fee.amount).reduce((a, b) => a + b, 0n) : 0n;
        if (order.direction === NFTOrder.TradeDirection.SellNFT) {
            await erc1155Token.mint(order.maker, tokenId, amount)();
            if (order.erc20Token !== ETH_TOKEN_ADDRESS) {
                await erc20Token
                    .mint(_taker, order.erc20TokenAmount + totalFeeAmount)
                    ();
            }
        } else {
            await erc1155Token.mint(_taker, tokenId, amount)();
            if (order.erc20Token === await weth.getAddress()) {
                await weth.deposit()({
                    from: order.maker,
                    value: order.erc20TokenAmount + totalFeeAmount,
                });
            } else {
                await erc20Token
                    .mint(order.maker, order.erc20TokenAmount + totalFeeAmount)
                    ();
            }
        }
    }

    async function assertBalancesAsync(
        order: ERC1155Order,
        tokenId: bigint = order.erc1155TokenId,
        amount: bigint = order.erc1155TokenAmount,
        _taker: string = taker,
    ): Promise<void> {
        const token = order.erc20Token === await weth.getAddress() ? weth : erc20Token;
        if (order.direction === NFTOrder.TradeDirection.SellNFT) {
            const erc20FillAmount = amount
                 * order.erc20TokenAmount
                 / order.erc1155TokenAmount;
            const erc20Balance = await token.balanceOf(order.maker)();
            expect(erc20Balance).to.equal(erc20FillAmount);
            const erc1155Balance = await erc1155Token.balanceOf(_taker, tokenId)();
            expect(erc1155Balance).to.equal(amount);
        } else {
            const erc20FillAmount = amount
                 * order.erc20TokenAmount
                 / order.erc1155TokenAmount;
            const erc20Balance = await token.balanceOf(_taker)();
            expect(erc20Balance).to.equal(erc20FillAmount);
            const erc1155Balance = await erc1155Token.balanceOf(order.maker, tokenId)();
            expect(erc1155Balance).to.equal(amount);
        }
        if (order.fees.length > 0) {
            await Promise.all(
                order.fees.map(async fee => {
                    const feeRecipientBalance = await token.balanceOf(fee.recipient)();
                    const feeFillAmount = amount * fee.amount.idiv(order.erc1155TokenAmount);
                    expect(feeRecipientBalance).to.equal(feeFillAmount);
                }),
            );
        }
    }

    async function getTestERC1155Order(fields: Partial<ERC1155Order> = {}): Promise<ERC1155Order> {
        return getRandomERC1155Order({
            maker,
            verifyingContract: await zeroEx.getAddress(),
            chainId: 1337,
            erc20Token: await erc20Token.getAddress(),
            erc1155Token: await erc1155Token.getAddress(),
            taker: NULL_ADDRESS,
            ...fields,
        });
    }

    function createERC1155OrderFilledEvent(
        order: ERC1155Order,
        amount: bigint = order.erc1155TokenAmount,
        _taker: string = taker,
        erc1155TokenId: bigint = order.erc1155TokenId,
    ): IZeroExERC1155OrderFilledEventArgs {
        const erc20FillAmount = amount
             * order.erc20TokenAmount
             / order.erc1155TokenAmount
            .integerValue(
                order.direction === NFTOrder.TradeDirection.SellNFT ? 0 : 1,
            );
        return {
            direction: order.direction,
            maker: order.maker,
            taker,
            nonce: order.nonce,
            erc20Token: order.erc20Token,
            erc20FillAmount,
            erc1155Token: order.erc1155Token,
            erc1155TokenId,
            erc1155FillAmount: amount,
            matcher: NULL_ADDRESS,
        };
    }

    describe('getERC1155OrderHash()', () => {
        it('returns the correct hash for order with no fees or properties', async () => {
            const order = await getTestERC1155Order();
            const hash = await zeroEx.getERC1155OrderHash(order)();
            expect(hash).to.eq(order.getHash());
        });
        it('returns the correct hash for order with null property', async () => {
            const order = await getTestERC1155Order({
                erc1155TokenProperties: [
                    {
                        propertyValidator: NULL_ADDRESS,
                        propertyData: NULL_BYTES,
                    },
                ],
            });
            const hash = await zeroEx.getERC1155OrderHash(order)();
            expect(hash).to.eq(order.getHash());
        });
        it('returns the correct hash for order with 1 fee, 1 property', async () => {
            const order = await getTestERC1155Order({
                fees: [
                    {
                        recipient: randomAddress(),
                        amount: getRandomInteger(0, MAX_UINT256),
                        feeData: hexUtils.random(),
                    },
                ],
                erc1155TokenProperties: [
                    {
                        propertyValidator: randomAddress(),
                        propertyData: hexUtils.random(),
                    },
                ],
            });
            const hash = await zeroEx.getERC1155OrderHash(order)();
            expect(hash).to.eq(order.getHash());
        });
        it('returns the correct hash for order with 2 fees, 2 properties', async () => {
            const order = await getTestERC1155Order({
                fees: [
                    {
                        recipient: randomAddress(),
                        amount: getRandomInteger(0, MAX_UINT256),
                        feeData: hexUtils.random(),
                    },
                    {
                        recipient: randomAddress(),
                        amount: getRandomInteger(0, MAX_UINT256),
                        feeData: hexUtils.random(),
                    },
                ],
                erc1155TokenProperties: [
                    {
                        propertyValidator: randomAddress(),
                        propertyData: hexUtils.random(),
                    },
                    {
                        propertyValidator: randomAddress(),
                        propertyData: hexUtils.random(),
                    },
                ],
            });
            const hash = await zeroEx.getERC1155OrderHash(order)();
            expect(hash).to.eq(order.getHash());
        });
    });

    describe('validateERC1155OrderSignature', () => {
        it('succeeds for a valid EthSign signature', async () => {
            const order = await getTestERC1155Order();
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await zeroEx.validateERC1155OrderSignature(order, signature)();
        });
        it('reverts for an invalid EthSign signature', async () => {
            const order = await getTestERC1155Order();
            const signature = await order.getSignatureWithProviderAsync(
                env.provider,
                SignatureType.EthSign,
                otherMaker,
            );
            const tx = zeroEx.validateERC1155OrderSignature(order, signature)();
            expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.InvalidSignerError(maker, otherMaker));
        });
        it('succeeds for a valid EIP-712 signature', async () => {
            const order = await getTestERC1155Order();
            const signature = await order.getSignatureWithProviderAsync(env.provider, SignatureType.EIP712);
            await zeroEx.validateERC1155OrderSignature(order, signature)();
        });
        it('reverts for an invalid EIP-712 signature', async () => {
            const order = await getTestERC1155Order();
            const signature = await order.getSignatureWithProviderAsync(env.provider, SignatureType.EIP712, otherMaker);
            const tx = zeroEx.validateERC1155OrderSignature(order, signature)();
            expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.InvalidSignerError(maker, otherMaker));
        });
    });

    describe('cancelERC1155Order', () => {
        it('can cancel an order', async () => {
            const order = await getTestERC1155Order();
            const tx = await zeroEx.cancelERC1155Order(order.nonce)({
                from: maker,
            });
            verifyEventsFromLogs(tx.logs, [{ maker, nonce: order.nonce }], IZeroExEvents.ERC1155OrderCancelled);
            const orderInfo = await zeroEx.getERC1155OrderInfo(order)();
            expect(orderInfo.status).to.equal(NFTOrder.OrderStatus.Unfillable);
        });
        it('cancelling an order twice silently succeeds', async () => {
            const order = await getTestERC1155Order();
            await zeroEx.cancelERC1155Order(order.nonce)({
                from: maker,
            });
            const tx = await zeroEx.cancelERC1155Order(order.nonce)({
                from: maker,
            });
            verifyEventsFromLogs(tx.logs, [{ maker, nonce: order.nonce }], IZeroExEvents.ERC1155OrderCancelled);
            const orderInfo = await zeroEx.getERC1155OrderInfo(order)();
            expect(orderInfo.status).to.equal(NFTOrder.OrderStatus.Unfillable);
        });
    });

    describe('sellERC1155', () => {
        it('can fully fill a ERC1155 buy order', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = await zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                ({
                    from: taker,
                });
            await assertBalancesAsync(order);
            verifyEventsFromLogs(tx.logs, [createERC1155OrderFilledEvent(order)], IZeroExEvents.ERC1155OrderFilled);
            const orderInfo = await zeroEx.getERC1155OrderInfo(order)();
            expect(orderInfo.status).to.equal(NFTOrder.OrderStatus.Unfillable);
        });
        it('can partially fill a ERC1155 buy order', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            const erc1155FillAmount = Math.max(getRandomPortion(order.erc1155TokenAmount - 1), 1);
            await mintAssetsAsync(order, order.erc1155TokenId, erc1155FillAmount);
            await zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, erc1155FillAmount, false, NULL_BYTES)
                ({
                    from: taker,
                });
            await assertBalancesAsync(order, order.erc1155TokenId, erc1155FillAmount);
            const orderInfo = await zeroEx.getERC1155OrderInfo(order)();
            expect(orderInfo.status).to.equal(NFTOrder.OrderStatus.Fillable);
        });
        it('cannot fill the same order twice', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            await zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                ({
                    from: taker,
                });
            const tx = zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(maker, order.nonce, NFTOrder.OrderStatus.Unfillable),
            );
        });
        it('cannot fill a cancelled order', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            await zeroEx.cancelERC1155Order(order.nonce)({
                from: maker,
            });
            const tx = zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(maker, order.nonce, NFTOrder.OrderStatus.Unfillable),
            );
        });
        it('cannot fill an invalid order (erc20Token == ETH)', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc20Token: ETH_TOKEN_ADDRESS,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await erc1155Token
                .mint(taker, order.erc1155TokenId, order.erc1155TokenAmount)
                ();
            const tx = zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith('NFTOrders::_validateBuyOrder/NATIVE_TOKEN_NOT_ALLOWED');
        });
        it('cannot fill an expired order', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                expiry: ethers.parseUnits(Math.floor(Date.now() / 1000 - 1)),
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(maker, order.nonce, NFTOrder.OrderStatus.Expired),
            );
        });
        it('reverts if a sell order is provided', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith('NFTOrders::_validateBuyOrder/WRONG_TRADE_DIRECTION');
        });
        it('reverts if the taker is not the taker address specified in the order', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                taker,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order, order.erc1155TokenId, order.erc1155TokenAmount, otherTaker);
            const tx = zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                ({
                    from: otherTaker,
                });
            return expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.OnlyTakerError(otherTaker, taker));
        });
        it('succeeds if the taker is the taker address specified in the order', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                taker,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            await zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                ({
                    from: taker,
                });
            await assertBalancesAsync(order);
        });
        it('reverts if an invalid signature is provided', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider, SignatureType.EIP712, otherMaker);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.InvalidSignerError(maker, otherMaker));
        });
        it('reverts if `unwrapNativeToken` is true and `erc20Token` is not WETH', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, true, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.ERC20TokenMismatchError(order.erc20Token, await weth.getAddress()),
            );
        });
        it('sends ETH to taker if `unwrapNativeToken` is true and `erc20Token` is WETH', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc20Token: await weth.getAddress(),
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            await zeroEx
                .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, true, NULL_BYTES)
                ({
                    from: taker,
                });
            const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            expect(takerEthBalanceAfter - takerEthBalanceBefore).to.equal(order.erc20TokenAmount);
            const makerBalance = await erc1155Token.balanceOf(maker, order.erc1155TokenId)();
            expect(makerBalance).to.equal(order.erc1155TokenAmount);
        });
        describe('fees', () => {
            it('single fee to EOA', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                    fees: [
                        {
                            recipient: otherMaker,
                            amount: ethers.parseUnits(111),
                            feeData: constants.NULL_BYTES,
                        },
                    ],
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order);
                await zeroEx
                    .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                await assertBalancesAsync(order);
            });
            it('partial fill, single fee', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                    fees: [
                        {
                            recipient: otherMaker,
                            amount: getRandomInteger('1e18', '10e18'),
                            feeData: constants.NULL_BYTES,
                        },
                    ],
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                const erc1155FillAmount = Math.max(getRandomPortion(order.erc1155TokenAmount - 1), 1);
                await mintAssetsAsync(order, order.erc1155TokenId, erc1155FillAmount);
                await zeroEx
                    .sellERC1155(order, signature, order.erc1155TokenId, erc1155FillAmount, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                await assertBalancesAsync(order, order.erc1155TokenId, erc1155FillAmount);
            });
            it('single fee, successful callback', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                    fees: [
                        {
                            recipient: await feeRecipient.getAddress(),
                            amount: ethers.parseUnits(111),
                            feeData: hexUtils.random(),
                        },
                    ],
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order);
                await zeroEx
                    .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                await assertBalancesAsync(order);
            });
            it('single fee, callback reverts', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                    fees: [
                        {
                            recipient: await feeRecipient.getAddress(),
                            amount: ethers.parseUnits(333),
                            feeData: hexUtils.random(),
                        },
                    ],
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order);
                const tx = zeroEx
                    .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                return expect(tx).to.be.revertedWith('TestFeeRecipient::receiveZeroExFeeCallback/REVERT');
            });
            it('single fee, callback returns invalid value', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                    fees: [
                        {
                            recipient: await feeRecipient.getAddress(),
                            amount: ethers.parseUnits(666),
                            feeData: hexUtils.random(),
                        },
                    ],
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order);
                const tx = zeroEx
                    .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                return expect(tx).to.be.revertedWith('NFTOrders::_payFees/CALLBACK_FAILED');
            });
            it('multiple fees to EOAs', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                    fees: [
                        {
                            recipient: otherMaker,
                            amount: ethers.parseUnits(111),
                            feeData: constants.NULL_BYTES,
                        },
                        {
                            recipient: otherTaker,
                            amount: ethers.parseUnits(222),
                            feeData: constants.NULL_BYTES,
                        },
                    ],
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order);
                await zeroEx
                    .sellERC1155(order, signature, order.erc1155TokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                await assertBalancesAsync(order);
            });
        });
        describe('properties', () => {
            let propertyValidator: TestPropertyValidatorContract;

            before(async () => {
                const signer = await env.provider.getSigner(owner);
                const propertyValidatorFactory = new TestPropertyValidator__factory(signer);
                propertyValidator = await propertyValidatorFactory.deploy();
                await propertyValidator.waitForDeployment();
            });
            it('Checks tokenId if no properties are provided', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order, order.erc1155TokenId + 1);
                const tx = zeroEx
                    .sellERC1155(
                        order,
                        signature,
                        order.erc1155TokenId + 1,
                        order.erc1155TokenAmount,
                        false,
                        NULL_BYTES,
                    )
                    ({
                        from: taker,
                    });
                return expect(tx).to.be.revertedWith(
                    new RevertErrors.NFTOrders.TokenIdMismatchError(order.erc1155TokenId + 1, order.erc1155TokenId),
                );
            });
            it('Null property', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                    erc1155TokenId: ZERO,
                    erc1155TokenProperties: [
                        {
                            propertyValidator: NULL_ADDRESS,
                            propertyData: NULL_BYTES,
                        },
                    ],
                });
                const tokenId = getRandomInteger(0, MAX_UINT256);
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order, tokenId);
                await zeroEx
                    .sellERC1155(order, signature, tokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                await assertBalancesAsync(order, tokenId);
            });
            it('Reverts if property validation fails', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                    erc1155TokenId: ZERO,
                    erc1155TokenProperties: [
                        {
                            propertyValidator: await propertyValidator.getAddress(),
                            propertyData: NULL_BYTES,
                        },
                    ],
                });
                const tokenId = getRandomInteger(0, MAX_UINT256);
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order, tokenId);
                const tx = zeroEx
                    .sellERC1155(order, signature, tokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                return expect(tx).to.be.revertedWith(
                    new RevertErrors.NFTOrders.PropertyValidationFailedError(
                        await propertyValidator.getAddress(),
                        order.erc1155Token,
                        tokenId,
                        NULL_BYTES,
                        new StringRevertError('TestPropertyValidator::validateProperty/REVERT').encode(),
                    ),
                );
            });
            it('Successful property validation', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                    erc1155TokenId: ZERO,
                    erc1155TokenProperties: [
                        {
                            propertyValidator: await propertyValidator.getAddress(),
                            propertyData: hexUtils.random(),
                        },
                    ],
                });
                const tokenId = getRandomInteger(0, MAX_UINT256);
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order, tokenId);
                await zeroEx
                    .sellERC1155(order, signature, tokenId, order.erc1155TokenAmount, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                await assertBalancesAsync(order, tokenId);
            });
        });
    });
    describe('onERC1155Received', () => {
        let dataEncoder: AbiEncoder.DataType;
        before(() => {
            dataEncoder = AbiEncoder.create(
                [
                    {
                        name: 'order',
                        type: 'tuple',
                        components: ERC1155Order.STRUCT_ABI,
                    },
                    {
                        name: 'signature',
                        type: 'tuple',
                        components: SIGNATURE_ABI,
                    },
                    { name: 'unwrapNativeToken', type: 'bool' },
                ],
                [
                    {
                        name: 'property',
                        type: 'tuple',
                        internalType: 'Property',
                        components: [
                            {
                                name: 'propertyValidator',
                                type: 'address',
                            },
                            { name: 'propertyData', type: 'bytes' },
                        ],
                    },
                    {
                        name: 'fee',
                        type: 'tuple',
                        internalType: 'Fee',
                        components: [
                            { name: 'recipient', type: 'address' },
                            { name: 'amount', type: 'uint256' },
                            { name: 'feeData', type: 'bytes' },
                        ],
                    },
                ],
            );
        });
        it('throws if data is not encoded correctly', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            await mintAssetsAsync(order);
            const tx = erc1155Token
                .safeTransferFrom(
                    taker,
                    await zeroEx.getAddress(),
                    order.erc1155TokenId,
                    order.erc1155TokenAmount,
                    hexUtils.random(),
                )
                ({
                    from: taker,
                });
            return expect(tx).to.be.rejected();
        });
        it('reverts if msg.sender != order.erc1155Token', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .onERC1155Received(
                    taker,
                    taker,
                    order.erc1155TokenId,
                    order.erc1155TokenAmount,
                    dataEncoder.encode({
                        order,
                        signature,
                        unwrapNativeToken: false,
                    }),
                )
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.ERC1155TokenMismatchError(taker, order.erc1155Token),
            );
        });
        it('reverts if transferred tokenId does not match order.erc1155TokenId', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order, order.erc1155TokenId + 1);

            const tx = erc1155Token
                .safeTransferFrom(
                    taker,
                    await zeroEx.getAddress(),
                    order.erc1155TokenId + 1,
                    order.erc1155TokenAmount,
                    dataEncoder.encode({
                        order,
                        signature,
                        unwrapNativeToken: false,
                    }),
                )
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.TokenIdMismatchError(order.erc1155TokenId + 1, order.erc1155TokenId),
            );
        });
        it('can sell ERC1155 without approval', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            // revoke approval
            await erc1155Token.setApprovalForAll(await zeroEx.getAddress(), false)({
                from: taker,
            });

            await erc1155Token
                .safeTransferFrom(
                    taker,
                    await zeroEx.getAddress(),
                    order.erc1155TokenId,
                    order.erc1155TokenAmount,
                    dataEncoder.encode({
                        order,
                        signature,
                        unwrapNativeToken: false,
                    }),
                )
                ({
                    from: taker,
                });
            await assertBalancesAsync(order);
        });
    });
    describe('buyERC1155', () => {
        it('can fill a ERC1155 sell order', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = await zeroEx
                .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                ({
                    from: taker,
                });
            await assertBalancesAsync(order);
            verifyEventsFromLogs(tx.logs, [createERC1155OrderFilledEvent(order)], IZeroExEvents.ERC1155OrderFilled);
            const orderInfo = await zeroEx.getERC1155OrderInfo(order)();
            expect(orderInfo.status).to.equal(NFTOrder.OrderStatus.Unfillable);
        });
        it('can partially fill a ERC1155 sell order', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            const erc1155FillAmount = Math.max(getRandomPortion(order.erc1155TokenAmount - 1), 1);
            await mintAssetsAsync(order, order.erc1155TokenId, erc1155FillAmount);
            await zeroEx.buyERC1155(order, signature, erc1155FillAmount, NULL_BYTES)({
                from: taker,
            });
            await assertBalancesAsync(order, order.erc1155TokenId, erc1155FillAmount);
            const orderInfo = await zeroEx.getERC1155OrderInfo(order)();
            expect(orderInfo.status).to.equal(NFTOrder.OrderStatus.Fillable);
        });
        it('cannot fill the same order twice', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            await zeroEx
                .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                ({
                    from: taker,
                });
            const tx = zeroEx
                .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(maker, order.nonce, NFTOrder.OrderStatus.Unfillable),
            );
        });
        it('cannot fill a cancelled order', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            await zeroEx.cancelERC1155Order(order.nonce)({
                from: maker,
            });
            const tx = zeroEx
                .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(maker, order.nonce, NFTOrder.OrderStatus.Unfillable),
            );
        });
        it('cannot fill an expired order', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                expiry: ethers.parseUnits(Math.floor(Date.now() / 1000 - 1)),
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(maker, order.nonce, NFTOrder.OrderStatus.Expired),
            );
        });
        it('reverts if a buy order is provided', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith('NFTOrders::_validateSellOrder/WRONG_TRADE_DIRECTION');
        });
        it('reverts if the taker is not the taker address specified in the order', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                taker,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order, order.erc1155TokenId, order.erc1155TokenAmount, otherTaker);
            const tx = zeroEx
                .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                ({
                    from: otherTaker,
                });
            return expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.OnlyTakerError(otherTaker, taker));
        });
        it('succeeds if the taker is the taker address specified in the order', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                taker,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            await zeroEx
                .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                ({
                    from: taker,
                });
            await assertBalancesAsync(order);
        });
        it('reverts if an invalid signature is provided', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider, SignatureType.EIP712, otherMaker);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.InvalidSignerError(maker, otherMaker));
        });
        describe('ETH', () => {
            it('can fill an order with ETH (and refunds excess ETH)', async () => {
                const order = await getTestERC1155Order({
                    erc20Token: ETH_TOKEN_ADDRESS,
                    direction: NFTOrder.TradeDirection.SellNFT,
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order);
                const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                const makerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(maker);
                const tx = await zeroEx
                    .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                    ({
                        from: taker,
                        value: order.erc20TokenAmount + 1,
                    });
                const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                const makerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(maker);
                expect(takerEthBalanceBefore - takerEthBalanceAfter).to.equal(order.erc20TokenAmount);
                expect(makerEthBalanceAfter - makerEthBalanceBefore).to.equal(order.erc20TokenAmount);
                verifyEventsFromLogs(
                    tx.logs,
                    [
                        {
                            operator: await zeroEx.getAddress(),
                            from: maker,
                            to: taker,
                            id: order.erc1155TokenId,
                            value: order.erc1155TokenAmount,
                        },
                    ],
                    'TransferSingle',
                );
            });
            it('can fill a WETH order with ETH', async () => {
                const order = await getTestERC1155Order({
                    erc20Token: await weth.getAddress(),
                    direction: NFTOrder.TradeDirection.SellNFT,
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await erc1155Token
                    .mint(maker, order.erc1155TokenId, order.erc1155TokenAmount)
                    ();
                const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                await zeroEx
                    .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                    ({
                        from: taker,
                        value: order.erc20TokenAmount,
                    });
                const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                expect(takerEthBalanceBefore - takerEthBalanceAfter).to.equal(order.erc20TokenAmount);
                await assertBalancesAsync(order);
            });
            it('uses WETH if not enough ETH to fill WETH order', async () => {
                const order = await getTestERC1155Order({
                    erc20Token: await weth.getAddress(),
                    direction: NFTOrder.TradeDirection.SellNFT,
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await weth.deposit()({
                    from: taker,
                    value: order.erc20TokenAmount,
                });
                await erc1155Token
                    .mint(maker, order.erc1155TokenId, order.erc1155TokenAmount)
                    ();
                const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                await zeroEx
                    .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                    ({
                        from: taker,
                        value: order.erc20TokenAmount - 1,
                    });
                const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                expect(takerEthBalanceAfter).to.equal(takerEthBalanceBefore);
                await assertBalancesAsync(order);
            });
        });
        describe('fees', () => {
            it('single fee to EOA', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.SellNFT,
                    fees: [
                        {
                            recipient: otherMaker,
                            amount: ethers.parseUnits(111),
                            feeData: constants.NULL_BYTES,
                        },
                    ],
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order);
                await zeroEx
                    .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                    ({
                        from: taker,
                    });
                await assertBalancesAsync(order);
            });
            it('partial fill, single fee', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.SellNFT,
                    fees: [
                        {
                            recipient: otherMaker,
                            amount: getRandomInteger('1e18', '10e18'),
                            feeData: constants.NULL_BYTES,
                        },
                    ],
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                const erc1155FillAmount = Math.max(getRandomPortion(order.erc1155TokenAmount - 1), 1);
                await mintAssetsAsync(order, order.erc1155TokenId, erc1155FillAmount);
                await zeroEx.buyERC1155(order, signature, erc1155FillAmount, NULL_BYTES)({
                    from: taker,
                });
                await assertBalancesAsync(order, order.erc1155TokenId, erc1155FillAmount);
            });
            it('pays fees in ETH if erc20Token == ETH', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.SellNFT,
                    erc20Token: ETH_TOKEN_ADDRESS,
                    fees: [
                        {
                            recipient: otherMaker,
                            amount: ethers.parseUnits(111),
                            feeData: constants.NULL_BYTES,
                        },
                    ],
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order);
                const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                const makerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(maker);
                const feeRecipientEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(otherMaker);
                await zeroEx
                    .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                    ({
                        from: taker,
                        value: order.erc20TokenAmount + order.fees[0].amount + 1,
                    });
                const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                const makerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(maker);
                const feeRecipientEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(otherMaker);
                expect(takerEthBalanceBefore - takerEthBalanceAfter).to.equal(
                    order.erc20TokenAmount + order.fees[0].amount,
                );
                expect(makerEthBalanceAfter - makerEthBalanceBefore).to.equal(order.erc20TokenAmount);
                expect(feeRecipientEthBalanceAfter - feeRecipientEthBalanceBefore).to.equal(
                    order.fees[0].amount,
                );
                const takerBalance = await erc1155Token.balanceOf(taker, order.erc1155TokenId)();
                expect(takerBalance).to.equal(order.erc1155TokenAmount);
            });
            it('pays fees in ETH if erc20Token == WETH but taker uses ETH', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.SellNFT,
                    erc20Token: await weth.getAddress(),
                    fees: [
                        {
                            recipient: otherMaker,
                            amount: ethers.parseUnits(111),
                            feeData: constants.NULL_BYTES,
                        },
                    ],
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order);
                const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                const feeRecipientEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(otherMaker);
                const tx = await zeroEx
                    .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                    ({
                        from: taker,
                        value: order.erc20TokenAmount + order.fees[0].amount + 1,
                    });
                const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                const feeRecipientEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(otherMaker);
                expect(takerEthBalanceBefore - takerEthBalanceAfter).to.equal(
                    order.erc20TokenAmount + order.fees[0].amount,
                );
                expect(feeRecipientEthBalanceAfter - feeRecipientEthBalanceBefore).to.equal(
                    order.fees[0].amount,
                );
                verifyEventsFromLogs(
                    tx.logs,
                    [
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: maker,
                            value: order.erc20TokenAmount,
                        },
                    ],
                    'Transfer',
                );
                verifyEventsFromLogs(
                    tx.logs,
                    [
                        {
                            operator: await zeroEx.getAddress(),
                            from: maker,
                            to: taker,
                            id: order.erc1155TokenId,
                            value: order.erc1155TokenAmount,
                        },
                    ],
                    'TransferSingle',
                );
            });
            it('pays fees in WETH if taker uses WETH', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.SellNFT,
                    erc20Token: await weth.getAddress(),
                    fees: [
                        {
                            recipient: otherMaker,
                            amount: ethers.parseUnits(111),
                            feeData: constants.NULL_BYTES,
                        },
                    ],
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await erc1155Token
                    .mint(maker, order.erc1155TokenId, order.erc1155TokenAmount)
                    ();
                await weth.deposit()({
                    from: taker,
                    value: order.erc20TokenAmount + order.fees[0].amount,
                });
                await zeroEx
                    .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                    ({
                        from: taker,
                    });
                await assertBalancesAsync(order);
            });
            it('reverts if overspent ETH', async () => {
                const order = await getTestERC1155Order({
                    direction: NFTOrder.TradeDirection.SellNFT,
                    erc20Token: ETH_TOKEN_ADDRESS,
                    fees: [
                        {
                            recipient: otherMaker,
                            amount: ethers.parseUnits(111),
                            feeData: constants.NULL_BYTES,
                        },
                    ],
                });
                await sendEtherAsync(await zeroEx.getAddress(), order.fees[0].amount);
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order);
                const tx = zeroEx
                    .buyERC1155(order, signature, order.erc1155TokenAmount, NULL_BYTES)
                    ({
                        from: taker,
                        value: order.erc20TokenAmount,
                    });
                return expect(tx).to.be.revertedWith(
                    new RevertErrors.NFTOrders.OverspentEthError(
                        order.erc20TokenAmount + order.fees[0].amount,
                        order.erc20TokenAmount,
                    ),
                );
            });
        });
    });
    describe('batchBuyERC1155s', () => {
        it('reverts if arrays are different lengths', async () => {
            const order = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .batchBuyERC1155s(
                    [order],
                    [signature, signature],
                    [order.erc1155TokenAmount, order.erc1155TokenAmount],
                    [NULL_BYTES, NULL_BYTES],
                    false,
                )
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith('ERC1155OrdersFeature::batchBuyERC1155s/ARRAY_LENGTH_MISMATCH');
        });
        it('successfully fills multiple orders', async () => {
            const order1 = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature1 = await order1.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order1);
            const order2 = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: await weth.getAddress(),
            });
            const signature2 = await order2.getSignatureWithProviderAsync(env.provider);
            await erc1155Token
                .mint(maker, order2.erc1155TokenId, order2.erc1155TokenAmount)
                ();
            await weth.deposit().sendTransactionAsync({
                from: taker,
                value: order2.erc20TokenAmount,
            });
            await zeroEx
                .batchBuyERC1155s(
                    [order1, order2],
                    [signature1, signature2],
                    [order1.erc1155TokenAmount, order2.erc1155TokenAmount],
                    [NULL_BYTES, NULL_BYTES],
                    false,
                )
                ({
                    from: taker,
                });
            await assertBalancesAsync(order1);
            await assertBalancesAsync(order2);
        });
        it('catches revert if one order fails', async () => {
            const order1 = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature1 = await order1.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order1);
            const order2 = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: await weth.getAddress(),
            });
            // invalid signature
            const signature2 = await order2.getSignatureWithProviderAsync(
                env.provider,
                SignatureType.EIP712,
                otherMaker,
            );
            await erc1155Token
                .mint(maker, order2.erc1155TokenId, order2.erc1155TokenAmount)
                ();
            await weth.deposit().sendTransactionAsync({
                from: taker,
                value: order2.erc20TokenAmount,
            });
            const tx = zeroEx.batchBuyERC1155s(
                [order1, order2],
                [signature1, signature2],
                [order1.erc1155TokenAmount, order2.erc1155TokenAmount],
                [NULL_BYTES, NULL_BYTES],
                false,
            );
            const successes = await tx({
                from: taker,
            });
            expect(successes).to.deep.equal([true, false]);
            await tx({
                from: taker,
            });
            await assertBalancesAsync(order1);
            const makerBalance = await erc1155Token.balanceOf(maker, order2.erc1155TokenId)();
            expect(makerBalance).to.equal(order2.erc1155TokenAmount);
            const takerWethBalance = await weth.balanceOf(taker)();
            expect(takerWethBalance).to.equal(order2.erc20TokenAmount);
        });
        it('bubbles up revert if one order fails and `revertIfIncomplete == true`', async () => {
            const order1 = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature1 = await order1.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order1);
            const order2 = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: await weth.getAddress(),
            });
            // invalid signature
            const signature2 = await order2.getSignatureWithProviderAsync(
                env.provider,
                SignatureType.EIP712,
                otherMaker,
            );
            await erc1155Token
                .mint(maker, order2.erc1155TokenId, order2.erc1155TokenAmount)
                ();
            await weth.deposit().sendTransactionAsync({
                from: taker,
                value: order2.erc20TokenAmount,
            });
            const tx = zeroEx
                .batchBuyERC1155s(
                    [order1, order2],
                    [signature1, signature2],
                    [order1.erc1155TokenAmount, order2.erc1155TokenAmount],
                    [NULL_BYTES, NULL_BYTES],
                    true,
                )
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.InvalidSignerError(order2.maker, otherMaker));
        });
        it('can fill multiple orders with ETH, refund excess ETH', async () => {
            const order1 = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: ETH_TOKEN_ADDRESS,
            });
            const signature1 = await order1.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order1);
            const order2 = await getTestERC1155Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: await weth.getAddress(),
            });
            const signature2 = await order2.getSignatureWithProviderAsync(env.provider);
            await erc1155Token
                .mint(maker, order2.erc1155TokenId, order2.erc1155TokenAmount)
                ();
            const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            await zeroEx
                .batchBuyERC1155s(
                    [order1, order2],
                    [signature1, signature2],
                    [order1.erc1155TokenAmount, order2.erc1155TokenAmount],
                    [NULL_BYTES, NULL_BYTES],
                    true,
                )
                ({
                    from: taker,
                    value: order1.erc20TokenAmount + order2.erc20TokenAmount + 1,
                });
            const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            expect(takerEthBalanceBefore - takerEthBalanceAfter).to.equal(
                order1.erc20TokenAmount + order2.erc20TokenAmount,
            );
            const takerBalance1 = await erc1155Token.balanceOf(taker, order1.erc1155TokenId)();
            expect(takerBalance1).to.equal(order1.erc1155TokenAmount);
            const takerBalance2 = await erc1155Token.balanceOf(taker, order2.erc1155TokenId)();
            expect(takerBalance2).to.equal(order2.erc1155TokenAmount);
        });
    });
    describe('preSignERC1155Order', () => {
        const PRESIGN_SIGNATURE = {
            signatureType: SignatureType.PreSigned,
            v: 0,
            r: constants.NULL_BYTES32,
            s: constants.NULL_BYTES32,
        };
        let contractMaker: TestNFTOrderPresignerContract;
        before(async () => {
            const signer = await env.provider.getSigner(owner);
            const contractMakerFactory = new TestNFTOrderPresigner__factory(signer);
            contractMaker = await contractMakerFactory.deploy(await zeroEx.getAddress());
            await contractMaker.waitForDeployment();
            
            await contractMaker.approveERC20(await erc20Token.getAddress());
            await contractMaker.approveERC1155(await erc1155Token.getAddress());
        });
        it('can fill order that has been presigned by the maker', async () => {
            const order = await getTestERC1155Order({
                maker: await contractMaker.getAddress(),
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            await mintAssetsAsync(order);
            await contractMaker.preSignERC1155Order(order)();
            await zeroEx
                .sellERC1155(
                    order,
                    PRESIGN_SIGNATURE,
                    order.erc1155TokenId,
                    order.erc1155TokenAmount,
                    false,
                    NULL_BYTES,
                )
                ({
                    from: taker,
                });
            await assertBalancesAsync(order);
        });
        it('cannot fill order that has not been presigned by the maker', async () => {
            const order = await getTestERC1155Order({
                maker: await contractMaker.getAddress(),
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            await mintAssetsAsync(order);
            const tx = zeroEx
                .sellERC1155(
                    order,
                    PRESIGN_SIGNATURE,
                    order.erc1155TokenId,
                    order.erc1155TokenAmount,
                    false,
                    NULL_BYTES,
                )
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.InvalidSignerError(await contractMaker.getAddress(), NULL_ADDRESS),
            );
        });
        it('cannot fill order that was presigned then cancelled', async () => {
            const order = await getTestERC1155Order({
                maker: await contractMaker.getAddress(),
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            await mintAssetsAsync(order);
            await contractMaker.preSignERC1155Order(order)();
            await contractMaker.cancelERC1155Order(order.nonce)();
            const tx = zeroEx
                .sellERC1155(
                    order,
                    PRESIGN_SIGNATURE,
                    order.erc1155TokenId,
                    order.erc1155TokenAmount,
                    false,
                    NULL_BYTES,
                )
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(
                    await contractMaker.getAddress(),
                    order.nonce,
                    NFTOrder.OrderStatus.Unfillable,
                ),
            );
        });
        it('only maker can presign order', async () => {
            const order = await getTestERC1155Order({
                maker: otherMaker,
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            await mintAssetsAsync(order);
            const tx = contractMaker.preSignERC1155Order(order)();
            return expect(tx).to.be.revertedWith('ERC1155OrdersFeature::preSignERC1155Order/MAKER_MISMATCH');
        });
    });
});
