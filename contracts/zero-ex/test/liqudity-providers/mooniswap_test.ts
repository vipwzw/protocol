import { ethers } from "hardhat";
import { constants, getRandomInteger, verifyEventsFromLogs, filterLogs } from '@0x/utils';
import { expect } from 'chai';
import { hexUtils } from '@0x/utils';

import { artifacts } from '../artifacts';
import {
    MooniswapLiquidityProviderContract,
    TestMintableERC20TokenContract,
    TestMooniswapContract,
    TestWethContract,
    TestMintableERC20Token__factory,
    TestWeth__factory,
    TestMooniswap__factory,
    MooniswapLiquidityProvider__factory
} from '../wrappers';

describe('MooniswapLiquidityProvider feature', () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
    } as any;
    let lp: MooniswapLiquidityProviderContract;
    let sellToken: TestMintableERC20TokenContract;
    let buyToken: TestMintableERC20TokenContract;
    let weth: TestWethContract;
    let testMooniswap: TestMooniswapContract;
    let taker: string;
    let mooniswapData: string;
    const RECIPIENT = hexUtils.random(20);
    const ETH_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const { NULL_ADDRESS, ZERO_AMOUNT } = constants;
    const SELL_AMOUNT = getRandomInteger('1e18', '10e18');
    const BUY_AMOUNT = getRandomInteger('1e18', '10e18');

    before(async () => {
        [, taker] = await env.getAccountAddressesAsync();
        env.txDefaults.from = taker;
        
        const signer = await env.provider.getSigner(taker);
        
        const tokenFactories = new Array(2).fill(0).map(() => new TestMintableERC20Token__factory(signer));
        const tokenDeployments = await Promise.all(
            tokenFactories.map(factory => factory.deploy())
        );
        await Promise.all(tokenDeployments.map(token => token.waitForDeployment()));
        [sellToken, buyToken] = tokenDeployments;
        
        const wethFactory = new TestWeth__factory(signer);
        weth = await wethFactory.deploy();
        await weth.waitForDeployment();
        
        const testMooniswapFactory = new TestMooniswap__factory(signer);
        testMooniswap = await testMooniswapFactory.deploy();
        await testMooniswap.waitForDeployment();
        
        const lpFactory = new MooniswapLiquidityProvider__factory(signer);
        lp = await lpFactory.deploy(await weth.getAddress());
        await lp.waitForDeployment();
        
        mooniswapData = hexUtils.leftPad(await testMooniswap.getAddress());
    });

    async function prepareNextSwapFundsAsync(
        sellTokenAddress: string,
        sellAmount: bigint,
        buyTokenAddress: string,
        buyAmount: bigint,
    ): Promise<void> {
        const wethAddr = (await weth.getAddress()).toLowerCase();
        if (sellTokenAddress.toLowerCase() === wethAddr) {
            const signer = await env.provider.getSigner(taker);
            await (await weth.connect(signer).deposit({ value: sellAmount })).wait();
            await (await weth.connect(signer).transfer(await lp.getAddress(), sellAmount)).wait();
        } else if (sellTokenAddress.toLowerCase() === (await sellToken.getAddress()).toLowerCase()) {
            await (await sellToken.mint(await lp.getAddress(), sellAmount)).wait();
        } else {
            const signer = await env.provider.getSigner(taker);
            await (await signer.sendTransaction({ to: await lp.getAddress(), value: sellAmount })).wait();
        }
        await (await testMooniswap.setNextBoughtAmount(buyAmount, {
            value: buyTokenAddress.toLowerCase() === ETH_TOKEN_ADDRESS.toLowerCase() ? buyAmount : ZERO_AMOUNT,
        })).wait();
    }

    it('can swap ERC20->ERC20', async () => {
        await prepareNextSwapFundsAsync(await sellToken.getAddress(), SELL_AMOUNT, await buyToken.getAddress(), BUY_AMOUNT);
        const tx = await lp.sellTokenForToken(await sellToken.getAddress(), await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        const receipt = await tx.wait();
        expect(await buyToken.balanceOf(RECIPIENT)).to.eq(BUY_AMOUNT);
        const mooniContract = testMooniswap as unknown as ethers.Contract;
        verifyEventsFromLogs(
            receipt.logs,
            mooniContract,
            [
                {
                    event: 'MooniswapCalled',
                    args: {
                        value: ZERO_AMOUNT,
                        sellToken: await sellToken.getAddress(),
                        buyToken: await buyToken.getAddress(),
                        sellAmount: SELL_AMOUNT,
                        minBuyAmount: BUY_AMOUNT,
                        referral: NULL_ADDRESS,
                    },
                },
            ],
        );
    });

    it('can swap ERC20->ETH', async () => {
        await prepareNextSwapFundsAsync(await sellToken.getAddress(), SELL_AMOUNT, ETH_TOKEN_ADDRESS, BUY_AMOUNT);
        const tx = await lp.sellTokenForEth(await sellToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        const receipt = await tx.wait();
        expect(await env.provider.getBalance(RECIPIENT)).to.eq(BUY_AMOUNT);
        const mooniContract = testMooniswap as unknown as ethers.Contract;
        verifyEventsFromLogs(
            receipt.logs,
            mooniContract,
            [
                {
                    event: 'MooniswapCalled',
                    args: {
                        value: ZERO_AMOUNT,
                        sellToken: await sellToken.getAddress(),
                        buyToken: NULL_ADDRESS,
                        sellAmount: SELL_AMOUNT,
                        minBuyAmount: BUY_AMOUNT,
                        referral: NULL_ADDRESS,
                    },
                },
            ],
        );
    });

    it('can swap ETH->ERC20', async () => {
        await prepareNextSwapFundsAsync(ETH_TOKEN_ADDRESS, SELL_AMOUNT, await buyToken.getAddress(), BUY_AMOUNT);
        const tx = await lp.sellEthForToken(await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        const receipt = await tx.wait();
        expect(await buyToken.balanceOf(RECIPIENT)).to.eq(BUY_AMOUNT);
        const mooniContract = testMooniswap as unknown as ethers.Contract;
        verifyEventsFromLogs(
            receipt.logs,
            mooniContract,
            [
                {
                    event: 'MooniswapCalled',
                    args: {
                        value: SELL_AMOUNT,
                        sellToken: NULL_ADDRESS,
                        buyToken: await buyToken.getAddress(),
                        sellAmount: SELL_AMOUNT,
                        minBuyAmount: BUY_AMOUNT,
                        referral: NULL_ADDRESS,
                    },
                },
            ],
        );
    });

    it('can swap ETH->ERC20 with attached ETH', async () => {
        // 先设置期望买入数量，再进行一次交易
        await (await testMooniswap.setNextBoughtAmount(BUY_AMOUNT)).wait();
        const tx = await lp.sellEthForToken(await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData, { value: SELL_AMOUNT });
        const receipt = await tx.wait();
        expect(await buyToken.balanceOf(RECIPIENT)).to.eq(BUY_AMOUNT);
        const mooniContract = testMooniswap as unknown as ethers.Contract;
        verifyEventsFromLogs(
            receipt.logs,
            mooniContract,
            [
                {
                    event: 'MooniswapCalled',
                    args: {
                        value: SELL_AMOUNT,
                        sellToken: NULL_ADDRESS,
                        buyToken: await buyToken.getAddress(),
                        sellAmount: SELL_AMOUNT,
                        minBuyAmount: BUY_AMOUNT,
                        referral: NULL_ADDRESS,
                    },
                },
            ],
        );
    });

    it('can swap ERC20->WETH', async () => {
        await prepareNextSwapFundsAsync(
            await sellToken.getAddress(),
            SELL_AMOUNT,
            ETH_TOKEN_ADDRESS,
            BUY_AMOUNT,
        );
        const tx = await lp.sellTokenForToken(await sellToken.getAddress(), await weth.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        const receipt = await tx.wait();
        expect(await sellToken.balanceOf(await testMooniswap.getAddress())).to.eq(SELL_AMOUNT);
        expect(await weth.balanceOf(RECIPIENT)).to.eq(BUY_AMOUNT);
        const mooniContract = testMooniswap as unknown as ethers.Contract;
        verifyEventsFromLogs(
            receipt.logs,
            mooniContract,
            [
                {
                    event: 'MooniswapCalled',
                    args: {
                        value: ZERO_AMOUNT,
                        sellToken: await sellToken.getAddress(),
                        buyToken: NULL_ADDRESS,
                        sellAmount: SELL_AMOUNT,
                        minBuyAmount: BUY_AMOUNT,
                        referral: NULL_ADDRESS,
                    },
                },
            ],
        );
    });

    it('can swap WETH->ERC20', async () => {
        await prepareNextSwapFundsAsync(await weth.getAddress(), SELL_AMOUNT, await buyToken.getAddress(), BUY_AMOUNT);
        const tx = await lp.sellTokenForToken(await weth.getAddress(), await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        const receipt = await tx.wait();
        expect(await env.provider.getBalance(await testMooniswap.getAddress())).to.eq(SELL_AMOUNT);
        expect(await buyToken.balanceOf(RECIPIENT)).to.eq(BUY_AMOUNT);
        const mooniContract = testMooniswap as unknown as ethers.Contract;
        verifyEventsFromLogs(
            receipt.logs,
            mooniContract,
            [
                {
                    event: 'MooniswapCalled',
                    args: {
                        value: SELL_AMOUNT,
                        sellToken: NULL_ADDRESS,
                        buyToken: await buyToken.getAddress(),
                        sellAmount: SELL_AMOUNT,
                        minBuyAmount: BUY_AMOUNT,
                        referral: NULL_ADDRESS,
                    },
                },
            ],
        );
    });

    it('reverts if pool reverts', async () => {
        await prepareNextSwapFundsAsync(await sellToken.getAddress(), SELL_AMOUNT, await buyToken.getAddress(), BUY_AMOUNT);
        await (await testMooniswap.setNextBoughtAmount(BUY_AMOUNT - 1n)).wait();
        await expect(lp.sellTokenForToken(await sellToken.getAddress(), await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData)).to.be.revertedWith('UNDERBOUGHT');
    });

    it('reverts if ERC20->ERC20 is the same token', async () => {
        await expect(
            lp.sellTokenForToken(await sellToken.getAddress(), await sellToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData)
        ).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ERC20 receives an ETH input token', async () => {
        await expect(
            lp.sellTokenForToken(ETH_TOKEN_ADDRESS, await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData)
        ).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ERC20 receives an ETH output token', async () => {
        await expect(
            lp.sellTokenForToken(await sellToken.getAddress(), ETH_TOKEN_ADDRESS, RECIPIENT, BUY_AMOUNT, mooniswapData)
        ).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ETH receives an ETH input token', async () => {
        await expect(
            lp.sellTokenForEth(ETH_TOKEN_ADDRESS, RECIPIENT, BUY_AMOUNT, mooniswapData)
        ).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ETH->ERC20 receives an ETH output token', async () => {
        await expect(
            lp.sellEthForToken(ETH_TOKEN_ADDRESS, RECIPIENT, BUY_AMOUNT, mooniswapData)
        ).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('emits a LiquidityProviderFill event', async () => {
        await prepareNextSwapFundsAsync(await sellToken.getAddress(), SELL_AMOUNT, await buyToken.getAddress(), BUY_AMOUNT);
        const receipt = await (await lp.sellTokenForToken(await sellToken.getAddress(), await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData)).wait();
        const parsed = filterLogs(receipt.logs, (lp as unknown as ethers.Contract), 'LiquidityProviderFill');
        expect(parsed.length).to.equal(1);
        const args = parsed[0].args as any;
        expect(args.inputToken).to.equal(await sellToken.getAddress());
        expect(args.outputToken).to.equal(await buyToken.getAddress());
        expect(args.sellAmount ?? args.inputTokenAmount).to.equal(SELL_AMOUNT);
        expect(args.boughtAmount ?? args.outputTokenAmount).to.equal(BUY_AMOUNT);
        expect((args.sourceId as string)).to.equal(hexUtils.rightPad(hexUtils.toHex(Buffer.from('Mooniswap'))));
        expect(args.sourceAddress).to.equal(await testMooniswap.getAddress());
        expect(String(args.sender).toLowerCase()).to.equal(String(taker).toLowerCase());
        expect(String(args.recipient).toLowerCase()).to.equal(String(RECIPIENT).toLowerCase());
    });
});
