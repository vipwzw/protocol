import { NULL_ADDRESS } from '@0x/utils';
import { TxData, SupportedProvider } from 'ethereum-types';
import { ethers } from 'ethers';
import * as _ from 'lodash';

import { artifacts } from './artifacts';
import type { HardhatArtifact, HardhatArtifacts, BootstrapFeatureArtifacts, FullFeatureArtifacts } from './types';

// Import TypeChain factories
import {
    FullMigration as FullMigrationContract,
    InitialMigration as InitialMigrationContract,
    ZeroEx as ZeroExContract,
} from './wrappers';

import { FullMigration__factory, InitialMigration__factory } from './typechain-types/factories/contracts/src/migrations';
import { ZeroEx__factory } from './typechain-types/factories/contracts/src';
import { SimpleFunctionRegistryFeature__factory, OwnableFeature__factory } from './typechain-types/factories/contracts/src/features';

/**
 * 从 Hardhat artifact 部署合约
 */
async function deployFromHardhatArtifactAsync<T>(
    ContractFactory: any,
    artifact: HardhatArtifact,
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    logDecodeDependencies: HardhatArtifacts,
    ...constructorArgs: any[]
): Promise<T> {
    // 获取 signer - provider 在测试环境中应该有 getSigner 方法
    const signer = await (provider as any).getSigner(txDefaults.from as string);
    // 使用 TypeChain 工厂部署合约
    const factory = new ContractFactory(signer);
    const contract = await factory.deploy(...constructorArgs);
    await contract.waitForDeployment();
    return contract as T;
}

/**
 * Addresses of minimum features for a deployment of the Exchange Proxy.
 */
export interface BootstrapFeatures {
    registry: string;
    ownable: string;
}

/**
 * 默认的引导功能 artifacts
 */
const DEFAULT_BOOTSTRAP_FEATURE_ARTIFACTS: BootstrapFeatureArtifacts = {
    registry: artifacts.SimpleFunctionRegistryFeature,
    ownable: artifacts.OwnableFeature,
};

/**
 * Deploy the minimum features of the Exchange Proxy.
 */
export async function deployBootstrapFeaturesAsync(
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    features: Partial<BootstrapFeatures> = {},
    featureArtifacts: Partial<BootstrapFeatureArtifacts> = {},
): Promise<BootstrapFeatures> {
    const _featureArtifacts = {
        ...DEFAULT_BOOTSTRAP_FEATURE_ARTIFACTS,
        ...featureArtifacts,
    };

    // 部署 SimpleFunctionRegistryFeature
    const registry = features.registry || await (async () => {
        const signer = await (provider as any).getSigner(txDefaults.from as string);
        const factory = new SimpleFunctionRegistryFeature__factory(signer);
        const contract = await factory.deploy();
        await contract.waitForDeployment();
        return await contract.getAddress();
    })();

    // 部署 OwnableFeature
    const ownable = features.ownable || await (async () => {
        const signer = await (provider as any).getSigner(txDefaults.from as string);
        const factory = new OwnableFeature__factory(signer);
        const contract = await factory.deploy();
        await contract.waitForDeployment();
        return await contract.getAddress();
    })();

    return {
        registry,
        ownable,
    };
}

/**
 * Migrate an instance of the Exchange proxy with minimum viable features.
 */
export async function initialMigrateAsync(
    owner: string,
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    features: Partial<BootstrapFeatures> = {},
): Promise<ZeroExContract> {
    const migrator = await deployFromHardhatArtifactAsync<InitialMigrationContract>(
        InitialMigration__factory,
        artifacts.InitialMigration,
        provider,
        txDefaults,
        artifacts,
        txDefaults.from as string,
    );
    const zeroEx = await deployFromHardhatArtifactAsync<ZeroExContract>(
        ZeroEx__factory,
        artifacts.ZeroEx,
        provider,
        txDefaults,
        artifacts,
        await migrator.getAddress(),
    );
    await migrator.initializeZeroEx(
        owner,
        await zeroEx.getAddress(),
        await deployBootstrapFeaturesAsync(provider, txDefaults, features),
    );
    return zeroEx;
}

/**
 * Full features for a deployment of the Exchange Proxy.
 */
export interface FullFeatures extends BootstrapFeatures {
    transformERC20: string;
    metaTransactions: string;
    nativeOrders: string;
    otcOrders: string;
}

/**
 * Configuration options for a full migration.
 */
export interface FullMigrationConfig {
    transformerDeployer: string;
    exchangeProxyFlashWallet: string;
    zeroExAddress: string;
    wethAddress: string;
    stakingAddress: string;
    feeCollectorController: string;
    protocolFeeMultiplier: number;
}

/**
 * Default full feature artifacts
 */
const DEFAULT_FULL_FEATURE_ARTIFACTS: FullFeatureArtifacts = {
    registry: artifacts.SimpleFunctionRegistryFeature,
    ownable: artifacts.OwnableFeature,
    transformERC20: artifacts.TransformERC20Feature,
    metaTransactions: artifacts.MetaTransactionsFeature,
    nativeOrders: artifacts.NativeOrdersFeature,
    feeCollectorController: artifacts.FeeCollectorController,
    otcOrders: artifacts.OtcOrdersFeature,
};

/**
 * Deploy all the features for the Exchange Proxy.
 */
export async function deployAllFeaturesAsync(
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    features: Partial<FullFeatures> = {},
    config: Partial<FullMigrationConfig> = {},
    featureArtifacts: Partial<FullFeatureArtifacts> = {},
): Promise<FullFeatures> {
    const _featureArtifacts = {
        ...DEFAULT_FULL_FEATURE_ARTIFACTS,
        ...featureArtifacts,
    };

    // TODO: 实现实际的合约部署逻辑，等待 typechain 生成完整的类型
    // 目前使用 NULL_ADDRESS 作为占位符
    return {
        registry: features.registry || NULL_ADDRESS,
        ownable: features.ownable || NULL_ADDRESS,
        transformERC20: features.transformERC20 || NULL_ADDRESS,
        metaTransactions: features.metaTransactions || NULL_ADDRESS,
        nativeOrders: features.nativeOrders || NULL_ADDRESS,
        otcOrders: features.otcOrders || NULL_ADDRESS,
    };
}

/**
 * Migrate an instance of the Exchange proxy with all features.
 */
export async function fullMigrateAsync(
    owner: string,
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    features: Partial<FullFeatures> = {},
    config: Partial<FullMigrationConfig> = {},
    featureArtifacts: Partial<FullFeatureArtifacts> = {},
): Promise<ZeroExContract> {
    const migrator = await deployFromHardhatArtifactAsync<FullMigrationContract>(
        FullMigration__factory,
        artifacts.FullMigration,
        provider,
        txDefaults,
        artifacts,
        txDefaults.from as string,
    );
    const zeroEx = await deployFromHardhatArtifactAsync<ZeroExContract>(
        ZeroEx__factory,
        artifacts.ZeroEx,
        provider,
        txDefaults,
        artifacts,
        await migrator.getAddress(),
    );

    const allFeatures = await deployAllFeaturesAsync(provider, txDefaults, features, config, featureArtifacts);
    await migrator.migrateZeroEx(owner, await zeroEx.getAddress(), allFeatures, {
        transformerDeployer: config.transformerDeployer || NULL_ADDRESS,
    });
    return zeroEx;
}
