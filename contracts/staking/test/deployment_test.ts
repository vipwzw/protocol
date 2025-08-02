import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer } from 'ethers';

import { deployAndConfigureContractsAsync } from './utils/api_wrapper';

describe('Deployment Test - ethers v6 best practices', () => {
    let owner: Signer;
    
    before(async () => {
        [owner] = await ethers.getSigners();
    });

    it('should deploy and configure contracts using ethers v6 best practices', async () => {
        // ✅ 测试新的部署模式
        const wrapper = await deployAndConfigureContractsAsync(owner);
        
        // ✅ 验证合约部署成功 - 使用 await getAddress()
        expect(await wrapper.stakingContract.getAddress()).to.not.be.empty;
        expect(await wrapper.stakingProxyContract.getAddress()).to.not.be.empty;
        expect(await wrapper.zrxVaultContract.getAddress()).to.not.be.empty;
        expect(wrapper.zrxTokenContract.address).to.not.be.empty;
        expect(wrapper.wethTokenContract.address).to.not.be.empty;
        
        console.log('✅ All contracts deployed successfully using ethers v6 patterns');
        console.log('🎯 Staking:', await wrapper.stakingContract.getAddress());
        console.log('🎯 StakingProxy:', await wrapper.stakingProxyContract.getAddress());
        console.log('🎯 ZrxVault:', await wrapper.zrxVaultContract.getAddress());
        console.log('🎯 ZRX Token:', wrapper.zrxTokenContract.address);
        console.log('🎯 WETH Token:', wrapper.wethTokenContract.address);
    });

    it('should have proper contract authorization', async () => {
        const wrapper = await deployAndConfigureContractsAsync(owner);
        const ownerAddress = await owner.getAddress();
        
        // ✅ 验证授权设置 - 使用现代方法
        const isZrxVaultAuthorized = await wrapper.zrxVaultContract.authorized(ownerAddress);
        const isStakingProxyAuthorized = await wrapper.stakingProxyContract.authorized(ownerAddress);
        
        expect(isZrxVaultAuthorized).to.be.true;
        expect(isStakingProxyAuthorized).to.be.true;
        
        console.log('✅ Authorization configured correctly');
    });

    it('should demonstrate proper Signer vs Provider usage', async () => {
        const wrapper = await deployAndConfigureContractsAsync(owner);
        
        // ✅ 这应该能工作 - 通过 signer 发送交易
        const tx = await wrapper.zrxTokenContract.mint(await owner.getAddress(), 1000n);
        expect(tx).to.have.property('wait');
        
        // ✅ 这应该能工作 - 读取状态
        const balance = await wrapper.zrxTokenContract.balanceOf(await owner.getAddress());
        expect(balance).to.equal(1000n);
        
        console.log('✅ Signer/Provider pattern working correctly');
    });
});