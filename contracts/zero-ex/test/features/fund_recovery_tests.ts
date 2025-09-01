import { constants, randomAddress } from '@0x/utils';
import { expect } from 'chai';
import { OwnableRevertErrors } from '@0x/utils';
import { ethers } from 'hardhat';

import { IOwnableFeatureContract, IZeroExContract, FundRecoveryFeature__factory } from '../../src/wrappers';
import { artifacts } from '../artifacts';
import { FundRecoveryFeature } from '../../src/typechain-types/contracts/src/features/FundRecoveryFeature';
import { abis } from '../utils/abis';
import { fullMigrateAsync } from '../utils/migration';
import { TestMintableERC20Token } from '../../src/typechain-types/contracts/test/tokens/TestMintableERC20Token';

describe('FundRecovery', async () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
        web3Wrapper: {
            getBalanceInWeiAsync: async (addr: string) => ethers.provider.getBalance(addr),
            awaitTransactionMinedAsync: async (hash: string) => ethers.provider.waitForTransaction(hash),
            sendTransactionAsync: async (tx: any) => (await ethers.getSigner(tx.from)).sendTransaction(tx).then(r => r.hash),
        },
    } as any;
    let owner: string;
    let zeroEx: IZeroExContract;
    let token: TestMintableERC20Token;
    before(async () => {
        const accounts = await env.getAccountAddressesAsync();
        env.txDefaults.from = accounts[0];
        const INITIAL_ERC20_BALANCE = ethers.parseUnits('10000', 18);
        [owner] = await env.getAccountAddressesAsync();
        zeroEx = await fullMigrateAsync(owner, env.provider, env.txDefaults, {});
        // 使用 TypeChain factory 部署合约
        const TokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        token = await TokenFactory.deploy() as TestMintableERC20Token;
        await token.mint(await zeroEx.getAddress(), INITIAL_ERC20_BALANCE);
        const signer = await env.provider.getSigner(owner);
        const featureFactory = new FundRecoveryFeature__factory(signer);
        const featureImpl = await featureFactory.deploy();
        await featureImpl.waitForDeployment();
        const ownerSigner = await env.provider.getSigner(owner);
        // 🔧 使用IOwnableFeature接口调用migrate
        const ownableFeature = await ethers.getContractAt('IOwnableFeature', await zeroEx.getAddress());
        await ownableFeature
            .connect(ownerSigner)
            .migrate(await featureImpl.getAddress(), featureImpl.interface.encodeFunctionData('migrate'), owner);
    });

    // 🔧 状态重置机制：防止测试间干扰，确保每个测试都有正确的初始状态
    let snapshotId: string;
    
    before(async () => {
        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });
    
    beforeEach(async () => {
        await ethers.provider.send("evm_revert", [snapshotId]);
        snapshotId = await ethers.provider.send("evm_snapshot", []);
        
        // 重新获取账户地址
        [owner] = await env.getAccountAddressesAsync();
        env.txDefaults.from = owner;
        
        // 重新创建合约实例
        const TokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        token = await TokenFactory.attach(await token.getAddress()) as TestMintableERC20Token;
        
        // 确保zeroEx有正确的初始token余额
        const currentBalance = await token.balanceOf(await zeroEx.getAddress());
        if (currentBalance < ethers.parseUnits('1000', 18)) {
            // 如果余额不足，重新mint
            await token.mint(await zeroEx.getAddress(), ethers.parseUnits('10000', 18));
        }
    });

    describe('Should delegatecall `transferTrappedTokensTo` from the exchange proxy', () => {
        const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const recipientAddress = randomAddress();
        it('Tranfers an arbitrary ERC-20 Token', async () => {
            // 🔧 使用ethers.parseUnits替代Web3Wrapper.toBaseUnitAmount
            const amountOut = ethers.parseUnits('100', 18);
            
            // 🔧 使用FundRecoveryFeature接口和现代语法
            const fundRecoveryFeature = await ethers.getContractAt('IFundRecoveryFeature', await zeroEx.getAddress());
            const ownerSigner = await env.provider.getSigner(owner);
            await fundRecoveryFeature
                .connect(ownerSigner)
                .transferTrappedTokensTo(await token.getAddress(), amountOut, recipientAddress);
            
            // 🔧 使用现代ethers v6语法
            const recipientAddressBalanceAferTransfer = await token.balanceOf(recipientAddress);
            return expect(recipientAddressBalanceAferTransfer).to.be.closeTo(amountOut, 100n);
        });
        it('Amount -1 transfers entire balance of ERC-20', async () => {
            // 🔧 使用现代ethers v6语法
            const balanceOwner = await token.balanceOf(await zeroEx.getAddress());
            
            // 🔧 使用FundRecoveryFeature接口
            const fundRecoveryFeature = await ethers.getContractAt('IFundRecoveryFeature', await zeroEx.getAddress());
            const ownerSigner = await env.provider.getSigner(owner);
            await fundRecoveryFeature
                .connect(ownerSigner)
                .transferTrappedTokensTo(await token.getAddress(), constants.MAX_UINT256, recipientAddress);
            
            const recipientAddressBalanceAferTransfer = await token.balanceOf(recipientAddress);
            // 🔧 精确验证：recipient应该收到所有的zeroEx token余额
            return expect(recipientAddressBalanceAferTransfer).to.be.closeTo(balanceOwner, 100n);
        });
        it('Amount -1 transfers entire balance of ETH', async () => {
            const amountOut = 20n;
            const ownerSigner = await ethers.getSigner(owner);
            const tx = await ownerSigner.sendTransaction({
                to: await zeroEx.getAddress(),
                value: amountOut,
            });
            await tx.wait();
            // 🔧 使用现代ethers v6语法
            const balanceOwner = await ethers.provider.getBalance(await zeroEx.getAddress());
            
            // 🔧 使用FundRecoveryFeature接口
            const fundRecoveryFeature = await ethers.getContractAt('IFundRecoveryFeature', await zeroEx.getAddress());
            await fundRecoveryFeature
                .connect(ownerSigner)
                .transferTrappedTokensTo(ETH_TOKEN_ADDRESS, constants.MAX_UINT256, recipientAddress);
            
            const recipientAddressBalanceAferTransfer = await ethers.provider.getBalance(recipientAddress);
            return expect(recipientAddressBalanceAferTransfer).to.be.closeTo(balanceOwner, ethers.parseEther('0.001'));
        });
        it('Transfers ETH ', async () => {
            const amountOut = 20n;
            const ownerSigner = await ethers.getSigner(owner);
            const tx = await ownerSigner.sendTransaction({
                to: await zeroEx.getAddress(),
                value: amountOut,
            });
            await tx.wait();
            const ownerSigner2 = await env.provider.getSigner(owner);
            // 🔧 使用FundRecoveryFeature接口调用transferTrappedTokensTo
            const fundRecoveryFeature = await ethers.getContractAt('IFundRecoveryFeature', await zeroEx.getAddress());
            await fundRecoveryFeature
                .connect(ownerSigner2)
                .transferTrappedTokensTo(ETH_TOKEN_ADDRESS, amountOut - 1n, recipientAddress); // 🔧 使用BigInt字面量
            const recipientAddressBalance = await ethers.provider.getBalance(recipientAddress);
            return expect(recipientAddressBalance).to.be.closeTo(amountOut - 1n, ethers.parseEther('0.001')); // 🔧 使用closeTo精确检查
        });
        it('Feature `transferTrappedTokensTo` can only be called by owner', async () => {
            // 🔧 使用FundRecoveryFeature接口和实际账户
            const fundRecoveryFeature = await ethers.getContractAt('IFundRecoveryFeature', await zeroEx.getAddress());
            const [, notOwnerAccount] = await ethers.getSigners(); // 使用实际账户
            const notOwnerSigner = notOwnerAccount;
            
            // 🔧 使用try-catch验证权限错误
            const tx = fundRecoveryFeature
                .connect(notOwnerSigner)
                .transferTrappedTokensTo(ETH_TOKEN_ADDRESS, constants.MAX_UINT256, recipientAddress);
            
            try {
                await tx;
                expect.fail('Transaction should have reverted');
            } catch (error: any) {
                // 验证OnlyOwnerError选择器
                expect(error.message).to.include('0x1de45ad1'); // OnlyOwnerError选择器
            }
        });
    });
});
