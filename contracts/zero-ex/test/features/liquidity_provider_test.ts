import { ethers } from "hardhat";
import { artifacts as erc20Artifacts, DummyERC20TokenContract } from '@0x/contracts-erc20';
import { constants, verifyEventsFromLogs } from '@0x/utils';
import { expect } from 'chai';
import { OwnableRevertErrors, ZeroExRevertErrors } from '@0x/utils';

import { 
    IOwnableFeatureContract, 
    IZeroExContract, 
    LiquidityProviderFeatureContract,
    DummyERC20Token__factory,
    TestWeth__factory,
    LiquidityProviderSandbox__factory,
    LiquidityProviderFeature__factory,
    TestLiquidityProvider__factory
} from '../../src/wrappers';
import { artifacts } from '../artifacts';
import { fullMigrateAsync } from '../utils/migration';
import {
    LiquidityProviderSandboxContract,
    TestLiquidityProviderContract,
    TestLiquidityProviderEvents,
    TestWethContract,
} from '../wrappers';

describe('LiquidityProvider feature', () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
    } as any;
    let zeroEx: IZeroExContract;
    let feature: LiquidityProviderFeatureContract;
    let sandbox: LiquidityProviderSandboxContract;
    let liquidityProvider: TestLiquidityProviderContract;
    let token: DummyERC20TokenContract;
    let weth: TestWethContract;
    let owner: string;
    let taker: string;

    before(async () => {
        [owner, taker] = await env.getAccountAddressesAsync();
        env.txDefaults.from = owner; // 🔧 设置正确的from地址
        zeroEx = await fullMigrateAsync(owner, env.provider, env.txDefaults, {});

        const signer = await env.provider.getSigner(owner);
        const tokenFactory = new DummyERC20Token__factory(signer);
        token = await tokenFactory.deploy(
            "DummyToken", // 🔧 使用简单字符串替代可能不存在的常量
            "DUMMY",
            18,
            ethers.parseEther("1000000"), // 1M tokens
        );
        await token.waitForDeployment();
        // 🔧 尝试使用mint方法替代setBalance
        const takerSigner = await env.provider.getSigner(taker);
        await token.connect(takerSigner).mint(ethers.parseEther("1000"));
        const wethFactory = new TestWeth__factory(signer);
        weth = await wethFactory.deploy();
        await weth.waitForDeployment();
        
        // 🔧 设置token授权
        await token
            .connect(takerSigner)
            .approve(await zeroEx.getAddress(), ethers.parseEther("10000")); // 🔧 使用简单值

        feature = new LiquidityProviderFeatureContract(await zeroEx.getAddress(), env.provider, env.txDefaults, abis);
        
        const sandboxFactory = new LiquidityProviderSandbox__factory(signer);
        sandbox = await sandboxFactory.deploy(await zeroEx.getAddress());
        await sandbox.waitForDeployment();

        const featureFactory = new LiquidityProviderFeature__factory(signer);
        const featureImpl = await featureFactory.deploy(await sandbox.getAddress());
        await featureImpl.waitForDeployment();

        const ownerSigner = await env.provider.getSigner(owner);
        const ownableFeature = await ethers.getContractAt('IOwnableFeature', await zeroEx.getAddress(), ownerSigner);
        await ownableFeature.migrate(await featureImpl.getAddress(), featureImpl.interface.encodeFunctionData('migrate'), owner);

        const liquidityProviderFactory = new TestLiquidityProvider__factory(signer);
        liquidityProvider = await liquidityProviderFactory.deploy();
        await liquidityProvider.waitForDeployment();
    });
    describe('Sandbox', () => {
        it('Cannot call sandbox `executeSellTokenForToken` function directly', async () => {
            const takerSigner = await env.provider.getSigner(taker);
            return expect(
                sandbox
                    .connect(takerSigner)
                    .executeSellTokenForToken(
                        await liquidityProvider.getAddress(),
                        await token.getAddress(),
                        await weth.getAddress(),
                        taker,
                        constants.ZERO_AMOUNT,
                        constants.NULL_BYTES,
                    )
            ).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(taker));
        });
        it('Cannot call sandbox `executeSellEthForToken` function directly', async () => {
            const takerSigner = await env.provider.getSigner(taker);
            return expect(
                sandbox
                    .connect(takerSigner)
                    .executeSellEthForToken(
                        await liquidityProvider.getAddress(),
                        await token.getAddress(),
                        taker,
                        constants.ZERO_AMOUNT,
                        constants.NULL_BYTES,
                    )
            ).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(taker));
        });
        it('Cannot call sandbox `executeSellTokenForEth` function directly', async () => {
            const tx = sandbox
                .executeSellTokenForEth(
                    await liquidityProvider.getAddress(),
                    await token.getAddress(),
                    taker,
                    constants.ZERO_AMOUNT,
                    constants.NULL_BYTES,
                )
                ({ from: taker });
            return expect(tx).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(taker));
        });
    });
    describe('Swap', () => {
        const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        it('Successfully executes an ERC20-ERC20 swap', async () => {
            const tx = await feature
                .sellToLiquidityProvider(
                    await token.getAddress(),
                    await weth.getAddress(),
                    await liquidityProvider.getAddress(),
                    constants.NULL_ADDRESS,
                    constants.ONE_ETHER,
                    constants.ZERO_AMOUNT,
                    constants.NULL_BYTES,
                )
                ({ from: taker });
            verifyEventsFromLogs(
                tx.logs,
                [
                    {
                        inputToken: await token.getAddress(),
                        outputToken: await weth.getAddress(),
                        recipient: taker,
                        minBuyAmount: constants.ZERO_AMOUNT,
                        inputTokenBalance: constants.ONE_ETHER,
                    },
                ],
                TestLiquidityProviderEvents.SellTokenForToken,
            );
        });
        it('Reverts if cannot fulfill the minimum buy amount', async () => {
            const minBuyAmount = 1n;
            const tx = feature
                .sellToLiquidityProvider(
                    await token.getAddress(),
                    await weth.getAddress(),
                    await liquidityProvider.getAddress(),
                    constants.NULL_ADDRESS,
                    constants.ONE_ETHER,
                    minBuyAmount,
                    constants.NULL_BYTES,
                )
                ({ from: taker });
            return expect(tx).to.be.revertedWith(
                new ZeroExRevertErrors.LiquidityProvider.LiquidityProviderIncompleteSellError(
                    await liquidityProvider.getAddress(),
                    await weth.getAddress(),
                    await token.getAddress(),
                    constants.ONE_ETHER,
                    constants.ZERO_AMOUNT,
                    minBuyAmount,
                ),
            );
        });
        it('Successfully executes an ETH-ERC20 swap', async () => {
            const tx = await feature
                .sellToLiquidityProvider(
                    ETH_TOKEN_ADDRESS,
                    await token.getAddress(),
                    await liquidityProvider.getAddress(),
                    constants.NULL_ADDRESS,
                    constants.ONE_ETHER,
                    constants.ZERO_AMOUNT,
                    constants.NULL_BYTES,
                )
                ({ from: taker, value: constants.ONE_ETHER });
            verifyEventsFromLogs(
                tx.logs,
                [
                    {
                        outputToken: await token.getAddress(),
                        recipient: taker,
                        minBuyAmount: constants.ZERO_AMOUNT,
                        ethBalance: constants.ONE_ETHER,
                    },
                ],
                TestLiquidityProviderEvents.SellEthForToken,
            );
        });
        it('Successfully executes an ERC20-ETH swap', async () => {
            const tx = await feature
                .sellToLiquidityProvider(
                    await token.getAddress(),
                    ETH_TOKEN_ADDRESS,
                    await liquidityProvider.getAddress(),
                    constants.NULL_ADDRESS,
                    constants.ONE_ETHER,
                    constants.ZERO_AMOUNT,
                    constants.NULL_BYTES,
                )
                ({ from: taker });
            verifyEventsFromLogs(
                tx.logs,
                [
                    {
                        inputToken: await token.getAddress(),
                        recipient: taker,
                        minBuyAmount: constants.ZERO_AMOUNT,
                        inputTokenBalance: constants.ONE_ETHER,
                    },
                ],
                TestLiquidityProviderEvents.SellTokenForEth,
            );
        });
    });
});
