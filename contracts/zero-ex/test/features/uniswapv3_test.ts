import { ethers } from "ethers";
import {
    blockchainTests,
    constants,
    describe,
    expect,
    getRandomPortion,
    randomAddress,
} from '@0x/test-utils';
import { hexUtils } from '@0x/utils';
import { LogWithDecodedArgs } from 'ethereum-types';

import { artifacts } from '../artifacts';
import {
    TestMintableERC20TokenContract,
    TestNoEthRecipientContract,
    TestUniswapV3FactoryContract,
    TestUniswapV3FactoryPoolCreatedEventArgs,
    TestUniswapV3PoolContract,
    TestWethContract,
    UniswapV3FeatureContract,
    TestWeth__factory,
    TestMintableERC20Token__factory,
    TestNoEthRecipient__factory,
    TestUniswapV3Factory__factory,
    UniswapV3Feature__factory,
} from '../wrappers';

blockchainTests('UniswapV3Feature', env => {
    const { MAX_UINT256, NULL_ADDRESS, ZERO_AMOUNT } = constants;
    const POOL_FEE = 1234;
    const MAX_SUPPLY = BigInt('10000000000000000000'); // 10e18 as BigInt
    let uniFactory: TestUniswapV3FactoryContract;
    let feature: UniswapV3FeatureContract;
    let weth: TestWethContract;
    let tokens: TestMintableERC20TokenContract[];
    const sellAmount = getRandomPortion(MAX_SUPPLY);
    const buyAmount = getRandomPortion(MAX_SUPPLY);
    let taker: string;
    const recipient = randomAddress();
    let noEthRecipient: TestNoEthRecipientContract;

    before(async () => {
        [, taker] = await env.getAccountAddressesAsync();
        const signer = await env.provider.getSigner(taker);
        
        const wethFactory = new TestWeth__factory(signer);
        weth = await wethFactory.deploy();
        await weth.waitForDeployment();

        const tokenFactories = [...new Array(3)].map(() => new TestMintableERC20Token__factory(signer));
        const tokenDeployments = await Promise.all(
            tokenFactories.map(factory => factory.deploy())
        );
        await Promise.all(tokenDeployments.map(token => token.waitForDeployment()));
        tokens = tokenDeployments;

        const noEthRecipientFactory = new TestNoEthRecipient__factory(signer);
        noEthRecipient = await noEthRecipientFactory.deploy();
        await noEthRecipient.waitForDeployment();

        const uniFactoryFactory = new TestUniswapV3Factory__factory(signer);
        uniFactory = await uniFactoryFactory.deploy();
        await uniFactory.waitForDeployment();

        const featureFactory = new UniswapV3Feature__factory(signer);
        feature = await featureFactory.deploy(
            await weth.getAddress(),
            await uniFactory.getAddress(),
            await uniFactory.POOL_INIT_CODE_HASH(),
        );
        await feature.waitForDeployment();
        
        const takerSigner = await env.provider.getSigner(taker);
        await Promise.all(
            [...tokens, weth].map(t =>
                t.connect(takerSigner).approve(await feature.getAddress(), MAX_UINT256)
            ),
        );
    });

    function isWethContract(t: TestMintableERC20TokenContract | TestWethContract): t is TestWethContract {
        return !!(t as any).deposit;
    }

    async function mintToAsync(
        token: TestMintableERC20TokenContract | TestWethContract,
        owner: string,
        amount: BigNumber,
    ): Promise<void> {
        if (isWethContract(token)) {
            await token.depositTo(owner)({ value: amount });
        } else {
            await token.mint(owner, amount)();
        }
    }

    async function createPoolAsync(
        token0: TestMintableERC20TokenContract | TestWethContract,
        token1: TestMintableERC20TokenContract | TestWethContract,
        balance0: BigNumber,
        balance1: BigNumber,
    ): Promise<TestUniswapV3PoolContract> {
        const r = await uniFactory
            .createPool(token0.address, token1.address, BigInt(POOL_FEE))
            ();
        const pool = new TestUniswapV3PoolContract(
            (r.logs[0] as LogWithDecodedArgs<TestUniswapV3FactoryPoolCreatedEventArgs>).args.pool,
            env.provider,
            env.txDefaults,
        );
        await mintToAsync(token0, pool.address, balance0);
        await mintToAsync(token1, pool.address, balance1);
        return pool;
    }

    function encodePath(tokens_: Array<TestMintableERC20TokenContract | TestWethContract>): string {
        const elems: string[] = [];
        tokens_.forEach((t, i) => {
            if (i) {
                elems.push(hexUtils.leftPad(POOL_FEE, 3));
            }
            elems.push(hexUtils.leftPad(t.address, 20));
        });
        return hexUtils.concat(...elems);
    }

    describe('sellTokenForTokenToUniswapV3()', () => {
        it('1-hop swap', async () => {
            const [sellToken, buyToken] = tokens;
            const pool = await createPoolAsync(sellToken, buyToken, ZERO_AMOUNT, buyAmount);
            await mintToAsync(sellToken, taker, sellAmount);
            await feature
                .sellTokenForTokenToUniswapV3(encodePath([sellToken, buyToken]), sellAmount, buyAmount, recipient)
                ({ from: taker });
            // Test pools always ask for full sell amount and pay entire balance.
            expect(await sellToken.balanceOf(taker)()).to.eq(0);
            expect(await buyToken.balanceOf(recipient)()).to.eq(buyAmount);
            expect(await sellToken.balanceOf(pool.address)()).to.eq(sellAmount);
        });

        it('2-hop swap', async () => {
            const pools = [
                await createPoolAsync(tokens[0], tokens[1], ZERO_AMOUNT, buyAmount),
                await createPoolAsync(tokens[1], tokens[2], ZERO_AMOUNT, buyAmount),
            ];
            await mintToAsync(tokens[0], taker, sellAmount);
            await feature
                .sellTokenForTokenToUniswapV3(encodePath(tokens), sellAmount, buyAmount, recipient)
                ({ from: taker });
            // Test pools always ask for full sell amount and pay entire balance.
            expect(await tokens[0].balanceOf(taker)()).to.eq(0);
            expect(await tokens[2].balanceOf(recipient)()).to.eq(buyAmount);
            expect(await tokens[0].balanceOf(pools[0].address)()).to.eq(sellAmount);
            expect(await tokens[1].balanceOf(pools[1].address)()).to.eq(buyAmount);
        });

        it('1-hop underbuy fails', async () => {
            const [sellToken, buyToken] = tokens;
            await createPoolAsync(sellToken, buyToken, ZERO_AMOUNT, buyAmount - 1);
            await mintToAsync(sellToken, taker, sellAmount);
            const tx = feature
                .sellTokenForTokenToUniswapV3(encodePath([sellToken, buyToken]), sellAmount, buyAmount, recipient)
                ({ from: taker });
            return expect(tx).to.be.revertedWith('UniswapV3Feature/UNDERBOUGHT');
        });

        it('2-hop underbuy fails', async () => {
            await createPoolAsync(tokens[0], tokens[1], ZERO_AMOUNT, buyAmount);
            await createPoolAsync(tokens[1], tokens[2], ZERO_AMOUNT, buyAmount - 1);
            await mintToAsync(tokens[0], taker, sellAmount);
            const tx = feature
                .sellTokenForTokenToUniswapV3(encodePath(tokens), sellAmount, buyAmount, recipient)
                ({ from: taker });
            return expect(tx).to.be.revertedWith('UniswapV3Feature/UNDERBOUGHT');
        });

        it('null recipient is sender', async () => {
            const [sellToken, buyToken] = tokens;
            await createPoolAsync(sellToken, buyToken, ZERO_AMOUNT, buyAmount);
            await mintToAsync(sellToken, taker, sellAmount);
            await feature
                .sellTokenForTokenToUniswapV3(encodePath([sellToken, buyToken]), sellAmount, buyAmount, NULL_ADDRESS)
                ({ from: taker });
            // Test pools always ask for full sell amount and pay entire balance.
            expect(await buyToken.balanceOf(taker)()).to.eq(buyAmount);
        });
    });

    describe('sellEthForTokenToUniswapV3()', () => {
        it('1-hop swap', async () => {
            const [buyToken] = tokens;
            const pool = await createPoolAsync(weth, buyToken, ZERO_AMOUNT, buyAmount);
            await feature
                .sellEthForTokenToUniswapV3(encodePath([weth, buyToken]), buyAmount, recipient)
                ({ from: taker, value: sellAmount });
            // Test pools always ask for full sell amount and pay entire balance.
            expect(await buyToken.balanceOf(recipient)()).to.eq(buyAmount);
            expect(await weth.balanceOf(pool.address)()).to.eq(sellAmount);
        });

        it('null recipient is sender', async () => {
            const [buyToken] = tokens;
            const pool = await createPoolAsync(weth, buyToken, ZERO_AMOUNT, buyAmount);
            await feature
                .sellEthForTokenToUniswapV3(encodePath([weth, buyToken]), buyAmount, NULL_ADDRESS)
                ({ from: taker, value: sellAmount });
            // Test pools always ask for full sell amount and pay entire balance.
            expect(await buyToken.balanceOf(taker)()).to.eq(buyAmount);
            expect(await weth.balanceOf(pool.address)()).to.eq(sellAmount);
        });
    });

    describe('sellTokenForEthToUniswapV3()', () => {
        it('1-hop swap', async () => {
            const [sellToken] = tokens;
            const pool = await createPoolAsync(sellToken, weth, ZERO_AMOUNT, buyAmount);
            await mintToAsync(sellToken, taker, sellAmount);
            await feature
                .sellTokenForEthToUniswapV3(encodePath([sellToken, weth]), sellAmount, buyAmount, recipient)
                ({ from: taker });
            // Test pools always ask for full sell amount and pay entire balance.
            expect(await sellToken.balanceOf(taker)()).to.eq(0);
            expect(await env.web3Wrapper.getBalanceInWeiAsync(recipient)).to.eq(buyAmount);
            expect(await sellToken.balanceOf(pool.address)()).to.eq(sellAmount);
        });

        it('null recipient is sender', async () => {
            const [sellToken] = tokens;
            const pool = await createPoolAsync(sellToken, weth, ZERO_AMOUNT, buyAmount);
            await mintToAsync(sellToken, taker, sellAmount);
            const takerBalanceBefore = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            await feature
                .sellTokenForEthToUniswapV3(encodePath([sellToken, weth]), sellAmount, buyAmount, NULL_ADDRESS)
                ({ from: taker, gasPrice: ZERO_AMOUNT });
            // Test pools always ask for full sell amount and pay entire balance.
            expect((await env.web3Wrapper.getBalanceInWeiAsync(taker)) - takerBalanceBefore).to.eq(
                buyAmount,
            );
            expect(await sellToken.balanceOf(pool.address)()).to.eq(sellAmount);
        });

        it('fails if receipient cannot receive ETH', async () => {
            const [sellToken] = tokens;
            await mintToAsync(sellToken, taker, sellAmount);
            const tx = feature
                .sellTokenForEthToUniswapV3(
                    encodePath([sellToken, weth]),
                    sellAmount,
                    buyAmount,
                    noEthRecipient.address,
                )
                ({ from: taker });
            return expect(tx).to.be.rejectedWith('revert');
        });
    });
});
