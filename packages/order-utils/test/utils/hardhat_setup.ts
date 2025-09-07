import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

let provider: any;
let signers: HardhatEthersSigner[];
let accounts: string[];

/**
 * 初始化 Hardhat 测试环境
 */
export async function setupHardhatEnvironment() {
    // 获取 hardhat 内置的 provider
    provider = ethers.provider;

    // 获取测试账户
    signers = await ethers.getSigners();
    accounts = signers.map(signer => signer.address);

    console.log(`🔧 Hardhat 环境已初始化:`);
    console.log(`  - Provider: ${provider.constructor.name}`);
    console.log(`  - 账户数量: ${accounts.length}`);
    console.log(`  - 第一个账户: ${accounts[0]}`);

    return {
        provider,
        signers,
        accounts,
        defaultAccount: accounts[0],
        defaultSigner: signers[0],
    };
}

/**
 * 获取测试账户地址列表
 */
export function getTestAccounts(): string[] {
    if (!accounts) {
        throw new Error('Hardhat environment not initialized. Call setupHardhatEnvironment() first.');
    }
    return accounts;
}

/**
 * 获取测试 provider
 */
export function getTestProvider() {
    if (!provider) {
        throw new Error('Hardhat environment not initialized. Call setupHardhatEnvironment() first.');
    }
    return provider;
}

/**
 * 获取测试签名器
 */
export function getTestSigner(index: number = 0): HardhatEthersSigner {
    if (!signers) {
        throw new Error('Hardhat environment not initialized. Call setupHardhatEnvironment() first.');
    }
    if (index >= signers.length) {
        throw new Error(`Signer index ${index} out of bounds. Available signers: ${signers.length}`);
    }
    return signers[index];
}

/**
 * 简化的 Web3Wrapper 兼容接口
 */
export function createWeb3Wrapper() {
    const testSigner = getTestSigner();

    return {
        async getAccountsAsync(): Promise<string[]> {
            return getTestAccounts();
        },

        async getAvailableAddressesAsync(): Promise<string[]> {
            return getTestAccounts();
        },

        async signMessageAsync(address: string, message: string): Promise<string> {
            // 找到对应地址的签名器
            const targetSigner = signers.find(s => s.address.toLowerCase() === address.toLowerCase());
            if (!targetSigner) {
                throw new Error(`No signer available for address ${address}`);
            }

            // 使用 ethers 的 signMessage 方法
            return await targetSigner.signMessage(ethers.getBytes(message));
        },

        async signTypedDataAsync(address: string, typedData: any): Promise<string> {
            // 找到对应地址的签名器
            const targetSigner = signers.find(s => s.address.toLowerCase() === address.toLowerCase());
            if (!targetSigner) {
                throw new Error(`No signer available for address ${address}`);
            }

            // 处理 EIP712 结构
            let domain, types, value;

            if (typedData.domain && typedData.types && (typedData.message || typedData.value)) {
                domain = typedData.domain;
                types = { ...typedData.types };
                // 移除 EIP712Domain，ethers 会自动处理
                delete types.EIP712Domain;
                value = typedData.message || typedData.value;
            } else {
                domain = typedData.domain || {};
                types = typedData.types || {};
                delete types.EIP712Domain;
                value = typedData;
            }

            return await targetSigner.signTypedData(domain, types, value);
        },
    };
}
