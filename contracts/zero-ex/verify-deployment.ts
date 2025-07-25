const { ethers } = require('hardhat');
import { deployFillQuoteTransformerTestEnvironment } from './test/utils/deployment-helper';

async function verifyDeployment() {
    console.log('🔍 验证测试环境中的合约部署...');

    const signers = await ethers.getSigners();
    const accounts = signers.slice(0, 20).map((s: any) => s.address);

    // 部署测试环境
    console.log('📦 部署测试环境...');
    const testEnv = await deployFillQuoteTransformerTestEnvironment(accounts);

    console.log('\n📋 部署的合约地址:');
    console.log('- Exchange:', await testEnv.exchange.getAddress());
    console.log('- BridgeAdapter:', await testEnv.bridgeAdapter.getAddress()); 
    console.log('- Transformer:', await testEnv.transformer.getAddress());
    console.log('- Host:', await testEnv.host.getAddress());
    console.log('- Bridge:', await testEnv.bridge.getAddress());
    console.log('- TakerToken:', await testEnv.tokens.takerToken.getAddress());
    console.log('- MakerToken:', await testEnv.tokens.makerToken.getAddress());

    // 验证 transformer 是否真的是 FillQuoteTransformer
    console.log('\n🔍 验证 Transformer 合约类型...');
    try {
        // 检查合约是否有 transform 函数
        const transformerInterface = testEnv.transformer.interface;
        const hasTransformFunction = transformerInterface.fragments.some((f: any) => f.name === 'transform');
        console.log('- 有 transform 函数:', hasTransformFunction);

        // 检查构造函数参数
        const constructorFragment = transformerInterface.fragments.find((f: any) => f.type === 'constructor');
        console.log('- 构造函数参数数量:', constructorFragment?.inputs?.length || 0);

        // 尝试调用 transformer 的一些只读函数
        // 注意：FillQuoteTransformer 有 zeroEx() 和 bridgeAdapter() getter
        const zeroExAddr = await testEnv.transformer.zeroEx();
        const bridgeAdapterAddr = await testEnv.transformer.bridgeAdapter();
        console.log('- transformer.zeroEx():', zeroExAddr);
        console.log('- transformer.bridgeAdapter():', bridgeAdapterAddr);
        console.log('- 预期 exchange 地址:', await testEnv.exchange.getAddress());
        console.log('- 预期 bridgeAdapter 地址:', await testEnv.bridgeAdapter.getAddress());

        // 验证地址是否匹配
        const zeroExMatches = zeroExAddr.toLowerCase() === (await testEnv.exchange.getAddress()).toLowerCase();
        const bridgeAdapterMatches = bridgeAdapterAddr.toLowerCase() === (await testEnv.bridgeAdapter.getAddress()).toLowerCase();
        
        console.log('\n✅ 地址验证结果:');
        console.log('- ZeroEx 地址匹配:', zeroExMatches);
        console.log('- BridgeAdapter 地址匹配:', bridgeAdapterMatches);

        if (zeroExMatches && bridgeAdapterMatches) {
            console.log('🎉 合约部署完全正确！');
        } else {
            console.log('❌ 合约配置有问题！');
        }

    } catch (error) {
        console.log('❌ 验证 transformer 时出错:', error.message);
    }
}

verifyDeployment().catch(console.error); 