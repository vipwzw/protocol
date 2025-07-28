import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
/**
 * 初始化 Hardhat 测试环境
 */
export declare function setupHardhatEnvironment(): Promise<{
    provider: any;
    signers: HardhatEthersSigner[];
    accounts: string[];
    defaultAccount: string;
    defaultSigner: HardhatEthersSigner;
}>;
/**
 * 获取测试账户地址列表
 */
export declare function getTestAccounts(): string[];
/**
 * 获取测试 provider
 */
export declare function getTestProvider(): any;
/**
 * 获取测试签名器
 */
export declare function getTestSigner(index?: number): HardhatEthersSigner;
/**
 * 简化的 Web3Wrapper 兼容接口
 */
export declare function createWeb3Wrapper(): {
    getAccountsAsync(): Promise<string[]>;
    getAvailableAddressesAsync(): Promise<string[]>;
    signMessageAsync(address: string, message: string): Promise<string>;
    signTypedDataAsync(address: string, typedData: any): Promise<string>;
};
