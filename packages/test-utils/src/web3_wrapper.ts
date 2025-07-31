import { ethers } from 'ethers';
const hardhat = require('hardhat');

import { constants } from './constants';

// 默认交易配置，保持向后兼容性
export const txDefaults = {
    gasLimit: constants.DEFAULT_GAS_LIMIT,
    gasPrice: constants.DEFAULT_GAS_PRICE,
};

// 获取 Hardhat 的 provider
const getProvider = () => {
    if (hardhat?.ethers?.provider) {
        return hardhat.ethers.provider;
    }
    // 后备方案：直接从 hardhat network 获取
    return new ethers.JsonRpcProvider(hardhat.network.config.url || 'http://localhost:8545');
};

// 创建兼容的 provider 对象
export const provider = getProvider();

// 创建兼容的 web3Wrapper 对象，保持原有接口
export const web3Wrapper = {
    // 获取节点类型
    async getNodeTypeAsync(): Promise<string> {
        try {
            const version = await provider.send('web3_clientVersion', []);
            if (version.includes('Hardhat')) {
                return 'Ganache'; // 为了兼容性，将 Hardhat 视为 Ganache
            }
            return 'Geth';
        } catch {
            return 'Ganache'; // 默认返回 Ganache
        }
    },

    // 等待交易被挖掘
    async awaitTransactionMinedAsync(txHash: string) {
        const receipt = await provider.waitForTransaction(txHash);
        return receipt;
    },

    // 等待交易成功
    async awaitTransactionSuccessAsync(txHash: string) {
        const receipt = await provider.waitForTransaction(txHash);
        if (!receipt) {
            throw new Error('Transaction receipt not found');
        }
        if (receipt.status !== 1) {
            throw new Error(`Transaction failed: ${txHash}`);
        }
        return receipt;
    },

    // 获取可用地址
    async getAvailableAddressesAsync(): Promise<string[]> {
        try {
            // 首先尝试使用 hardhat.ethers.getSigners()
            if (hardhat?.ethers?.getSigners) {
                const signers = await hardhat.ethers.getSigners();
                return signers.map((signer: any) => signer.address);
            }
            // 后备方案：直接调用 eth_accounts
            return await provider.send('eth_accounts', []);
        } catch (error) {
            console.warn('Failed to get available addresses:', error);
            return [];
        }
    },

    // 增加时间
    async increaseTimeAsync(seconds: number): Promise<void> {
        await provider.send('evm_increaseTime', [seconds]);
        await provider.send('evm_mine', []);
    },

    // 挖掘新块
    async mineBlockAsync(): Promise<void> {
        await provider.send('evm_mine', []);
    },

    // 获取最新区块
    async getBlockAsync(blockNumber: string | number = 'latest') {
        return await provider.getBlock(blockNumber);
    },

    // 获取交易
    async getTransactionAsync(txHash: string) {
        return await provider.getTransaction(txHash);
    },

    // 获取余额
    async getBalanceAsync(address: string): Promise<bigint> {
        const balance = await provider.getBalance(address);
        return balance;
    },

    // 获取 nonce
    async getNonceAsync(address: string): Promise<number> {
        return await provider.getTransactionCount(address);
    },

    // 发送交易
    async sendTransactionAsync(txData: any) {
        // 这个方法需要一个 signer，通常在测试中从 hardhat.ethers.getSigners() 获取
        throw new Error('sendTransactionAsync requires a signer. Use ethers.Signer.sendTransaction() instead.');
    },

    // 估算 Gas
    async estimateGasAsync(txData: any): Promise<bigint> {
        return await provider.estimateGas(txData);
    },

    // 获取 Gas 价格
    async getGasPriceAsync(): Promise<bigint> {
        const feeData = await provider.getFeeData();
        return feeData.gasPrice || constants.DEFAULT_GAS_PRICE;
    },

    // 获取链 ID
    async getNetworkAsync(): Promise<{ chainId: number }> {
        const network = await provider.getNetwork();
        return { chainId: Number(network.chainId) };
    }
};

// 导出 provider 相关函数，保持向后兼容
export const providerUtils = {
    // 启动 provider（在 Hardhat 中不需要，但保持接口兼容）
    startProviderEngine(providerInstance: any): void {
        // Hardhat 自动管理 provider，这里是空实现
        console.log('Provider engine started (Hardhat managed)');
    },

    // 停止 provider（在 Hardhat 中不需要，但保持接口兼容）
    stopProviderEngine(providerInstance: any): void {
        // Hardhat 自动管理 provider，这里是空实现
        console.log('Provider engine stopped (Hardhat managed)');
    }
};