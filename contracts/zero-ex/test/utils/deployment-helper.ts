const { ethers } = require('hardhat');

/**
 * 通用的 ZeroEx FullMigration 部署函数
 * 解决合约注册和初始化问题的统一解决方案
 */
export interface ZeroExDeploymentResult {
    zeroEx: any;
    verifyingContract: string;
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

    if (logProgress) {
        console.log(`✅ 所有 features 部署完成`);
    }

    // 8. 使用 FullMigration 注册所有 features
    const features = {
        registry: await registry.getAddress(),
        ownable: await ownable.getAddress(),
        transformERC20: await transformERC20.getAddress(),
        metaTransactions: await metaTransactions.getAddress(),
        nativeOrders: await nativeOrders.getAddress(),
        otcOrders: await otcOrders.getAddress()
    };

    await migrator.migrateZeroEx(
        owner.address,
        verifyingContract,
        features,
        {
            transformerDeployer: transformerDeployer || owner.address
        }
    );
    if (logProgress) {
        console.log(`✅ ZeroEx 完全迁移，所有 features 已注册`);
    }

    // 9. 创建 feature 接口 (解决函数调用问题)
    const transformFeature = new ethers.Contract(
        verifyingContract,
        transformERC20.interface,
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