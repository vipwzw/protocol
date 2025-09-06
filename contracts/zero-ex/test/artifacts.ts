import { ContractArtifact } from '@0x/contract-artifacts';

// 核心合约 artifacts
import * as ZeroEx from '../artifacts/contracts/src/ZeroEx.sol/ZeroEx.json';
import * as IZeroEx from '../artifacts/contracts/src/IZeroEx.sol/IZeroEx.json';

// 基础测试合约 - 已验证存在的
import * as TestFullMigration from '../artifacts/contracts/test/TestFullMigration.sol/TestFullMigration.json';
import * as TestInitialMigration from '../artifacts/contracts/test/TestInitialMigration.sol/TestInitialMigration.json';
import * as TestFixinProtocolFees from '../artifacts/contracts/test/TestFixinProtocolFees.sol/TestFixinProtocolFees.json';
import * as TestStaking from '../artifacts/contracts/test/TestStaking.sol/TestStaking.json';
import * as TestMigrator from '../artifacts/contracts/test/TestMigrator.sol/TestMigrator.json';

// 代币相关测试合约
import * as TestMintableERC20Token from '../artifacts/contracts/test/tokens/TestMintableERC20Token.sol/TestMintableERC20Token.json';
import * as TestWeth from '../artifacts/contracts/test/tokens/TestWeth.sol/TestWeth.json';
import * as DummyERC20Token from '../artifacts/contracts/src/external/DummyERC20Token.sol/DummyERC20Token.json';

// 已验证存在的 Feature 合约
import * as FundRecoveryFeature from '../artifacts/contracts/src/features/FundRecoveryFeature.sol/FundRecoveryFeature.json';
import * as BatchFillNativeOrdersFeature from '../artifacts/contracts/src/features/BatchFillNativeOrdersFeature.sol/BatchFillNativeOrdersFeature.json';
import * as NativeOrdersFeature from '../artifacts/contracts/src/features/NativeOrdersFeature.sol/NativeOrdersFeature.json';
import * as OwnableFeature from '../artifacts/contracts/src/features/OwnableFeature.sol/OwnableFeature.json';
import * as TransformERC20Feature from '../artifacts/contracts/src/features/TransformERC20Feature.sol/TransformERC20Feature.json';
import * as MetaTransactionsFeature from '../artifacts/contracts/src/features/MetaTransactionsFeature.sol/MetaTransactionsFeature.json';
import * as LiquidityProviderFeature from '../artifacts/contracts/src/features/LiquidityProviderFeature.sol/LiquidityProviderFeature.json';
import * as UniswapV3Feature from '../artifacts/contracts/src/features/UniswapV3Feature.sol/UniswapV3Feature.json';

// NFT 订单相关 Feature（在 nft_orders 子目录中）
import * as ERC721OrdersFeature from '../artifacts/contracts/src/features/nft_orders/ERC721OrdersFeature.sol/ERC721OrdersFeature.json';
import * as ERC1155OrdersFeature from '../artifacts/contracts/src/features/nft_orders/ERC1155OrdersFeature.sol/ERC1155OrdersFeature.json';

// 部署器相关（已验证存在的）
import * as TransformerDeployer from '../artifacts/contracts/src/external/TransformerDeployer.sol/TransformerDeployer.json';
import * as TestTransformerDeployerTransformer from '../artifacts/contracts/test/TestTransformerDeployerTransformer.sol/TestTransformerDeployerTransformer.json';
import * as PermissionlessTransformerDeployer from '../artifacts/contracts/src/external/PermissionlessTransformerDeployer.sol/PermissionlessTransformerDeployer.json';
import * as TestPermissionlessTransformerDeployerTransformer from '../artifacts/contracts/test/TestPermissionlessTransformerDeployerTransformer.sol/TestPermissionlessTransformerDeployerTransformer.json';

// 库合约
import * as TestLibNativeOrder from '../artifacts/contracts/test/TestLibNativeOrder.sol/TestLibNativeOrder.json';
import * as TestLibSignature from '../artifacts/contracts/test/TestLibSignature.sol/TestLibSignature.json';

// 费用收集器
import * as FeeCollectorController from '../artifacts/contracts/src/external/FeeCollectorController.sol/FeeCollectorController.json';

// 迁移相关
import * as InitialMigration from '../artifacts/contracts/src/migrations/InitialMigration.sol/InitialMigration.json';

// 导出 artifacts 对象 - 只包含已验证存在的合约
export const artifacts = {
    // 核心合约
    ZeroEx: ZeroEx as ContractArtifact,
    IZeroEx: IZeroEx as ContractArtifact,

    // 基础测试合约
    TestFullMigration: TestFullMigration as ContractArtifact,
    TestInitialMigration: TestInitialMigration as ContractArtifact,
    TestFixinProtocolFees: TestFixinProtocolFees as ContractArtifact,
    TestStaking: TestStaking as ContractArtifact,
    TestMigrator: TestMigrator as ContractArtifact,

    // 代币测试合约
    TestMintableERC20Token: TestMintableERC20Token as ContractArtifact,
    TestWeth: TestWeth as ContractArtifact,
    DummyERC20Token: DummyERC20Token as ContractArtifact,

    // Feature 合约
    FundRecoveryFeature: FundRecoveryFeature as ContractArtifact,
    BatchFillNativeOrdersFeature: BatchFillNativeOrdersFeature as ContractArtifact,
    NativeOrdersFeature: NativeOrdersFeature as ContractArtifact,
    OwnableFeature: OwnableFeature as ContractArtifact,
    TransformERC20Feature: TransformERC20Feature as ContractArtifact,
    MetaTransactionsFeature: MetaTransactionsFeature as ContractArtifact,
    LiquidityProviderFeature: LiquidityProviderFeature as ContractArtifact,
    UniswapV3Feature: UniswapV3Feature as ContractArtifact,
    ERC721OrdersFeature: ERC721OrdersFeature as ContractArtifact,
    ERC1155OrdersFeature: ERC1155OrdersFeature as ContractArtifact,

    // 部署器相关
    TransformerDeployer: TransformerDeployer as ContractArtifact,
    TestTransformerDeployerTransformer: TestTransformerDeployerTransformer as ContractArtifact,
    PermissionlessTransformerDeployer: PermissionlessTransformerDeployer as ContractArtifact,
    TestPermissionlessTransformerDeployerTransformer:
        TestPermissionlessTransformerDeployerTransformer as ContractArtifact,

    // 库合约
    TestLibNativeOrder: TestLibNativeOrder as ContractArtifact,
    TestLibSignature: TestLibSignature as ContractArtifact,

    // 费用和控制器
    FeeCollectorController: FeeCollectorController as ContractArtifact,

    // 迁移相关
    InitialMigration: InitialMigration as ContractArtifact,
};

export default artifacts;
