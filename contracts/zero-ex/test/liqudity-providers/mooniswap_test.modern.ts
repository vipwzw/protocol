import { expect } from 'chai';
import '@nomicfoundation/hardhat-chai-matchers';
const { ethers } = require('hardhat');
import { Contract, MaxUint256 } from 'ethers';
import { randomBytes } from 'crypto';


describe('MooniswapLiquidityProvider Feature - Modern Tests', function() {
    // Extended timeout for liquidity provider operations
    this.timeout(180000);
    
    let admin: any;
    let taker: any;
    
    // Core contracts
    let lp: Contract;
    let sellToken: Contract;
    let buyToken: Contract;
    let weth: Contract;
    let testMooniswap: Contract;
    let mooniswapData: string;
    
    const RECIPIENT = '0x' + randomBytes(20).toString('hex');
    const ETH_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    const ZERO_AMOUNT = 0;
    
    // Use fixed amounts for testing
    const SELL_AMOUNT = ethers.parseEther('1');
    const BUY_AMOUNT = ethers.parseEther('2');
    
    before(async function() {
        console.log('🚀 Setting up MooniswapLiquidityProvider Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [admin, taker] = signers;
        
        console.log('👤 Admin:', admin.target);
        console.log('👤 Taker:', taker.target);
        console.log('📍 Recipient:', RECIPIENT);
        
        await deployContractsAsync();
        
        console.log('✅ MooniswapLiquidityProvider test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying Mooniswap contracts...');
        
        // Deploy test tokens
        const TestTokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        sellToken = await TestTokenFactory.deploy('TestToken1', 'TT1', 18);
        await sellToken.waitForDeployment();
        console.log(`✅ SellToken: ${await sellToken.getAddress()}`);
        
        buyToken = await TestTokenFactory.deploy('TestToken2', 'TT2', 18);
        await buyToken.waitForDeployment();
        console.log(`✅ BuyToken: ${await buyToken.getAddress()}`);
        
        // Deploy WETH
        const WethFactory = await ethers.getContractFactory('TestWeth');
        weth = await WethFactory.deploy();
        await weth.waitForDeployment();
        console.log(`✅ WETH: ${await weth.getAddress()}`);
        
        // Deploy TestMooniswap
        const TestMooniswapFactory = await ethers.getContractFactory('TestMooniswap');
        testMooniswap = await TestMooniswapFactory.deploy();
        await testMooniswap.waitForDeployment();
        console.log(`✅ TestMooniswap: ${await testMooniswap.getAddress()}`);
        
        // Deploy MooniswapLiquidityProvider
        const LiquidityProviderFactory = await ethers.getContractFactory('MooniswapLiquidityProvider');
        lp = await LiquidityProviderFactory.connect(taker).deploy(await weth.getAddress());
        await lp.waitForDeployment();
        console.log(`✅ MooniswapLiquidityProvider: ${await lp.getAddress()}`);
        
        // Prepare mooniswap data
        mooniswapData = ethers.zeroPadValue(await testMooniswap.getAddress(), 32);
    }

    async function prepareNextSwapFundsAsync(
        sellTokenAddress: string,
        sellAmount: bigint,
        buyTokenAddress: string,
        buyAmount: bigint,
    ): Promise<void> {
        const wethAddress = await weth.getAddress();
        const lpAddress = await lp.getAddress();
        
        if (sellTokenAddress.toLowerCase() === wethAddress.toLowerCase()) {
            const wethWithTaker = weth.connect(taker) as any;
            await wethWithTaker.deposit({ value: sellAmount });
            await wethWithTaker.transfer(lpAddress, sellAmount);
        } else if (sellTokenAddress.toLowerCase() === (await sellToken.getAddress()).toLowerCase()) {
            await sellToken.mint(lpAddress, sellAmount);
        } else {
            await taker.sendTransaction({
                to: lpAddress,
                value: sellAmount,
            });
        }
        
        const ethValue = buyTokenAddress.toLowerCase() === ETH_TOKEN_ADDRESS.toLowerCase() ? buyAmount : 0;
        await testMooniswap.setNextBoughtAmount(buyAmount, { value: ethValue });
    }

    it('can swap ERC20->ERC20', async function() {
        await prepareNextSwapFundsAsync(
            await sellToken.getAddress(),
            SELL_AMOUNT,
            await buyToken.getAddress(),
            BUY_AMOUNT
        );
        
        const tx = await lp.sellTokenForToken(
            await sellToken.getAddress(),
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            mooniswapData
        );
        
        const receipt = await tx.wait();
        
        // Check balance
        const recipientBalance = await buyToken.balanceOf(RECIPIENT);
        expect(Number(recipientBalance)).to.equal(Number(BUY_AMOUNT));
        
        // Check event was emitted
        const mooniswapCalled = receipt.logs.find((log: any) => log.fragment?.name === 'MooniswapCalled');
        expect(mooniswapCalled).to.not.be.undefined;
    });

    it('can swap ERC20->ETH', async function() {
        await prepareNextSwapFundsAsync(
            await sellToken.getAddress(),
            SELL_AMOUNT,
            ETH_TOKEN_ADDRESS,
            BUY_AMOUNT
        );
        
        const initialBalance = await ethers.provider.getBalance(RECIPIENT);
        
        const tx = await lp.sellTokenForEth(
            await sellToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            mooniswapData
        );
        
        const receipt = await tx.wait();
        
        // Check ETH balance increased
        const finalBalance = await ethers.provider.getBalance(RECIPIENT);
        expect(Number(finalBalance - initialBalance)).to.equal(Number(BUY_AMOUNT));
        
        // Check event was emitted
        const mooniswapCalled = receipt.logs.find((log: any) => log.fragment?.name === 'MooniswapCalled');
        expect(mooniswapCalled).to.not.be.undefined;
    });

    it('can swap ETH->ERC20', async function() {
        await prepareNextSwapFundsAsync(
            ETH_TOKEN_ADDRESS,
            SELL_AMOUNT,
            await buyToken.getAddress(),
            BUY_AMOUNT
        );
        
        const tx = await lp.sellEthForToken(
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            mooniswapData
        );
        
        const receipt = await tx.wait();
        
        // Check token balance
        const recipientBalance = await buyToken.balanceOf(RECIPIENT);
        expect(Number(recipientBalance)).to.equal(Number(BUY_AMOUNT));
        
        // Check event was emitted
        const mooniswapCalled = receipt.logs.find((log: any) => log.fragment?.name === 'MooniswapCalled');
        expect(mooniswapCalled).to.not.be.undefined;
    });

    it('can swap ETH->ERC20 with attached ETH', async function() {
        await testMooniswap.setNextBoughtAmount(BUY_AMOUNT);
        
        const tx = await lp.sellEthForToken(
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            mooniswapData,
            { value: SELL_AMOUNT }
        );
        
        const receipt = await tx.wait();
        
        // Check token balance
        const recipientBalance = await buyToken.balanceOf(RECIPIENT);
        expect(Number(recipientBalance)).to.equal(Number(BUY_AMOUNT));
        
        // Check event was emitted
        const mooniswapCalled = receipt.logs.find((log: any) => log.fragment?.name === 'MooniswapCalled');
        expect(mooniswapCalled).to.not.be.undefined;
    });

    it('can swap ERC20->WETH', async function() {
        await prepareNextSwapFundsAsync(
            await sellToken.getAddress(),
            SELL_AMOUNT,
            ETH_TOKEN_ADDRESS, // Mooni contract holds ETH
            BUY_AMOUNT
        );
        
        const tx = await lp.sellTokenForToken(
            await sellToken.getAddress(),
            await weth.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            mooniswapData
        );
        
        const receipt = await tx.wait();
        
        // Check balances
        const sellTokenBalance = await sellToken.balanceOf(await testMooniswap.getAddress());
        expect(Number(sellTokenBalance)).to.equal(Number(SELL_AMOUNT));
        
        const wethBalance = await weth.balanceOf(RECIPIENT);
        expect(Number(wethBalance)).to.equal(Number(BUY_AMOUNT));
        
        // Check event was emitted
        const mooniswapCalled = receipt.logs.find((log: any) => log.fragment?.name === 'MooniswapCalled');
        expect(mooniswapCalled).to.not.be.undefined;
    });

    it('can swap WETH->ERC20', async function() {
        await prepareNextSwapFundsAsync(
            await weth.getAddress(),
            SELL_AMOUNT,
            await buyToken.getAddress(),
            BUY_AMOUNT
        );
        
        const tx = await lp.sellTokenForToken(
            await weth.getAddress(),
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            mooniswapData
        );
        
        const receipt = await tx.wait();
        
        // Check balances
        const ethBalance = await ethers.provider.getBalance(await testMooniswap.getAddress());
        expect(Number(ethBalance)).to.equal(Number(SELL_AMOUNT));
        
        const buyTokenBalance = await buyToken.balanceOf(RECIPIENT);
        expect(Number(buyTokenBalance)).to.equal(Number(BUY_AMOUNT));
        
        // Check event was emitted
        const mooniswapCalled = receipt.logs.find((log: any) => log.fragment?.name === 'MooniswapCalled');
        expect(mooniswapCalled).to.not.be.undefined;
    });

    it('reverts if pool reverts', async function() {
        await prepareNextSwapFundsAsync(
            await sellToken.getAddress(),
            SELL_AMOUNT,
            await buyToken.getAddress(),
            BUY_AMOUNT
        );
        
        await testMooniswap.setNextBoughtAmount(BUY_AMOUNT - 1n);
        
        await expect(
            lp.sellTokenForToken(
                await sellToken.getAddress(),
                await buyToken.getAddress(),
                RECIPIENT,
                BUY_AMOUNT,
                mooniswapData
            )
        ).to.be.revertedWith('UNDERBOUGHT');
    });

    it('reverts if ERC20->ERC20 is the same token', async function() {
        await expect(
            lp.sellTokenForToken(
                await sellToken.getAddress(),
                await sellToken.getAddress(),
                RECIPIENT,
                BUY_AMOUNT,
                mooniswapData
            )
        ).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ERC20 receives an ETH input token', async function() {
        await expect(
            lp.sellTokenForToken(
                ETH_TOKEN_ADDRESS,
                await buyToken.getAddress(),
                RECIPIENT,
                BUY_AMOUNT,
                mooniswapData
            )
        ).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ERC20 receives an ETH output token', async function() {
        await expect(
            lp.sellTokenForToken(
                await sellToken.getAddress(),
                ETH_TOKEN_ADDRESS,
                RECIPIENT,
                BUY_AMOUNT,
                mooniswapData
            )
        ).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ETH receives an ETH input token', async function() {
        await expect(
            lp.sellTokenForEth(
                ETH_TOKEN_ADDRESS,
                RECIPIENT,
                BUY_AMOUNT,
                mooniswapData
            )
        ).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ETH->ERC20 receives an ETH output token', async function() {
        await expect(
            lp.sellEthForToken(
                ETH_TOKEN_ADDRESS,
                RECIPIENT,
                BUY_AMOUNT,
                mooniswapData
            )
        ).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('emits a LiquidityProviderFill event', async function() {
        await prepareNextSwapFundsAsync(
            await sellToken.getAddress(),
            SELL_AMOUNT,
            await buyToken.getAddress(),
            BUY_AMOUNT
        );
        
        const tx = await lp.sellTokenForToken(
            await sellToken.getAddress(),
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            mooniswapData
        );
        
        const receipt = await tx.wait();
        
        // Check LiquidityProviderFill event was emitted
        const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'LiquidityProviderFill');
        expect(fillEvent).to.not.be.undefined;
        
        if (fillEvent) {
            expect(fillEvent.args.inputToken).to.equal(await sellToken.getAddress());
            expect(fillEvent.args.outputToken).to.equal(await buyToken.getAddress());
            expect(fillEvent.args.inputTokenAmount).to.equal(SELL_AMOUNT);
            expect(fillEvent.args.outputTokenAmount).to.equal(BUY_AMOUNT);
            expect(fillEvent.args.sender).to.equal(taker.target);
            expect(fillEvent.args.recipient).to.equal(RECIPIENT);
        }
    });
}); 