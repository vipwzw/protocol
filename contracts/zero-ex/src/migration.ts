import { NULL_ADDRESS } from '@0x/utils';
import { TxData, SupportedProvider } from 'ethereum-types';
import * as _ from 'lodash';

import { artifacts } from './artifacts';
import { deployFromFoundryArtifactAsync } from './foundry-deployer';
import type {
    FoundryArtifact,
    FoundryArtifacts,
    BootstrapFeatureArtifacts,
    FullFeatureArtifacts,
} from './foundry-types';
import {
    // // FeeCollectorControllerContract // Not available in TypeChain, // Not available in TypeChain output
    FullMigration as FullMigrationContract,
    InitialMigration as InitialMigrationContract,
    IZeroEx as IZeroExContract,
    MetaTransactionsFeature as MetaTransactionsFeatureContract,
    NativeOrdersFeature as NativeOrdersFeatureContract,
    OtcOrdersFeature as OtcOrdersFeatureContract,
    OwnableFeature as OwnableFeatureContract,
    SimpleFunctionRegistryFeature as SimpleFunctionRegistryFeatureContract,
    TransformERC20Feature as TransformERC20FeatureContract,
    ZeroEx as ZeroExContract,
} from './wrappers';

// Import TypeChain factories directly
import { SimpleFunctionRegistryFeature__factory } from '../test/typechain-types/factories/SimpleFunctionRegistryFeature__factory';
import { OwnableFeature__factory } from '../test/typechain-types/factories/OwnableFeature__factory';
import { InitialMigration__factory } from '../test/typechain-types/factories/migrations/InitialMigration__factory';
import { ZeroEx__factory } from '../test/typechain-types/factories/ZeroEx__factory';
import { TransformERC20Feature__factory } from '../test/typechain-types/factories/TransformERC20Feature__factory';
import { MetaTransactionsFeature__factory } from '../test/typechain-types/factories/MetaTransactionsFeature__factory';
import { NativeOrdersFeature__factory } from '../test/typechain-types/factories/NativeOrdersFeature__factory';
import { OtcOrdersFeature__factory } from '../test/typechain-types/factories/OtcOrdersFeature__factory';
import { FullMigration__factory } from '../test/typechain-types/factories/migrations/FullMigration__factory';

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
                    SimpleFunctionRegistryFeature__factory,
                    _featureArtifacts.registry,
                    provider,
                    txDefaults,
                    artifacts,
                )
            ).target as string,
        ownable:
            features.ownable ||
            (
                await deployFromFoundryArtifactAsync<OwnableFeatureContract>(
                    OwnableFeature__factory,
                    _featureArtifacts.ownable,
                    provider,
                    txDefaults,
                    artifacts,
                )
            ).target as string,
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
        InitialMigration__factory,
        artifacts.InitialMigration,
        provider,
        txDefaults,
        artifacts,
        txDefaults.from as string,
    );
    const zeroEx = await deployFromFoundryArtifactAsync<ZeroExContract>(
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
        // FeeCollectorController not available in TypeChain output
        // _config.feeCollectorController = (
        //     await deployFromFoundryArtifactAsync<FeeCollectorControllerContract>(
        //         FeeCollectorControllerContract,
        //         _featureArtifacts.feeCollectorController,
        //         provider,
        //         txDefaults,
        //         artifacts,
        //         _config.wethAddress,
        //         _config.stakingAddress,
        //     )
        // ).address;
    }
    return {
        ...(await deployBootstrapFeaturesAsync(provider, txDefaults)),
        transformERC20:
            features.transformERC20 ||
            (
                await deployFromFoundryArtifactAsync<TransformERC20FeatureContract>(
                    TransformERC20Feature__factory,
                    _featureArtifacts.transformERC20,
                    provider,
                    txDefaults,
                    artifacts,
                )
            ).target as string,
        metaTransactions:
            features.metaTransactions ||
            (
                await deployFromFoundryArtifactAsync<MetaTransactionsFeatureContract>(
                    MetaTransactionsFeature__factory,
                    _featureArtifacts.metaTransactions,
                    provider,
                    txDefaults,
                    artifacts,
                    _config.zeroExAddress,
                )
            ).target as string,
        nativeOrders:
            features.nativeOrders ||
            (
                await deployFromFoundryArtifactAsync<NativeOrdersFeatureContract>(
                    NativeOrdersFeature__factory,
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
            ).target as string,
        otcOrders:
            features.otcOrders ||
            (
                await deployFromFoundryArtifactAsync<OtcOrdersFeatureContract>(
                    OtcOrdersFeature__factory,
                    _featureArtifacts.otcOrders,
                    provider,
                    txDefaults,
                    artifacts,
                    _config.zeroExAddress,
                    _config.wethAddress,
                )
            ).target as string,
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
): Promise<ZeroExContract> {
    const migrator = await deployFromFoundryArtifactAsync<FullMigrationContract>(
        FullMigration__factory,
        artifacts.FullMigration,
        provider,
        txDefaults,
        artifacts,
        txDefaults.from as string,
    );
    const zeroEx = await deployFromFoundryArtifactAsync<ZeroExContract>(
        ZeroEx__factory,
        artifacts.ZeroEx,
        provider,
        txDefaults,
        artifacts,
        await migrator.getBootstrapper(),
    );
    const _config = { ...config, zeroExAddress: zeroEx.target as string };
    const allFeatures = await deployAllFeaturesAsync(provider, txDefaults, features, _config, featureArtifacts);
    await migrator
        .migrateZeroEx(owner, zeroEx.target as string, allFeatures, {
            transformerDeployer: config.transformerDeployer || '0x0000000000000000000000000000000000000000',
        })
        ;
    return zeroEx;
}
