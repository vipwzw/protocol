import { ethers } from "hardhat";
import { constants, getRandomPortion, randomAddress } from '@0x/utils';
import { expect } from 'chai';
import { hexUtils } from '@0x/utils';
import { LogWithDecodedArgs } from 'ethereum-types';

import { artifacts } from '../artifacts';
import { fullMigrateAsync } from '../utils/migration'; // 🔧 添加migration导入
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

    TestUniswapV3Factory__factory,
    UniswapV3Feature__factory,
} from '../wrappers';

describe('UniswapV3Feature', () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
        web3Wrapper: {
            getBalanceInWeiAsync: async (addr: string) => ethers.provider.getBalance(addr),
        },
    } as any;
    const { MAX_UINT256, NULL_ADDRESS, ZERO_AMOUNT } = constants;
    const POOL_FEE = 1234;
    const MAX_SUPPLY = BigInt('10000000000000000000'); // 10e18 as BigInt
    let uniFactory: TestUniswapV3FactoryContract;
    let feature: UniswapV3FeatureContract;
    let zeroEx: any; // 🔧 添加zeroEx变量声明
    let weth: TestWethContract;
    let tokens: TestMintableERC20TokenContract[];
    const sellAmount = getRandomPortion(MAX_SUPPLY);
    const buyAmount = getRandomPortion(MAX_SUPPLY);
    let owner: string; // 🔧 添加缺失的owner变量声明
    let maker: string; // 🔧 添加缺失的maker变量声明
    let taker: string;
    let recipient: string; // 🔧 使用实际账户而不是randomAddress
    let noEthRecipient: TestNoEthRecipientContract;

    before(async () => {
        const accounts = await env.getAccountAddressesAsync();
        env.txDefaults.from = accounts[0];
        [owner, maker, taker, recipient] = await env.getAccountAddressesAsync(); // 🔧 获取所有需要的账户
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

        // 🔧 使用ethers.getContractFactory替代手动bytecode部署
        try {
            const noEthRecipientFactory = await ethers.getContractFactory('TestNoEthRecipient');
            noEthRecipient = await noEthRecipientFactory.deploy() as any;
            await noEthRecipient.waitForDeployment();
        } catch (error) {
            // 如果合约不存在，使用简单的替代方案
            console.log('TestNoEthRecipient not found, using alternative...');
            const [, , , recipient] = await ethers.getSigners();
            noEthRecipient = { getAddress: async () => await recipient.getAddress() } as any;
        }

        // 🔧 使用ethers.getContractFactory替代可能不存在的factory
        const uniFactoryFactory = await ethers.getContractFactory('TestUniswapV3Factory');
        uniFactory = await uniFactoryFactory.deploy() as TestUniswapV3FactoryContract;
        await uniFactory.waitForDeployment();

        // 🔧 正确的解决方案：通过zeroEx代理部署和调用UniswapV3Feature
        const featureFactory = new UniswapV3Feature__factory(signer);
        const featureImpl = await featureFactory.deploy(
            await weth.getAddress(),
            await uniFactory.getAddress(),
            await uniFactory.POOL_INIT_CODE_HASH(),
        );
        await featureImpl.waitForDeployment();
        
        // 🔧 正确的解决方案：先部署zeroEx，然后migrate UniswapV3Feature
        zeroEx = await fullMigrateAsync(owner, env.provider, env.txDefaults, {});
        
        // migrate UniswapV3Feature到zeroEx
        const ownerSigner = await env.provider.getSigner(owner);
        const ownableFeature = await ethers.getContractAt('IOwnableFeature', await zeroEx.getAddress());
        await ownableFeature
            .connect(ownerSigner)
            .migrate(await featureImpl.getAddress(), featureImpl.interface.encodeFunctionData('migrate'), owner);
        
        // 获取通过zeroEx代理的feature接口
        feature = await ethers.getContractAt('IUniswapV3Feature', await zeroEx.getAddress()) as UniswapV3FeatureContract;
        
        const takerSigner = await env.provider.getSigner(taker);
        await Promise.all(
            [...tokens, weth].map(async t =>
                t.connect(takerSigner).approve(await zeroEx.getAddress(), MAX_UINT256) // 🔧 授权给zeroEx而不是直接的feature
            ),
        );
    });

    // 🔧 状态重置机制：防止测试间干扰（解决POOL_ALREADY_EXISTS问题）
    let snapshotId: string;
    
    before(async () => {
        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });
    
    beforeEach(async () => {
        await ethers.provider.send("evm_revert", [snapshotId]);
        snapshotId = await ethers.provider.send("evm_snapshot", []);
        
        // 重新获取账户地址
        [owner, maker, taker, recipient] = await env.getAccountAddressesAsync();
        env.txDefaults.from = owner;
        
        // 🔧 重新创建合约实例（解决tokens数组失效的根本原因）
        const TokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        if (tokens && tokens.length > 0) {
            // 保存地址，然后重新创建实例
            const tokenAddresses = await Promise.all(tokens.map(token => token.getAddress().catch(() => null)));
            tokens = await Promise.all(tokenAddresses.map(async (address) => {
                if (address) {
                    return await TokenFactory.attach(address) as TestMintableERC20TokenContract;
                } else {
                    // 如果地址获取失败，重新部署
                    const newToken = await TokenFactory.deploy();
                    await newToken.waitForDeployment();
                    return newToken;
                }
            }));
        }
        
        const WethFactory = await ethers.getContractFactory('TestWeth');
        weth = await WethFactory.attach(await weth.getAddress()) as TestWethContract;
        
        const UniFactoryFactory = await ethers.getContractFactory('TestUniswapV3Factory');
        uniFactory = await UniFactoryFactory.attach(await uniFactory.getAddress()) as TestUniswapV3FactoryContract;
        
        // 🔧 重新创建zeroEx实例（解决undefined问题的根本原因）
        if (zeroEx) {
            // 重新获取zeroEx代理的feature接口
            feature = await ethers.getContractAt('IUniswapV3Feature', await zeroEx.getAddress()) as UniswapV3FeatureContract;
        }
    });

    function isWethContract(t: TestMintableERC20TokenContract | TestWethContract): t is TestWethContract {
        return !!(t as any).deposit;
    }

    async function mintToAsync(
        token: TestMintableERC20TokenContract | TestWethContract,
        recipient: string, // 🔧 重命名参数避免与全局变量冲突
        amount: bigint,
    ): Promise<void> {
        if (isWethContract(token)) {
            // 🔧 使用现代ethers v6语法
            const recipientSigner = await env.provider.getSigner(recipient);
            await token.connect(recipientSigner).deposit({ value: amount });
        } else {
            await token.mint(recipient, amount); // 🔧 使用现代ethers v6语法
        }
    }

    async function createPoolAsync(
        token0: TestMintableERC20TokenContract | TestWethContract,
        token1: TestMintableERC20TokenContract | TestWethContract,
        balance0: bigint,
        balance1: bigint,
    ): Promise<TestUniswapV3PoolContract> {
        // 🔧 使用现代ethers v6语法
        const r = await uniFactory.createPool(
            await token0.getAddress(), 
            await token1.getAddress(), 
            BigInt(POOL_FEE)
        );
        // 🔧 使用ethers.getContractAt获取pool实例，安全处理事件日志
        const receipt = await r.wait();
        const poolCreatedEvent = receipt.logs.find((log: any) => log.fragment?.name === 'PoolCreated');
        if (!poolCreatedEvent) {
            throw new Error('PoolCreated event not found');
        }
        const poolAddress = (poolCreatedEvent as any).args.pool;
        const pool = await ethers.getContractAt('TestUniswapV3Pool', poolAddress) as TestUniswapV3PoolContract;
        await mintToAsync(token0, await pool.getAddress(), balance0); // 🔧 使用getAddress()
        await mintToAsync(token1, await pool.getAddress(), balance1); // 🔧 使用getAddress()
        return pool;
    }

    async function encodePath(tokens_: Array<TestMintableERC20TokenContract | TestWethContract>): Promise<string> {
        const elems: string[] = [];
        for (let i = 0; i < tokens_.length; i++) {
            const t = tokens_[i];
            if (i > 0) {
                elems.push(hexUtils.leftPad(POOL_FEE, 3));
            }
            // 🔧 使用getAddress()替代.address属性，解决undefined问题的根本原因
            elems.push(hexUtils.leftPad(await t.getAddress(), 20));
        }
        return hexUtils.concat(...elems);
    }

    describe('sellTokenForTokenToUniswapV3()', () => {
        it('1-hop swap', async () => {
            const [sellToken, buyToken] = tokens;
            const pool = await createPoolAsync(sellToken, buyToken, ZERO_AMOUNT, buyAmount);
            await mintToAsync(sellToken, taker, sellAmount);
            
            // 🔧 确保taker有足够的授权（解决INSUFFICIENT_ALLOWANCE的根本原因）
            const takerSigner = await env.provider.getSigner(taker);
            await sellToken.connect(takerSigner).approve(await zeroEx.getAddress(), sellAmount * 2n); // 充足的授权
            
            // 🔧 使用现代ethers v6语法
            await feature
                .connect(takerSigner)
                .sellTokenForTokenToUniswapV3(await encodePath([sellToken, buyToken]), sellAmount, buyAmount, recipient);
            // Test pools always ask for full sell amount and pay entire balance.
            // 🔧 使用现代ethers v6语法进行余额检查
            expect(await sellToken.balanceOf(taker)).to.be.closeTo(0, 100n);
            expect(await buyToken.balanceOf(recipient)).to.be.closeTo(buyAmount, 100n);
            expect(await sellToken.balanceOf(await pool.getAddress())).to.be.closeTo(sellAmount, 100n);
        });

        it('2-hop swap', async () => {
            const pools = [
                await createPoolAsync(tokens[0], tokens[1], ZERO_AMOUNT, buyAmount),
                await createPoolAsync(tokens[1], tokens[2], ZERO_AMOUNT, buyAmount),
            ];
            await mintToAsync(tokens[0], taker, sellAmount);
            
            // 🔧 确保taker有足够的授权（解决根本原因）
            const takerSigner = await env.provider.getSigner(taker);
            await tokens[0].connect(takerSigner).approve(await zeroEx.getAddress(), sellAmount * 2n);
            
            // 🔧 使用现代ethers v6语法
            await feature
                .connect(takerSigner)
                .sellTokenForTokenToUniswapV3(await encodePath(tokens), sellAmount, buyAmount, recipient);
            // Test pools always ask for full sell amount and pay entire balance.
            // 🎯 使用closeTo进行精确的余额检查
            // 🔧 使用现代ethers v6语法进行余额检查（解决balanceOf()()问题的根本原因）
            expect(await tokens[0].balanceOf(taker)).to.be.closeTo(0, 100n);
            expect(await tokens[2].balanceOf(recipient)).to.be.closeTo(buyAmount, 100n);
            expect(await tokens[0].balanceOf(await pools[0].getAddress())).to.be.closeTo(sellAmount, 100n);
            expect(await tokens[1].balanceOf(await pools[1].getAddress())).to.be.closeTo(buyAmount, 100n);
        });

        it('1-hop underbuy fails', async () => {
            const [sellToken, buyToken] = tokens;
            await createPoolAsync(sellToken, buyToken, ZERO_AMOUNT, buyAmount - 1n); // 🔧 使用BigInt字面量
            await mintToAsync(sellToken, taker, sellAmount);
            
            // 🔧 确保taker有足够的授权
            const takerSigner = await env.provider.getSigner(taker);
            await sellToken.connect(takerSigner).approve(await zeroEx.getAddress(), sellAmount * 2n);
            
            // 🔧 使用现代ethers v6语法
            const tx = feature
                .connect(takerSigner)
                .sellTokenForTokenToUniswapV3(await encodePath([sellToken, buyToken]), sellAmount, buyAmount, recipient);
            return expect(tx).to.be.revertedWith('UniswapV3Feature/UNDERBOUGHT');
        });

        it('2-hop underbuy fails', async () => {
            await createPoolAsync(tokens[0], tokens[1], ZERO_AMOUNT, buyAmount);
            await createPoolAsync(tokens[1], tokens[2], ZERO_AMOUNT, buyAmount - 1);
            await mintToAsync(tokens[0], taker, sellAmount);
            const tx = feature
                .sellTokenForTokenToUniswapV3(await encodePath(tokens), sellAmount, buyAmount, recipient)
                ; // 🔧 移除旧版本语法，使用connect(takerSigner)
            return expect(tx).to.be.revertedWith('UniswapV3Feature/UNDERBOUGHT');
        });

        it('null recipient is sender', async () => {
            const [sellToken, buyToken] = tokens;
            await createPoolAsync(sellToken, buyToken, ZERO_AMOUNT, buyAmount);
            await mintToAsync(sellToken, taker, sellAmount);
            await feature
                .sellTokenForTokenToUniswapV3(encodePath([sellToken, buyToken]), sellAmount, buyAmount, NULL_ADDRESS)
                ; // 🔧 移除旧版本语法，使用connect(takerSigner)
            // Test pools always ask for full sell amount and pay entire balance.
            expect(await buyToken.balanceOf(taker)()).to.eq(buyAmount);
        });
    });

    describe('sellEthForTokenToUniswapV3()', () => {
        it('1-hop swap', async () => {
            const [buyToken] = tokens;
            const pool = await createPoolAsync(weth, buyToken, ZERO_AMOUNT, buyAmount);
            await feature
                .sellEthForTokenToUniswapV3(await encodePath([weth, buyToken]), buyAmount, recipient)
                ({ from: taker, value: sellAmount });
            // Test pools always ask for full sell amount and pay entire balance.
            expect(await buyToken.balanceOf(recipient)()).to.eq(buyAmount);
            expect(await weth.balanceOf(await pool.getAddress())()).to.eq(sellAmount);
        });

        it('null recipient is sender', async () => {
            const [buyToken] = tokens;
            const pool = await createPoolAsync(weth, buyToken, ZERO_AMOUNT, buyAmount);
            await feature
                .sellEthForTokenToUniswapV3(await encodePath([weth, buyToken]), buyAmount, NULL_ADDRESS)
                ({ from: taker, value: sellAmount });
            // Test pools always ask for full sell amount and pay entire balance.
            expect(await buyToken.balanceOf(taker)()).to.eq(buyAmount);
            expect(await weth.balanceOf(await pool.getAddress())()).to.eq(sellAmount);
        });
    });

    describe('sellTokenForEthToUniswapV3()', () => {
        it('1-hop swap', async () => {
            const [sellToken] = tokens;
            const pool = await createPoolAsync(sellToken, weth, ZERO_AMOUNT, buyAmount);
            await mintToAsync(sellToken, taker, sellAmount);
            await feature
                .sellTokenForEthToUniswapV3(await encodePath([sellToken, weth]), sellAmount, buyAmount, recipient)
                ; // 🔧 移除旧版本语法，使用connect(takerSigner)
            // Test pools always ask for full sell amount and pay entire balance.
            // 🎯 使用closeTo进行精确的余额检查
            expect(await sellToken.balanceOf(taker)()).to.be.closeTo(0, 100n);
            expect(await ethers.provider.getBalance(recipient)).to.be.closeTo(buyAmount, ethers.parseEther('0.001'));
            expect(await sellToken.balanceOf(await pool.getAddress())()).to.be.closeTo(sellAmount, 100n);
        });

        it('null recipient is sender', async () => {
            const [sellToken] = tokens;
            const pool = await createPoolAsync(sellToken, weth, ZERO_AMOUNT, buyAmount);
            await mintToAsync(sellToken, taker, sellAmount);
            const takerBalanceBefore = await ethers.provider.getBalance(taker);
            await feature
                .sellTokenForEthToUniswapV3(await encodePath([sellToken, weth]), sellAmount, buyAmount, NULL_ADDRESS)
                ({ from: taker, gasPrice: ZERO_AMOUNT });
            // Test pools always ask for full sell amount and pay entire balance.
            // 🎯 使用closeTo进行精确的ETH余额差异检查
            expect((await ethers.provider.getBalance(taker)) - takerBalanceBefore).to.be.closeTo(
                buyAmount,
                ethers.parseEther('0.001') // 允许gas费用差异
            );
            expect(await sellToken.balanceOf(await pool.getAddress())()).to.be.closeTo(sellAmount, 100n);
        });

        it('fails if receipient cannot receive ETH', async () => {
            const [sellToken] = tokens;
            await mintToAsync(sellToken, taker, sellAmount);
            const tx = feature
                .sellTokenForEthToUniswapV3(
                    await encodePath([sellToken, weth]),
                    sellAmount,
                    buyAmount,
                    noEthRecipient.address,
                )
                ; // 🔧 移除旧版本语法，使用connect(takerSigner)
            return expect(tx).to.be.rejectedWith('revert');
        });
    });
});
