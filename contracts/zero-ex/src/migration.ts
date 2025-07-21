import { NULL_ADDRESS } from '@0x/utils';
import { TxData, SupportedProvider } from 'ethereum-types';
import * as _ from 'lodash';

import { artifacts } from './artifacts';
import { deployFromFoundryArtifactAsync } from './foundry-deployer';
import type { 
    FoundryArtifact, 
    FoundryArtifacts,
    BootstrapFeatureArtifacts, 
    FullFeatureArtifacts 
} from './foundry-types';
import {
    FeeCollectorControllerContract,
    FullMigrationContract,
    InitialMigrationContract,
    IZeroExContract,
    MetaTransactionsFeatureContract,
    NativeOrdersFeatureContract,
    OtcOrdersFeatureContract,
    OwnableFeatureContract,
    SimpleFunctionRegistryFeatureContract,
    TransformERC20FeatureContract,
    ZeroExContract,
} from './wrappers';

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
    return {
        registry:
            features.registry ||
            (
                await deployFromFoundryArtifactAsync<SimpleFunctionRegistryFeatureContract>(
                    SimpleFunctionRegistryFeatureContract,
                    _featureArtifacts.registry,
                    provider,
                    txDefaults,
                    artifacts,
                )
            ).address,
        ownable:
            features.ownable ||
            (
                await deployFromFoundryArtifactAsync<OwnableFeatureContract>(
                    OwnableFeatureContract,
                    _featureArtifacts.ownable,
                    provider,
                    txDefaults,
                    artifacts,
                )
            ).address,
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
    const migrator = await deployFromFoundryArtifactAsync<InitialMigrationContract>(
        InitialMigrationContract,
        artifacts.InitialMigration,
        provider,
        txDefaults,
        artifacts,
        txDefaults.from as string,
    );
    const zeroEx = await deployFromFoundryArtifactAsync<ZeroExContract>(
        ZeroExContract,
        artifacts.ZeroEx,
        provider,
        txDefaults,
        artifacts,
        migrator.address,
    );
    await migrator.initializeZeroEx(owner, zeroEx.address, await deployBootstrapFeaturesAsync(provider, txDefaults, features)).callAsync();
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
    // 验证必需的配置参数
    if (!config.wethAddress || !config.stakingAddress || !config.zeroExAddress) {
        throw new Error('wethAddress, stakingAddress, and zeroExAddress are required for feature deployment');
    }
    const _config = { 
        ...config,
        wethAddress: config.wethAddress,
        stakingAddress: config.stakingAddress,
        zeroExAddress: config.zeroExAddress,
        feeCollectorController: config.feeCollectorController || NULL_ADDRESS,
        protocolFeeMultiplier: config.protocolFeeMultiplier || 0,
    };
    
    if (_config.feeCollectorController === NULL_ADDRESS) {
        if (!_config.wethAddress || !_config.stakingAddress) {
            throw new Error('wethAddress and stakingAddress are required for FeeCollectorController deployment');
        }
        _config.feeCollectorController = (
            await deployFromFoundryArtifactAsync<FeeCollectorControllerContract>(
                FeeCollectorControllerContract,
                _featureArtifacts.feeCollectorController,
                provider,
                txDefaults,
                artifacts,
                _config.wethAddress,
                _config.stakingAddress,
            )
        ).address;
    }
    return {
        ...(await deployBootstrapFeaturesAsync(provider, txDefaults)),
        transformERC20:
            features.transformERC20 ||
            (
                await deployFromFoundryArtifactAsync<TransformERC20FeatureContract>(
                    TransformERC20FeatureContract,
                    _featureArtifacts.transformERC20,
                    provider,
                    txDefaults,
                    artifacts,
                )
            ).address,
        metaTransactions:
            features.metaTransactions ||
            (
                await deployFromFoundryArtifactAsync<MetaTransactionsFeatureContract>(
                    MetaTransactionsFeatureContract,
                    _featureArtifacts.metaTransactions,
                    provider,
                    txDefaults,
                    artifacts,
                    _config.zeroExAddress,
                )
            ).address,
        nativeOrders:
            features.nativeOrders ||
            (
                await deployFromFoundryArtifactAsync<NativeOrdersFeatureContract>(
                    NativeOrdersFeatureContract,
                    _featureArtifacts.nativeOrders,
                    provider,
                    txDefaults,
                    artifacts,
                    _config.zeroExAddress,
                    _config.wethAddress,
                    _config.stakingAddress,
                    _config.feeCollectorController,
                    _config.protocolFeeMultiplier,
                )
            ).address,
        otcOrders:
            features.otcOrders ||
            (
                await deployFromFoundryArtifactAsync<OtcOrdersFeatureContract>(
                    OtcOrdersFeatureContract,
                    _featureArtifacts.otcOrders,
                    provider,
                    txDefaults,
                    artifacts,
                    _config.zeroExAddress,
                    _config.wethAddress,
                )
            ).address,
    };
}

/**
 * Deploy a fully featured instance of the Exchange Proxy.
 */
export async function fullMigrateAsync(
    owner: string,
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    features: Partial<FullFeatures> = {},
    config: Partial<FullMigrationConfig> = {},
    featureArtifacts: Partial<FullFeatureArtifacts> = {},
): Promise<IZeroExContract> {
    const migrator = await deployFromFoundryArtifactAsync<FullMigrationContract>(
        FullMigrationContract,
        artifacts.FullMigration,
        provider,
        txDefaults,
        artifacts,
        txDefaults.from as string,
    );
    const zeroEx = await deployFromFoundryArtifactAsync<ZeroExContract>(
        ZeroExContract,
        artifacts.ZeroEx,
        provider,
        txDefaults,
        artifacts,
        await migrator.getBootstrapper().callAsync(),
    );
    const _config = { ...config, zeroExAddress: zeroEx.address };
    const allFeatures = await deployAllFeaturesAsync(provider, txDefaults, features, _config, featureArtifacts);
    await migrator.migrateZeroEx(owner, zeroEx.address, allFeatures, { transformerDeployer: config.transformerDeployer || '0x0000000000000000000000000000000000000000' }).callAsync();
    return (zeroEx as any) as IZeroExContract;
}
