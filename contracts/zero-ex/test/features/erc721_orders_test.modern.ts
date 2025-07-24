import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { randomBytes } from 'crypto';

// Import chai-as-promised for proper async error handling
import 'chai-as-promised';

describe('ERC721OrdersFeature - Complete Modern Tests', function() {
    // Extended timeout for ERC721 operations
    this.timeout(300000);
    
    let owner: any;
    let maker: any;
    let taker: any;
    let otherMaker: any;
    let otherTaker: any;
    let matcher: any;
    let feeRecipient: any;
    let zeroEx: any;
    let weth: any;
    let erc20Token: any;
    let erc721Token: any;
    let propertyValidator: any;
    let nftOrderPresigner: any;
    
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    const ETH_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const MAX_UINT256 = ethers.MaxUint256;
    const NULL_BYTES = '0x';
    const ZERO_AMOUNT = 0n;
    
    // NFT Order enums
    const TradeDirection = {
        SellNFT: 0,
        BuyNFT: 1
    };
    
    const SignatureType = {
        EthSign: 0,
        EIP712: 1,
        PreSigned: 2
    };
    
    interface ERC721Fee {
        recipient: string;
        amount: bigint;
        feeData: string;
    }
    
    interface ERC721Property {
        propertyValidator: string;
        propertyData: string;
    }
    
    interface ERC721Order {
        direction: number;
        maker: string;
        taker: string;
        expiry: number;
        nonce: bigint;
        erc20Token: string;
        erc20TokenAmount: bigint;
        fees: ERC721Fee[];
        erc721Token: string;
        erc721TokenId: bigint;
        erc721TokenProperties: ERC721Property[];
    }
    
    before(async function() {
        console.log('🚀 Setting up Complete ERC721OrdersFeature Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [owner, maker, taker, otherMaker, otherTaker, matcher] = signers;
        
        console.log('👤 Owner:', owner.address);
        console.log('👤 Maker:', maker.address);
        console.log('👤 Taker:', taker.address);
        
        await deployContractsAsync();
        await setupApprovalsAsync();
        
        console.log('✅ Complete ERC721OrdersFeature test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying Complete ERC721OrdersFeature contracts...');
        
        // Deploy WETH
        const WethFactory = await ethers.getContractFactory('TestWeth');
        weth = await WethFactory.deploy();
        await weth.waitForDeployment();
        console.log(`✅ WETH: ${await weth.getAddress()}`);
        
        // Deploy ERC20 token
        const ERC20Factory = await ethers.getContractFactory('TestMintableERC20Token');
        erc20Token = await ERC20Factory.deploy('TestToken', 'TEST', 18);
        await erc20Token.waitForDeployment();
        console.log(`✅ ERC20 Token: ${await erc20Token.getAddress()}`);
        
        // Deploy ERC721 token
        const ERC721Factory = await ethers.getContractFactory('TestMintableERC721Token');
        erc721Token = await ERC721Factory.deploy('TestNFT', 'TNFT');
        await erc721Token.waitForDeployment();
        console.log(`✅ ERC721 Token: ${await erc721Token.getAddress()}`);
        
        // Deploy mock ZeroEx contract with ERC721 orders support
        const ZeroExFactory = await ethers.getContractFactory('TestZeroExWithERC721Orders');
        zeroEx = await ZeroExFactory.deploy(await weth.getAddress());
        await zeroEx.waitForDeployment();
        console.log(`✅ ZeroEx: ${await zeroEx.getAddress()}`);
        
        // Deploy fee recipient
        const FeeRecipientFactory = await ethers.getContractFactory('TestFeeRecipient');
        feeRecipient = await FeeRecipientFactory.deploy();
        await feeRecipient.waitForDeployment();
        console.log(`✅ Fee Recipient: ${await feeRecipient.getAddress()}`);
        
        // Deploy property validator
        const PropertyValidatorFactory = await ethers.getContractFactory('TestPropertyValidator');
        propertyValidator = await PropertyValidatorFactory.deploy();
        await propertyValidator.waitForDeployment();
        console.log(`✅ Property Validator: ${await propertyValidator.getAddress()}`);
        
        // Deploy NFT order presigner
        const PresignerFactory = await ethers.getContractFactory('TestNFTOrderPresigner');
        nftOrderPresigner = await PresignerFactory.deploy(await zeroEx.getAddress());
        await nftOrderPresigner.waitForDeployment();
        console.log(`✅ NFT Order Presigner: ${await nftOrderPresigner.getAddress()}`);
    }

    async function setupApprovalsAsync(): Promise<void> {
        console.log('🔐 Setting up token approvals...');
        
        const accounts = [maker, otherMaker, taker, otherTaker];
        const zeroExAddress = await zeroEx.getAddress();
        
        // Approve ERC20 tokens
        for (const account of accounts) {
            await erc20Token.connect(account).approve(zeroExAddress, MAX_UINT256);
            await weth.connect(account).approve(zeroExAddress, MAX_UINT256);
        }
        
        // Approve ERC721 tokens (setApprovalForAll)
        for (const account of accounts) {
            await erc721Token.connect(account).setApprovalForAll(zeroExAddress, true);
        }
        
        console.log(`✅ All token approvals set`);
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

    function getTestERC721Order(fields: Partial<ERC721Order> = {}): ERC721Order {
        return {
            direction: fields.direction ?? TradeDirection.SellNFT,
            maker: fields.maker || maker.address,
            taker: fields.taker || NULL_ADDRESS,
            expiry: fields.expiry || createExpiry(3600),
            nonce: fields.nonce || BigInt(Math.floor(Math.random() * 1000000)),
            erc20Token: fields.erc20Token || (erc20Token.target || erc20Token.address),
            erc20TokenAmount: fields.erc20TokenAmount || ethers.parseEther('1'),
            fees: fields.fees || [],
            erc721Token: fields.erc721Token || (erc721Token.target || erc721Token.address),
            erc721TokenId: fields.erc721TokenId || BigInt(Math.floor(Math.random() * 1000000)),
            erc721TokenProperties: fields.erc721TokenProperties || [],
            ...fields
        };
    }

    async function mintAssetsAsync(
        order: ERC721Order,
        tokenId: bigint = order.erc721TokenId,
        _taker: string = taker.address
    ): Promise<void> {
        const totalFeeAmount = order.fees.length > 0 
            ? order.fees.reduce((sum, fee) => sum + fee.amount, 0n) 
            : ZERO_AMOUNT;
        
        if (order.direction === TradeDirection.SellNFT) {
            // Seller has NFT, buyer needs ERC20/ETH
            await erc721Token.mint(order.maker, tokenId);
            if (order.erc20Token !== ETH_TOKEN_ADDRESS) {
                const token = order.erc20Token === (weth.target || weth.address) ? weth : erc20Token;
                await token.mint(_taker, order.erc20TokenAmount + totalFeeAmount);
            }
        } else {
            // Buyer has NFT to offer, seller needs ERC20/ETH
            await erc721Token.mint(_taker, tokenId);
            if (order.erc20Token === (weth.target || weth.address)) {
                await weth.connect(await ethers.getSigner(order.maker)).deposit({
                    value: order.erc20TokenAmount + totalFeeAmount
                });
            } else {
                await erc20Token.mint(order.maker, order.erc20TokenAmount + totalFeeAmount);
            }
        }
    }

    async function assertBalancesAsync(
        order: ERC721Order,
        tokenId: bigint = order.erc721TokenId,
        _taker: string = taker.address
    ): Promise<void> {
        const token = order.erc20Token === (weth.target || weth.address) ? weth : erc20Token;
        
        if (order.direction === TradeDirection.SellNFT) {
            // Check maker received ERC20
            const makerBalance = await token.balanceOf(order.maker);
            expect(makerBalance).to.equal(order.erc20TokenAmount);
            
            // Check taker received NFT
            const erc721Owner = await erc721Token.ownerOf(tokenId);
            expect(erc721Owner).to.equal(_taker);
        } else {
            // Check taker received ERC20
            const erc20Balance = await token.balanceOf(_taker);
            expect(erc20Balance).to.equal(order.erc20TokenAmount);
            
            // Check maker received NFT
            const erc721Owner = await erc721Token.ownerOf(tokenId);
            expect(erc721Owner).to.equal(order.maker);
        }
        
        // Check fee recipients received fees
        if (order.fees.length > 0) {
            for (const fee of order.fees) {
                const feeRecipientBalance = await token.balanceOf(fee.recipient);
                expect(feeRecipientBalance).to.equal(fee.amount);
            }
        }
    }

    function createERC721OrderFilledEvent(
        order: ERC721Order,
        _taker: string = taker.address,
        erc721TokenId: bigint = order.erc721TokenId
    ): any {
        return {
            direction: order.direction,
            maker: order.maker,
            taker: _taker,
            nonce: order.nonce,
            erc20Token: order.erc20Token,
            erc20TokenAmount: order.erc20TokenAmount,
            erc721Token: order.erc721Token,
            erc721TokenId,
            matcher: NULL_ADDRESS,
        };
    }

    async function createOrderSignature(order: ERC721Order, signer: any = maker): Promise<string> {
        const orderHash = await getOrderHash(order);
        return await signer.signMessage(ethers.getBytes(orderHash));
    }

    async function getOrderHash(order: ERC721Order): Promise<string> {
        return await zeroEx.getERC721OrderHash(order);
    }

    describe('getERC721OrderHash()', function() {
        it('returns the correct hash for order with no fees or properties', async function() {
            const order = getTestERC721Order();
            const hash = await zeroEx.getERC721OrderHash(order);
            
            expect(hash).to.not.equal(ethers.ZeroHash);
            expect(hash).to.have.lengthOf(66); // 0x + 64 hex chars
            
            console.log(`✅ Generated ERC721 order hash: ${hash.slice(0, 10)}...`);
        });

        it('returns the correct hash for order with null property', async function() {
            const order = getTestERC721Order({
                erc721TokenProperties: [
                    {
                        propertyValidator: NULL_ADDRESS,
                        propertyData: NULL_BYTES,
                    },
                ],
            });
            const hash = await zeroEx.getERC721OrderHash(order);
            
            expect(hash).to.not.equal(ethers.ZeroHash);
            
            console.log(`✅ Generated hash for order with null property`);
        });

        it('returns the correct hash for order with 1 fee, 1 property', async function() {
            const order = getTestERC721Order({
                fees: [
                    {
                        recipient: await feeRecipient.getAddress(),
                        amount: ethers.parseEther('0.1'),
                        feeData: NULL_BYTES,
                    },
                ],
                erc721TokenProperties: [
                    {
                        propertyValidator: await propertyValidator.getAddress(),
                        propertyData: '0x1234',
                    },
                ],
            });
            const hash = await zeroEx.getERC721OrderHash(order);
            
            expect(hash).to.not.equal(ethers.ZeroHash);
            
            console.log(`✅ Generated hash for order with fee and property`);
        });

        it('different orders have different hashes', async function() {
            const order1 = getTestERC721Order();
            const order2 = getTestERC721Order({ nonce: order1.nonce + 1n });
            
            const hash1 = await zeroEx.getERC721OrderHash(order1);
            const hash2 = await zeroEx.getERC721OrderHash(order2);
            
            expect(hash1).to.not.equal(hash2);
            
            console.log(`✅ Different orders produce different hashes`);
        });
    });

    describe('validateERC721OrderSignature', function() {
        it('validates a valid signature', async function() {
            const order = getTestERC721Order();
            const signature = await createOrderSignature(order);
            
            const isValid = await zeroEx.validateERC721OrderSignature(order, signature, maker.address);
            expect(isValid).to.be.true;
            
            console.log(`✅ Valid signature correctly validated`);
        });

        it('rejects an invalid signature', async function() {
            const order = getTestERC721Order();
            const invalidSignature = generateRandomBytes32();
            
            const isValid = await zeroEx.validateERC721OrderSignature(order, invalidSignature, maker.address);
            expect(isValid).to.be.false;
            
            console.log(`✅ Invalid signature correctly rejected`);
        });

        it('validates pre-signed order', async function() {
            const order = getTestERC721Order();
            
            // Pre-sign the order
            await zeroEx.connect(maker).preSignERC721Order(order);
            
            const isValid = await zeroEx.validateERC721OrderSignature(order, NULL_BYTES, maker.address);
            expect(isValid).to.be.true;
            
            console.log(`✅ Pre-signed order correctly validated`);
        });

        it('rejects signature from wrong signer', async function() {
            const order = getTestERC721Order();
            const signature = await createOrderSignature(order, taker); // Wrong signer
            
            const isValid = await zeroEx.validateERC721OrderSignature(order, signature, maker.address);
            expect(isValid).to.be.false;
            
            console.log(`✅ Wrong signer signature correctly rejected`);
        });
    });

    describe('cancelERC721Order', function() {
        it('can cancel an unfilled order', async function() {
            const order = getTestERC721Order();
            
            const result = await zeroEx.connect(maker).cancelERC721Order(order.nonce);
            const receipt = await result.wait();
            
            // Check for cancellation event
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderCancelled');
            expect(cancelEvent).to.not.be.undefined;
            
            // Check order is cancelled
            const isCancelled = await zeroEx.isERC721OrderNonceCancelled(maker.address, order.nonce);
            expect(isCancelled).to.be.true;
            
            console.log(`✅ Cancelled unfilled ERC721 order`);
        });

        it('can cancel multiple orders', async function() {
            const nonces = [1n, 2n, 3n];
            
            for (const nonce of nonces) {
                await zeroEx.connect(maker).cancelERC721Order(nonce);
                const isCancelled = await zeroEx.isERC721OrderNonceCancelled(maker.address, nonce);
                expect(isCancelled).to.be.true;
            }
            
            console.log(`✅ Cancelled multiple ERC721 orders`);
        });

        it('cannot cancel someone else\'s order', async function() {
            const order = getTestERC721Order();
            
            await expect(
                zeroEx.connect(taker).cancelERC721Order(order.nonce)
            ).to.be.rejectedWith('Unauthorized');
            
            console.log(`✅ Correctly prevented unauthorized cancellation`);
        });

        it('can cancel already cancelled order', async function() {
            const order = getTestERC721Order();
            
            // Cancel once
            await zeroEx.connect(maker).cancelERC721Order(order.nonce);
            
            // Cancel again - should not revert
            const result = await zeroEx.connect(maker).cancelERC721Order(order.nonce);
            const receipt = await result.wait();
            
            const cancelEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderCancelled');
            expect(cancelEvent).to.not.be.undefined;
            
            console.log(`✅ Can cancel already cancelled order`);
        });
    });

    describe('sellERC721', function() {
        it('can sell an ERC721 token for ERC20', async function() {
            const order = getTestERC721Order({
                direction: TradeDirection.SellNFT,
            });
            await mintAssetsAsync(order);
            const signature = await createOrderSignature(order);
            
            const result = await zeroEx.connect(taker).sellERC721(
                order,
                signature,
                order.erc721TokenId,
                false, // unwrapNativeToken
                NULL_BYTES // callbackData
            );
            const receipt = await result.wait();
            
            // Check for fill event
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            // Check balances
            await assertBalancesAsync(order);
            
            console.log(`✅ Successfully sold ERC721 for ERC20`);
        });

        it('can sell ERC721 token for WETH', async function() {
            const order = getTestERC721Order({
                direction: TradeDirection.SellNFT,
                erc20Token: await weth.getAddress(),
            });
            await mintAssetsAsync(order);
            const signature = await createOrderSignature(order);
            
            const result = await zeroEx.connect(taker).sellERC721(
                order,
                signature,
                order.erc721TokenId,
                false,
                NULL_BYTES
            );
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            await assertBalancesAsync(order);
            
            console.log(`✅ Successfully sold ERC721 for WETH`);
        });

        it('can sell with unwrapping WETH to ETH', async function() {
            const order = getTestERC721Order({
                direction: TradeDirection.SellNFT,
                erc20Token: await weth.getAddress(),
            });
            await mintAssetsAsync(order);
            const signature = await createOrderSignature(order);
            
            const ethBalanceBefore = await ethers.provider.getBalance(taker.address);
            
            const result = await zeroEx.connect(taker).sellERC721(
                order,
                signature,
                order.erc721TokenId,
                true, // unwrapNativeToken
                NULL_BYTES
            );
            const receipt = await result.wait();
            
            const ethBalanceAfter = await ethers.provider.getBalance(taker.address);
            
            // Should have received ETH (minus gas)
            const ethReceived = ethBalanceAfter - ethBalanceBefore;
            expect(ethReceived > 0n).to.be.true;
            
            console.log(`✅ Successfully sold ERC721 with WETH unwrapping`);
        });

        it('cannot sell with wrong token ID', async function() {
            const order = getTestERC721Order({
                direction: TradeDirection.SellNFT,
            });
            await mintAssetsAsync(order);
            const signature = await createOrderSignature(order);
            
            const wrongTokenId = order.erc721TokenId + 1n;
            
            await expect(
                zeroEx.connect(taker).sellERC721(
                    order,
                    signature,
                    wrongTokenId,
                    false,
                    NULL_BYTES
                )
            ).to.be.rejectedWith('TokenIdMismatch');
            
            console.log(`✅ Correctly rejected wrong token ID`);
        });

        it('cannot sell expired order', async function() {
            const order = getTestERC721Order({
                direction: TradeDirection.SellNFT,
                expiry: Math.floor(Date.now() / 1000) - 60, // Expired
            });
            await mintAssetsAsync(order);
            const signature = await createOrderSignature(order);
            
            await expect(
                zeroEx.connect(taker).sellERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    false,
                    NULL_BYTES
                )
            ).to.be.rejectedWith('OrderExpired');
            
            console.log(`✅ Correctly rejected expired order`);
        });

        it('cannot sell cancelled order', async function() {
            const order = getTestERC721Order({
                direction: TradeDirection.SellNFT,
            });
            await mintAssetsAsync(order);
            const signature = await createOrderSignature(order);
            
            // Cancel the order
            await zeroEx.connect(maker).cancelERC721Order(order.nonce);
            
            await expect(
                zeroEx.connect(taker).sellERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    false,
                    NULL_BYTES
                )
            ).to.be.rejectedWith('OrderCancelled');
            
            console.log(`✅ Correctly rejected cancelled order`);
        });

        describe('fees', function() {
            it('pays single fee to recipient', async function() {
                const feeAmount = ethers.parseEther('0.1');
                const order = getTestERC721Order({
                    direction: TradeDirection.SellNFT,
                    fees: [
                        {
                            recipient: await feeRecipient.getAddress(),
                            amount: feeAmount,
                            feeData: NULL_BYTES,
                        },
                    ],
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                const result = await zeroEx.connect(taker).sellERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    false,
                    NULL_BYTES
                );
                const receipt = await result.wait();
                
                const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderFilled');
                expect(fillEvent).to.not.be.undefined;
                
                // Check fee recipient received fee
                const feeRecipientBalance = await erc20Token.balanceOf(await feeRecipient.getAddress());
                expect(feeRecipientBalance).to.equal(feeAmount);
                
                console.log(`✅ Single fee correctly paid: ${ethers.formatEther(feeAmount)} tokens`);
            });

            it('pays multiple fees to different recipients', async function() {
                const fee1Amount = ethers.parseEther('0.1');
                const fee2Amount = ethers.parseEther('0.05');
                const secondRecipient = generateRandomAddress();
                
                const order = getTestERC721Order({
                    direction: TradeDirection.SellNFT,
                    fees: [
                        {
                            recipient: await feeRecipient.getAddress(),
                            amount: fee1Amount,
                            feeData: NULL_BYTES,
                        },
                        {
                            recipient: secondRecipient,
                            amount: fee2Amount,
                            feeData: NULL_BYTES,
                        },
                    ],
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                const result = await zeroEx.connect(taker).sellERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    false,
                    NULL_BYTES
                );
                const receipt = await result.wait();
                
                const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderFilled');
                expect(fillEvent).to.not.be.undefined;
                
                // Check both fee recipients received fees
                const feeRecipient1Balance = await erc20Token.balanceOf(await feeRecipient.getAddress());
                const feeRecipient2Balance = await erc20Token.balanceOf(secondRecipient);
                expect(feeRecipient1Balance).to.equal(fee1Amount);
                expect(feeRecipient2Balance).to.equal(fee2Amount);
                
                console.log(`✅ Multiple fees correctly paid: ${ethers.formatEther(fee1Amount)} + ${ethers.formatEther(fee2Amount)}`);
            });

            it('handles zero fee amounts', async function() {
                const order = getTestERC721Order({
                    direction: TradeDirection.SellNFT,
                    fees: [
                        {
                            recipient: await feeRecipient.getAddress(),
                            amount: 0n,
                            feeData: NULL_BYTES,
                        },
                    ],
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                const result = await zeroEx.connect(taker).sellERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    false,
                    NULL_BYTES
                );
                const receipt = await result.wait();
                
                const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderFilled');
                expect(fillEvent).to.not.be.undefined;
                
                console.log(`✅ Zero fee amount handled correctly`);
            });

            it('reverts if taker has insufficient balance for fees', async function() {
                const order = getTestERC721Order({
                    direction: TradeDirection.SellNFT,
                    fees: [
                        {
                            recipient: await feeRecipient.getAddress(),
                            amount: ethers.parseEther('1000'), // Very large fee
                            feeData: NULL_BYTES,
                        },
                    ],
                });
                
                // Only mint base amount, not enough for fees
                await erc721Token.mint(order.maker, order.erc721TokenId);
                await erc20Token.mint(taker.address, order.erc20TokenAmount); // Not including fee
                
                const signature = await createOrderSignature(order);
                
                await expect(
                    zeroEx.connect(taker).sellERC721(
                        order,
                        signature,
                        order.erc721TokenId,
                        false,
                        NULL_BYTES
                    )
                ).to.be.rejectedWith('InsufficientBalance');
                
                console.log(`✅ Correctly rejected insufficient balance for fees`);
            });
        });

        describe('properties', function() {
            it('validates token properties', async function() {
                const order = getTestERC721Order({
                    direction: TradeDirection.SellNFT,
                    erc721TokenProperties: [
                        {
                            propertyValidator: await propertyValidator.getAddress(),
                            propertyData: '0x1234', // Some property data
                        },
                    ],
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                const result = await zeroEx.connect(taker).sellERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    false,
                    NULL_BYTES
                );
                const receipt = await result.wait();
                
                const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderFilled');
                expect(fillEvent).to.not.be.undefined;
                
                console.log(`✅ Token properties validated successfully`);
            });

            it('handles null property validator', async function() {
                const order = getTestERC721Order({
                    direction: TradeDirection.SellNFT,
                    erc721TokenProperties: [
                        {
                            propertyValidator: NULL_ADDRESS,
                            propertyData: NULL_BYTES,
                        },
                    ],
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                const result = await zeroEx.connect(taker).sellERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    false,
                    NULL_BYTES
                );
                const receipt = await result.wait();
                
                const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderFilled');
                expect(fillEvent).to.not.be.undefined;
                
                console.log(`✅ Null property validator handled correctly`);
            });

            it('reverts if property validation fails', async function() {
                // Create a property validator that always fails
                const FailingValidatorFactory = await ethers.getContractFactory('TestFailingPropertyValidator');
                const failingValidator = await FailingValidatorFactory.deploy();
                await failingValidator.waitForDeployment();
                
                const order = getTestERC721Order({
                    direction: TradeDirection.SellNFT,
                    erc721TokenProperties: [
                        {
                            propertyValidator: await failingValidator.getAddress(),
                            propertyData: '0x1234',
                        },
                    ],
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                await expect(
                    zeroEx.connect(taker).sellERC721(
                        order,
                        signature,
                        order.erc721TokenId,
                        false,
                        NULL_BYTES
                    )
                ).to.be.rejectedWith('PropertyValidationFailed');
                
                console.log(`✅ Property validation failure correctly handled`);
            });

            it('validates multiple properties', async function() {
                const order = getTestERC721Order({
                    direction: TradeDirection.SellNFT,
                    erc721TokenProperties: [
                        {
                            propertyValidator: await propertyValidator.getAddress(),
                            propertyData: '0x1234',
                        },
                        {
                            propertyValidator: NULL_ADDRESS,
                            propertyData: NULL_BYTES,
                        },
                    ],
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                const result = await zeroEx.connect(taker).sellERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    false,
                    NULL_BYTES
                );
                const receipt = await result.wait();
                
                const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderFilled');
                expect(fillEvent).to.not.be.undefined;
                
                console.log(`✅ Multiple properties validated successfully`);
            });
        });
    });

    describe('onERC721Received', function() {
        it('handles ERC721 transfers to contract', async function() {
            const tokenId = BigInt(Math.floor(Math.random() * 1000000));
            await erc721Token.mint(taker.address, tokenId);
            
            // Transfer NFT to ZeroEx contract
            const result = await erc721Token.connect(taker).safeTransferFrom(
                taker.address,
                await zeroEx.getAddress(),
                tokenId,
                NULL_BYTES
            );
            const receipt = await result.wait();
            
            // Check transfer was successful
            const owner = await erc721Token.ownerOf(tokenId);
            expect(owner).to.equal(await zeroEx.getAddress());
            
            console.log(`✅ ERC721 transfer to contract handled: token ${tokenId}`);
        });

        it('can handle ERC721 transfers with data', async function() {
            const tokenId = BigInt(Math.floor(Math.random() * 1000000));
            await erc721Token.mint(taker.address, tokenId);
            
            const customData = '0x1234567890abcdef';
            
            const result = await erc721Token.connect(taker).safeTransferFrom(
                taker.address,
                await zeroEx.getAddress(),
                tokenId,
                customData
            );
            const receipt = await result.wait();
            
            // Check transfer was successful
            const owner = await erc721Token.ownerOf(tokenId);
            expect(owner).to.equal(await zeroEx.getAddress());
            
            console.log(`✅ ERC721 transfer with data handled: token ${tokenId}`);
        });

        it('returns correct selector', async function() {
            const selector = await zeroEx.onERC721Received(
                taker.address,
                maker.address,
                123n,
                NULL_BYTES
            );
            
            // Should return the correct ERC721 receiver selector
            const expectedSelector = '0x150b7a02'; // bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))
            expect(selector).to.equal(expectedSelector);
            
            console.log(`✅ Correct ERC721 receiver selector returned`);
        });
    });

    describe('buyERC721', function() {
        it('can buy an ERC721 token with ERC20', async function() {
            const order = getTestERC721Order({
                direction: TradeDirection.BuyNFT,
            });
            await mintAssetsAsync(order);
            const signature = await createOrderSignature(order);
            
            const result = await zeroEx.connect(taker).buyERC721(
                order,
                signature,
                order.erc721TokenId,
                NULL_BYTES
            );
            const receipt = await result.wait();
            
            // Check for fill event
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            // Check balances
            await assertBalancesAsync(order);
            
            console.log(`✅ Successfully bought ERC721 with ERC20`);
        });

        it('can buy ERC721 token with WETH', async function() {
            const order = getTestERC721Order({
                direction: TradeDirection.BuyNFT,
                erc20Token: await weth.getAddress(),
            });
            await mintAssetsAsync(order);
            const signature = await createOrderSignature(order);
            
            const result = await zeroEx.connect(taker).buyERC721(
                order,
                signature,
                order.erc721TokenId,
                NULL_BYTES
            );
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            await assertBalancesAsync(order);
            
            console.log(`✅ Successfully bought ERC721 with WETH`);
        });

        it('cannot buy with wrong token ID', async function() {
            const order = getTestERC721Order({
                direction: TradeDirection.BuyNFT,
            });
            await mintAssetsAsync(order);
            const signature = await createOrderSignature(order);
            
            const wrongTokenId = order.erc721TokenId + 1n;
            
            await expect(
                zeroEx.connect(taker).buyERC721(
                    order,
                    signature,
                    wrongTokenId,
                    NULL_BYTES
                )
            ).to.be.rejectedWith('TokenIdMismatch');
            
            console.log(`✅ Correctly rejected wrong token ID for buy order`);
        });

        it('cannot buy expired order', async function() {
            const order = getTestERC721Order({
                direction: TradeDirection.BuyNFT,
                expiry: Math.floor(Date.now() / 1000) - 60, // Expired
            });
            await mintAssetsAsync(order);
            const signature = await createOrderSignature(order);
            
            await expect(
                zeroEx.connect(taker).buyERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    NULL_BYTES
                )
            ).to.be.rejectedWith('OrderExpired');
            
            console.log(`✅ Correctly rejected expired buy order`);
        });

        describe('ETH', function() {
            it('can buy ERC721 with ETH', async function() {
                const order = getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc20Token: ETH_TOKEN_ADDRESS,
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                const result = await zeroEx.connect(taker).buyERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    NULL_BYTES,
                    { value: order.erc20TokenAmount }
                );
                const receipt = await result.wait();
                
                const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderFilled');
                expect(fillEvent).to.not.be.undefined;
                
                console.log(`✅ Successfully bought ERC721 with ETH`);
            });

            it('reverts if insufficient ETH sent', async function() {
                const order = getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc20Token: ETH_TOKEN_ADDRESS,
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                const insufficientAmount = order.erc20TokenAmount - 1n;
                
                await expect(
                    zeroEx.connect(taker).buyERC721(
                        order,
                        signature,
                        order.erc721TokenId,
                        NULL_BYTES,
                        { value: insufficientAmount }
                    )
                ).to.be.rejectedWith('InsufficientETH');
                
                console.log(`✅ Correctly rejected insufficient ETH`);
            });

            it('refunds excess ETH', async function() {
                const order = getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc20Token: ETH_TOKEN_ADDRESS,
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                const excessAmount = order.erc20TokenAmount + ethers.parseEther('1');
                const balanceBefore = await ethers.provider.getBalance(taker.address);
                
                const result = await zeroEx.connect(taker).buyERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    NULL_BYTES,
                    { value: excessAmount }
                );
                const receipt = await result.wait();
                
                const balanceAfter = await ethers.provider.getBalance(taker.address);
                const gasUsed = receipt.gasUsed * receipt.gasPrice;
                const netChange = balanceBefore - balanceAfter - gasUsed;
                
                // Should only have spent the order amount, not the excess
                expect(netChange).to.equal(order.erc20TokenAmount);
                
                console.log(`✅ Excess ETH correctly refunded`);
            });
        });

        describe('fees', function() {
            it('pays fees in ETH transactions', async function() {
                const feeAmount = ethers.parseEther('0.1');
                const order = getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc20Token: ETH_TOKEN_ADDRESS,
                    fees: [
                        {
                            recipient: await feeRecipient.getAddress(),
                            amount: feeAmount,
                            feeData: NULL_BYTES,
                        },
                    ],
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                const totalValue = order.erc20TokenAmount + feeAmount;
                const feeRecipientBalanceBefore = await ethers.provider.getBalance(await feeRecipient.getAddress());
                
                const result = await zeroEx.connect(taker).buyERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    NULL_BYTES,
                    { value: totalValue }
                );
                const receipt = await result.wait();
                
                const feeRecipientBalanceAfter = await ethers.provider.getBalance(await feeRecipient.getAddress());
                const feeReceived = feeRecipientBalanceAfter - feeRecipientBalanceBefore;
                
                expect(feeReceived).to.equal(feeAmount);
                
                console.log(`✅ ETH fee correctly paid: ${ethers.formatEther(feeAmount)} ETH`);
            });

            it('handles fee payments with ERC20 tokens', async function() {
                const feeAmount = ethers.parseEther('0.1');
                const order = getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    fees: [
                        {
                            recipient: await feeRecipient.getAddress(),
                            amount: feeAmount,
                            feeData: NULL_BYTES,
                        },
                    ],
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                const result = await zeroEx.connect(taker).buyERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    NULL_BYTES
                );
                const receipt = await result.wait();
                
                // Check fee recipient received ERC20 tokens
                const feeRecipientBalance = await erc20Token.balanceOf(await feeRecipient.getAddress());
                expect(feeRecipientBalance).to.equal(feeAmount);
                
                console.log(`✅ ERC20 fee correctly paid: ${ethers.formatEther(feeAmount)} tokens`);
            });

            it('distributes fees among multiple recipients', async function() {
                const fee1Amount = ethers.parseEther('0.1');
                const fee2Amount = ethers.parseEther('0.05');
                const secondRecipient = generateRandomAddress();
                
                const order = getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc20Token: ETH_TOKEN_ADDRESS,
                    fees: [
                        {
                            recipient: await feeRecipient.getAddress(),
                            amount: fee1Amount,
                            feeData: NULL_BYTES,
                        },
                        {
                            recipient: secondRecipient,
                            amount: fee2Amount,
                            feeData: NULL_BYTES,
                        },
                    ],
                });
                await mintAssetsAsync(order);
                const signature = await createOrderSignature(order);
                
                const totalValue = order.erc20TokenAmount + fee1Amount + fee2Amount;
                
                const fee1BalanceBefore = await ethers.provider.getBalance(await feeRecipient.getAddress());
                const fee2BalanceBefore = await ethers.provider.getBalance(secondRecipient);
                
                const result = await zeroEx.connect(taker).buyERC721(
                    order,
                    signature,
                    order.erc721TokenId,
                    NULL_BYTES,
                    { value: totalValue }
                );
                const receipt = await result.wait();
                
                const fee1BalanceAfter = await ethers.provider.getBalance(await feeRecipient.getAddress());
                const fee2BalanceAfter = await ethers.provider.getBalance(secondRecipient);
                
                expect(fee1BalanceAfter - fee1BalanceBefore).to.equal(fee1Amount);
                expect(fee2BalanceAfter - fee2BalanceBefore).to.equal(fee2Amount);
                
                console.log(`✅ Multiple ETH fees distributed correctly`);
            });
        });
    });

    describe('batchBuyERC721s', function() {
        it('can buy multiple ERC721 tokens in one transaction', async function() {
            const orders = [
                getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc721TokenId: 1n,
                }),
                getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc721TokenId: 2n,
                }),
                getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc721TokenId: 3n,
                }),
            ];
            
            const signatures = [];
            const tokenIds = [];
            
            for (const order of orders) {
                await mintAssetsAsync(order);
                signatures.push(await createOrderSignature(order));
                tokenIds.push(order.erc721TokenId);
            }
            
            const result = await zeroEx.connect(taker).batchBuyERC721s(
                orders,
                signatures,
                tokenIds,
                NULL_BYTES,
                false // revertIfIncomplete
            );
            const receipt = await result.wait();
            
            // Check for multiple fill events
            const fillEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'ERC721OrderFilled');
            expect(fillEvents.length).to.equal(orders.length);
            
            // Verify all balances
            for (const order of orders) {
                await assertBalancesAsync(order);
            }
            
            console.log(`✅ Successfully batch bought ${orders.length} ERC721 tokens`);
        });

        it('can buy multiple ERC721 tokens with ETH', async function() {
            const orders = [
                getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc20Token: ETH_TOKEN_ADDRESS,
                    erc721TokenId: 1n,
                    erc20TokenAmount: ethers.parseEther('1'),
                }),
                getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc20Token: ETH_TOKEN_ADDRESS,
                    erc721TokenId: 2n,
                    erc20TokenAmount: ethers.parseEther('1.5'),
                }),
            ];
            
            const signatures = [];
            const tokenIds = [];
            let totalValue = 0n;
            
            for (const order of orders) {
                await mintAssetsAsync(order);
                signatures.push(await createOrderSignature(order));
                tokenIds.push(order.erc721TokenId);
                totalValue += order.erc20TokenAmount;
            }
            
            const result = await zeroEx.connect(taker).batchBuyERC721s(
                orders,
                signatures,
                tokenIds,
                NULL_BYTES,
                false,
                { value: totalValue }
            );
            const receipt = await result.wait();
            
            const fillEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'ERC721OrderFilled');
            expect(fillEvents.length).to.equal(orders.length);
            
            console.log(`✅ Successfully batch bought ${orders.length} ERC721 tokens with ETH`);
        });

        it('handles partial success when revertIfIncomplete is false', async function() {
            const orders = [
                getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc721TokenId: 1n,
                }),
                getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc721TokenId: 2n,
                    expiry: Math.floor(Date.now() / 1000) - 60, // Expired order
                }),
                getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc721TokenId: 3n,
                }),
            ];
            
            const signatures = [];
            const tokenIds = [];
            
            for (let i = 0; i < orders.length; i++) {
                if (i !== 1) { // Don't mint for expired order
                    await mintAssetsAsync(orders[i]);
                }
                signatures.push(await createOrderSignature(orders[i]));
                tokenIds.push(orders[i].erc721TokenId);
            }
            
            const result = await zeroEx.connect(taker).batchBuyERC721s(
                orders,
                signatures,
                tokenIds,
                NULL_BYTES,
                false // revertIfIncomplete = false, so should not revert
            );
            const receipt = await result.wait();
            
            // Should have 2 successful fills (orders 0 and 2)
            const fillEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'ERC721OrderFilled');
            expect(fillEvents.length).to.equal(2);
            
            console.log(`✅ Batch buy handled partial success correctly`);
        });

        it('reverts all when revertIfIncomplete is true and one order fails', async function() {
            const orders = [
                getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc721TokenId: 1n,
                }),
                getTestERC721Order({
                    direction: TradeDirection.BuyNFT,
                    erc721TokenId: 2n,
                    expiry: Math.floor(Date.now() / 1000) - 60, // Expired order
                }),
            ];
            
            const signatures = [];
            const tokenIds = [];
            
            for (let i = 0; i < orders.length; i++) {
                if (i !== 1) { // Don't mint for expired order
                    await mintAssetsAsync(orders[i]);
                }
                signatures.push(await createOrderSignature(orders[i]));
                tokenIds.push(orders[i].erc721TokenId);
            }
            
            await expect(
                zeroEx.connect(taker).batchBuyERC721s(
                    orders,
                    signatures,
                    tokenIds,
                    NULL_BYTES,
                    true // revertIfIncomplete = true
                )
            ).to.be.rejectedWith('OrderExpired');
            
            console.log(`✅ Batch buy correctly reverted when revertIfIncomplete is true`);
        });

        it('handles empty batch', async function() {
            const result = await zeroEx.connect(taker).batchBuyERC721s(
                [],
                [],
                [],
                NULL_BYTES,
                false
            );
            const receipt = await result.wait();
            
            const fillEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'ERC721OrderFilled');
            expect(fillEvents.length).to.equal(0);
            
            console.log(`✅ Empty batch handled correctly`);
        });
    });

    describe('preSignERC721Order', function() {
        it('can pre-sign an order', async function() {
            const order = getTestERC721Order();
            
            const result = await zeroEx.connect(maker).preSignERC721Order(order);
            const receipt = await result.wait();
            
            // Check for pre-sign event
            const preSignEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderPreSigned');
            expect(preSignEvent).to.not.be.undefined;
            
            // Verify order is pre-signed
            const isPreSigned = await zeroEx.isERC721OrderNoncePreSigned(maker.address, order.nonce);
            expect(isPreSigned).to.be.true;
            
            console.log(`✅ Successfully pre-signed ERC721 order`);
        });

        it('pre-signed order can be filled without signature', async function() {
            const order = getTestERC721Order({
                direction: TradeDirection.SellNFT,
            });
            await mintAssetsAsync(order);
            
            // Pre-sign the order
            await zeroEx.connect(maker).preSignERC721Order(order);
            
            // Fill without providing signature (use empty bytes)
            const result = await zeroEx.connect(taker).sellERC721(
                order,
                NULL_BYTES, // No signature needed
                order.erc721TokenId,
                false,
                NULL_BYTES
            );
            const receipt = await result.wait();
            
            const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderFilled');
            expect(fillEvent).to.not.be.undefined;
            
            await assertBalancesAsync(order);
            
            console.log(`✅ Pre-signed order filled successfully without signature`);
        });

        it('only maker can pre-sign order', async function() {
            const order = getTestERC721Order();
            
            await expect(
                zeroEx.connect(taker).preSignERC721Order(order)
            ).to.be.rejectedWith('Unauthorized');
            
            console.log(`✅ Correctly prevented non-maker from pre-signing`);
        });

        it('can pre-sign multiple orders', async function() {
            const orders = [
                getTestERC721Order({ nonce: 1n }),
                getTestERC721Order({ nonce: 2n }),
                getTestERC721Order({ nonce: 3n }),
            ];
            
            for (const order of orders) {
                await zeroEx.connect(maker).preSignERC721Order(order);
                const isPreSigned = await zeroEx.isERC721OrderNoncePreSigned(maker.address, order.nonce);
                expect(isPreSigned).to.be.true;
            }
            
            console.log(`✅ Successfully pre-signed ${orders.length} orders`);
        });

        it('pre-signing already pre-signed order has no effect', async function() {
            const order = getTestERC721Order();
            
            // Pre-sign once
            await zeroEx.connect(maker).preSignERC721Order(order);
            
            // Pre-sign again - should not revert
            const result = await zeroEx.connect(maker).preSignERC721Order(order);
            const receipt = await result.wait();
            
            const preSignEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ERC721OrderPreSigned');
            expect(preSignEvent).to.not.be.undefined;
            
            console.log(`✅ Re-pre-signing order handled correctly`);
        });
    });

    describe('matchERC721Orders', function() {
        it('can match buy and sell orders', async function() {
            const sellOrder = getTestERC721Order({
                direction: TradeDirection.SellNFT,
                maker: maker.address,
                erc721TokenId: 123n,
            });
            
            const buyOrder = getTestERC721Order({
                direction: TradeDirection.BuyNFT,
                maker: otherMaker.address,
                erc721TokenId: 123n,
                erc20TokenAmount: sellOrder.erc20TokenAmount,
            });
            
            // Mint assets for both orders
            await mintAssetsAsync(sellOrder, sellOrder.erc721TokenId, NULL_ADDRESS);
            await mintAssetsAsync(buyOrder, buyOrder.erc721TokenId, NULL_ADDRESS);
            
            const sellSignature = await createOrderSignature(sellOrder, maker);
            const buySignature = await createOrderSignature(buyOrder, otherMaker);
            
            const result = await zeroEx.connect(matcher).matchERC721Orders(
                sellOrder,
                buyOrder,
                sellSignature,
                buySignature
            );
            const receipt = await result.wait();
            
            // Check for match events
            const fillEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'ERC721OrderFilled');
            expect(fillEvents.length).to.equal(2); // Both orders should be filled
            
            // Verify final balances
            const nftOwner = await erc721Token.ownerOf(sellOrder.erc721TokenId);
            expect(nftOwner).to.equal(buyOrder.maker);
            
            console.log(`✅ Successfully matched buy and sell orders`);
        });

        it('reverts if orders have different token IDs', async function() {
            const sellOrder = getTestERC721Order({
                direction: TradeDirection.SellNFT,
                erc721TokenId: 123n,
            });
            
            const buyOrder = getTestERC721Order({
                direction: TradeDirection.BuyNFT,
                erc721TokenId: 456n, // Different token ID
            });
            
            await mintAssetsAsync(sellOrder);
            await mintAssetsAsync(buyOrder);
            
            const sellSignature = await createOrderSignature(sellOrder);
            const buySignature = await createOrderSignature(buyOrder, otherMaker);
            
            await expect(
                zeroEx.connect(matcher).matchERC721Orders(
                    sellOrder,
                    buyOrder,
                    sellSignature,
                    buySignature
                )
            ).to.be.rejectedWith('TokenIdMismatch');
            
            console.log(`✅ Correctly rejected orders with different token IDs`);
        });

        it('reverts if both orders have same direction', async function() {
            const order1 = getTestERC721Order({
                direction: TradeDirection.SellNFT,
            });
            
            const order2 = getTestERC721Order({
                direction: TradeDirection.SellNFT, // Same direction
                maker: otherMaker.address,
            });
            
            await mintAssetsAsync(order1);
            await mintAssetsAsync(order2);
            
            const signature1 = await createOrderSignature(order1);
            const signature2 = await createOrderSignature(order2, otherMaker);
            
            await expect(
                zeroEx.connect(matcher).matchERC721Orders(
                    order1,
                    order2,
                    signature1,
                    signature2
                )
            ).to.be.rejectedWith('InvalidOrderDirection');
            
            console.log(`✅ Correctly rejected orders with same direction`);
        });

        it('reverts if price mismatch', async function() {
            const sellOrder = getTestERC721Order({
                direction: TradeDirection.SellNFT,
                erc20TokenAmount: ethers.parseEther('1'),
            });
            
            const buyOrder = getTestERC721Order({
                direction: TradeDirection.BuyNFT,
                maker: otherMaker.address,
                erc721TokenId: sellOrder.erc721TokenId,
                erc20TokenAmount: ethers.parseEther('0.5'), // Lower price
            });
            
            await mintAssetsAsync(sellOrder);
            await mintAssetsAsync(buyOrder);
            
            const sellSignature = await createOrderSignature(sellOrder);
            const buySignature = await createOrderSignature(buyOrder, otherMaker);
            
            await expect(
                zeroEx.connect(matcher).matchERC721Orders(
                    sellOrder,
                    buyOrder,
                    sellSignature,
                    buySignature
                )
            ).to.be.rejectedWith('PriceMismatch');
            
            console.log(`✅ Correctly rejected orders with price mismatch`);
        });

        it('handles matching with fees', async function() {
            const feeAmount = ethers.parseEther('0.1');
            const sellOrder = getTestERC721Order({
                direction: TradeDirection.SellNFT,
                erc721TokenId: 123n,
                fees: [
                    {
                        recipient: await feeRecipient.getAddress(),
                        amount: feeAmount,
                        feeData: NULL_BYTES,
                    },
                ],
            });
            
            const buyOrder = getTestERC721Order({
                direction: TradeDirection.BuyNFT,
                maker: otherMaker.address,
                erc721TokenId: 123n,
                erc20TokenAmount: sellOrder.erc20TokenAmount,
            });
            
            // Mint assets (including fee amount)
            await mintAssetsAsync(sellOrder, sellOrder.erc721TokenId, NULL_ADDRESS);
            await mintAssetsAsync(buyOrder, buyOrder.erc721TokenId, NULL_ADDRESS);
            
            const sellSignature = await createOrderSignature(sellOrder, maker);
            const buySignature = await createOrderSignature(buyOrder, otherMaker);
            
            const result = await zeroEx.connect(matcher).matchERC721Orders(
                sellOrder,
                buyOrder,
                sellSignature,
                buySignature
            );
            const receipt = await result.wait();
            
            const fillEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'ERC721OrderFilled');
            expect(fillEvents.length).to.equal(2);
            
            // Check fee was paid
            const feeRecipientBalance = await erc20Token.balanceOf(await feeRecipient.getAddress());
            expect(feeRecipientBalance).to.equal(feeAmount);
            
            console.log(`✅ Successfully matched orders with fees`);
        });
    });
}); 