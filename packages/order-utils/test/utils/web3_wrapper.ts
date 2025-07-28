import { ethers } from 'ethers';

// 创建一个简单的 ethers provider 用于测试
const provider = new ethers.JsonRpcProvider('http://localhost:8545');

// 创建确定性的测试钱包，确保测试结果的一致性
const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const testWallet = ethers.Wallet.fromPhrase(testMnemonic);
const testSigner = testWallet.connect(provider);

// 创建一个兼容的 web3Wrapper 对象
const web3Wrapper = {
    async getAccountsAsync(): Promise<string[]> {
        // 返回确定性的测试地址，确保测试结果一致
        return [testWallet.address];
    },
    async getAvailableAddressesAsync(): Promise<string[]> {
        return this.getAccountsAsync();
    },
    async signMessageAsync(address: string, message: string): Promise<string> {
        // 使用确定性的测试钱包进行签名
        if (address.toLowerCase() !== testWallet.address.toLowerCase()) {
            throw new Error(`Address ${address} does not match test wallet ${testWallet.address}`);
        }
        try {
            // 使用 ethers v6 的 signMessage 方法
            return await testSigner.signMessage(ethers.getBytes(message));
        } catch (error) {
            throw new Error(`Failed to sign message: ${error}`);
        }
    },
    async signTypedDataAsync(address: string, typedData: any): Promise<string> {
        // 使用确定性的测试钱包进行 TypedData 签名
        if (address.toLowerCase() !== testWallet.address.toLowerCase()) {
            throw new Error(`Address ${address} does not match test wallet ${testWallet.address}`);
        }
        try {
            // 使用 ethers v6 的 signTypedData 方法
            // 需要正确解析 EIP712 结构
            let domain, types, value;
            
            if (typedData.domain && typedData.types && (typedData.message || typedData.value)) {
                // 标准 EIP712 结构
                domain = typedData.domain;
                types = { ...typedData.types };
                // 移除 EIP712Domain 类型，ethers 会自动处理
                delete types.EIP712Domain;
                value = typedData.message || typedData.value;
            } else {
                // 兼容其他格式
                domain = typedData.domain || {};
                types = typedData.types || {};
                delete types.EIP712Domain;
                value = typedData;
            }
            
            return await testSigner.signTypedData(domain, types, value);
        } catch (error) {
            throw new Error(`Failed to sign typed data: ${error}`);
        }
    },
    // 添加 send 方法以与 assert.ts 中的代码兼容
    async send(method: string, params: any[]): Promise<any> {
        if (method === 'eth_accounts') {
            // 返回确定性的测试钱包地址
            return [testWallet.address];
        }
        return provider.send(method, params);
    }
};

export { provider, web3Wrapper };
