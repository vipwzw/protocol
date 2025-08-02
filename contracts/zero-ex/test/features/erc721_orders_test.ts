import { ethers } from "ethers";
import {
    blockchainTests,
    constants,
    describe,
    expect,
    getRandomInteger,
    randomAddress,
    verifyEventsFromLogs,
} from '@0x/test-utils';
import { ERC721Order, NFTOrder, RevertErrors, SIGNATURE_ABI, SignatureType } from '@0x/protocol-utils';
import { AbiEncoder,  hexUtils, NULL_BYTES, StringRevertError } from '@0x/utils';

import {
    IOwnableFeatureContract,
    IZeroExContract,
    IZeroExERC721OrderFilledEventArgs,
    IZeroExEvents,
    TestWeth__factory,
    TestMintableERC20Token__factory,
    TestMintableERC721Token__factory,
    ERC721OrdersFeature__factory,
    TestFeeRecipient__factory,
    TestPropertyValidator__factory,
    TestNFTOrderPresigner__factory
} from '../../src/wrappers';
import { artifacts } from '../artifacts';
import { abis } from '../utils/abis';
import { fullMigrateAsync } from '../utils/migration';
import { getRandomERC721Order } from '../utils/nft_orders';

import {
    ERC721OrdersFeatureContract,
    TestFeeRecipientContract,
    TestMintableERC20TokenContract,
    TestMintableERC721TokenContract,
    TestNFTOrderPresignerContract,
    TestPropertyValidatorContract,
    TestWethContract,
} from '../wrappers';

blockchainTests('ERC721OrdersFeature', env => {
    const { NULL_ADDRESS, MAX_UINT256, ZERO_AMOUNT: ZERO } = constants;
    const ETH_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    let owner: string;
    let maker: string;
    let taker: string;
    let otherMaker: string;
    let otherTaker: string;
    let matcher: string;
    let feeRecipient: TestFeeRecipientContract;
    let zeroEx: IZeroExContract;
    let weth: TestWethContract;
    let erc20Token: TestMintableERC20TokenContract;
    let erc721Token: TestMintableERC721TokenContract;

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
        [owner, maker, taker, otherMaker, otherTaker, matcher] = await env.getAccountAddressesAsync();

        const signer = await env.provider.getSigner(owner);
        
        const wethFactory = new TestWeth__factory(signer);
        weth = await wethFactory.deploy();
        await weth.waitForDeployment();

        const erc20TokenFactory = new TestMintableERC20Token__factory(signer);
        erc20Token = await erc20TokenFactory.deploy();
        await erc20Token.waitForDeployment();

        const erc721TokenFactory = new TestMintableERC721Token__factory(signer);
        erc721Token = await erc721TokenFactory.deploy();
        await erc721Token.waitForDeployment();

        zeroEx = await fullMigrateAsync(owner, env.provider, txDefaults, {}, { wethAddress: await weth.getAddress() });
        zeroEx = new IZeroExContract(await zeroEx.getAddress(), env.provider, txDefaults, abis);

        const featureFactory = new ERC721OrdersFeature__factory(signer);
        const featureImpl = await featureFactory.deploy(
            await zeroEx.getAddress(),
            await weth.getAddress(),
        );
        await featureImpl.waitForDeployment();
        
        const ownableFeature = new IOwnableFeatureContract(await zeroEx.getAddress(), env.provider, txDefaults, abis);
        const ownerSigner = await env.provider.getSigner(owner);
        await ownableFeature
            .connect(ownerSigner)
            .migrate(await featureImpl.getAddress(), featureImpl.migrate().getABIEncodedTransactionData(), owner)
            ();

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
            erc721Token.setApprovalForAll(await zeroEx.getAddress(), true)({
                from: maker,
            }),
            erc721Token.setApprovalForAll(await zeroEx.getAddress(), true)({
                from: otherMaker,
            }),
            erc721Token.setApprovalForAll(await zeroEx.getAddress(), true)({
                from: taker,
            }),
            erc721Token.setApprovalForAll(await zeroEx.getAddress(), true)({
                from: otherTaker,
            }),
        ]);

        const feeRecipientFactory = new TestFeeRecipient__factory(signer);
        feeRecipient = await feeRecipientFactory.deploy();
        await feeRecipient.waitForDeployment();
    });

    async function mintAssetsAsync(
        order: ERC721Order,
        tokenId: bigint = order.erc721TokenId,
        _taker: string = taker,
    ): Promise<void> {
        const totalFeeAmount = order.fees.length > 0 ? order.fees.map(fee => fee.amount).reduce((a, b) => a + b, 0n) : 0n;
        if (order.direction === NFTOrder.TradeDirection.SellNFT) {
            await erc721Token.mint(order.maker, tokenId)();
            if (order.erc20Token !== ETH_TOKEN_ADDRESS) {
                await erc20Token
                    .mint(_taker, order.erc20TokenAmount + totalFeeAmount)
                    ();
            }
        } else {
            await erc721Token.mint(_taker, tokenId)();
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
        order: ERC721Order,
        tokenId: bigint = order.erc721TokenId,
        _taker: string = taker,
    ): Promise<void> {
        const token = order.erc20Token === await weth.getAddress() ? weth : erc20Token;
        if (order.direction === NFTOrder.TradeDirection.SellNFT) {
            const makerBalance = await token.balanceOf(order.maker)();
            expect(makerBalance).to.equal(order.erc20TokenAmount);
            const erc721Owner = await erc721Token.ownerOf(tokenId)();
            expect(erc721Owner).to.equal(_taker);
        } else {
            const erc20Balance = await token.balanceOf(_taker)();
            expect(erc20Balance).to.equal(order.erc20TokenAmount);
            const erc721Owner = await erc721Token.ownerOf(tokenId)();
            expect(erc721Owner).to.equal(order.maker);
        }
        if (order.fees.length > 0) {
            await Promise.all(
                order.fees.map(async fee => {
                    const feeRecipientBalance = await token.balanceOf(fee.recipient)();
                    expect(feeRecipientBalance).to.equal(fee.amount);
                }),
            );
        }
    }

    async function getTestERC721Order(fields: Partial<ERC721Order> = {}): Promise<ERC721Order> {
        return getRandomERC721Order({
            maker,
            verifyingContract: await zeroEx.getAddress(),
            chainId: 1337,
            erc20Token: await erc20Token.getAddress(),
            erc721Token: await erc721Token.getAddress(),
            taker: NULL_ADDRESS,
            ...fields,
        });
    }

    function createERC721OrderFilledEvent(
        order: ERC721Order,
        _taker: string = taker,
        erc721TokenId: bigint = order.erc721TokenId,
    ): IZeroExERC721OrderFilledEventArgs {
        return {
            direction: order.direction,
            maker: order.maker,
            taker,
            nonce: order.nonce,
            erc20Token: order.erc20Token,
            erc20TokenAmount: order.erc20TokenAmount,
            erc721Token: order.erc721Token,
            erc721TokenId,
            matcher: NULL_ADDRESS,
        };
    }

    describe('getERC721OrderHash()', () => {
        it('returns the correct hash for order with no fees or properties', async () => {
            const order = await getTestERC721Order();
            const hash = await zeroEx.getERC721OrderHash(order)();
            expect(hash).to.eq(order.getHash());
        });
        it('returns the correct hash for order with null property', async () => {
            const order = await getTestERC721Order({
                erc721TokenProperties: [
                    {
                        propertyValidator: NULL_ADDRESS,
                        propertyData: NULL_BYTES,
                    },
                ],
            });
            const hash = await zeroEx.getERC721OrderHash(order)();
            expect(hash).to.eq(order.getHash());
        });
        it('returns the correct hash for order with 1 fee, 1 property', async () => {
            const order = await getTestERC721Order({
                fees: [
                    {
                        recipient: randomAddress(),
                        amount: getRandomInteger(0, MAX_UINT256),
                        feeData: hexUtils.random(),
                    },
                ],
                erc721TokenProperties: [
                    {
                        propertyValidator: randomAddress(),
                        propertyData: hexUtils.random(),
                    },
                ],
            });
            const hash = await zeroEx.getERC721OrderHash(order)();
            expect(hash).to.eq(order.getHash());
        });
        it('returns the correct hash for order with 2 fees, 2 properties', async () => {
            const order = await getTestERC721Order({
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
                erc721TokenProperties: [
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
            const hash = await zeroEx.getERC721OrderHash(order)();
            expect(hash).to.eq(order.getHash());
        });
    });

    describe('validateERC721OrderSignature', () => {
        it('succeeds for a valid EthSign signature', async () => {
            const order = await getTestERC721Order();
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await zeroEx.validateERC721OrderSignature(order, signature)();
        });
        it('reverts for an invalid EthSign signature', async () => {
            const order = await getTestERC721Order();
            const signature = await order.getSignatureWithProviderAsync(
                env.provider,
                SignatureType.EthSign,
                otherMaker,
            );
            const tx = zeroEx.validateERC721OrderSignature(order, signature)();
            expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.InvalidSignerError(maker, otherMaker));
        });
        it('succeeds for a valid EIP-712 signature', async () => {
            const order = await getTestERC721Order();
            const signature = await order.getSignatureWithProviderAsync(env.provider, SignatureType.EIP712);
            await zeroEx.validateERC721OrderSignature(order, signature)();
        });
        it('reverts for an invalid EIP-712 signature', async () => {
            const order = await getTestERC721Order();
            const signature = await order.getSignatureWithProviderAsync(env.provider, SignatureType.EIP712, otherMaker);
            const tx = zeroEx.validateERC721OrderSignature(order, signature)();
            expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.InvalidSignerError(maker, otherMaker));
        });
    });

    describe('cancelERC721Order', () => {
        it('can cancel an order', async () => {
            const order = await getTestERC721Order();
            const tx = await zeroEx.cancelERC721Order(order.nonce)({
                from: maker,
            });
            verifyEventsFromLogs(tx.logs, [{ maker, nonce: order.nonce }], IZeroExEvents.ERC721OrderCancelled);
            const orderStatus = await zeroEx.getERC721OrderStatus(order)();
            expect(orderStatus).to.equal(NFTOrder.OrderStatus.Unfillable);
            const bitVector = await zeroEx
                .getERC721OrderStatusBitVector(maker, order.nonce.dividedToIntegerBy(256))
                ();
            const flag = ethers.parseUnits(2).exponentiatedBy(order.nonce.mod(256));
            expect(bitVector).to.equal(flag);
        });
        it('cancelling an order twice silently succeeds', async () => {
            const order = await getTestERC721Order();
            await zeroEx.cancelERC721Order(order.nonce)({
                from: maker,
            });
            const tx = await zeroEx.cancelERC721Order(order.nonce)({
                from: maker,
            });
            verifyEventsFromLogs(tx.logs, [{ maker, nonce: order.nonce }], IZeroExEvents.ERC721OrderCancelled);
            const orderStatus = await zeroEx.getERC721OrderStatus(order)();
            expect(orderStatus).to.equal(NFTOrder.OrderStatus.Unfillable);
            const bitVector = await zeroEx
                .getERC721OrderStatusBitVector(maker, order.nonce.dividedToIntegerBy(256))
                ();
            const flag = ethers.parseUnits(2).exponentiatedBy(order.nonce.mod(256));
            expect(bitVector).to.equal(flag);
        });
    });

    describe('sellERC721', () => {
        it('can fill a ERC721 buy order', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = await zeroEx
                .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            await assertBalancesAsync(order);
            verifyEventsFromLogs(tx.logs, [createERC721OrderFilledEvent(order)], IZeroExEvents.ERC721OrderFilled);
            const bitVector = await zeroEx
                .getERC721OrderStatusBitVector(maker, order.nonce.dividedToIntegerBy(256))
                ();
            const flag = ethers.parseUnits(2).exponentiatedBy(order.nonce.mod(256));
            expect(bitVector).to.equal(flag);
        });
        it('cannot fill the same order twice', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            await zeroEx
                .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            const tx = zeroEx
                .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(maker, order.nonce, NFTOrder.OrderStatus.Unfillable),
            );
        });
        it('can fill two orders from the same maker with different nonces', async () => {
            const order1 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                nonce: ZERO,
            });
            const signature1 = await order1.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order1);
            await zeroEx
                .sellERC721(order1, signature1, order1.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            const order2 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                nonce: ethers.parseUnits(1),
            });
            const signature2 = await order2.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order2);
            await zeroEx
                .sellERC721(order2, signature2, order2.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            const bitVector = await zeroEx.getERC721OrderStatusBitVector(maker, ZERO)();
            expect(bitVector).to.equal(3); // 0...00011
        });
        it('cannot fill a cancelled order', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            await zeroEx.cancelERC721Order(order.nonce)({
                from: maker,
            });
            const tx = zeroEx
                .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(maker, order.nonce, NFTOrder.OrderStatus.Unfillable),
            );
        });
        it('cannot fill an invalid order (erc20Token == ETH)', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc20Token: ETH_TOKEN_ADDRESS,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await erc721Token.mint(taker, order.erc721TokenId)();
            const tx = zeroEx
                .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith('NFTOrders::_validateBuyOrder/NATIVE_TOKEN_NOT_ALLOWED');
        });
        it('cannot fill an expired order', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                expiry: ethers.parseUnits(Math.floor(Date.now() / 1000 - 1)),
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(maker, order.nonce, NFTOrder.OrderStatus.Expired),
            );
        });
        it('reverts if a sell order is provided', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith('NFTOrders::_validateBuyOrder/WRONG_TRADE_DIRECTION');
        });
        it('reverts if the taker is not the taker address specified in the order', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                taker,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order, order.erc721TokenId, otherTaker);
            const tx = zeroEx
                .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                ({
                    from: otherTaker,
                });
            return expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.OnlyTakerError(otherTaker, taker));
        });
        it('succeeds if the taker is the taker address specified in the order', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                taker,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            await zeroEx
                .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            await assertBalancesAsync(order);
        });
        it('reverts if an invalid signature is provided', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider, SignatureType.EIP712, otherMaker);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.InvalidSignerError(maker, otherMaker));
        });
        it('reverts if `unwrapNativeToken` is true and `erc20Token` is not WETH', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .sellERC721(order, signature, order.erc721TokenId, true, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.ERC20TokenMismatchError(order.erc20Token, await weth.getAddress()),
            );
        });
        it('sends ETH to taker if `unwrapNativeToken` is true and `erc20Token` is WETH', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc20Token: await weth.getAddress(),
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            await zeroEx
                .sellERC721(order, signature, order.erc721TokenId, true, NULL_BYTES)
                ({
                    from: taker,
                });
            const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            expect(takerEthBalanceAfter - takerEthBalanceBefore).to.equal(order.erc20TokenAmount);
            const erc721Owner = await erc721Token.ownerOf(order.erc721TokenId)();
            expect(erc721Owner).to.equal(maker);
        });
        describe('fees', () => {
            it('single fee to EOA', async () => {
                const order = await getTestERC721Order({
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
                    .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                await assertBalancesAsync(order);
            });
            it('single fee, successful callback', async () => {
                const order = await getTestERC721Order({
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
                    .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                await assertBalancesAsync(order);
            });
            it('single fee, callback reverts', async () => {
                const order = await getTestERC721Order({
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
                    .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                return expect(tx).to.be.revertedWith('TestFeeRecipient::receiveZeroExFeeCallback/REVERT');
            });
            it('single fee, callback returns invalid value', async () => {
                const order = await getTestERC721Order({
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
                    .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                return expect(tx).to.be.revertedWith('NFTOrders::_payFees/CALLBACK_FAILED');
            });
            it('multiple fees to EOAs', async () => {
                const order = await getTestERC721Order({
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
                    .sellERC721(order, signature, order.erc721TokenId, false, NULL_BYTES)
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
                const order = await getTestERC721Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order, order.erc721TokenId + 1);
                const tx = zeroEx
                    .sellERC721(order, signature, order.erc721TokenId + 1, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                return expect(tx).to.be.revertedWith(
                    new RevertErrors.NFTOrders.TokenIdMismatchError(order.erc721TokenId + 1, order.erc721TokenId),
                );
            });
            it('Null property', async () => {
                const order = await getTestERC721Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                    erc721TokenId: ZERO,
                    erc721TokenProperties: [
                        {
                            propertyValidator: NULL_ADDRESS,
                            propertyData: NULL_BYTES,
                        },
                    ],
                });
                const tokenId = getRandomInteger(0, MAX_UINT256);
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order, tokenId);
                await zeroEx.sellERC721(order, signature, tokenId, false, NULL_BYTES)({
                    from: taker,
                });
                await assertBalancesAsync(order, tokenId);
            });
            it('Reverts if property validation fails', async () => {
                const order = await getTestERC721Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                    erc721TokenId: ZERO,
                    erc721TokenProperties: [
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
                    .sellERC721(order, signature, tokenId, false, NULL_BYTES)
                    ({
                        from: taker,
                    });
                return expect(tx).to.be.revertedWith(
                    new RevertErrors.NFTOrders.PropertyValidationFailedError(
                        await propertyValidator.getAddress(),
                        order.erc721Token,
                        tokenId,
                        NULL_BYTES,
                        new StringRevertError('TestPropertyValidator::validateProperty/REVERT').encode(),
                    ),
                );
            });
            it('Successful property validation', async () => {
                const order = await getTestERC721Order({
                    direction: NFTOrder.TradeDirection.BuyNFT,
                    erc721TokenId: ZERO,
                    erc721TokenProperties: [
                        {
                            propertyValidator: await propertyValidator.getAddress(),
                            propertyData: hexUtils.random(),
                        },
                    ],
                });
                const tokenId = getRandomInteger(0, MAX_UINT256);
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order, tokenId);
                await zeroEx.sellERC721(order, signature, tokenId, false, NULL_BYTES)({
                    from: taker,
                });
                await assertBalancesAsync(order, tokenId);
            });
        });
    });
    describe('onERC721Received', () => {
        let dataEncoder: AbiEncoder.DataType;
        before(() => {
            dataEncoder = AbiEncoder.create(
                [
                    {
                        name: 'order',
                        type: 'tuple',
                        components: ERC721Order.STRUCT_ABI,
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
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            await mintAssetsAsync(order);
            const tx = erc721Token
                .safeTransferFrom2(taker, await zeroEx.getAddress(), order.erc721TokenId, hexUtils.random())
                ({
                    from: taker,
                });
            return expect(tx).to.be.rejected();
        });
        it('reverts if msg.sender != order.erc721Token', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx
                .onERC721Received(
                    taker,
                    taker,
                    order.erc721TokenId,
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
                new RevertErrors.NFTOrders.ERC721TokenMismatchError(taker, order.erc721Token),
            );
        });
        it('reverts if transferred tokenId does not match order.erc721TokenId', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order, order.erc721TokenId + 1);

            const tx = erc721Token
                .safeTransferFrom2(
                    taker,
                    await zeroEx.getAddress(),
                    order.erc721TokenId + 1,
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
                new RevertErrors.NFTOrders.TokenIdMismatchError(order.erc721TokenId + 1, order.erc721TokenId),
            );
        });
        it('can sell ERC721 without approval', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            // revoke approval
            await erc721Token.setApprovalForAll(await zeroEx.getAddress(), false)({
                from: taker,
            });

            await erc721Token
                .safeTransferFrom2(
                    taker,
                    await zeroEx.getAddress(),
                    order.erc721TokenId,
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
    describe('buyERC721', () => {
        it('can fill a ERC721 sell order', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = await zeroEx.buyERC721(order, signature, NULL_BYTES)({
                from: taker,
            });
            await assertBalancesAsync(order);
            verifyEventsFromLogs(tx.logs, [createERC721OrderFilledEvent(order)], IZeroExEvents.ERC721OrderFilled);
            const bitVector = await zeroEx
                .getERC721OrderStatusBitVector(maker, order.nonce.dividedToIntegerBy(256))
                ();
            const flag = ethers.parseUnits(2).exponentiatedBy(order.nonce.mod(256));
            expect(bitVector).to.equal(flag);
        });
        it('cannot fill the same order twice', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            await zeroEx.buyERC721(order, signature, NULL_BYTES)({
                from: taker,
            });
            const tx = zeroEx.buyERC721(order, signature, NULL_BYTES)({
                from: taker,
            });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(maker, order.nonce, NFTOrder.OrderStatus.Unfillable),
            );
        });
        it('cannot fill a cancelled order', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            await zeroEx.cancelERC721Order(order.nonce)({
                from: maker,
            });
            const tx = zeroEx.buyERC721(order, signature, NULL_BYTES)({
                from: taker,
            });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(maker, order.nonce, NFTOrder.OrderStatus.Unfillable),
            );
        });
        it('cannot fill an expired order', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                expiry: ethers.parseUnits(Math.floor(Date.now() / 1000 - 1)),
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx.buyERC721(order, signature, NULL_BYTES)({
                from: taker,
            });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.OrderNotFillableError(maker, order.nonce, NFTOrder.OrderStatus.Expired),
            );
        });
        it('reverts if a buy order is provided', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx.buyERC721(order, signature, NULL_BYTES)({
                from: taker,
            });
            return expect(tx).to.be.revertedWith('NFTOrders::_validateSellOrder/WRONG_TRADE_DIRECTION');
        });
        it('reverts if the taker is not the taker address specified in the order', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                taker,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order, order.erc721TokenId, otherTaker);
            const tx = zeroEx.buyERC721(order, signature, NULL_BYTES)({
                from: otherTaker,
            });
            return expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.OnlyTakerError(otherTaker, taker));
        });
        it('succeeds if the taker is the taker address specified in the order', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                taker,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            await zeroEx.buyERC721(order, signature, NULL_BYTES)({
                from: taker,
            });
            await assertBalancesAsync(order);
        });
        it('reverts if an invalid signature is provided', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider, SignatureType.EIP712, otherMaker);
            await mintAssetsAsync(order);
            const tx = zeroEx.buyERC721(order, signature, NULL_BYTES)({
                from: taker,
            });
            return expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.InvalidSignerError(maker, otherMaker));
        });
        describe('ETH', () => {
            it('can fill an order with ETH (and refunds excess ETH)', async () => {
                const order = await getTestERC721Order({
                    erc20Token: ETH_TOKEN_ADDRESS,
                    direction: NFTOrder.TradeDirection.SellNFT,
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await mintAssetsAsync(order);
                const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                const makerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(maker);
                const tx = await zeroEx.buyERC721(order, signature, NULL_BYTES)({
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
                            _from: maker,
                            _to: taker,
                            _tokenId: order.erc721TokenId,
                        },
                    ],
                    'Transfer',
                );
            });
            it('can fill a WETH order with ETH', async () => {
                const order = await getTestERC721Order({
                    erc20Token: await weth.getAddress(),
                    direction: NFTOrder.TradeDirection.SellNFT,
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await erc721Token.mint(maker, order.erc721TokenId)();
                const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                await zeroEx.buyERC721(order, signature, NULL_BYTES)({
                    from: taker,
                    value: order.erc20TokenAmount,
                });
                const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                expect(takerEthBalanceBefore - takerEthBalanceAfter).to.equal(order.erc20TokenAmount);
                await assertBalancesAsync(order);
            });
            it('uses WETH if not enough ETH to fill WETH order', async () => {
                const order = await getTestERC721Order({
                    erc20Token: await weth.getAddress(),
                    direction: NFTOrder.TradeDirection.SellNFT,
                });
                const signature = await order.getSignatureWithProviderAsync(env.provider);
                await weth.deposit()({
                    from: taker,
                    value: order.erc20TokenAmount,
                });
                await erc721Token.mint(maker, order.erc721TokenId)();
                const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
                await zeroEx.buyERC721(order, signature, NULL_BYTES)({
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
                const order = await getTestERC721Order({
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
                await zeroEx.buyERC721(order, signature, NULL_BYTES)({
                    from: taker,
                });
                await assertBalancesAsync(order);
            });
            it('pays fees in ETH if erc20Token == ETH', async () => {
                const order = await getTestERC721Order({
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
                await zeroEx.buyERC721(order, signature, NULL_BYTES)({
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
                const erc721Owner = await erc721Token.ownerOf(order.erc721TokenId)();
                expect(erc721Owner).to.equal(taker);
            });
            it('pays fees in ETH if erc20Token == WETH but taker uses ETH', async () => {
                const order = await getTestERC721Order({
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
                const tx = await zeroEx.buyERC721(order, signature, NULL_BYTES)({
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
                            _from: maker,
                            _to: taker,
                            _tokenId: order.erc721TokenId,
                        },
                        {
                            token: await weth.getAddress(),
                            from: await zeroEx.getAddress(),
                            to: maker,
                            value: order.erc20TokenAmount,
                        },
                    ],
                    'Transfer',
                );
            });
            it('pays fees in WETH if taker uses WETH', async () => {
                const order = await getTestERC721Order({
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
                await erc721Token.mint(maker, order.erc721TokenId)();
                await weth.deposit()({
                    from: taker,
                    value: order.erc20TokenAmount + order.fees[0].amount,
                });
                await zeroEx.buyERC721(order, signature, NULL_BYTES)({
                    from: taker,
                });
                await assertBalancesAsync(order);
            });
            it('reverts if overspent ETH', async () => {
                const order = await getTestERC721Order({
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
                const tx = zeroEx.buyERC721(order, signature, NULL_BYTES)({
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
    describe('batchBuyERC721s', () => {
        it('reverts if arrays are different lengths', async () => {
            const order = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature = await order.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order);
            const tx = zeroEx.batchBuyERC721s([order], [signature, signature], [], false)({
                from: taker,
            });
            return expect(tx).to.be.revertedWith('ERC721OrdersFeature::batchBuyERC721s/ARRAY_LENGTH_MISMATCH');
        });
        it('successfully fills multiple orders', async () => {
            const order1 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature1 = await order1.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order1);
            const order2 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: await weth.getAddress(),
            });
            const signature2 = await order2.getSignatureWithProviderAsync(env.provider);
            await erc721Token.mint(maker, order2.erc721TokenId)();
            await weth.deposit().sendTransactionAsync({
                from: taker,
                value: order2.erc20TokenAmount,
            });
            await zeroEx
                .batchBuyERC721s([order1, order2], [signature1, signature2], [NULL_BYTES, NULL_BYTES], false)
                ({
                    from: taker,
                });
            await assertBalancesAsync(order1);
            await assertBalancesAsync(order2);
        });
        it('catches revert if one order fails', async () => {
            const order1 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature1 = await order1.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order1);
            const order2 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: await weth.getAddress(),
            });
            // invalid signature
            const signature2 = await order2.getSignatureWithProviderAsync(
                env.provider,
                SignatureType.EIP712,
                otherMaker,
            );
            await erc721Token.mint(maker, order2.erc721TokenId)();
            await weth.deposit().sendTransactionAsync({
                from: taker,
                value: order2.erc20TokenAmount,
            });
            const tx = zeroEx.batchBuyERC721s(
                [order1, order2],
                [signature1, signature2],
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
            const erc721Owner = await erc721Token.ownerOf(order2.erc721TokenId)();
            expect(erc721Owner).to.equal(maker);
            const takerWethBalance = await weth.balanceOf(taker)();
            expect(takerWethBalance).to.equal(order2.erc20TokenAmount);
        });
        it('bubbles up revert if one order fails and `revertIfIncomplete == true`', async () => {
            const order1 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature1 = await order1.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order1);
            const order2 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: await weth.getAddress(),
            });
            // invalid signature
            const signature2 = await order2.getSignatureWithProviderAsync(
                env.provider,
                SignatureType.EIP712,
                otherMaker,
            );
            await erc721Token.mint(maker, order2.erc721TokenId)();
            await weth.deposit().sendTransactionAsync({
                from: taker,
                value: order2.erc20TokenAmount,
            });
            const tx = zeroEx
                .batchBuyERC721s([order1, order2], [signature1, signature2], [NULL_BYTES, NULL_BYTES], true)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(new RevertErrors.NFTOrders.InvalidSignerError(order2.maker, otherMaker));
        });
        it('can fill multiple orders with ETH, refund excess ETH', async () => {
            const order1 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: ETH_TOKEN_ADDRESS,
            });
            const signature1 = await order1.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(order1);
            const order2 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: await weth.getAddress(),
            });
            const signature2 = await order2.getSignatureWithProviderAsync(env.provider);
            await erc721Token.mint(maker, order2.erc721TokenId)();
            const takerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            await zeroEx
                .batchBuyERC721s([order1, order2], [signature1, signature2], [NULL_BYTES, NULL_BYTES], true)
                ({
                    from: taker,
                    value: order1.erc20TokenAmount + order2.erc20TokenAmount + 1,
                });
            const takerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            expect(takerEthBalanceBefore - takerEthBalanceAfter).to.equal(
                order1.erc20TokenAmount + order2.erc20TokenAmount,
            );
            const erc721Owner1 = await erc721Token.ownerOf(order1.erc721TokenId)();
            expect(erc721Owner1).to.equal(taker);
            const erc721Owner2 = await erc721Token.ownerOf(order2.erc721TokenId)();
            expect(erc721Owner2).to.equal(taker);
        });
    });
    describe('preSignERC721Order', () => {
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
            await contractMaker.approveERC721(await erc721Token.getAddress());
        });
        it('can fill order that has been presigned by the maker', async () => {
            const order = await getTestERC721Order({
                maker: await contractMaker.getAddress(),
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            await mintAssetsAsync(order);
            await contractMaker.preSignERC721Order(order)();
            await zeroEx
                .sellERC721(order, PRESIGN_SIGNATURE, order.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            await assertBalancesAsync(order);
        });
        it('cannot fill order that has not been presigned by the maker', async () => {
            const order = await getTestERC721Order({
                maker: await contractMaker.getAddress(),
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            await mintAssetsAsync(order);
            const tx = zeroEx
                .sellERC721(order, PRESIGN_SIGNATURE, order.erc721TokenId, false, NULL_BYTES)
                ({
                    from: taker,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.InvalidSignerError(await contractMaker.getAddress(), NULL_ADDRESS),
            );
        });
        it('cannot fill order that was presigned then cancelled', async () => {
            const order = await getTestERC721Order({
                maker: await contractMaker.getAddress(),
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            await mintAssetsAsync(order);
            await contractMaker.preSignERC721Order(order)();
            await contractMaker.cancelERC721Order(order.nonce)();
            const tx = zeroEx
                .sellERC721(order, PRESIGN_SIGNATURE, order.erc721TokenId, false, NULL_BYTES)
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
    });
    describe('matchERC721Orders', () => {
        it('cannot match two sell orders', async () => {
            const order1 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature1 = await order1.getSignatureWithProviderAsync(env.provider);
            const order2 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const signature2 = await order2.getSignatureWithProviderAsync(env.provider);
            const tx = zeroEx.matchERC721Orders(order1, order2, signature1, signature2)({
                from: matcher,
            });
            return expect(tx).to.be.revertedWith('NFTOrders::_validateBuyOrder/WRONG_TRADE_DIRECTION');
        });
        it('cannot match two buy orders', async () => {
            const order1 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature1 = await order1.getSignatureWithProviderAsync(env.provider);
            const order2 = await getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const signature2 = await order2.getSignatureWithProviderAsync(env.provider);
            const tx = zeroEx.matchERC721Orders(order1, order2, signature1, signature2)({
                from: matcher,
            });
            return expect(tx).to.be.revertedWith('NFTOrders::_validateSellOrder/WRONG_TRADE_DIRECTION');
        });
        it('erc721TokenId must match', async () => {
            const sellOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const sellSignature = await sellOrder.getSignatureWithProviderAsync(env.provider);
            const buyOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
            });
            const buySignature = await buyOrder.getSignatureWithProviderAsync(env.provider);
            const tx = zeroEx
                .matchERC721Orders(sellOrder, buyOrder, sellSignature, buySignature)
                ({
                    from: matcher,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.TokenIdMismatchError(sellOrder.erc721TokenId, buyOrder.erc721TokenId),
            );
        });
        it('erc721Token must match', async () => {
            const sellOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const sellSignature = await sellOrder.getSignatureWithProviderAsync(env.provider);
            const buyOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc721Token: await erc20Token.getAddress(),
                erc721TokenId: sellOrder.erc721TokenId,
            });
            const buySignature = await buyOrder.getSignatureWithProviderAsync(env.provider);
            const tx = zeroEx
                .matchERC721Orders(sellOrder, buyOrder, sellSignature, buySignature)
                ({
                    from: matcher,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.ERC721TokenMismatchError(sellOrder.erc721Token, buyOrder.erc721Token),
            );
        });
        it('erc20Token must match', async () => {
            const sellOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const sellSignature = await sellOrder.getSignatureWithProviderAsync(env.provider);
            const buyOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc20Token: await weth.getAddress(),
                erc20TokenAmount: sellOrder.erc20TokenAmount,
                erc721TokenId: sellOrder.erc721TokenId,
            });
            const buySignature = await buyOrder.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(buyOrder, sellOrder.erc721TokenId, sellOrder.maker);
            const tx = zeroEx
                .matchERC721Orders(sellOrder, buyOrder, sellSignature, buySignature)
                ({
                    from: matcher,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.ERC20TokenMismatchError(sellOrder.erc20Token, buyOrder.erc20Token),
            );
        });
        it('reverts if spread is negative', async () => {
            const sellOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const sellSignature = await sellOrder.getSignatureWithProviderAsync(env.provider);
            const buyOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc721TokenId: sellOrder.erc721TokenId,
                erc20TokenAmount: sellOrder.erc20TokenAmount - 1,
            });
            const buySignature = await buyOrder.getSignatureWithProviderAsync(env.provider);
            const tx = zeroEx
                .matchERC721Orders(sellOrder, buyOrder, sellSignature, buySignature)
                ({
                    from: matcher,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.NegativeSpreadError(sellOrder.erc20TokenAmount, buyOrder.erc20TokenAmount),
            );
        });
        it('matches two orders and sends profit to matcher', async () => {
            const sellOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
            });
            const sellSignature = await sellOrder.getSignatureWithProviderAsync(env.provider);
            const spread = getRandomInteger(1, '1e18');
            const buyOrder = getTestERC721Order({
                maker: otherMaker,
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc721TokenId: sellOrder.erc721TokenId,
                erc20TokenAmount: sellOrder.erc20TokenAmount + spread,
            });
            const buySignature = await buyOrder.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(buyOrder, sellOrder.erc721TokenId, sellOrder.maker);
            await zeroEx
                .matchERC721Orders(sellOrder, buyOrder, sellSignature, buySignature)
                ({
                    from: matcher,
                });
            await assertBalancesAsync(sellOrder, sellOrder.erc721TokenId, otherMaker);
            const matcherBalance = await erc20Token.balanceOf(matcher)();
            expect(matcherBalance).to.equal(spread);
        });
        it('matches two ETH/WETH orders and sends profit to matcher', async () => {
            const sellOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: ETH_TOKEN_ADDRESS,
            });
            const sellSignature = await sellOrder.getSignatureWithProviderAsync(env.provider);
            const spread = getRandomInteger(1, '1e18');
            const buyOrder = getTestERC721Order({
                maker: otherMaker,
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc20Token: await weth.getAddress(),
                erc721TokenId: sellOrder.erc721TokenId,
                erc20TokenAmount: sellOrder.erc20TokenAmount + spread,
            });
            const buySignature = await buyOrder.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(buyOrder, sellOrder.erc721TokenId, sellOrder.maker);
            const sellerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(sellOrder.maker);
            const matcherEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(matcher);
            await zeroEx
                .matchERC721Orders(sellOrder, buyOrder, sellSignature, buySignature)
                ({
                    from: matcher,
                });
            const erc721Owner = await erc721Token.ownerOf(sellOrder.erc721TokenId)();
            expect(erc721Owner).to.equal(buyOrder.maker);
            const sellerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(sellOrder.maker);
            const matcherEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(matcher);
            expect(sellerEthBalanceAfter - sellerEthBalanceBefore).to.equal(sellOrder.erc20TokenAmount);
            expect(matcherEthBalanceAfter - matcherEthBalanceBefore).to.equal(spread);
        });
        it('matches two orders (with fees) and sends profit to matcher', async () => {
            const spread = getRandomInteger(1, '1e18');
            const sellOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                fees: [
                    {
                        recipient: otherTaker,
                        amount: getRandomInteger(1, spread),
                        feeData: NULL_BYTES,
                    },
                ],
            });
            const sellSignature = await sellOrder.getSignatureWithProviderAsync(env.provider);
            const buyOrder = getTestERC721Order({
                maker: otherMaker,
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc721TokenId: sellOrder.erc721TokenId,
                erc20TokenAmount: sellOrder.erc20TokenAmount + spread,
            });
            const buySignature = await buyOrder.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(buyOrder, sellOrder.erc721TokenId, sellOrder.maker);
            await erc20Token.mint(buyOrder.maker, sellOrder.fees[0].amount)();
            await zeroEx
                .matchERC721Orders(sellOrder, buyOrder, sellSignature, buySignature)
                ({
                    from: matcher,
                });
            await assertBalancesAsync(sellOrder, sellOrder.erc721TokenId, otherMaker);
            const matcherBalance = await erc20Token.balanceOf(matcher)();
            expect(matcherBalance).to.equal(spread - sellOrder.fees[0].amount);
        });
        it('matches two ETH/WETH (with fees) orders and sends profit to matcher', async () => {
            const spread = getRandomInteger(1, '1e18');
            const sellOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: ETH_TOKEN_ADDRESS,
                fees: [
                    {
                        recipient: otherTaker,
                        amount: getRandomInteger(1, spread),
                        feeData: NULL_BYTES,
                    },
                ],
            });
            const sellSignature = await sellOrder.getSignatureWithProviderAsync(env.provider);
            const buyOrder = getTestERC721Order({
                maker: otherMaker,
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc20Token: await weth.getAddress(),
                erc721TokenId: sellOrder.erc721TokenId,
                erc20TokenAmount: sellOrder.erc20TokenAmount + spread,
            });
            const buySignature = await buyOrder.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(buyOrder, sellOrder.erc721TokenId, sellOrder.maker);
            await weth
                .deposit()
                ({ from: buyOrder.maker, value: sellOrder.fees[0].amount });
            const sellerEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(sellOrder.maker);
            const matcherEthBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(matcher);
            await zeroEx
                .matchERC721Orders(sellOrder, buyOrder, sellSignature, buySignature)
                ({
                    from: matcher,
                });
            const erc721Owner = await erc721Token.ownerOf(sellOrder.erc721TokenId)();
            expect(erc721Owner).to.equal(buyOrder.maker);
            const sellerEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(sellOrder.maker);
            const matcherEthBalanceAfter = await env.web3Wrapper.getBalanceInWeiAsync(matcher);
            expect(sellerEthBalanceAfter - sellerEthBalanceBefore).to.equal(sellOrder.erc20TokenAmount);
            expect(matcherEthBalanceAfter - matcherEthBalanceBefore).to.equal(
                spread - sellOrder.fees[0].amount,
            );
        });
        it('reverts if sell order fees exceed spread', async () => {
            const spread = getRandomInteger(1, '1e18');
            const sellOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                fees: [
                    {
                        recipient: otherTaker,
                        amount: spread + 1,
                        feeData: NULL_BYTES,
                    },
                ],
            });
            const sellSignature = await sellOrder.getSignatureWithProviderAsync(env.provider);
            const buyOrder = getTestERC721Order({
                maker: otherMaker,
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc721TokenId: sellOrder.erc721TokenId,
                erc20TokenAmount: sellOrder.erc20TokenAmount + spread,
            });
            const buySignature = await buyOrder.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(buyOrder, sellOrder.erc721TokenId, sellOrder.maker);
            await erc20Token.mint(buyOrder.maker, sellOrder.fees[0].amount)();
            const tx = zeroEx
                .matchERC721Orders(sellOrder, buyOrder, sellSignature, buySignature)
                ({
                    from: matcher,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.SellOrderFeesExceedSpreadError(sellOrder.fees[0].amount, spread),
            );
        });
        it('reverts if sell order fees exceed spread (ETH/WETH)', async () => {
            const spread = getRandomInteger(1, '1e18');
            const sellOrder = getTestERC721Order({
                direction: NFTOrder.TradeDirection.SellNFT,
                erc20Token: ETH_TOKEN_ADDRESS,
                fees: [
                    {
                        recipient: otherTaker,
                        amount: spread + 1,
                        feeData: NULL_BYTES,
                    },
                ],
            });
            await sendEtherAsync(await zeroEx.getAddress(), sellOrder.fees[0].amount);
            const sellSignature = await sellOrder.getSignatureWithProviderAsync(env.provider);
            const buyOrder = getTestERC721Order({
                maker: otherMaker,
                direction: NFTOrder.TradeDirection.BuyNFT,
                erc20Token: await weth.getAddress(),
                erc721TokenId: sellOrder.erc721TokenId,
                erc20TokenAmount: sellOrder.erc20TokenAmount + spread,
            });
            const buySignature = await buyOrder.getSignatureWithProviderAsync(env.provider);
            await mintAssetsAsync(buyOrder, sellOrder.erc721TokenId, sellOrder.maker);
            await weth
                .deposit()
                ({ from: buyOrder.maker, value: sellOrder.fees[0].amount });
            const tx = zeroEx
                .matchERC721Orders(sellOrder, buyOrder, sellSignature, buySignature)
                ({
                    from: matcher,
                });
            return expect(tx).to.be.revertedWith(
                new RevertErrors.NFTOrders.SellOrderFeesExceedSpreadError(sellOrder.fees[0].amount, spread),
            );
        });
    });
});
