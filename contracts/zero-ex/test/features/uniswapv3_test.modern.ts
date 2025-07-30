import { expect } from 'chai';
import '@nomicfoundation/hardhat-chai-matchers';
const { ethers } = require('hardhat');
import { Contract, MaxUint256 } from 'ethers';
import { randomBytes } from 'crypto';

describe('UniswapV3Feature - Modern Tests', function () {
    // Extended timeout for Uniswap operations
    this.timeout(180000);

    let taker: any;
    let uniFactory: any;
    let feature: any;
    let weth: any;
    let tokens: any[];
    let noEthRecipient: any;

    const POOL_FEE = 1234;
    const MAX_SUPPLY = ethers.parseEther('10');
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    const ZERO_AMOUNT = 0n;
    const MAX_UINT256 = MaxUint256;

    let sellAmount: bigint;
    let buyAmount: bigint;
    let recipient: string;

    before(async function () {
        console.log('🚀 Setting up UniswapV3Feature Test...');

        // Get signers
        const signers = await ethers.getSigners();
        [, taker] = signers;

        // Generate random amounts
        sellAmount = getRandomPortion(MAX_SUPPLY);
        buyAmount = getRandomPortion(MAX_SUPPLY);
        recipient = generateRandomAddress();

        console.log('👤 Taker:', taker.target);
        console.log('📍 Recipient:', recipient);
        console.log(`💰 Sell amount: ${ethers.formatEther(sellAmount.toString())} ETH`);
        console.log(`💰 Buy amount: ${ethers.formatEther(buyAmount.toString())} ETH`);

        await deployContractsAsync();

        console.log('✅ UniswapV3Feature test environment ready!');
    });

    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying UniswapV3Feature contracts...');

        // Deploy WETH
        const WethFactory = await ethers.getContractFactory('TestWeth');
        weth = await WethFactory.deploy();
        await weth.waitForDeployment();
        console.log(`✅ WETH: ${await weth.getAddress()}`);

        // Deploy test tokens
        const TokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        tokens = [];
        for (let i = 0; i < 3; i++) {
            const token = await TokenFactory.deploy('TestToken' + i, 'TT' + i, 18);
            await token.waitForDeployment();
            tokens.push(token);
            console.log(`✅ Token${i}: ${await token.getAddress()}`);
        }

        // Deploy no ETH recipient test contract
        const NoEthRecipientFactory = await ethers.getContractFactory('TestNoEthRecipient');
        noEthRecipient = await NoEthRecipientFactory.deploy();
        await noEthRecipient.waitForDeployment();
        console.log(`✅ NoEthRecipient: ${await noEthRecipient.getAddress()}`);

        // Deploy Uniswap V3 factory
        const UniFactoryFactory = await ethers.getContractFactory('TestUniswapV3Factory');
        uniFactory = await UniFactoryFactory.deploy();
        await uniFactory.waitForDeployment();
        console.log(`✅ UniswapV3Factory: ${await uniFactory.getAddress()}`);

        // Deploy UniswapV3 feature
        const FeatureFactory = await ethers.getContractFactory('TestUniswapV3Feature');
        const poolInitCodeHash = await uniFactory.POOL_INIT_CODE_HASH();
        feature = await FeatureFactory.deploy(await weth.getAddress(), await uniFactory.getAddress(), poolInitCodeHash);
        await feature.waitForDeployment();
        console.log(`✅ UniswapV3Feature: ${await feature.getAddress()}`);

        // Approve tokens for feature
        const allTokens = [...tokens, weth];
        for (const token of allTokens) {
            await token.connect(taker).approve(await feature.getAddress(), MAX_UINT256);
        }
        console.log(`✅ Approved all tokens for feature`);
    }

    function generateRandomAddress(): string {
        return '0x' + randomBytes(20).toString('hex');
    }

    function getRandomPortion(max: bigint): bigint {
        const randomFactor = Math.floor(Math.random() * 80) + 10; // 10-90%
        return (max * BigInt(randomFactor)) / 100n;
    }

    function isWethContract(token: any): boolean {
        // Simple check based on contract interface
        return token === weth;
    }

    async function mintToAsync(token: any, owner: string, amount: bigint): Promise<void> {
        if (isWethContract(token)) {
            await token.depositTo(owner, { value: amount });
        } else {
            await token.mint(owner, amount);
        }
    }

    async function createPoolAsync(token0: any, token1: any, balance0: bigint, balance1: bigint): Promise<any> {
        const tx = await uniFactory.createPool(await token0.getAddress(), await token1.getAddress(), POOL_FEE);
        const receipt = await tx.wait();

        // Find pool created event
        const poolCreatedEvent = receipt.logs.find((log: any) => log.fragment?.name === 'PoolCreated');
        if (!poolCreatedEvent) {
            throw new Error('Pool created event not found');
        }

        const poolAddress = poolCreatedEvent.args.pool;
        const PoolFactory = await ethers.getContractFactory('TestUniswapV3Pool');
        const pool = PoolFactory.attach(poolAddress);

        await mintToAsync(token0, poolAddress, balance0);
        await mintToAsync(token1, poolAddress, balance1);

        return pool;
    }

    function encodePath(tokens_: any[]): string {
        const elems: string[] = [];
        tokens_.forEach((t, i) => {
            if (i > 0) {
                // Add fee (3 bytes)
                elems.push(ethers.zeroPadValue(ethers.toBeHex(POOL_FEE), 3));
            }
            // Add token address (20 bytes)
            elems.push(ethers.zeroPadValue(t.getAddress ? t.getAddress() : t.target, 20));
        });
        return ethers.concat(elems);
    }

    describe('sellTokenForTokenToUniswapV3()', function () {
        it('1-hop swap', async function () {
            const [sellToken, buyToken] = tokens;
            const pool = await createPoolAsync(sellToken, buyToken, ZERO_AMOUNT, buyAmount);

            await mintToAsync(sellToken, taker.target, sellAmount);

            await feature
                .connect(taker)
                .sellTokenForTokenToUniswapV3(
                    await encodePath([sellToken, buyToken]),
                    sellAmount,
                    buyAmount,
                    recipient,
                );

            // Test pools always ask for full sell amount and pay entire balance
            const takerBalance = await sellToken.balanceOf(taker.target);
            const recipientBalance = await buyToken.balanceOf(recipient);
            const poolBalance = await sellToken.balanceOf(await pool.getAddress());

            expect(Number(takerBalance)).to.equal(Number(0n));
            expect(Number(recipientBalance)).to.equal(Number(buyAmount));
            expect(Number(poolBalance)).to.equal(Number(sellAmount));

            console.log(
                `✅ 1-hop swap: ${ethers.formatEther(sellAmount.toString())} → ${ethers.formatEther(buyAmount.toString())}`,
            );
        });

        it('2-hop swap', async function () {
            const pools = [
                await createPoolAsync(tokens[0], tokens[1], ZERO_AMOUNT, buyAmount),
                await createPoolAsync(tokens[1], tokens[2], ZERO_AMOUNT, buyAmount),
            ];

            await mintToAsync(tokens[0], taker.target, sellAmount);

            await feature
                .connect(taker)
                .sellTokenForTokenToUniswapV3(await encodePath(tokens), sellAmount, buyAmount, recipient);

            // Test pools always ask for full sell amount and pay entire balance
            expect(await tokens[0].balanceOf(taker.target)).to.equal(0n);
            expect(await tokens[2].balanceOf(recipient)).to.equal(buyAmount);
            expect(await tokens[0].balanceOf(await pools[0].getAddress())).to.equal(sellAmount);
            expect(await tokens[1].balanceOf(await pools[1].getAddress())).to.equal(buyAmount);

            console.log(`✅ 2-hop swap through ${tokens.length} tokens`);
        });

        it('1-hop underbuy fails', async function () {
            const [sellToken, buyToken] = tokens;
            await createPoolAsync(sellToken, buyToken, ZERO_AMOUNT, buyAmount - 1n);

            await mintToAsync(sellToken, taker.target, sellAmount);

            await expect(
                feature
                    .connect(taker)
                    .sellTokenForTokenToUniswapV3(
                        await encodePath([sellToken, buyToken]),
                        sellAmount,
                        buyAmount,
                        recipient,
                    ),
            ).to.be.revertedWith('UniswapV3Feature/UNDERBOUGHT');

            console.log(`✅ Correctly rejected underbuy scenario`);
        });

        it('2-hop underbuy fails', async function () {
            await createPoolAsync(tokens[0], tokens[1], ZERO_AMOUNT, buyAmount);
            await createPoolAsync(tokens[1], tokens[2], ZERO_AMOUNT, buyAmount - 1n);

            await mintToAsync(tokens[0], taker.target, sellAmount);

            await expect(
                feature
                    .connect(taker)
                    .sellTokenForTokenToUniswapV3(await encodePath(tokens), sellAmount, buyAmount, recipient),
            ).to.be.revertedWith('UniswapV3Feature/UNDERBOUGHT');

            console.log(`✅ Correctly rejected 2-hop underbuy scenario`);
        });

        it('null recipient is sender', async function () {
            const [sellToken, buyToken] = tokens;
            await createPoolAsync(sellToken, buyToken, ZERO_AMOUNT, buyAmount);

            await mintToAsync(sellToken, taker.target, sellAmount);

            await feature
                .connect(taker)
                .sellTokenForTokenToUniswapV3(
                    await encodePath([sellToken, buyToken]),
                    sellAmount,
                    buyAmount,
                    NULL_ADDRESS,
                );

            // Test pools always ask for full sell amount and pay entire balance
            const takerBuyTokenBalance = await buyToken.balanceOf(taker.target);
            expect(Number(takerBuyTokenBalance)).to.equal(Number(buyAmount));

            console.log(`✅ Null recipient correctly defaulted to sender`);
        });
    });

    describe('sellEthForTokenToUniswapV3()', function () {
        it('1-hop swap', async function () {
            const [buyToken] = tokens;
            const pool = await createPoolAsync(weth, buyToken, ZERO_AMOUNT, buyAmount);

            await feature
                .connect(taker)
                .sellEthForTokenToUniswapV3(await encodePath([weth, buyToken]), buyAmount, recipient, {
                    value: sellAmount,
                });

            // Test pools always ask for full sell amount and pay entire balance
            const recipientBalance = await buyToken.balanceOf(recipient);
            const poolWethBalance = await weth.balanceOf(await pool.getAddress());

            expect(Number(recipientBalance)).to.equal(Number(buyAmount));
            expect(Number(poolWethBalance)).to.equal(Number(sellAmount));

            console.log(
                `✅ ETH→Token swap: ${ethers.formatEther(sellAmount.toString())} ETH → ${ethers.formatEther(buyAmount.toString())} tokens`,
            );
        });

        it('null recipient is sender', async function () {
            const [buyToken] = tokens;
            const pool = await createPoolAsync(weth, buyToken, ZERO_AMOUNT, buyAmount);

            await feature
                .connect(taker)
                .sellEthForTokenToUniswapV3(await encodePath([weth, buyToken]), buyAmount, NULL_ADDRESS, {
                    value: sellAmount,
                });

            // Test pools always ask for full sell amount and pay entire balance
            const takerBalance = await buyToken.balanceOf(taker.target);
            const poolWethBalance = await weth.balanceOf(await pool.getAddress());

            expect(Number(takerBalance)).to.equal(Number(buyAmount));
            expect(Number(poolWethBalance)).to.equal(Number(sellAmount));

            console.log(`✅ ETH→Token with null recipient correctly defaulted to sender`);
        });
    });

    describe('sellTokenForEthToUniswapV3()', function () {
        it('1-hop swap', async function () {
            const [sellToken] = tokens;
            const pool = await createPoolAsync(sellToken, weth, ZERO_AMOUNT, buyAmount);

            await mintToAsync(sellToken, taker.target, sellAmount);

            const initialEthBalance = await ethers.provider.getBalance(recipient);

            await feature
                .connect(taker)
                .sellTokenForEthToUniswapV3(await encodePath([sellToken, weth]), sellAmount, buyAmount, recipient);

            // Test pools always ask for full sell amount and pay entire balance
            const takerTokenBalance = await sellToken.balanceOf(taker.target);
            const finalEthBalance = await ethers.provider.getBalance(recipient);
            const poolTokenBalance = await sellToken.balanceOf(await pool.getAddress());

            expect(Number(takerTokenBalance)).to.equal(Number(0n));
            expect(Number(finalEthBalance - initialEthBalance)).to.equal(Number(buyAmount));
            expect(Number(poolTokenBalance)).to.equal(Number(sellAmount));

            console.log(
                `✅ Token→ETH swap: ${ethers.formatEther(sellAmount.toString())} tokens → ${ethers.formatEther(buyAmount.toString())} ETH`,
            );
        });

        it('null recipient is sender', async function () {
            const [sellToken] = tokens;
            const pool = await createPoolAsync(sellToken, weth, ZERO_AMOUNT, buyAmount);

            await mintToAsync(sellToken, taker.target, sellAmount);

            const initialEthBalance = await ethers.provider.getBalance(taker.target);

            // Use zero gas price to make balance calculations easier
            await feature
                .connect(taker)
                .sellTokenForEthToUniswapV3(await encodePath([sellToken, weth]), sellAmount, buyAmount, NULL_ADDRESS, {
                    gasPrice: 0,
                });

            // Test pools always ask for full sell amount and pay entire balance
            const finalEthBalance = await ethers.provider.getBalance(taker.target);
            const poolTokenBalance = await sellToken.balanceOf(await pool.getAddress());

            expect(Number(finalEthBalance - initialEthBalance)).to.equal(Number(buyAmount));
            expect(Number(poolTokenBalance)).to.equal(Number(sellAmount));

            console.log(`✅ Token→ETH with null recipient correctly defaulted to sender`);
        });

        it('fails if recipient cannot receive ETH', async function () {
            const [sellToken] = tokens;
            await createPoolAsync(sellToken, weth, ZERO_AMOUNT, buyAmount);

            await mintToAsync(sellToken, taker.target, sellAmount);

            await expect(
                feature
                    .connect(taker)
                    .sellTokenForEthToUniswapV3(
                        await encodePath([sellToken, weth]),
                        sellAmount,
                        buyAmount,
                        await noEthRecipient.getAddress(),
                    ),
            ).to.be.reverted; // Should revert when trying to send ETH to non-payable contract

            console.log(`✅ Correctly failed when recipient cannot receive ETH`);
        });
    });
});
