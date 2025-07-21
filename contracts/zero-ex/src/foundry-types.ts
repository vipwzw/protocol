/**
 * Foundry 生成的合约 artifact 的原生类型定义
 * 直接对应 Foundry JSON 输出格式，不再依赖旧的 ContractArtifact 类型
 */

import { ContractAbi } from 'ethereum-types';

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
    language: 'Solidity';
    output: {
        abi: ContractAbi;
        devdoc: Record<string, any>;
        userdoc: Record<string, any>;
    };
    settings: FoundryCompilerSettings;
    sources: Record<string, {
        keccak256: string;
        urls: string[];
        license: string;
    }>;
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
    methodIdentifiers: Record<string, string>;  // 函数名 -> 选择器映射
    rawMetadata: string;                         // JSON 字符串
    metadata: FoundryMetadata;
    id: number;
}

/**
 * Foundry Artifacts 集合类型
 */
export type FoundryArtifacts = Record<string, FoundryArtifact>;

/**
 * 引导功能所需的 artifacts
 */
export interface BootstrapFeatureArtifacts {
    registry: FoundryArtifact;
    ownable: FoundryArtifact;
}

/**
 * 完整功能所需的 artifacts  
 */
export interface FullFeatureArtifacts extends BootstrapFeatureArtifacts {
    transformERC20: FoundryArtifact;
    metaTransactions: FoundryArtifact;
    nativeOrders: FoundryArtifact;
    feeCollectorController: FoundryArtifact;
    otcOrders: FoundryArtifact;
}

/**
 * 类型守卫：检查对象是否为有效的 Foundry artifact
 */
export function isFoundryArtifact(obj: any): obj is FoundryArtifact {
    return (
        obj &&
        typeof obj === 'object' &&
        Array.isArray(obj.abi) &&
        obj.bytecode &&
        typeof obj.bytecode.object === 'string' &&
        obj.deployedBytecode &&
        typeof obj.deployedBytecode.object === 'string' &&
        obj.methodIdentifiers &&
        typeof obj.methodIdentifiers === 'object' &&
        typeof obj.rawMetadata === 'string' &&
        obj.metadata &&
        typeof obj.id === 'number'
    );
}

/**
 * 从 Foundry artifact 提取 ABI
 */
export function getAbi(artifact: FoundryArtifact): ContractAbi {
    return artifact.abi;
}

/**
 * 从 Foundry artifact 提取字节码
 */
export function getBytecode(artifact: FoundryArtifact): string {
    return artifact.bytecode.object;
}

/**
 * 从 Foundry artifact 提取部署字节码
 */
export function getDeployedBytecode(artifact: FoundryArtifact): string {
    return artifact.deployedBytecode.object;
}

/**
 * 从 Foundry artifact 提取函数选择器
 */
export function getMethodIdentifiers(artifact: FoundryArtifact): Record<string, string> {
    return artifact.methodIdentifiers;
} 