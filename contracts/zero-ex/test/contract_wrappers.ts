/*
 * -----------------------------------------------------------------------------
 * 合约包装器 - 提供 deployFrom0xArtifactAsync 兼容性
 * -----------------------------------------------------------------------------
 */

import { BaseContract } from '@0x/base-contract';
import { ZeroExProvider } from 'ethereum-types';
import { ContractArtifact, TxData } from 'ethereum-types';
import { ethers } from 'ethers';

import { 
    TestLibNativeOrder__factory,
    TestMintableERC20Token__factory,
    PermissionlessTransformerDeployer__factory,
    ZeroEx__factory,
    IZeroEx__factory
} from '../src/typechain-types/factories';

import type {
    TestLibNativeOrder,
    TestMintableERC20Token,
    PermissionlessTransformerDeployer,
    ZeroEx,
    IZeroEx
} from '../src/typechain-types';

/**
 * 创建兼容的合约包装器类
 */
function createContractWrapper<T extends ethers.Contract>(
    contractFactory: any
) {
    return class extends BaseContract {
        public static async deployFrom0xArtifactAsync(
            artifact: ContractArtifact,
            provider: ZeroExProvider,
            txDefaults: Partial<TxData>,
            logDecodeDependencies: { [contractName: string]: any },
            ...constructorArgs: any[]
        ): Promise<any> {
            // 转换 provider 为 ethers.Provider
            const ethersProvider = new ethers.JsonRpcProvider(provider as any);
            
            // 获取签名者
            const signer = await ethersProvider.getSigner(txDefaults.from as string);
            
            // 部署合约
            const factory = new contractFactory(signer);
            const contract = await factory.deploy(...constructorArgs);
            await contract.waitForDeployment();
            
            // 返回包装后的合约实例
            const instance = new this(
                artifact.contractName,
                artifact.abi,
                await contract.getAddress(),
                provider,
                txDefaults,
                logDecodeDependencies
            );
            
            // 附加 TypeChain 生成的方法
            const typedContract = contract as T;
            Object.setPrototypeOf(instance, Object.getPrototypeOf(typedContract));
            Object.assign(instance, typedContract);
            
            return instance;
        }
        
        // 添加调用相关方法的包装
        public async callAsync(): Promise<any> {
            // 这个方法会被具体的合约方法覆盖
            throw new Error('callAsync method should be overridden by specific contract methods');
        }
    };
}

// 导出合约包装器类
export const TestLibNativeOrderContract = createContractWrapper<TestLibNativeOrder>(
    TestLibNativeOrder__factory
);

export const TestMintableERC20TokenContract = createContractWrapper<TestMintableERC20Token>(
    TestMintableERC20Token__factory
);

export const PermissionlessTransformerDeployerContract = createContractWrapper<PermissionlessTransformerDeployer>(
    PermissionlessTransformerDeployer__factory
);

export const ZeroExContract = createContractWrapper<ZeroEx>(
    ZeroEx__factory
);

export const IZeroExContract = createContractWrapper<IZeroEx>(
    IZeroEx__factory
);

// 导出类型
export type { TestLibNativeOrder as TestLibNativeOrderContract } from '../src/typechain-types';
export type { TestMintableERC20Token as TestMintableERC20TokenContract } from '../src/typechain-types';
export type { PermissionlessTransformerDeployer as PermissionlessTransformerDeployerContract } from '../src/typechain-types';
export type { ZeroEx as ZeroExContract } from '../src/typechain-types';
export type { IZeroEx as IZeroExContract } from '../src/typechain-types';