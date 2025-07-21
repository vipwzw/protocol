import { TxData, SupportedProvider } from 'ethereum-types';
import type { FoundryArtifact, FoundryArtifacts } from './foundry-types';

/**
 * Foundry 原生部署工具
 * 直接使用 Foundry JSON 格式部署合约，无需适配到旧的 ContractArtifact 格式
 */

/**
 * 从 Foundry artifact 部署合约
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

/**
 * 批量部署函数的便捷工具
 */
export class FoundryDeployer {
    constructor(
        private provider: SupportedProvider,
        private txDefaults: Partial<TxData>,
        private artifacts: FoundryArtifacts,
    ) {}

    /**
     * 部署单个合约
     */
    async deploy<T>(
        ContractClass: any,
        artifactKey: keyof FoundryArtifacts,
        ...constructorArgs: any[]
    ): Promise<T> {
        const artifact = this.artifacts[artifactKey] as FoundryArtifact;
        return deployFromFoundryArtifactAsync<T>(
            ContractClass,
            artifact,
            this.provider,
            this.txDefaults,
            this.artifacts,
            ...constructorArgs,
        );
    }

    /**
     * 创建一个绑定到特定合约类的部署函数
     */
    createDeployer<T>(ContractClass: any) {
        return async (
            artifactKey: keyof FoundryArtifacts,
            ...constructorArgs: any[]
        ): Promise<T> => {
            return this.deploy<T>(ContractClass, artifactKey, ...constructorArgs);
        };
    }
} 