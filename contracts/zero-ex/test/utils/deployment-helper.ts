const { ethers } = require('hardhat');

/**
 * 🎯 FillQuoteTransformer 测试环境部署（完全匹配 test-main 架构）
 * 不使用真实的 ZeroEx 系统，而是使用专门的测试合约
 */
export interface FillQuoteTransformerTestEnvironment {
    exchange: any;
    bridgeAdapter: any;
    transformer: any;
    host: any;
    bridge: any;
    tokens: {
        makerToken: any;
        takerToken: any;
        takerFeeToken: any;
    };
    accounts: {
        owner: string;
        maker: string;
        taker: string;
        feeRecipient: string;
        sender: string;
    };
    singleProtocolFee: bigint;
}

/**
 * 部署完整的 FillQuoteTransformer 测试环境
 * 使用 TestFillQuoteTransformerHost 而不是真实的 ZeroEx 系统
 */
export async function deployFillQuoteTransformerTestEnvironment(accounts: string[]): Promise<FillQuoteTransformerTestEnvironment> {
    console.log('🚀 开始 FillQuoteTransformer 测试环境部署（完全匹配 test-main）...');
    
    // ⭐ 关键常量：与 test-main 完全一致
    const GAS_PRICE = 1337;
    
    // 1. 获取测试账户
    const [owner, maker, taker, feeRecipient, sender] = accounts;
    console.log(`👤 测试账户: ${accounts.length} 个`);
    console.log(`🔧 使用 test-main 兼容设置: gasPrice=${GAS_PRICE}`);

    // 2. 部署测试专用的交换合约
    console.log('📦 部署测试交换环境...');
    const TestFillQuoteTransformerExchangeFactory = await ethers.getContractFactory('TestFillQuoteTransformerExchange');
    const exchange = await TestFillQuoteTransformerExchangeFactory.deploy();
    await exchange.waitForDeployment();
    console.log(`✅ TestFillQuoteTransformerExchange: ${await exchange.getAddress()}`);

    // 3. 部署 EthereumBridgeAdapter
    const EthereumBridgeAdapterFactory = await ethers.getContractFactory('EthereumBridgeAdapter');
    const bridgeAdapter = await EthereumBridgeAdapterFactory.deploy(ethers.ZeroAddress);
    await bridgeAdapter.waitForDeployment();
    console.log(`✅ EthereumBridgeAdapter: ${await bridgeAdapter.getAddress()}`);

    // 4. 直接部署 FillQuoteTransformer（不通过 TransformerDeployer）
    const FillQuoteTransformerFactory = await ethers.getContractFactory('FillQuoteTransformer');
    const transformer = await FillQuoteTransformerFactory.deploy(
        await bridgeAdapter.getAddress(),
        await exchange.getAddress()
    );
    await transformer.waitForDeployment();
    console.log(`✅ FillQuoteTransformer: ${await transformer.getAddress()}`);

    // 5. ⭐ 部署 TestFillQuoteTransformerHost（匹配 test-main 的 gas 环境）
    console.log(`📦 部署 TestFillQuoteTransformerHost (使用网络默认 gasPrice: ${GAS_PRICE})...`);
    const TestFillQuoteTransformerHostFactory = await ethers.getContractFactory('TestFillQuoteTransformerHost');
    // 注意：gasPrice 现在由 hardhat.config.ts 网络配置统一管理
    const host = await TestFillQuoteTransformerHostFactory.deploy();
    await host.waitForDeployment();
    console.log(`✅ TestFillQuoteTransformerHost: ${await host.getAddress()}`);

    // 6. ⭐ 部署 TestFillQuoteTransformerBridge（使用 sender 账户，匹配 test-main）
    console.log(`📦 部署 TestFillQuoteTransformerBridge (from: ${sender})...`);
    const [, , , , senderSigner] = await ethers.getSigners();
    const TestFillQuoteTransformerBridgeFactory = await ethers.getContractFactory('TestFillQuoteTransformerBridge', senderSigner);
    const bridge = await TestFillQuoteTransformerBridgeFactory.deploy();
    await bridge.waitForDeployment();
    console.log(`✅ TestFillQuoteTransformerBridge: ${await bridge.getAddress()}`);

    // 7. 部署测试代币
    console.log('📦 部署测试代币...');
    const TestMintableERC20Factory = await ethers.getContractFactory('TestMintableERC20Token');
    const makerToken = await TestMintableERC20Factory.deploy();
    const takerToken = await TestMintableERC20Factory.deploy();
    const takerFeeToken = await TestMintableERC20Factory.deploy();
    
    await Promise.all([
        makerToken.waitForDeployment(),
        takerToken.waitForDeployment(),
        takerFeeToken.waitForDeployment()
    ]);
    console.log('✅ 测试代币部署完成');

    // 8. 获取协议费用
    const singleProtocolFee = await exchange.getProtocolFeeMultiplier();
    console.log(`✅ 协议费用乘数: ${singleProtocolFee}`);

    console.log('🎉 FillQuoteTransformer 测试环境部署完成（test-main 兼容模式）！');

    return {
        exchange,
        bridgeAdapter,
        transformer,
        host,
        bridge,
        tokens: { makerToken, takerToken, takerFeeToken },
        accounts: { owner, maker, taker, feeRecipient, sender },
        singleProtocolFee
    };
}

/**
 * 通用的 ZeroEx FullMigration 部署函数
 * 解决合约注册和初始化问题的统一解决方案
 */
export interface ZeroExDeploymentResult {
    zeroEx: any;
    verifyingContract: string;
    transformerDeployer: string;
    features: {
        registry: any;
        ownable: any;
        transformERC20: any;
        metaTransactions: any;
        nativeOrders: any;
        otcOrders: any;
    };
    featureInterfaces: {
        transformFeature: any;
        nativeOrdersFeature: any;
        otcFeature: any;
    };
    migrator: any;
    dependencies: {
        staking: any;
        feeCollector: any;
    };
}

export interface DeploymentOptions {
    wethAddress?: string;
    protocolFeeMultiplier?: number;
    transformerDeployer?: string;
    logProgress?: boolean;
}

/**
 * 部署完整的 ZeroEx 系统，包含所有核心 features
 * 使用 FullMigration 模式确保正确的权限和注册
 */
export async function deployZeroExWithFullMigration(
    owner: any,
    wethToken: any,
    options: DeploymentOptions = {}
): Promise<ZeroExDeploymentResult> {
    const {
        protocolFeeMultiplier = 70000,
        transformerDeployer,
        logProgress = true
    } = options;

    if (logProgress) {
        console.log('📦 开始部署 ZeroEx (使用 FullMigration 模式)...');
    }

    // 1. 部署 FullMigration
    const FullMigrationFactory = await ethers.getContractFactory('FullMigration');
    const migrator = await FullMigrationFactory.deploy(owner.address);
    await migrator.waitForDeployment();
    if (logProgress) {
        console.log(`✅ FullMigration: ${await migrator.getAddress()}`);
    }

    // 2. 获取正确的 bootstrapper 
    const bootstrapper = await migrator.getBootstrapper();

    // 3. 部署 ZeroEx 代理合约
    const ZeroExFactory = await ethers.getContractFactory('ZeroEx');
    const zeroEx = await ZeroExFactory.deploy(bootstrapper);
    await zeroEx.waitForDeployment();
    const verifyingContract = await zeroEx.getAddress();
    if (logProgress) {
        console.log(`✅ ZeroEx: ${verifyingContract}`);
    }

    // 4. 部署所有核心 features
    const SimpleFunctionRegistryFactory = await ethers.getContractFactory('SimpleFunctionRegistryFeature');
    const registry = await SimpleFunctionRegistryFactory.deploy();
    await registry.waitForDeployment();

    const OwnableFactory = await ethers.getContractFactory('OwnableFeature');
    const ownable = await OwnableFactory.deploy();
    await ownable.waitForDeployment();

    // 7. 部署 TestTransformERC20（与 test-main 完全一致）
    const TestTransformERC20Factory = await ethers.getContractFactory('TestTransformERC20');
    const testTransformERC20 = await TestTransformERC20Factory.deploy();
    await testTransformERC20.waitForDeployment();
    
    const TransformERC20Factory = await ethers.getContractFactory('TransformERC20Feature');
    const transformERC20 = await TransformERC20Factory.deploy();
    await transformERC20.waitForDeployment();

    const MetaTransactionsFactory = await ethers.getContractFactory('MetaTransactionsFeature');
    const metaTransactions = await MetaTransactionsFactory.deploy(verifyingContract);
    await metaTransactions.waitForDeployment();

    // 5. 部署 NativeOrdersFeature 的依赖
    const TestStakingFactory = await ethers.getContractFactory('TestStaking');
    const staking = await TestStakingFactory.deploy(await wethToken.getAddress());
    await staking.waitForDeployment();

    const FeeCollectorFactory = await ethers.getContractFactory('FeeCollectorController');
    const feeCollector = await FeeCollectorFactory.deploy(await wethToken.getAddress(), await staking.getAddress());
    await feeCollector.waitForDeployment();

    // 6. 部署 TestNativeOrdersFeature (测试版本)
    const TestNativeOrdersFactory = await ethers.getContractFactory('TestNativeOrdersFeature');
    const nativeOrders = await TestNativeOrdersFactory.deploy(
        verifyingContract,
        await wethToken.getAddress(),
        await staking.getAddress(),
        await feeCollector.getAddress(),
        protocolFeeMultiplier
    );
    await nativeOrders.waitForDeployment();

    // 7. 部署 OtcOrdersFeature
    const OtcOrdersFactory = await ethers.getContractFactory('OtcOrdersFeature');
    const otcOrders = await OtcOrdersFactory.deploy(verifyingContract, await wethToken.getAddress());
    await otcOrders.waitForDeployment();

    // 8. 部署 TransformerDeployer（如果没有提供的话）
    let actualTransformerDeployer: string;
    if (transformerDeployer) {
        actualTransformerDeployer = transformerDeployer;
    } else {
        const TransformerDeployerFactory = await ethers.getContractFactory('TransformerDeployer');
        const deployerContract = await TransformerDeployerFactory.deploy([owner.address]);
        await deployerContract.waitForDeployment();
        actualTransformerDeployer = await deployerContract.getAddress();
        if (logProgress) {
            console.log(`✅ TransformerDeployer: ${actualTransformerDeployer}`);
        }
    }

    if (logProgress) {
        console.log(`✅ 所有 features 部署完成`);
    }

    // 9. 使用 FullMigration 注册所有 features（使用 TestTransformERC20）
    const features = {
        registry: await registry.getAddress(),
        ownable: await ownable.getAddress(),
        transformERC20: await testTransformERC20.getAddress(), // 🎯 使用 TestTransformERC20
        metaTransactions: await metaTransactions.getAddress(),
        nativeOrders: await nativeOrders.getAddress(),
        otcOrders: await otcOrders.getAddress()
    };

    await migrator.migrateZeroEx(
        owner.address,
        verifyingContract,
        features,
        {
            transformerDeployer: actualTransformerDeployer
        }
    );
    if (logProgress) {
        console.log(`✅ ZeroEx 完全迁移，所有 features 已注册`);
    }

    // 10. 创建 feature 接口 (基于 TestTransformERC20)
    const transformFeature = new ethers.Contract(
        verifyingContract,
        testTransformERC20.interface,
        ethers.provider
    );

    const nativeOrdersFeature = new ethers.Contract(
        verifyingContract,
        nativeOrders.interface,
        ethers.provider
    );

    const otcFeature = new ethers.Contract(
        verifyingContract,
        otcOrders.interface,
        ethers.provider
    );

    if (logProgress) {
        console.log(`✅ Feature 接口创建完成`);
    }

    return {
        zeroEx,
        verifyingContract,
        transformerDeployer: actualTransformerDeployer,
        features: {
            registry,
            ownable,
            transformERC20,
            metaTransactions,
            nativeOrders,
            otcOrders
        },
        featureInterfaces: {
            transformFeature,
            nativeOrdersFeature,
            otcFeature
        },
        migrator,
        dependencies: {
            staking,
            feeCollector
        }
    };
}

/**
 * 简化的代币部署函数
 */
export async function deployTestTokens(): Promise<{ 
    makerToken: any; 
    takerToken: any; 
    wethToken: any;
    dai?: any;
    shib?: any; 
    zrx?: any;
}> {
    console.log('📦 部署测试代币...');
    
    const TokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
    const WethFactory = await ethers.getContractFactory('TestWeth');

    const makerToken = await TokenFactory.deploy();
    await makerToken.waitForDeployment();

    const takerToken = await TokenFactory.deploy();
    await takerToken.waitForDeployment();

    const wethToken = await WethFactory.deploy();
    await wethToken.waitForDeployment();

    console.log('✅ 基础代币部署完成');

    return {
        makerToken,
        takerToken,
        wethToken
    };
}

/**
 * 给测试账户分发代币
 */
export async function distributeTokensToAccounts(
    tokens: any[], 
    accounts: any[], 
    amount: bigint = ethers.parseEther('10000'),
    logProgress: boolean = true
): Promise<void> {
    if (logProgress) {
        console.log('💰 分发代币给测试账户...');
    }

    for (const token of tokens) {
        for (const account of accounts) {
            await token.mint(account.address, amount);
        }
    }

    if (logProgress) {
        console.log('✅ 代币分发完成');
    }
}

/**
 * 批量代币授权函数
 */
export async function approveTokensForAccounts(
    tokens: any[], 
    accounts: any[], 
    spenderAddress: string,
    logProgress: boolean = true
): Promise<void> {
    if (logProgress) {
        console.log('📝 批量授权代币...');
    }

    for (const token of tokens) {
        for (const account of accounts) {
            await token.connect(account).approve(spenderAddress, ethers.MaxUint256);
        }
    }

    if (logProgress) {
        console.log('✅ 所有代币授权完成');
    }
} 