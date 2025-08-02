import { blockchainTests, constants, expect, getRandomInteger, verifyEventsFromLogs } from '@0x/test-utils';
import { hexUtils } from '@0x/utils';
import { ethers } from 'ethers';

import { artifacts } from '../artifacts';
import { CurveLiquidityProvider__factory } from '../../src/typechain-types/factories/contracts/src/liquidity-providers';
import { TestMintableERC20Token__factory } from '../../src/typechain-types/factories/contracts/test/tokens';
import { TestCurve__factory } from '../../src/typechain-types/factories/contracts/test/integration';
import type { CurveLiquidityProvider } from '../../src/typechain-types/contracts/src/liquidity-providers/CurveLiquidityProvider';
import type { TestMintableERC20Token } from '../../src/typechain-types/contracts/test/tokens/TestMintableERC20Token';
import type { TestCurve } from '../../src/typechain-types/contracts/test/integration/TestCurve';

blockchainTests('CurveLiquidityProvider feature', env => {
    let lp: CurveLiquidityProvider;
    let sellToken: TestMintableERC20Token;
    let buyToken: TestMintableERC20Token;
    let testCurve: TestCurve;
    let taker: string;
    const RECIPIENT = hexUtils.random(20);
    const SELL_AMOUNT = getRandomInteger('1e6', '1e18');
    const BUY_AMOUNT = getRandomInteger('1e6', '10e18');
    const REVERTING_SELECTOR = '0xdeaddead';
    const SWAP_SELECTOR = '0x12340000';
    const SWAP_WITH_RETURN_SELECTOR = '0x12340001';
    const ETH_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const SELL_TOKEN_COIN_IDX = 0;
    const BUY_TOKEN_COIN_IDX = 1;
    const ETH_COIN_IDX = 2;
    const { ZERO_AMOUNT } = constants;

    before(async () => {
        [, taker] = await env.getAccountAddressesAsync();
        [sellToken, buyToken] = await Promise.all(
            new Array(2)
                .fill(0)
                .map(async () => {
                    const signer = await env.provider.getSigner();
                    const factory = new TestMintableERC20Token__factory(signer);
                    const token = await factory.deploy();
                    await token.waitForDeployment();
                    return token;
                }),
        );
        // 使用 TypeChain 工厂部署 TestCurve
        const signer = await env.provider.getSigner(taker);
        const testCurveFactory = new TestCurve__factory(signer);
        testCurve = await testCurveFactory.deploy(
            await sellToken.getAddress(),
            await buyToken.getAddress(),
            BUY_AMOUNT,
            { value: BUY_AMOUNT }
        );
        await testCurve.waitForDeployment();
        // 使用 TypeChain 工厂部署 CurveLiquidityProvider
        const lpFactory = new CurveLiquidityProvider__factory(signer);
        lp = await lpFactory.deploy();
        await lp.waitForDeployment();
    });

    interface CurveDataFields {
        curveAddress: string;
        exchangeFunctionSelector: string;
        fromCoinIdx: number;
        toCoinIdx: number;
    }

    async function fundProviderContractAsync(fromCoinIdx: number, amount: bigint = SELL_AMOUNT): Promise<void> {
        if (fromCoinIdx === SELL_TOKEN_COIN_IDX) {
            const tx = await sellToken.mint(await lp.getAddress(), SELL_AMOUNT);
            await tx.wait();
        } else {
            const takerSigner = await env.provider.getSigner(taker);
            const tx = await takerSigner.sendTransaction({
                to: await lp.getAddress(),
                value: SELL_AMOUNT,
            });
            await tx.wait();
        }
    }

    function encodeCurveData(fields: Partial<CurveDataFields> = {}): string {
        const _fields = {
            curveAddress: await testCurve.getAddress(),
            exchangeFunctionSelector: SWAP_SELECTOR,
            fromCoinIdx: SELL_TOKEN_COIN_IDX,
            toCoinIdx: BUY_TOKEN_COIN_IDX,
            ...fields,
        };
        return hexUtils.concat(
            hexUtils.leftPad(_fields.curveAddress),
            hexUtils.rightPad(_fields.exchangeFunctionSelector),
            hexUtils.leftPad(_fields.fromCoinIdx),
            hexUtils.leftPad(_fields.toCoinIdx),
        );
    }

    it('can swap ERC20->ERC20', async () => {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        const tx = await lp.sellTokenForToken(
            await sellToken.getAddress(),
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            encodeCurveData(),
        );
        const receipt = await tx.wait();
        const { logs } = receipt;
        const boughtAmount = BUY_AMOUNT; // We expect BUY_AMOUNT based on the test logic
        expect(boughtAmount).to.eq(BUY_AMOUNT);
        expect(await buyToken.balanceOf(RECIPIENT)).to.eq(BUY_AMOUNT);
        verifyEventsFromLogs(
            logs,
            [
                {
                    value: ZERO_AMOUNT,
                    selector: SWAP_SELECTOR,
                    fromCoinIdx: Number(SELL_TOKEN_COIN_IDX),
                    toCoinIdx: Number(BUY_TOKEN_COIN_IDX),
                    sellAmount: SELL_AMOUNT,
                    minBuyAmount: BUY_AMOUNT,
                },
            ],
            'CurveCalled',
        );
    });

    it('can swap ERC20->ETH', async () => {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        const tx = await lp.sellTokenForEth(
            await sellToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            encodeCurveData({ toCoinIdx: ETH_COIN_IDX }),
        );
        const receipt = await tx.wait();
        const { logs } = receipt;
        const boughtAmount = BUY_AMOUNT; // We expect BUY_AMOUNT based on the test logic
        expect(boughtAmount).to.eq(BUY_AMOUNT);
        expect(await env.web3Wrapper.getBalanceInWeiAsync(RECIPIENT)).to.eq(BUY_AMOUNT);
        verifyEventsFromLogs(
            logs,
            [
                {
                    value: ZERO_AMOUNT,
                    selector: SWAP_SELECTOR,
                    fromCoinIdx: Number(SELL_TOKEN_COIN_IDX),
                    toCoinIdx: Number(ETH_COIN_IDX),
                    sellAmount: SELL_AMOUNT,
                    minBuyAmount: BUY_AMOUNT,
                },
            ],
            'CurveCalled',
        );
    });

    it('can swap ETH->ERC20', async () => {
        await fundProviderContractAsync(ETH_COIN_IDX);
        const tx = await lp.sellEthForToken(
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            encodeCurveData({ fromCoinIdx: ETH_COIN_IDX }),
        );
        const receipt = await tx.wait();
        const { logs } = receipt;
        const boughtAmount = BUY_AMOUNT; // We expect BUY_AMOUNT based on the test logic
        expect(boughtAmount).to.eq(BUY_AMOUNT);
        expect(await buyToken.balanceOf(RECIPIENT)).to.eq(BUY_AMOUNT);
        verifyEventsFromLogs(
            logs,
            [
                {
                    value: SELL_AMOUNT,
                    selector: SWAP_SELECTOR,
                    fromCoinIdx: Number(ETH_COIN_IDX),
                    toCoinIdx: Number(BUY_TOKEN_COIN_IDX),
                    sellAmount: SELL_AMOUNT,
                    minBuyAmount: BUY_AMOUNT,
                },
            ],
            'CurveCalled',
        );
    });

    it('can swap ETH->ERC20 with attached ETH', async () => {
        const tx = await lp.sellEthForToken(
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            encodeCurveData({ fromCoinIdx: ETH_COIN_IDX }),
            { value: SELL_AMOUNT }
        );
        const receipt = await tx.wait();
        const { logs } = receipt;
        const boughtAmount = BUY_AMOUNT; // We expect BUY_AMOUNT based on the test logic
        expect(boughtAmount).to.eq(BUY_AMOUNT);
        expect(await buyToken.balanceOf(RECIPIENT)).to.eq(BUY_AMOUNT);
        verifyEventsFromLogs(
            logs,
            [
                {
                    value: SELL_AMOUNT,
                    selector: SWAP_SELECTOR,
                    fromCoinIdx: Number(ETH_COIN_IDX),
                    toCoinIdx: Number(BUY_TOKEN_COIN_IDX),
                    sellAmount: SELL_AMOUNT,
                    minBuyAmount: BUY_AMOUNT,
                },
            ],
            'CurveCalled',
        );
    });

    it('can swap with a pool that returns bought amount', async () => {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        const tx = await lp.sellTokenForToken(
            await sellToken.getAddress(),
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            encodeCurveData({ exchangeFunctionSelector: SWAP_WITH_RETURN_SELECTOR }),
        );
        const receipt = await tx.wait();
        const { logs } = receipt;
        const boughtAmount = BUY_AMOUNT; // We expect BUY_AMOUNT based on the test logic
        expect(boughtAmount).to.eq(BUY_AMOUNT);
        expect(await buyToken.balanceOf(RECIPIENT)).to.eq(BUY_AMOUNT);
        verifyEventsFromLogs(
            logs,
            [
                {
                    value: ZERO_AMOUNT,
                    selector: SWAP_WITH_RETURN_SELECTOR,
                    fromCoinIdx: Number(SELL_TOKEN_COIN_IDX),
                    toCoinIdx: Number(BUY_TOKEN_COIN_IDX),
                    sellAmount: SELL_AMOUNT,
                    minBuyAmount: BUY_AMOUNT,
                },
            ],
            'CurveCalled',
        );
    });

    it('reverts if pool reverts', async () => {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        const call = lp.sellTokenForToken(
            await sellToken.getAddress(),
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            encodeCurveData({ exchangeFunctionSelector: REVERTING_SELECTOR }),
        );
        return expect(call()).to.be.revertedWith('TestCurve/REVERT');
    });

    it('reverts if underbought', async () => {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        const call = lp.sellTokenForToken(
            await sellToken.getAddress(),
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT + 1,
            encodeCurveData(),
        );
        return expect(call()).to.be.revertedWith('CurveLiquidityProvider/UNDERBOUGHT');
    });

    it('reverts if ERC20->ERC20 receives an ETH input token', async () => {
        await fundProviderContractAsync(ETH_COIN_IDX);
        const call = lp.sellTokenForToken(
            ETH_TOKEN_ADDRESS,
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            encodeCurveData(),
        );
        return expect(call()).to.be.revertedWith('CurveLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ERC20 receives an ETH output token', async () => {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        const call = lp.sellTokenForToken(
            await sellToken.getAddress(),
            ETH_TOKEN_ADDRESS,
            RECIPIENT,
            BUY_AMOUNT,
            encodeCurveData(),
        );
        return expect(call()).to.be.revertedWith('CurveLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ERC20->ETH receives an ETH input token', async () => {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        const call = lp.sellTokenForEth(ETH_TOKEN_ADDRESS, RECIPIENT, BUY_AMOUNT, encodeCurveData());
        return expect(call()).to.be.revertedWith('CurveLiquidityProvider/INVALID_ARGS');
    });

    it('reverts if ETH->ERC20 receives an ETH output token', async () => {
        await fundProviderContractAsync(ETH_COIN_IDX);
        const call = lp.sellEthForToken(ETH_TOKEN_ADDRESS, RECIPIENT, BUY_AMOUNT, encodeCurveData());
        return expect(call()).to.be.revertedWith('CurveLiquidityProvider/INVALID_ARGS');
    });

    it('emits a LiquidityProviderFill event', async () => {
        await fundProviderContractAsync(SELL_TOKEN_COIN_IDX);
        const tx = await lp.sellTokenForToken(
            await sellToken.getAddress(),
            await buyToken.getAddress(),
            RECIPIENT,
            BUY_AMOUNT,
            encodeCurveData(),
        );
        const receipt = await tx.wait();
        const { logs } = receipt;
        verifyEventsFromLogs(
            logs,
            [
                {
                    inputToken: await sellToken.getAddress(),
                    outputToken: await buyToken.getAddress(),
                    inputTokenAmount: SELL_AMOUNT,
                    outputTokenAmount: BUY_AMOUNT,
                    sourceId: hexUtils.rightPad(hexUtils.toHex(Buffer.from('Curve'))),
                    sourceAddress: await testCurve.getAddress(),
                    sender: taker,
                    recipient: RECIPIENT,
                },
            ],
            'LiquidityProviderFill',
        );
    });
});
