import { ethers } from "hardhat";
// 🔧 使用TestMintableERC20Token替代DummyERC20Token
// import { artifacts as erc20Artifacts, DummyERC20TokenContract } from '@0x/contracts-erc20';
import { constants, verifyEventsFromLogs } from '@0x/utils';
import { expect } from 'chai';
import { OwnableRevertErrors, ZeroExRevertErrors } from '@0x/utils';

import { 
    IOwnableFeatureContract, 
    IZeroExContract, 
    LiquidityProviderFeatureContract,
    TestMintableERC20Token__factory, // 🔧 使用TestMintableERC20Token
    TestMintableERC20TokenContract, // 🔧 添加类型导入
    TestWeth__factory,
    LiquidityProviderSandbox__factory,
    LiquidityProviderFeature__factory
} from '../../src/wrappers';
import { TestLiquidityProvider__factory } from '../../src/typechain-types/factories/contracts/test/integration';
import { artifacts } from '../artifacts';
import { abis } from '../utils/abis'; // 🔧 添加abis导入
import { fullMigrateAsync } from '../utils/migration';
import {
    LiquidityProviderSandboxContract,
    TestLiquidityProviderContract,
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
    let token: TestMintableERC20TokenContract; // 🔧 使用TestMintableERC20Token类型
    let weth: TestWethContract;
    let owner: string;
    let taker: string;

    before(async () => {
        [owner, taker] = await env.getAccountAddressesAsync();
        env.txDefaults.from = owner; // 🔧 设置正确的from地址
        zeroEx = await fullMigrateAsync(owner, env.provider, env.txDefaults, {});

        const signer = await env.provider.getSigner(owner);
        const tokenFactory = new TestMintableERC20Token__factory(signer);
        token = await tokenFactory.deploy(); // 🔧 TestMintableERC20Token不需要构造参数
        await token.waitForDeployment();
        // 🔧 使用正确的mint语法：mint(recipient, amount)
        await token.mint(taker, ethers.parseEther("1000"));
        const wethFactory = new TestWeth__factory(signer);
        weth = await wethFactory.deploy();
        await weth.waitForDeployment();
        
        // 🔧 设置token授权
        const takerSigner = await env.provider.getSigner(taker);
        await token
            .connect(takerSigner)
            .approve(await zeroEx.getAddress(), ethers.parseEther("10000")); // 🔧 使用简单值

        // 🔧 使用ethers.getContractAt替代constructor
        feature = await ethers.getContractAt('ILiquidityProviderFeature', await zeroEx.getAddress()) as LiquidityProviderFeatureContract;
        
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
            const tx = sandbox
                .connect(takerSigner)
                .executeSellTokenForToken(
                    await liquidityProvider.getAddress(),
                    await token.getAddress(),
                    await weth.getAddress(),
                    taker,
                    constants.ZERO_AMOUNT,
                    constants.NULL_BYTES,
                );
            
            try {
                await tx;
                expect.fail('Transaction should have reverted');
            } catch (error: any) {
                // 验证OnlyOwnerError选择器
                expect(error.message).to.include('0x1de45ad1'); // OnlyOwnerError选择器
            }
        });
        it('Cannot call sandbox `executeSellEthForToken` function directly', async () => {
            const takerSigner = await env.provider.getSigner(taker);
            const tx = sandbox
                .connect(takerSigner)
                .executeSellEthForToken(
                    await liquidityProvider.getAddress(),
                    await token.getAddress(),
                    taker,
                    constants.ZERO_AMOUNT,
                    constants.NULL_BYTES,
                );
            
            try {
                await tx;
                expect.fail('Transaction should have reverted');
            } catch (error: any) {
                // 验证OnlyOwnerError选择器
                expect(error.message).to.include('0x1de45ad1'); // OnlyOwnerError选择器
            }
        });
        it('Cannot call sandbox `executeSellTokenForEth` function directly', async () => {
            const takerSigner = await env.provider.getSigner(taker);
            const tx = sandbox
                .connect(takerSigner)
                .executeSellTokenForEth(
                    await liquidityProvider.getAddress(),
                    await token.getAddress(),
                    taker,
                    constants.ZERO_AMOUNT,
                    constants.NULL_BYTES,
                );
            
            try {
                await tx;
                expect.fail('Transaction should have reverted');
            } catch (error: any) {
                // 验证OnlyOwnerError选择器
                expect(error.message).to.include('0x1de45ad1'); // OnlyOwnerError选择器
            }
        });
    });
    describe('Swap', () => {
        const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

        it('Successfully executes an ERC20-ERC20 swap', async () => {
            const takerSigner = await env.provider.getSigner(taker);
            const tx = await feature
                .connect(takerSigner)
                .sellToLiquidityProvider(
                    await token.getAddress(),
                    await weth.getAddress(),
                    await liquidityProvider.getAddress(),
                    '0x0000000000000000000000000000000000000000', // NULL_ADDRESS
                    ethers.parseEther('1'), // ONE_ETHER
                    0n, // ZERO_AMOUNT
                    '0x', // NULL_BYTES
                );
            const receipt = await tx.wait();
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        inputToken: await token.getAddress(),
                        outputToken: await weth.getAddress(),
                        recipient: taker,
                        minBuyAmount: constants.ZERO_AMOUNT,
                        inputTokenBalance: constants.ONE_ETHER,
                    },
                ],
                'SellTokenForToken',
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
