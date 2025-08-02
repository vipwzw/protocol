import { ethers } from "ethers";
import { blockchainTests, constants, expect, getRandomInteger, verifyEventsFromLogs } from '@0x/test-utils';
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

blockchainTests('MooniswapLiquidityProvider feature', env => {
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
        if (sellTokenAddress.toLowerCase() === await weth.getAddress().toLowerCase()) {
            await weth.deposit()({
                from: taker,
                value: sellAmount,
            });
            await weth.transfer(await lp.getAddress(), sellAmount)({ from: taker });
        } else if (sellTokenAddress.toLowerCase() === await sellToken.getAddress().toLowerCase()) {
            await sellToken.mint(await lp.getAddress(), sellAmount)();
        } else {
            await await env.web3Wrapper(
                await env.web3Wrapper.sendTransactionAsync({
                    to: await lp.getAddress(),
                    from: taker,
                    value: sellAmount,
                }),
            );
        }
        await testMooniswap.setNextBoughtAmount(buyAmount)({
            value: buyTokenAddress.toLowerCase() === ETH_TOKEN_ADDRESS.toLowerCase() ? buyAmount : ZERO_AMOUNT,
        });
    }

    it('can swap ERC20->ERC20', async () => {
        await prepareNextSwapFundsAsync(await sellToken.getAddress(), SELL_AMOUNT, await buyToken.getAddress(), BUY_AMOUNT);
        const call = lp.sellTokenForToken(await sellToken.getAddress(), await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        const boughtAmount = await call();
        const { logs } = await call();
        expect(boughtAmount).to.eq(BUY_AMOUNT);
        expect(await buyToken.balanceOf(RECIPIENT)()).to.eq(BUY_AMOUNT);
        verifyEventsFromLogs(
            logs,
            [
                {
                    value: ZERO_AMOUNT,
                    sellToken: await sellToken.getAddress(),
                    buyToken: await buyToken.getAddress(),
                    sellAmount: SELL_AMOUNT,
                    minBuyAmount: BUY_AMOUNT,
                    referral: NULL_ADDRESS,
                },
            ],
            'MooniswapCalled',
        );
    });

    it('can swap ERC20->ETH', async () => {
        await prepareNextSwapFundsAsync(await sellToken.getAddress(), SELL_AMOUNT, ETH_TOKEN_ADDRESS, BUY_AMOUNT);
        const call = lp.sellTokenForEth(await sellToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        const boughtAmount = await call();
        const { logs } = await call();
        expect(boughtAmount).to.eq(BUY_AMOUNT);
        expect(await env.web3Wrapper.getBalanceInWeiAsync(RECIPIENT)).to.eq(BUY_AMOUNT);
        verifyEventsFromLogs(
            logs,
            [
                {
                    value: ZERO_AMOUNT,
                    sellToken: await sellToken.getAddress(),
                    buyToken: NULL_ADDRESS,
                    sellAmount: SELL_AMOUNT,
                    minBuyAmount: BUY_AMOUNT,
                    referral: NULL_ADDRESS,
                },
            ],
            'MooniswapCalled',
        );
    });

    it('can swap ETH->ERC20', async () => {
        await prepareNextSwapFundsAsync(ETH_TOKEN_ADDRESS, SELL_AMOUNT, await buyToken.getAddress(), BUY_AMOUNT);
        const call = lp.sellEthForToken(await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        const boughtAmount = await call();
        const { logs } = await call();
        expect(boughtAmount).to.eq(BUY_AMOUNT);
        expect(await buyToken.balanceOf(RECIPIENT)()).to.eq(BUY_AMOUNT);
        verifyEventsFromLogs(
            logs,
            [
                {
                    value: SELL_AMOUNT,
                    sellToken: NULL_ADDRESS,
                    buyToken: await buyToken.getAddress(),
                    sellAmount: SELL_AMOUNT,
                    minBuyAmount: BUY_AMOUNT,
                    referral: NULL_ADDRESS,
                },
            ],
            'MooniswapCalled',
        );
    });

    it('can swap ETH->ERC20 with attached ETH', async () => {
        await testMooniswap.setNextBoughtAmount(BUY_AMOUNT)();
        const call = lp.sellEthForToken(await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        const boughtAmount = await call({ value: SELL_AMOUNT });
        const { logs } = await call({ value: SELL_AMOUNT });
        expect(boughtAmount).to.eq(BUY_AMOUNT);
        expect(await buyToken.balanceOf(RECIPIENT)()).to.eq(BUY_AMOUNT);
        verifyEventsFromLogs(
            logs,
            [
                {
                    value: SELL_AMOUNT,
                    sellToken: NULL_ADDRESS,
                    buyToken: await buyToken.getAddress(),
                    sellAmount: SELL_AMOUNT,
                    minBuyAmount: BUY_AMOUNT,
                    referral: NULL_ADDRESS,
                },
            ],
            'MooniswapCalled',
        );
    });

    it('can swap ERC20->WETH', async () => {
        await prepareNextSwapFundsAsync(
            await sellToken.getAddress(),
            SELL_AMOUNT,
            ETH_TOKEN_ADDRESS, // Mooni contract holds ETH.
            BUY_AMOUNT,
        );
        const call = lp.sellTokenForToken(await sellToken.getAddress(), await weth.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        const boughtAmount = await call();
        const { logs } = await call();
        expect(boughtAmount).to.eq(BUY_AMOUNT);
        expect(await sellToken.balanceOf(testMooniswap.address)()).to.eq(SELL_AMOUNT);
        expect(await weth.balanceOf(RECIPIENT)()).to.eq(BUY_AMOUNT);
        verifyEventsFromLogs(
            logs,
            [
                {
                    value: ZERO_AMOUNT,
                    sellToken: await sellToken.getAddress(),
                    buyToken: NULL_ADDRESS,
                    sellAmount: SELL_AMOUNT,
                    minBuyAmount: BUY_AMOUNT,
                    referral: NULL_ADDRESS,
                },
            ],
            'MooniswapCalled',
        );
    });

    it('can swap WETH->ERC20', async () => {
        await prepareNextSwapFundsAsync(await weth.getAddress(), SELL_AMOUNT, await buyToken.getAddress(), BUY_AMOUNT);
        const call = lp.sellTokenForToken(await weth.getAddress(), await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        const boughtAmount = await call();
        const { logs } = await call();
        expect(boughtAmount).to.eq(BUY_AMOUNT);
        expect(await env.web3Wrapper.getBalanceInWeiAsync(testMooniswap.address)).to.eq(SELL_AMOUNT);
        expect(await buyToken.balanceOf(RECIPIENT)()).to.eq(BUY_AMOUNT);
        verifyEventsFromLogs(
            logs,
            [
                {
                    value: SELL_AMOUNT,
                    sellToken: NULL_ADDRESS,
                    buyToken: await buyToken.getAddress(),
                    sellAmount: SELL_AMOUNT,
                    minBuyAmount: BUY_AMOUNT,
                    referral: NULL_ADDRESS,
                },
            ],
            'MooniswapCalled',
        );
    });

    it('reverts if pool reverts', async () => {
        await prepareNextSwapFundsAsync(await sellToken.getAddress(), SELL_AMOUNT, await buyToken.getAddress(), BUY_AMOUNT);
        await testMooniswap.setNextBoughtAmount(BUY_AMOUNT - 1)();
        const call = lp.sellTokenForToken(await sellToken.getAddress(), await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        return expect(call()).to.be.revertedWith('UNDERBOUGHT');
    });

    it('reverts if ERC20->ERC20 is the same token', async () => {
        const call = lp.sellTokenForToken(await sellToken.getAddress(), await sellToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        return expect(call()).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ERC20 receives an ETH input token', async () => {
        const call = lp.sellTokenForToken(ETH_TOKEN_ADDRESS, await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        return expect(call()).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ERC20 receives an ETH output token', async () => {
        const call = lp.sellTokenForToken(await sellToken.getAddress(), ETH_TOKEN_ADDRESS, RECIPIENT, BUY_AMOUNT, mooniswapData);
        return expect(call()).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ETH receives an ETH input token', async () => {
        const call = lp.sellTokenForEth(ETH_TOKEN_ADDRESS, RECIPIENT, BUY_AMOUNT, mooniswapData);
        return expect(call()).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ETH->ERC20 receives an ETH output token', async () => {
        const call = lp.sellEthForToken(ETH_TOKEN_ADDRESS, RECIPIENT, BUY_AMOUNT, mooniswapData);
        return expect(call()).to.be.revertedWith('MooniswapLiquidityProvider/INVALID_ARGS');
    });

    it('emits a LiquidityProviderFill event', async () => {
        await prepareNextSwapFundsAsync(await sellToken.getAddress(), SELL_AMOUNT, await buyToken.getAddress(), BUY_AMOUNT);
        const call = lp.sellTokenForToken(await sellToken.getAddress(), await buyToken.getAddress(), RECIPIENT, BUY_AMOUNT, mooniswapData);
        const { logs } = await call();
        verifyEventsFromLogs(
            logs,
            [
                {
                    inputToken: await sellToken.getAddress(),
                    outputToken: await buyToken.getAddress(),
                    inputTokenAmount: SELL_AMOUNT,
                    outputTokenAmount: BUY_AMOUNT,
                    sourceId: hexUtils.rightPad(hexUtils.toHex(Buffer.from('Mooniswap'))),
                    sourceAddress: testMooniswap.address,
                    sender: taker,
                    recipient: RECIPIENT,
                },
            ],
            'LiquidityProviderFill',
        );
    });
});
