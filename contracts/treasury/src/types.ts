/**
 * Treasury 包的 Hardhat 类型定义
 * 基于 Hardhat JSON 输出格式的原生类型
 */

import { BaseContract } from '@0x/base-contract';
import { ContractAbi } from 'ethereum-types';

/**
 * Hardhat 合约 Artifact - 主要类型
 * 直接对应 Hardhat 输出的 JSON 结构
 */
export interface HardhatArtifact {
    _format: string;
    contractName: string;
    sourceName: string;
    abi: ContractAbi;
    bytecode: string;
    deployedBytecode: string;
    linkReferences: Record<string, any>;
    deployedLinkReferences: Record<string, any>;
}

/**
 * Hardhat Artifacts 集合类型
 */
export type HardhatArtifacts = Record<string, HardhatArtifact>;

/**
 * Treasury 包特定的 Hardhat Artifacts 接口
 */
export interface TreasuryHardhatArtifacts extends HardhatArtifacts {
    ZrxTreasury: HardhatArtifact;
    DefaultPoolOperator: HardhatArtifact;
    DummyERC20Token: HardhatArtifact;
    IStaking: HardhatArtifact;
    IZrxTreasury: HardhatArtifact;
    TreasuryStaking: HardhatArtifact;
    ISablier: HardhatArtifact;
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
export async function deployFromHardhatArtifactAsync<T extends BaseContract>(
    ContractClass: any,
    hardhatArtifact: HardhatArtifact,
    provider: any,
    txDefaults: any,
    logDecodeDependencies: any,
    ...constructorArgs: any[]
): Promise<T> {
    // Hardhat artifact 转换为 generated-wrappers 期望的格式
    const convertedArtifact = {
        compilerOutput: {
            abi: hardhatArtifact.abi,
            evm: {
                bytecode: {
                    object: hardhatArtifact.bytecode.startsWith('0x')
                        ? hardhatArtifact.bytecode
                        : `0x${hardhatArtifact.bytecode}`,
                },
                deployedBytecode: {
                    object: hardhatArtifact.deployedBytecode
                        ? hardhatArtifact.deployedBytecode.startsWith('0x')
                            ? hardhatArtifact.deployedBytecode
                            : `0x${hardhatArtifact.deployedBytecode}`
                        : '0x',
                },
            },
        },
    };

    // 转换 logDecodeDependencies 中的每个 artifact
    const convertedLogDecodeDependencies: any = {};
    if (logDecodeDependencies) {
        for (const key of Object.keys(logDecodeDependencies)) {
            const dep = logDecodeDependencies[key];
            if (dep && dep.abi) {
                // 这是 Hardhat artifact，需要转换
                convertedLogDecodeDependencies[key] = {
                    compilerOutput: {
                        abi: dep.abi,
                    },
                };
            } else {
                // 已经是正确格式或者是其他格式，直接使用
                convertedLogDecodeDependencies[key] = dep;
            }
        }
    }

    // 使用 deployFrom0xArtifactAsync 方法
    return await ContractClass.deployFrom0xArtifactAsync(
        convertedArtifact,
        provider,
        txDefaults,
        convertedLogDecodeDependencies,
        ...constructorArgs,
    );
}
