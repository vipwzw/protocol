/**
 * 现代化的 Chai 断言模式参考
 * 用于 ethers v6 + Hardhat 环境
 * 
 * 🎯 目标：替代旧的 chai-as-promised 和 @0x/test-utils 断言
 */

import { expect } from 'chai';
import { ethers } from 'hardhat';

export class ModernAssertionPatterns {
    
    /**
     * ✅ 现代化 Revert 断言模式
     * 替代旧的 .to.be.revertedWith()
     */
    static async demonstrateRevertAssertions() {
        // 示例：这些是正确的现代断言语法
        
        // ✅ 基本 revert 断言 (Hardhat chai matchers)
        // await expect(contract.failingMethod()).to.be.reverted;
        
        // ✅ 带消息的 revert 断言
        // await expect(contract.failingMethod()).to.be.revertedWith('Expected error message');
        
        // ✅ 自定义错误断言 (Solidity 0.8.4+)
        // await expect(contract.failingMethod()).to.be.revertedWithCustomError(contract, 'CustomErrorName');
        
        // ✅ 带参数的自定义错误
        // await expect(contract.failingMethod()).to.be.revertedWithCustomError(contract, 'CustomErrorName')
        //     .withArgs(expectedArg1, expectedArg2);
        
        // ✅ Panic 错误断言 (溢出等)
        // await expect(contract.overflowMethod()).to.be.revertedWithPanic(0x11); // 算术溢出
        // await expect(contract.divisionByZero()).to.be.revertedWithPanic(0x12); // 除零错误
        
        // ✅ 无原因 revert
        // await expect(contract.simpleRevert()).to.be.revertedWithoutReason();
        
        console.log('✅ Modern revert assertion patterns loaded');
    }
    
    /**
     * ✅ 现代化事件断言模式
     */
    static async demonstrateEventAssertions() {
        // ✅ 事件发出断言
        // await expect(contract.emitEvent()).to.emit(contract, 'EventName');
        
        // ✅ 带参数的事件断言
        // await expect(contract.emitEvent()).to.emit(contract, 'EventName')
        //     .withArgs(expectedArg1, expectedArg2);
        
        // ✅ 多个事件断言
        // const tx = await contract.multipleEvents();
        // await expect(tx).to.emit(contract, 'FirstEvent');
        // await expect(tx).to.emit(contract, 'SecondEvent');
        
        console.log('✅ Modern event assertion patterns loaded');
    }
    
    /**
     * ✅ 现代化余额变化断言
     */
    static async demonstrateBalanceAssertions() {
        // ✅ ETH 余额变化断言
        // await expect(() => contract.withdraw()).to.changeEtherBalance(recipient, expectedAmount);
        // await expect(() => contract.withdraw()).to.changeEtherBalances([recipient1, recipient2], [amount1, amount2]);
        
        // ✅ ERC20 余额变化断言
        // await expect(() => token.transfer(recipient, amount)).to.changeTokenBalance(token, recipient, amount);
        // await expect(() => token.transfer(recipient, amount)).to.changeTokenBalances(token, [sender, recipient], [-amount, amount]);
        
        console.log('✅ Modern balance assertion patterns loaded');
    }
    
    /**
     * ❌ 需要避免的旧模式
     */
    static getDeprecatedPatterns() {
        return {
            // ❌ 避免：旧的 chai-as-promised 语法
            oldRevert: `
                // 不要使用：
                expect(promise).to.eventually.be.rejected;
                expect(promise).to.be.rejectedWith('error');
            `,
            
            // ❌ 避免：@0x/test-utils 的旧语法
            oldUtils: `
                // 不要使用：
                expectTransactionFailedAsync()
                expectTransactionFailedWithoutReasonAsync()
                expectContractCallFailedAsync()
            `,
            
            // ❌ 避免：过时的 web3 模式
            oldWeb3: `
                // 不要使用：
                web3Wrapper.getBalanceAsync()
                web3Wrapper.getAvailableAddressesAsync()
                contract.callAsync()
                contract.sendTransactionAsync()
            `
        };
    }
    
    /**
     * 🎯 BigInt 断言模式 (ethers v6)
     */
    static demonstrateBigIntAssertions() {
        // ✅ BigInt 比较
        const amount1 = 1000n;
        const amount2 = 1000n;
        
        expect(amount1).to.equal(amount2);
        expect(amount1).to.be.at.least(500n);
        expect(amount1).to.be.at.most(2000n);
        
        // ✅ 转换为 BigInt 进行比较
        const ethersResult = ethers.parseEther('1.0'); // 返回 bigint
        expect(ethersResult).to.equal(ethers.parseEther('1.0'));
        
        console.log('✅ Modern BigInt assertion patterns loaded');
    }
}

/**
 * 现代化错误处理辅助函数
 */
export class ModernErrorHelpers {
    
    /**
     * 创建标准错误消息
     */
    static createRevertReason(reason: string): string {
        return reason;
    }
    
    /**
     * 验证地址格式
     */
    static isValidAddress(address: string): boolean {
        return ethers.isAddress(address);
    }
    
    /**
     * 创建随机地址（用于测试）
     */
    static createRandomAddress(): string {
        return ethers.Wallet.createRandom().address;
    }
    
    /**
     * 解析交易收据中的事件
     */
    static parseEventsFromReceipt(receipt: any, contract: any, eventName: string) {
        return receipt.logs
            .filter((log: any) => log.address === contract.target)
            .map((log: any) => contract.interface.parseLog(log))
            .filter((parsed: any) => parsed && parsed.name === eventName);
    }
}

// 导出常用的现代化常量
export const ModernConstants = {
    ZERO_ADDRESS: ethers.ZeroAddress,
    MAX_UINT256: ethers.MaxUint256,
    ZERO_AMOUNT: 0n,
    ONE_ETHER: ethers.parseEther('1.0'),
    
    // 常用的 revert 消息
    REVERT_MESSAGES: {
        UNAUTHORIZED: 'Unauthorized',
        INSUFFICIENT_BALANCE: 'Insufficient balance',
        INVALID_ADDRESS: 'Invalid address',
        ALREADY_EXISTS: 'Already exists',
        NOT_FOUND: 'Not found'
    }
};