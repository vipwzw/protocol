/**
 * Utils 包的 Hardhat 类型定义
 * 基于 Hardhat 和 ethers v6 的标准类型
 */

import { TxData, SupportedProvider, ContractAbi } from 'ethereum-types';

/**
 * Hardhat 字节码格式
 */
export interface HardhatBytecode {
    object: string;
    opcodes: string;
    sourceMap: string;
    linkReferences: Record<string, Record<string, Array<{ start: number; length: number }>>>;
}

/**
 * Hardhat 调试信息
 */
export interface HardhatDebugInfo {
    info?: any;
}

/**
 * Hardhat 合约 Artifact - 标准格式
 * 对应 Hardhat 输出的 JSON 结构
 */
export interface HardhatArtifact {
    _format: string;
    contractName: string;
    sourceName: string;
    abi: ContractAbi;
    bytecode: string;
    deployedBytecode: string;
    linkReferences: Record<string, Record<string, Array<{ start: number; length: number }>>>;
    deployedLinkReferences: Record<string, Record<string, Array<{ start: number; length: number }>>>;
}

/**
 * Hardhat Artifacts 集合类型
 */
export type HardhatArtifacts = Record<string, HardhatArtifact>;

/**
 * Utils 包特定的 Hardhat Artifacts 接口
 */
export interface UtilsHardhatArtifacts extends HardhatArtifacts {
    // 主要合约
    Authorizable: HardhatArtifact;
    IAuthorizable: HardhatArtifact;
    IOwnable: HardhatArtifact;
    LibBytes: HardhatArtifact;
    LibMath: HardhatArtifact;
    LibSafeMath: HardhatArtifact;
    Ownable: HardhatArtifact;
    ReentrancyGuard: HardhatArtifact;
    
    // 错误库
    LibAuthorizableRichErrors: HardhatArtifact;
    LibBytesRichErrors: HardhatArtifact;
    LibMathRichErrors: HardhatArtifact;
    LibOwnableRichErrors: HardhatArtifact;
    LibReentrancyGuardRichErrors: HardhatArtifact;
    LibRichErrors: HardhatArtifact;
    LibSafeMathRichErrors: HardhatArtifact;
    
    // 测试合约
    TestLibBytes: HardhatArtifact;
    TestLibRichErrors: HardhatArtifact;
    TestLibSafeMath: HardhatArtifact;
    TestOwnable: HardhatArtifact;
    TestReentrancyGuard: HardhatArtifact;
}

/**
 * 从 Hardhat artifact 部署合约的通用函数
 * @param ContractClass 合约的包装器类
 * @param hardhatArtifact Hardhat 生成的 artifact
 * @param provider 以太坊提供者
 * @param txDefaults 交易默认参数
 * @param logDecodeDependencies 日志解码依赖（通常是 artifacts 对象）
 * @param constructorArgs 构造函数参数
 * @returns 部署的合约实例
 */
export async function deployFromHardhatArtifactAsync<T>(
    ContractClass: any,
    hardhatArtifact: HardhatArtifact,
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    logDecodeDependencies: HardhatArtifacts,
    ...constructorArgs: any[]
): Promise<T> {
    // 从 Hardhat artifact 中提取字节码和 ABI
    const bytecode = hardhatArtifact.bytecode;
    const abi = hardhatArtifact.abi;

    // 使用现有的 deployAsync 方法
    return await ContractClass.deployAsync(
        bytecode,
        abi,
        provider,
        txDefaults,
        logDecodeDependencies,
        ...constructorArgs,
    );
}

/**
 * 合约实例类型，基于 ethers v6
 */
export interface ContractInstance {
    address: string;
    interface: any;
    provider: any;
    [key: string]: any;
}

/**
 * 部署选项
 */
export interface DeploymentOptions {
    gasLimit?: number;
    gasPrice?: string;
    value?: string;
    nonce?: number;
}

/**
 * 合约工厂基础接口
 */
export interface ContractFactory {
    bytecode: string;
    interface: any;
    deploy(...args: any[]): Promise<ContractInstance>;
} 