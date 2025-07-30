/**
 * Hardhat 生成的合约 artifact 的类型定义
 * 对应 Hardhat JSON 输出格式
 */

/**
 * Hardhat 合约 Artifact - 主要类型
 * 直接对应 Hardhat 输出的 JSON 结构
 */
export interface HardhatArtifact {
    _format: string;
    contractName: string;
    sourceName: string;
    abi: any[]; // 使用更宽松的类型避免 ContractAbi 兼容性问题
    bytecode: string;
    deployedBytecode: string;
    linkReferences: Record<string, Record<string, Array<{ start: number; length: number }>>>;
    deployedLinkReferences: Record<string, Record<string, Array<{ start: number; length: number }>>>;
}

/**
 * Hardhat Artifacts 集合类型
 */
export interface HardhatArtifacts {
    [contractName: string]: HardhatArtifact;
}

/**
 * Bootstrap 阶段需要的 Feature Artifacts
 */
export interface BootstrapFeatureArtifacts {
    registry: HardhatArtifact;
    ownable: HardhatArtifact;
}

/**
 * 完整部署需要的 Feature Artifacts
 */
export interface FullFeatureArtifacts extends BootstrapFeatureArtifacts {
    transformERC20: HardhatArtifact;
    metaTransactions: HardhatArtifact;
    nativeOrders: HardhatArtifact;
    feeCollectorController: HardhatArtifact;
    otcOrders: HardhatArtifact;
}
