/**
 * 从合约 artifact 获取代码大小
 */
export function getCodesizeFromArtifact(artifact: any): number {
    if (!artifact) {
        throw new Error('Artifact is undefined');
    }
    
    // 支持不同的 artifact 格式
    let bytecode: string;
    
    if (artifact.bytecode) {
        // Hardhat artifact 格式
        bytecode = artifact.bytecode;
    } else if (artifact.compilerOutput?.evm?.bytecode?.object) {
        // 0x artifact 格式
        bytecode = artifact.compilerOutput.evm.bytecode.object;
    } else if (artifact.evm?.bytecode?.object) {
        // 简化的 evm 格式
        bytecode = artifact.evm.bytecode.object;
    } else if (typeof artifact === 'string') {
        // 直接的字节码字符串
        bytecode = artifact;
    } else {
        throw new Error('Unable to extract bytecode from artifact');
    }
    
    // 移除 0x 前缀（如果存在）
    if (bytecode.startsWith('0x')) {
        bytecode = bytecode.slice(2);
    }
    
    // 计算字节长度（每两个十六进制字符代表一个字节）
    return bytecode.length / 2;
}

/**
 * 检查合约代码大小是否超过限制
 */
export function checkCodesize(artifact: any, maxSize: number = 24576): boolean {
    const codesize = getCodesizeFromArtifact(artifact);
    return codesize <= maxSize;
}

/**
 * 获取合约代码大小的人类可读格式
 */
export function getCodesizeString(artifact: any): string {
    const codesize = getCodesizeFromArtifact(artifact);
    return `${codesize} bytes (${(codesize / 1024).toFixed(2)} KB)`;
}

/**
 * 合约大小限制常量
 */
export const CONTRACT_SIZE_LIMITS = {
    // Ethereum 主网限制（EIP-170）
    MAINNET: 24576, // 24 KB
    // 常见的测试网络限制
    TESTNET: 24576,
    // 没有限制（用于测试）
    UNLIMITED: Number.MAX_SAFE_INTEGER,
};