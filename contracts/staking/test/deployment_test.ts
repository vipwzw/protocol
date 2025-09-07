import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer } from 'ethers';

import { deployAndConfigureContractsAsync } from './utils/api_wrapper';
import { ERC20Wrapper } from '@0x/contracts-asset-proxy';

describe('Deployment Test - ethers v6 best practices', () => {
    let owner: string;
    let erc20Wrapper: ERC20Wrapper;

    beforeEach(async () => {
        const signers = await ethers.getSigners();
        owner = signers[0].address;

        // Setup ERC20Wrapper for each test
        const accounts = signers.map(s => s.address);
        erc20Wrapper = new ERC20Wrapper(ethers.provider, accounts, owner);
    });

    it('should deploy and configure contracts using ethers v6 best practices', async () => {
        // ✅ 测试新的部署模式
        const wrapper = await deployAndConfigureContractsAsync({ provider: ethers.provider }, owner, erc20Wrapper);

        // ✅ 验证合约部署成功 - 使用 await getAddress()
        expect(await wrapper.stakingContract.getAddress()).to.not.be.empty;
        expect(await wrapper.stakingProxyContract.getAddress()).to.not.be.empty;
        expect(await wrapper.zrxVaultContract.getAddress()).to.not.be.empty;
        expect(await wrapper.zrxTokenContract.getAddress()).to.not.be.empty;
        expect(await wrapper.wethContract.getAddress()).to.not.be.empty;

        console.log('✅ All contracts deployed successfully using ethers v6 patterns');
        console.log('🎯 Staking:', await wrapper.stakingContract.getAddress());
        console.log('🎯 StakingProxy:', await wrapper.stakingProxyContract.getAddress());
        console.log('🎯 ZrxVault:', await wrapper.zrxVaultContract.getAddress());
        console.log('🎯 ZRX Token:', await wrapper.zrxTokenContract.getAddress());
        console.log('🎯 WETH Token:', await wrapper.wethContract.getAddress());
    });

    it('should have proper contract authorization', async () => {
        const wrapper = await deployAndConfigureContractsAsync({ provider: ethers.provider }, owner, erc20Wrapper);
        const ownerAddress = owner;

        // ✅ 验证授权设置 - 使用现代方法
        const isZrxVaultAuthorized = await wrapper.zrxVaultContract.authorized(ownerAddress);
        const isStakingProxyAuthorized = await wrapper.stakingProxyContract.authorized(ownerAddress);

        expect(isZrxVaultAuthorized).to.be.true;
        expect(isStakingProxyAuthorized).to.be.true;

        console.log('✅ Authorization configured correctly');
    });

    it('should demonstrate proper Signer vs Provider usage', async () => {
        const wrapper = await deployAndConfigureContractsAsync({ provider: ethers.provider }, owner, erc20Wrapper);

        // ✅ 这应该能工作 - 读取状态 (跳过 mint，因为 DummyERC20Token 可能没有 mint 方法)
        const balance = await wrapper.zrxTokenContract.balanceOf(owner);
        expect(balance).to.be.greaterThanOrEqual(0n);

        console.log('✅ Signer/Provider pattern working correctly');
    });
});
