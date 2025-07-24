// 使用示例：如何在任何测试文件中使用通用部署函数

import { 
    deployZeroExWithFullMigration, 
    deployTestTokens, 
    approveTokensForAccounts 
} from './deployment-helper';

describe('任何 Feature 测试', function() {
    let owner: any;
    let maker: any; 
    let taker: any;
    let deployment: any;
    let tokens: any;

    before(async function() {
        const signers = await ethers.getSigners();
        [owner, maker, taker] = signers;

        // 🚀 一行代码解决所有部署和注册问题！
        tokens = await deployTestTokens();
        deployment = await deployZeroExWithFullMigration(owner, tokens.wethToken);
        await approveTokensForAccounts([tokens.makerToken, tokens.takerToken], [maker, taker], deployment.verifyingContract);
    });

    it('测试任何功能', async function() {
        // 现在你可以直接使用：
        // - deployment.zeroEx (基础代理)
        // - deployment.featureInterfaces.transformFeature (TransformERC20 功能)
        // - deployment.featureInterfaces.nativeOrdersFeature (NativeOrders 功能) 
        // - deployment.featureInterfaces.otcFeature (OTC 功能)
        
        // 例如：
        const protocolFee = await deployment.featureInterfaces.nativeOrdersFeature.getProtocolFeeMultiplier();
        const transformWallet = await deployment.featureInterfaces.transformFeature.getTransformWallet();
        
        expect(protocolFee).to.be.a('bigint');
        expect(transformWallet).to.have.lengthOf(42);
    });
});

// 🎯 主要优势：
// 1. 一致性 - 所有测试使用相同的正确部署模式
// 2. 简洁性 - 从 150行 → 3行核心代码
// 3. 可维护性 - 修复一次，所有测试受益
// 4. 可扩展性 - 轻松添加新的 features 