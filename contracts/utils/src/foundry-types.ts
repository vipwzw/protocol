/**
 * Utils 包的 Foundry 类型定义
 * 基于 Foundry JSON 输出格式的原生类型
 */

import { TxData, SupportedProvider, ContractAbi } from 'ethereum-types';

/**
 * Foundry 字节码格式
 */
export interface FoundryBytecode {
    object: string;
    sourceMap: string;
    linkReferences: Record<string, Record<string, Array<{ start: number; length: number }>>>;
}

/**
 * Foundry 编译器设置
 */
export interface FoundryCompilerSettings {
    remappings: string[];
    optimizer: {
        enabled: boolean;
        runs: number;
    };
    metadata: {
        bytecodeHash: string;
    };
    compilationTarget: Record<string, string>;
    evmVersion: string;
    libraries: Record<string, any>;
}

/**
 * Foundry 编译器信息
 */
export interface FoundryCompiler {
    version: string;
}

/**
 * Foundry 元数据
 */
export interface FoundryMetadata {
    compiler: FoundryCompiler;
    language: string;
    output: {
        abi: ContractAbi;
        devdoc: any;
        userdoc: any;
    };
    settings: FoundryCompilerSettings;
    sources: Record<string, any>;
    version: number;
}

/**
 * Foundry 合约 Artifact - 主要类型
 * 直接对应 Foundry 输出的 JSON 结构
 */
export interface FoundryArtifact {
    abi: ContractAbi;
    bytecode: FoundryBytecode;
    deployedBytecode: FoundryBytecode;
    methodIdentifiers: Record<string, string>; // 函数名 -> 选择器映射
    rawMetadata: string; // JSON 字符串
    metadata: FoundryMetadata;
    id: number;
}

/**
 * Foundry Artifacts 集合类型
 */
export type FoundryArtifacts = Record<string, FoundryArtifact>;

/**
 * Utils 包特定的 Foundry Artifacts 接口
 * 基于统一版本的合约（移除版本化后缀）
 */
export interface UtilsFoundryArtifacts extends FoundryArtifacts {
    // 统一版本合约
    Authorizable: FoundryArtifact;
    IAuthorizable: FoundryArtifact;
    IOwnable: FoundryArtifact;
    LibAuthorizableRichErrors: FoundryArtifact;
    LibBytesRichErrors: FoundryArtifact;
    LibBytes: FoundryArtifact;
    LibMathRichErrors: FoundryArtifact;
    LibMath: FoundryArtifact;
    LibOwnableRichErrors: FoundryArtifact;
    LibReentrancyGuardRichErrors: FoundryArtifact;
    LibRichErrors: FoundryArtifact;
    LibSafeMathRichErrors: FoundryArtifact;
    Ownable: FoundryArtifact;
    ReentrancyGuard: FoundryArtifact;
}

/**
 * 从 Foundry artifact 部署合约的通用函数
 * @param ContractClass 合约的包装器类
 * @param foundryArtifact Foundry 生成的 artifact
 * @param provider 以太坊提供者
 * @param txDefaults 交易默认参数
 * @param logDecodeDependencies 日志解码依赖（通常是 artifacts 对象）
 * @param constructorArgs 构造函数参数
 * @returns 部署的合约实例
 */
export async function deployFromFoundryArtifactAsync<T>(
    ContractClass: any,
    foundryArtifact: FoundryArtifact,
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    logDecodeDependencies: FoundryArtifacts,
    ...constructorArgs: any[]
): Promise<T> {
    // 从 Foundry artifact 中提取字节码和 ABI
    const bytecode = foundryArtifact.bytecode.object;
    const abi = foundryArtifact.abi;

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
