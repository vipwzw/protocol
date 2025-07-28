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
            return await testSigner.signTypedData(
                typedData.domain,
                typedData.types,
                typedData.message || typedData.value || typedData
            );
        } catch (error) {
            throw new Error(`Failed to sign typed data: ${error}`);
        }
    },
    // 添加 send 方法以与 assert.ts 中的代码兼容
    async send(method: string, params: any[]): Promise<any> {
        if (method === 'eth_accounts') {
            // 返回一个包含一些测试地址的数组
            return ['0x0000000000000000000000000000000000000000'];
        }
        return provider.send(method, params);
    }
};

export { provider, web3Wrapper };
