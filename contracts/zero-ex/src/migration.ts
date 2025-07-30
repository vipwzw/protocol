import { NULL_ADDRESS } from '@0x/utils';
import { TxData, SupportedProvider } from 'ethereum-types';
import * as _ from 'lodash';

import { artifacts } from './artifacts';
import type {
    HardhatArtifact,
    HardhatArtifacts,
    BootstrapFeatureArtifacts,
    FullFeatureArtifacts,
} from './types';

// Import TypeChain factories
import {
    FullMigration as FullMigrationContract,
    InitialMigration as InitialMigrationContract,
    ZeroEx as ZeroExContract,
} from './wrappers';

import { 
    FullMigration__factory,
    InitialMigration__factory,
    ZeroEx__factory,
} from './typechain-types/factories';

/**
 * 从 Hardhat artifact 部署合约
 */
async function deployFromHardhatArtifactAsync<T>(
    ContractClass: any,
    artifact: HardhatArtifact,
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    logDecodeDependencies: HardhatArtifacts,
    ...constructorArgs: any[]
): Promise<T> {
    // 使用 ContractClass 来实例化合约
    const factory = new ContractClass(provider, artifact.abi, artifact.bytecode);
    const contract = await factory.deploy(...constructorArgs, { ...txDefaults });
    await contract.waitForDeployment();
    return contract;
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
    
    // TODO: 暂时返回空对象，等待更多 typechain 类型生成
    return {
        registry: features.registry || NULL_ADDRESS,
        ownable: features.ownable || NULL_ADDRESS,
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
        migrator.target as string,
    );
    await migrator
        .initializeZeroEx(owner, zeroEx.target as string, await deployBootstrapFeaturesAsync(provider, txDefaults, features))
        ;
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
    
    // TODO: 暂时返回空对象，等待更多 typechain 类型生成
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
        migrator.target as string,
    );
    
    const allFeatures = await deployAllFeaturesAsync(provider, txDefaults, features, config, featureArtifacts);
    await migrator.migrateZeroEx(
        owner, 
        zeroEx.target as string, 
        allFeatures,
        { transformerDeployer: config.transformerDeployer || NULL_ADDRESS }
    );
    return zeroEx;
}
