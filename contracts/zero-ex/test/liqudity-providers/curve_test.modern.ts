import { expect } from 'chai';
import '@nomicfoundation/hardhat-chai-matchers';
const { ethers } = require('hardhat');
import { Contract, MaxUint256 } from 'ethers';
import { randomBytes } from 'crypto';


describe('CurveLiquidityProvider Feature - Modern Tests', function() {
    // Extended timeout for liquidity provider operations
    this.timeout(180000);
    
    let admin: any;
    let taker: any;
    
    // Core contracts
    let lp: Contract;
    let sellToken: Contract;
    let buyToken: Contract;
    let testCurve: Contract;
    
    const RECIPIENT = '0x' + randomBytes(20).toString('hex');
    const REVERTING_SELECTOR = '0xdeaddead';
    const SWAP_SELECTOR = '0x12340000';
    const SWAP_WITH_RETURN_SELECTOR = '0x12340001';
    const ETH_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const SELL_TOKEN_COIN_IDX = 0;
    const BUY_TOKEN_COIN_IDX = 1;
    const ETH_COIN_IDX = 2;
    const ZERO_AMOUNT = 0;
    
    // Use fixed amounts for testing
    const SELL_AMOUNT = ethers.parseEther('1');
    const BUY_AMOUNT = ethers.parseEther('2');
    
    before(async function() {
        console.log('🚀 Setting up CurveLiquidityProvider Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [admin, taker] = signers;
        
        console.log('👤 Admin:', admin.target);
        console.log('👤 Taker:', taker.target);
        console.log('📍 Recipient:', RECIPIENT);
        
        await deployContractsAsync();
        
        console.log('✅ CurveLiquidityProvider test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying Curve contracts...');
        
        // Deploy test tokens
        const TestTokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        sellToken = await TestTokenFactory.deploy('TestToken1', 'TT1', 18);
        await sellToken.waitForDeployment();
        console.log(`✅ SellToken: ${await sellToken.getAddress()}`);
        
        buyToken = await TestTokenFactory.deploy('TestToken2', 'TT2', 18);
        await buyToken.waitForDeployment();
        console.log(`✅ BuyToken: ${await buyToken.getAddress()}`);
        
        // Deploy TestCurve with ETH value
        const TestCurveFactory = await ethers.getContractFactory('TestCurve');
        testCurve = await TestCurveFactory.deploy(
            await sellToken.getAddress(),
            await buyToken.getAddress(),
            BUY_AMOUNT,
            { value: BUY_AMOUNT }
        );
        await testCurve.waitForDeployment();
        console.log(`✅ TestCurve: ${await testCurve.getAddress()}`);
        
        // Deploy CurveLiquidityProvider
        const LiquidityProviderFactory = await ethers.getContractFactory('CurveLiquidityProvider');
        lp = await LiquidityProviderFactory.connect(taker).deploy();
        await lp.waitForDeployment();
        console.log(`✅ CurveLiquidityProvider: ${await lp.getAddress()}`);
    }
    
    interface CurveDataFields {
        curveAddress: string;
        exchangeFunctionSelector: string;
        fromCoinIdx: number;
        toCoinIdx: number;
    }

    async function fundProviderContractAsync(fromCoinIdx: number, amount = SELL_AMOUNT): Promise<void> {
        if (fromCoinIdx === SELL_TOKEN_COIN_IDX) {
            await sellToken.mint(await lp.getAddress(), SELL_AMOUNT);
        } else {
            await taker.sendTransaction({
                to: await lp.getAddress(),
                value: SELL_AMOUNT,
            });
        }
    }

    async function encodeCurveData(fields: Partial<CurveDataFields> = {}): Promise<string> {
        const curveAddress = await testCurve.getAddress();
        const _fields = {
            curveAddress: curveAddress,
            exchangeFunctionSelector: SWAP_SELECTOR,
            fromCoinIdx: SELL_TOKEN_COIN_IDX,
            toCoinIdx: BUY_TOKEN_COIN_IDX,
            ...fields,
        };
        
        // Encode parameters: address(32) + selector(4) + fromIdx(32) + toIdx(32)
        const addressPadded = ethers.zeroPadValue(_fields.curveAddress, 32);
        const selectorPadded = ethers.zeroPadValue(_fields.exchangeFunctionSelector, 32);
        const fromIdxPadded = ethers.zeroPadValue(ethers.toBeHex(_fields.fromCoinIdx), 32);
        const toIdxPadded = ethers.zeroPadValue(ethers.toBeHex(_fields.toCoinIdx), 32);
        
        return ethers.concat([addressPadded, selectorPadded, fromIdxPadded, toIdxPadded]);
    }

    it('can swap ERC20->ERC20', async function() {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        
        const tx = await lp.sellTokenForToken(
            await sellToken.getAddress(),
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            await encodeCurveData()
        );
        
        const receipt = await tx.wait();
        
        // Check balance
        const recipientBalance = await buyToken.balanceOf(RECIPIENT);
        expect(Number(recipientBalance)).to.equal(Number(BUY_AMOUNT));
        
        // Check event was emitted
        const curveCalled = receipt.logs.find((log: any) => log.fragment?.name === 'CurveCalled');
        expect(curveCalled).to.not.be.undefined;
    });

    it('can swap ERC20->ETH', async function() {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        
        const initialBalance = await ethers.provider.getBalance(RECIPIENT);
        
        const tx = await lp.sellTokenForEth(
            await sellToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            await encodeCurveData({ toCoinIdx: ETH_COIN_IDX })
        );
        
        const receipt = await tx.wait();
        
        // Check ETH balance increased
        const finalBalance = await ethers.provider.getBalance(RECIPIENT);
        expect(Number(finalBalance - initialBalance)).to.equal(Number(BUY_AMOUNT));
        
        // Check event was emitted
        const curveCalled = receipt.logs.find((log: any) => log.fragment?.name === 'CurveCalled');
        expect(curveCalled).to.not.be.undefined;
    });

    it('can swap ETH->ERC20', async function() {
        await fundProviderContractAsync(ETH_COIN_IDX);
        
        const tx = await lp.sellEthForToken(
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            await encodeCurveData({ fromCoinIdx: ETH_COIN_IDX })
        );
        
        const receipt = await tx.wait();
        
        // Check token balance
        const recipientBalance = await buyToken.balanceOf(RECIPIENT);
        expect(Number(recipientBalance)).to.equal(Number(BUY_AMOUNT));
        
        // Check event was emitted
        const curveCalled = receipt.logs.find((log: any) => log.fragment?.name === 'CurveCalled');
        expect(curveCalled).to.not.be.undefined;
    });

    it('can swap ETH->ERC20 with attached ETH', async function() {
        const tx = await lp.sellEthForToken(
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            await encodeCurveData({ fromCoinIdx: ETH_COIN_IDX }),
            { value: SELL_AMOUNT }
        );
        
        const receipt = await tx.wait();
        
        // Check token balance
        const recipientBalance = await buyToken.balanceOf(RECIPIENT);
        expect(Number(recipientBalance)).to.equal(Number(BUY_AMOUNT));
        
        // Check event was emitted
        const curveCalled = receipt.logs.find((log: any) => log.fragment?.name === 'CurveCalled');
        expect(curveCalled).to.not.be.undefined;
    });

    it('can swap with a pool that returns bought amount', async function() {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        
        const tx = await lp.sellTokenForToken(
            await sellToken.getAddress(),
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            await encodeCurveData({ exchangeFunctionSelector: SWAP_WITH_RETURN_SELECTOR })
        );
        
        const receipt = await tx.wait();
        
        // Check token balance
        const recipientBalance = await buyToken.balanceOf(RECIPIENT);
        expect(Number(recipientBalance)).to.equal(Number(BUY_AMOUNT));
        
        // Check event was emitted with correct selector
        const curveCalled = receipt.logs.find((log: any) => log.fragment?.name === 'CurveCalled');
        expect(curveCalled).to.not.be.undefined;
    });

    it('reverts if pool reverts', async function() {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        
        await expect(
            lp.sellTokenForToken(
                await sellToken.getAddress(),
                await buyToken.getAddress(),
                RECIPIENT,
                BUY_AMOUNT,
                await encodeCurveData({ exchangeFunctionSelector: REVERTING_SELECTOR })
            )
        ).to.be.revertedWith('TestCurve/REVERT');
    });

    it('reverts if underbought', async function() {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        
        await expect(
            lp.sellTokenForToken(
                await sellToken.getAddress(),
                await buyToken.getAddress(),
                RECIPIENT,
                BUY_AMOUNT + 1n,
                await encodeCurveData()
            )
        ).to.be.revertedWith('CurveLiquidityProvider/UNDERBOUGHT');
    });

    it('reverts if ERC20->ERC20 receives an ETH input token', async function() {
        await fundProviderContractAsync(ETH_COIN_IDX);
        
        await expect(
            lp.sellTokenForToken(
                ETH_TOKEN_ADDRESS,
                await buyToken.getAddress(),
                RECIPIENT,
                BUY_AMOUNT,
                await encodeCurveData()
            )
        ).to.be.revertedWith('CurveLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ERC20 receives an ETH output token', async function() {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        
        await expect(
            lp.sellTokenForToken(
                await sellToken.getAddress(),
                ETH_TOKEN_ADDRESS,
                RECIPIENT,
                BUY_AMOUNT,
                await encodeCurveData()
            )
        ).to.be.revertedWith('CurveLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ETH receives an ETH input token', async function() {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        
        await expect(
            lp.sellTokenForEth(
                ETH_TOKEN_ADDRESS,
                RECIPIENT,
                BUY_AMOUNT,
                await encodeCurveData()
            )
        ).to.be.revertedWith('CurveLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ETH->ERC20 receives an ETH output token', async function() {
        await fundProviderContractAsync(ETH_COIN_IDX);
        
        await expect(
            lp.sellEthForToken(
                ETH_TOKEN_ADDRESS,
                RECIPIENT,
                BUY_AMOUNT,
                await encodeCurveData()
            )
        ).to.be.revertedWith('CurveLiquidityProvider/INVALID_ARGS');
    });

    it('emits a LiquidityProviderFill event', async function() {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        
        const tx = await lp.sellTokenForToken(
            await sellToken.getAddress(),
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            await encodeCurveData()
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