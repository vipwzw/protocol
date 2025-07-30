const ethersLib = require('hardhat');

async function decodeErrorData() {
    console.log('🔍 解码 IncompleteFillSellQuoteError 数据...');

    // 原始错误：IncompleteFillSellQuoteError(address,uint256,uint256)
    const errorData =
        '0xadc35ca600000000000000000000000025b8fe1de9daf8ba351890744ff28cf7dfa8f5e300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000082835adaf07fb80';

    console.log('原始错误数据:', errorData);
    console.log('错误类型: IncompleteFillSellQuoteError(address,uint256,uint256)');

    const selector = errorData.slice(0, 10); // 0xadc35ca6
    const params = errorData.slice(10);

    console.log('\n🔍 分解错误数据:');
    console.log('- 选择器:', selector);
    console.log('- 参数数据长度:', params.length, '字符');

    // 手动分解3个32字节参数
    console.log('\n🔬 手动分解:');

    const param1 = params.slice(0, 64); // address
    const param2 = params.slice(64, 128); // uint256
    const param3 = params.slice(128, 192); // uint256

    console.log('参数1 (address):', param1);
    console.log('参数2 (soldAmount):', param2);
    console.log('参数3 (targetAmount):', param3);

    // 解析地址 (去掉前导零)
    const token = '0x' + param1.slice(24); // 去掉前24个字符，留下20字节地址
    console.log('\n📊 解析结果:');
    console.log('- token (sellToken):', token);

    // 解析数量
    const soldAmount = BigInt('0x' + param2);
    const targetAmount = BigInt('0x' + param3);

    console.log('- soldAmount:', soldAmount.toString());
    console.log('- targetAmount:', targetAmount.toString());

    console.log('\n📈 分析:');
    console.log('- 期望卖出:', targetAmount.toString());
    console.log('- 实际卖出:', soldAmount.toString());
    console.log('- 差额:', (targetAmount - soldAmount).toString());

    if (targetAmount > 0n) {
        console.log('- 完成度:', ((Number(soldAmount) / Number(targetAmount)) * 100).toFixed(2) + '%');
    }

    if (soldAmount === 0n) {
        console.log('❌ 完全没有卖出任何代币！');
        console.log('💡 可能的原因：');
        console.log('  - 桥接合约没有足够的流动性');
        console.log('  - 代币余额不足');
        console.log('  - 授权问题');
    } else if (soldAmount < targetAmount) {
        console.log('⚠️ 部分成功：卖出数量少于目标数量');
    }
}

decodeErrorData().catch(console.error);
