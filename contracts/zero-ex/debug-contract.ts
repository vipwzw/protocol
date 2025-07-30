const { ethers } = require('hardhat');
const {
    encodeFillQuoteTransformerData,
    FillQuoteTransformerSide,
    FillQuoteTransformerOrderType,
} = require('@0x/protocol-utils');

async function debugContract() {
    console.log('🔍 调试合约 InvalidTransformDataError 问题...');

    const signers = await ethers.getSigners();
    const [owner] = signers;

    // 首先部署真实的测试环境获取真实地址
    console.log('📦 部署真实测试环境...');
    const TestMintableERC20Factory = await ethers.getContractFactory('TestMintableERC20Token');
    const takerToken = await TestMintableERC20Factory.deploy();
    const makerToken = await TestMintableERC20Factory.deploy();
    await Promise.all([takerToken.waitForDeployment(), makerToken.waitForDeployment()]);

    const takerTokenAddr = await takerToken.getAddress();
    const makerTokenAddr = await makerToken.getAddress();

    console.log('✅ 真实代币地址:');
    console.log('- takerToken:', takerTokenAddr);
    console.log('- makerToken:', makerTokenAddr);

    // 部署真实的桥接合约
    const TestFillQuoteTransformerBridgeFactory = await ethers.getContractFactory('TestFillQuoteTransformerBridge');
    const bridge = await TestFillQuoteTransformerBridgeFactory.deploy();
    await bridge.waitForDeployment();
    const bridgeAddr = await bridge.getAddress();
    console.log('- bridge:', bridgeAddr);

    // 部署调试合约
    console.log('\n📦 部署调试合约...');
    const DebugFillQuoteTransformerFactory = await ethers.getContractFactory('DebugFillQuoteTransformer');
    const debugTransformer = await DebugFillQuoteTransformerFactory.deploy();
    await debugTransformer.waitForDeployment();
    console.log('✅ 调试合约部署完成:', await debugTransformer.getAddress());

    // 创建使用真实地址的测试数据
    console.log('\n📊 创建测试数据（使用真实地址）...');
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    // 使用真实的桥接数据
    const boughtAmount = 1000000000000000000n; // 1 ether
    const lpData = abiCoder.encode(['uint256'], [boughtAmount]);
    const bridgeData = abiCoder.encode(['address', 'bytes'], [bridgeAddr, lpData]);

    const bridgeOrder = {
        source: '0x0000000000000000000000000000000000000000000000000000000000000000',
        takerTokenAmount: 1000000000000000000n,
        makerTokenAmount: 1000000000000000000n,
        bridgeData: bridgeData,
    };

    const transformData = {
        side: FillQuoteTransformerSide.Sell,
        sellToken: takerTokenAddr, // ✅ 使用真实地址
        buyToken: makerTokenAddr, // ✅ 使用真实地址
        bridgeOrders: [bridgeOrder],
        limitOrders: [],
        rfqOrders: [],
        fillSequence: [FillQuoteTransformerOrderType.Bridge],
        fillAmount: 1000000000000000000n,
        refundReceiver: '0x0000000000000000000000000000000000000000',
        otcOrders: [],
    };

    console.log('📋 测试数据概览（真实地址）:');
    console.log('- sellToken:', transformData.sellToken);
    console.log('- buyToken:', transformData.buyToken);
    console.log('- bridgeOrders数量:', transformData.bridgeOrders.length);
    console.log('- fillSequence数量:', transformData.fillSequence.length);

    // 编码数据
    console.log('\n🔧 编码数据...');
    const encodedData = encodeFillQuoteTransformerData(transformData);
    console.log('✅ 编码完成');
    console.log('- JavaScript 编码长度:', encodedData.length, '字符');
    console.log('- 预期字节长度:', encodedData.length / 2 - 1, '字节');

    // 验证编码数据中的地址
    console.log('\n🔍 验证编码数据...');
    console.log('- 编码前 sellToken:', transformData.sellToken);
    console.log('- 编码前 buyToken:', transformData.buyToken);

    // 手动解码前几个字段来验证
    try {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const decoded = abiCoder.decode(
            [
                'tuple(uint8,address,address,tuple(bytes32,uint256,uint256,bytes)[],bytes,bytes,uint8[],uint256,address,bytes)',
            ],
            encodedData,
        );

        const [side, sellToken, buyToken] = decoded[0];
        console.log('- 解码后 sellToken:', sellToken);
        console.log('- 解码后 buyToken:', buyToken);
        console.log(
            '- 地址是否匹配:',
            sellToken.toLowerCase() === transformData.sellToken.toLowerCase() &&
                buyToken.toLowerCase() === transformData.buyToken.toLowerCase(),
        );
    } catch (decodeErr) {
        console.log('❌ 手动解码失败:', decodeErr.message);
    }

    // 调用调试合约
    console.log('\n🎯 调用调试合约...');
    try {
        const result = await debugTransformer.debugTransform(encodedData);
        console.log('✅ 调试成功！');
        console.log('🔍 分析结果:', result);
    } catch (error) {
        console.log('❌ 调试调用失败:');
        console.log('错误信息:', error.message);

        // 提取可能的错误代码
        if (error.message.includes('0x')) {
            const errorMatch = error.message.match(/0x[a-fA-F0-9]+/);
            if (errorMatch) {
                console.log('🔍 错误代码:', errorMatch[0]);
            }
        }
    }
}

debugContract().catch(console.error);
