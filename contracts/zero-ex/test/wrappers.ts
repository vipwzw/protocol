/* eslint-disable import/no-unresolved */
/**
 * 合约类型和工厂导出 - 支持所有测试所需的合约
 */

// 核心合约类型导出
export type { ZeroEx as ZeroExContract } from '../src/typechain-types/contracts/src/ZeroEx';
export type { IZeroEx as IZeroExContract } from '../src/typechain-types/contracts/src/IZeroEx';

// 测试合约类型导出 - 按字母顺序排列
export type { TestFullMigration as TestFullMigrationContract } from '../src/typechain-types/contracts/test/TestFullMigration';
export type { TestInitialMigration as TestInitialMigrationContract } from '../src/typechain-types/contracts/test/TestInitialMigration';
export type { TestFixinProtocolFees as TestFixinProtocolFeesContract } from '../src/typechain-types/contracts/test/TestFixinProtocolFees';
export type { TestFixinTokenSpender as TestFixinTokenSpenderContract } from '../src/typechain-types/contracts/test/TestFixinTokenSpender';
export type { TestMigrator as TestMigratorContract } from '../src/typechain-types/contracts/test/TestMigrator';
export type { TestStaking as TestStakingContract } from '../src/typechain-types/contracts/test/TestStaking';

// 代币相关测试合约
export type { TestMintableERC20Token as TestMintableERC20TokenContract } from '../src/typechain-types/contracts/test/tokens/TestMintableERC20Token';
export type { TestMintableERC721Token as TestMintableERC721TokenContract } from '../src/typechain-types/contracts/test/tokens/TestMintableERC721Token';
export type { TestMintableERC1155Token as TestMintableERC1155TokenContract } from '../src/typechain-types/contracts/test/tokens/TestMintableERC1155Token';
export type { TestTokenSpenderERC20Token as TestTokenSpenderERC20TokenContract } from '../src/typechain-types/contracts/test/tokens/TestTokenSpenderERC20Token';
export type { TestWeth as TestWethContract } from '../src/typechain-types/contracts/test/tokens/TestWeth';
export type { DummyERC20Token as DummyERC20TokenContract } from '../src/typechain-types/contracts/src/external/DummyERC20Token';

// Feature 接口类型
export type { IFundRecoveryFeature as IFundRecoveryFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/IFundRecoveryFeature';
export type { IBatchFillNativeOrdersFeature as IBatchFillNativeOrdersFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/IBatchFillNativeOrdersFeature';
export type { IOtcOrdersFeature as IOtcOrdersFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/IOtcOrdersFeature';
export type { IERC721OrdersFeature as IERC721OrdersFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/IERC721OrdersFeature';
export type { IERC1155OrdersFeature as IERC1155OrdersFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/IERC1155OrdersFeature';
export type { INativeOrdersFeature as INativeOrdersFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/INativeOrdersFeature';
export type { ISimpleFunctionRegistryFeature as ISimpleFunctionRegistryFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/ISimpleFunctionRegistryFeature';
export type { IOwnableFeature as IOwnableFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/IOwnableFeature';
export type { ITransformERC20Feature as ITransformERC20FeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/ITransformERC20Feature';
export type { IMetaTransactionsFeature as IMetaTransactionsFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/IMetaTransactionsFeature';
export type { ILiquidityProviderFeature as ILiquidityProviderFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/ILiquidityProviderFeature';
export type { IUniswapV3Feature as IUniswapV3FeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/IUniswapV3Feature';
export type { IMultiplexFeature as IMultiplexFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/IMultiplexFeature';
export type { IBootstrapFeature as IBootstrapFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/IBootstrapFeature';

// Feature 实现类型
export type { FundRecoveryFeature as FundRecoveryFeatureContract } from '../src/typechain-types/contracts/src/features/FundRecoveryFeature';
export type { BatchFillNativeOrdersFeature as BatchFillNativeOrdersFeatureContract } from '../src/typechain-types/contracts/src/features/BatchFillNativeOrdersFeature';
export type { OtcOrdersFeature as OtcOrdersFeatureContract } from '../src/typechain-types/contracts/src/features/OtcOrdersFeature';
export type { ERC721OrdersFeature as ERC721OrdersFeatureContract } from '../src/typechain-types/contracts/src/features/ERC721OrdersFeature';
export type { ERC1155OrdersFeature as ERC1155OrdersFeatureContract } from '../src/typechain-types/contracts/src/features/ERC1155OrdersFeature';
export type { NativeOrdersFeature as NativeOrdersFeatureContract } from '../src/typechain-types/contracts/src/features/NativeOrdersFeature';
export type { SimpleFunctionRegistryFeature as SimpleFunctionRegistryFeatureContract } from '../src/typechain-types/contracts/src/features/SimpleFunctionRegistryFeature';
export type { OwnableFeature as OwnableFeatureContract } from '../src/typechain-types/contracts/src/features/OwnableFeature';
export type { TransformERC20Feature as TransformERC20FeatureContract } from '../src/typechain-types/contracts/src/features/TransformERC20Feature';
export type { MetaTransactionsFeature as MetaTransactionsFeatureContract } from '../src/typechain-types/contracts/src/features/MetaTransactionsFeature';
export type { LiquidityProviderFeature as LiquidityProviderFeatureContract } from '../src/typechain-types/contracts/src/features/LiquidityProviderFeature';
export type { UniswapV3Feature as UniswapV3FeatureContract } from '../src/typechain-types/contracts/src/features/UniswapV3Feature';
export type { MultiplexFeature as MultiplexFeatureContract } from '../src/typechain-types/contracts/src/features/MultiplexFeature';

// Feature 测试合约类型
export type { TestSimpleFunctionRegistryFeatureImpl1 as TestSimpleFunctionRegistryFeatureImpl1Contract } from '../src/typechain-types/contracts/test/TestSimpleFunctionRegistryFeatureImpl1';
export type { TestSimpleFunctionRegistryFeatureImpl2 as TestSimpleFunctionRegistryFeatureImpl2Contract } from '../src/typechain-types/contracts/test/TestSimpleFunctionRegistryFeatureImpl2';
export type { TestMetaTransactionsTransformERC20Feature as TestMetaTransactionsTransformERC20FeatureContract } from '../src/typechain-types/contracts/test/TestMetaTransactionsTransformERC20Feature';
export type { TestMetaTransactionsNativeOrdersFeature as TestMetaTransactionsNativeOrdersFeatureContract } from '../src/typechain-types/contracts/test/TestMetaTransactionsNativeOrdersFeature';
export type { TestTransformERC20 as TestTransformERC20Contract } from '../src/typechain-types/contracts/test/TestTransformERC20';
export type { TestNativeOrdersFeature as TestNativeOrdersFeatureContract } from '../src/typechain-types/contracts/test/TestNativeOrdersFeature';

// Transformer 相关类型
export type { WethTransformer as WethTransformerContract } from '../src/typechain-types/contracts/src/transformers/WethTransformer';
export type { PayTakerTransformer as PayTakerTransformerContract } from '../src/typechain-types/contracts/src/transformers/PayTakerTransformer';
export type { FillQuoteTransformer as FillQuoteTransformerContract } from '../src/typechain-types/contracts/src/transformers/FillQuoteTransformer';
export type { TestTransformerHost as TestTransformerHostContract } from '../src/typechain-types/contracts/test/TestTransformerHost';
export type { TestWethTransformerHost as TestWethTransformerHostContract } from '../src/typechain-types/contracts/test/TestWethTransformerHost';
export type { TestFillQuoteTransformerHost as TestFillQuoteTransformerHostContract } from '../src/typechain-types/contracts/test/TestFillQuoteTransformerHost';
export type { TestTransformerBase as TestTransformerBaseContract } from '../src/typechain-types/contracts/test/TestTransformerBase';
export type { TestDelegateCaller as TestDelegateCallerContract } from '../src/typechain-types/contracts/test/TestDelegateCaller';
export type { TestMintTokenERC20Transformer as TestMintTokenERC20TransformerContract } from '../src/typechain-types/contracts/test/TestMintTokenERC20Transformer';
export type { MintTransformEvent } from '../src/typechain-types/contracts/test/TestMintTokenERC20Transformer';
export type { TestFillQuoteTransformerExchange as TestFillQuoteTransformerExchangeContract } from '../src/typechain-types/contracts/test/TestFillQuoteTransformerExchange';
export type { TestFillQuoteTransformerBridge as TestFillQuoteTransformerBridgeContract } from '../src/typechain-types/contracts/test/TestFillQuoteTransformerBridge';
export type { EthereumBridgeAdapter as EthereumBridgeAdapterContract } from '../src/typechain-types/contracts/src/transformers/bridges/EthereumBridgeAdapter';

// 部署器相关类型
export type { TransformerDeployer as TransformerDeployerContract } from '../src/typechain-types/contracts/src/external/TransformerDeployer';
export type { TestTransformerDeployerTransformer as TestTransformerDeployerTransformerContract } from '../src/typechain-types/contracts/test/TestTransformerDeployerTransformer';
export type { PermissionlessTransformerDeployer as PermissionlessTransformerDeployerContract } from '../src/typechain-types/contracts/src/external/PermissionlessTransformerDeployer';
export type { TestPermissionlessTransformerDeployerTransformer as TestPermissionlessTransformerDeployerTransformerContract } from '../src/typechain-types/contracts/test/TestPermissionlessTransformerDeployerTransformer';

// 流动性提供商相关类型
export type { LiquidityProviderSandbox as LiquidityProviderSandboxContract } from '../src/typechain-types/contracts/src/external/LiquidityProviderSandbox';
export type { TestLiquidityProvider as TestLiquidityProviderContract } from '../src/typechain-types/contracts/test/TestLiquidityProvider';
export type { CurveLiquidityProvider as CurveLiquidityProviderContract } from '../src/typechain-types/contracts/src/liquidity-providers/CurveLiquidityProvider';
export type { MooniswapLiquidityProvider as MooniswapLiquidityProviderContract } from '../src/typechain-types/contracts/src/liquidity-providers/MooniswapLiquidityProvider';
export type { TestCurve as TestCurveContract } from '../src/typechain-types/contracts/test/integration/TestCurve';
export type { TestMooniswap as TestMooniswapContract } from '../src/typechain-types/contracts/test/integration/TestMooniswap';

// 集成测试合约类型
export type { TestUniswapV2Factory as TestUniswapV2FactoryContract } from '../src/typechain-types/contracts/test/integration/TestUniswapV2Factory';
export type { TestUniswapV3Factory as TestUniswapV3FactoryContract } from '../src/typechain-types/contracts/test/integration/TestUniswapV3Factory';
export type { TestNoEthRecipient as TestNoEthRecipientContract } from '../src/typechain-types/contracts/test/TestNoEthRecipient';

// 费用和控制器类型
export type { FeeCollectorController as FeeCollectorControllerContract } from '../src/typechain-types/contracts/src/external/FeeCollectorController';

// 注册和验证器类型
export type { TestRfqOriginRegistration as TestRfqOriginRegistrationContract } from '../src/typechain-types/contracts/test/TestRfqOriginRegistration';
export type { TestOrderSignerRegistryWithContractWallet as TestOrderSignerRegistryWithContractWalletContract } from '../src/typechain-types/contracts/test/TestOrderSignerRegistryWithContractWallet';
export type { TestFeeRecipient as TestFeeRecipientContract } from '../src/typechain-types/contracts/test/TestFeeRecipient';
export type { TestPropertyValidator as TestPropertyValidatorContract } from '../src/typechain-types/contracts/test/TestPropertyValidator';
export type { TestNFTOrderPresigner as TestNFTOrderPresignerContract } from '../src/typechain-types/contracts/test/TestNFTOrderPresigner';

// 迁移相关类型
export type { InitialMigration as InitialMigrationContract } from '../src/typechain-types/contracts/src/migrations/InitialMigration';

// 库合约类型
export type { TestLibNativeOrder as TestLibNativeOrderContract } from '../src/typechain-types/contracts/test/TestLibNativeOrder';
export type { TestLibSignature as TestLibSignatureContract } from '../src/typechain-types/contracts/test/TestLibSignature';

// ================================
// 工厂类型导出
// ================================

// 核心合约工厂
export { ZeroEx__factory, IZeroEx__factory } from '../src/typechain-types/factories/contracts/src';

// 测试合约工厂
export { 
    TestFullMigration__factory,
    TestInitialMigration__factory,
    TestFixinProtocolFees__factory,
    TestFixinTokenSpender__factory,
    TestMigrator__factory,
    TestStaking__factory,
    TestLibNativeOrder__factory,
    TestLibSignature__factory,
    TestTransformerHost__factory,
    TestWethTransformerHost__factory,
    TestFillQuoteTransformerHost__factory,
    TestTransformerBase__factory,
    TestDelegateCaller__factory,
    TestMintTokenERC20Transformer__factory,
    TestFillQuoteTransformerExchange__factory,
    TestFillQuoteTransformerBridge__factory,
    TestTransformerDeployerTransformer__factory,
    TestPermissionlessTransformerDeployerTransformer__factory,
    TestLiquidityProvider__factory,

    TestRfqOriginRegistration__factory,
    TestOrderSignerRegistryWithContractWallet__factory,
    TestFeeRecipient__factory,
    TestPropertyValidator__factory,
    TestNFTOrderPresigner__factory,
    TestSimpleFunctionRegistryFeatureImpl1__factory,
    TestSimpleFunctionRegistryFeatureImpl2__factory,
    TestMetaTransactionsTransformERC20Feature__factory,
    TestMetaTransactionsNativeOrdersFeature__factory,
    TestTransformERC20__factory,
    TestNativeOrdersFeature__factory
} from '../src/typechain-types/factories/contracts/test';

// 代币测试合约工厂
export { 
    TestMintableERC20Token__factory,
    TestTokenSpenderERC20Token__factory,
    TestWeth__factory
} from '../src/typechain-types/factories/contracts/test/tokens';

export { TestMintableERC721Token__factory } from '../src/typechain-types/factories/contracts/test/tokens/TestMintableERC721Token.sol';
export { TestMintableERC1155Token__factory } from '../src/typechain-types/factories/contracts/test/tokens/TestMintableERC1155Token.sol';

// Feature 工厂
export { 
    FundRecoveryFeature__factory,
    BatchFillNativeOrdersFeature__factory,
    OtcOrdersFeature__factory,
    ERC721OrdersFeature__factory,
    ERC1155OrdersFeature__factory,
    NativeOrdersFeature__factory,
    SimpleFunctionRegistryFeature__factory,
    OwnableFeature__factory,
    TransformERC20Feature__factory,
    MetaTransactionsFeature__factory,
    LiquidityProviderFeature__factory,
    UniswapV3Feature__factory,
    MultiplexFeature__factory
} from '../src/typechain-types/factories/contracts/src/features';

// Transformer 工厂
export { 
    WethTransformer__factory,
    PayTakerTransformer__factory,
    FillQuoteTransformer__factory
} from '../src/typechain-types/factories/contracts/src/transformers';

// 桥接适配器工厂
export { EthereumBridgeAdapter__factory } from '../src/typechain-types/factories/contracts/src/transformers/bridges';

// 部署器工厂
export { TransformerDeployer__factory } from '../src/typechain-types/factories/contracts/src/external/TransformerDeployer.sol';
export { 
    PermissionlessTransformerDeployer__factory,
    LiquidityProviderSandbox__factory,
    FeeCollectorController__factory
} from '../src/typechain-types/factories/contracts/src/external';

// 流动性提供商工厂
export { 
    CurveLiquidityProvider__factory,
    MooniswapLiquidityProvider__factory
} from '../src/typechain-types/factories/contracts/src/liquidity-providers';

// 集成测试工厂
export { 
    TestCurve__factory,
    TestMooniswap__factory,
    TestUniswapV2Factory__factory,
    TestUniswapV3Factory__factory
} from '../src/typechain-types/factories/contracts/test/integration';

// 外部合约工厂
export { DummyERC20Token__factory } from '../src/typechain-types/factories/contracts/src/external';

// 迁移工厂
export { InitialMigration__factory } from '../src/typechain-types/factories/contracts/src/migrations';

// 事件类型 - 用于测试中的事件验证
export interface TransformerDeployerEvents {
    Deployed: any;
    Killed: any;
}

export interface PermissionlessTransformerDeployerEvents {
    Deployed: any;
}