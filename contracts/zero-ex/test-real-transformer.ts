const { ethers } = require('hardhat');
const {
    encodeFillQuoteTransformerData,
    FillQuoteTransformerSide,
    FillQuoteTransformerOrderType,
} = require('@0x/protocol-utils');
import { deployFillQuoteTransformerTestEnvironment } from './test/utils/deployment-helper';

async function testRealTransformer() {
    console.log('🎯 测试真实的 FillQuoteTransformer 合约...');

    const signers = await ethers.getSigners();
    const accounts = signers.slice(0, 20).map((s: any) => s.address);

    // 部署测试环境
    console.log('📦 部署测试环境...');
    const testEnv = await deployFillQuoteTransformerTestEnvironment(accounts);

    // 分发代币到测试账户
    console.log('💰 分发代币...');
    const { maker, taker, sender } = testEnv.accounts;
    const mintAmount = 10000000000000000000n; // 10 ether

    await testEnv.tokens.takerToken.mint(testEnv.host, mintAmount);
    await testEnv.tokens.makerToken.mint(testEnv.bridge, mintAmount);

    console.log('✅ 代币分发完成');

    // 创建与测试相同的数据
    console.log('\n📊 创建测试数据...');
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    const boughtAmount = 1000000000000000000n; // 1 ether
    const lpData = abiCoder.encode(['uint256'], [boughtAmount]);
    const bridgeData = abiCoder.encode(['address', 'bytes'], [await testEnv.bridge.getAddress(), lpData]);

    const bridgeOrder = {
        source: '0x0000000000000000000000000000000000000000000000000000000000000000',
        takerTokenAmount: 1000000000000000000n,
        makerTokenAmount: 1000000000000000000n,
        bridgeData: bridgeData,
    };

    const transformData = {
        side: FillQuoteTransformerSide.Sell,
        sellToken: await testEnv.tokens.takerToken.getAddress(),
        buyToken: await testEnv.tokens.makerToken.getAddress(),
        bridgeOrders: [bridgeOrder],
        limitOrders: [],
        rfqOrders: [],
        fillSequence: [FillQuoteTransformerOrderType.Bridge],
        fillAmount: 1000000000000000000n,
        refundReceiver: '0x0000000000000000000000000000000000000000',
        otcOrders: [],
    };

    console.log('📋 测试数据概览:');
    console.log('- sellToken:', transformData.sellToken);
    console.log('- buyToken:', transformData.buyToken);
    console.log('- bridge地址:', await testEnv.bridge.getAddress());
    console.log('- fillAmount:', transformData.fillAmount.toString());

    // 编码数据
    console.log('\n🔧 编码数据...');
    const encodedData = encodeFillQuoteTransformerData(transformData);
    console.log('✅ 编码完成，长度:', encodedData.length, '字符');

    // 测试真实的 transform 调用
    console.log('\n🎯 测试真实的 FillQuoteTransformer...');

    try {
        console.log('📞 调用 host.executeTransform...');
        console.log('参数:');
        console.log('- transformer:', await testEnv.transformer.getAddress());
        console.log('- inputToken:', await testEnv.tokens.takerToken.getAddress());
        console.log('- inputTokenAmount:', transformData.fillAmount.toString());
        console.log('- sender:', sender);
        console.log('- recipient:', taker);
        console.log('- data 长度:', encodedData.length);

        const tx = await testEnv.host.executeTransform(
            await testEnv.transformer.getAddress(),
            await testEnv.tokens.takerToken.getAddress(),
            transformData.fillAmount,
            sender,
            taker,
            encodedData,
        );

        const receipt = await tx.wait();
        console.log('✅ 交易成功！');
        console.log('- Gas 使用:', receipt.gasUsed.toString());
        console.log('- 交易哈希:', receipt.hash);
    } catch (error) {
        console.log('❌ 真实 transformer 调用失败:');
        console.log('错误信息:', error.message);

        // 分析错误
        if (error.message.includes('0xadc35ca6')) {
            console.log('🔍 检测到 InvalidTransformDataError (0xadc35ca6)');
        }
        if (error.message.includes('0x')) {
            const errorMatch = error.message.match(/0x[a-fA-F0-9]+/g);
            if (errorMatch) {
                console.log('🔍 错误代码:', errorMatch);
            }
        }

        // 尝试直接调用 transformer.transform 来获取更多信息
        console.log('\n🔬 尝试直接调用 transformer.transform...');
        try {
            const transformResult = await testEnv.transformer.transform.staticCall({
                sender: sender,
                recipient: taker,
                data: encodedData,
            });
            console.log('✅ 直接调用成功:', transformResult);
        } catch (directError) {
            console.log('❌ 直接调用也失败:', directError.message);
        }
    }
}

testRealTransformer().catch(console.error);
