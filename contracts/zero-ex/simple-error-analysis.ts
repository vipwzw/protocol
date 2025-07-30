async function simpleErrorAnalysis() {
    console.log('🔍 简单分析 InvalidTransformDataError...');

    // 从测试输出中重新提取的错误数据
    const fullErrorData: string =
        '0xadc35ca600000000000000000000000025b8fe1de9daf8ba351890744ff28cf7dfa8f5e300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a7640000';

    console.log('完整错误数据:', fullErrorData);
    console.log('错误数据长度:', fullErrorData.length);

    // 手动分析错误结构
    const selector = fullErrorData.slice(0, 10); // 0xadc35ca6
    console.log('\n选择器:', selector);

    // 按 32 字节分解剩余数据
    const remaining = fullErrorData.slice(10);
    console.log('剩余数据长度:', remaining.length);

    const chunks: string[] = [];
    for (let i = 0; i < remaining.length; i += 64) {
        chunks.push(remaining.slice(i, i + 64));
    }

    console.log('\n按32字节分解:');
    chunks.forEach((chunk: string, index: number) => {
        console.log(`第${index + 1}个32字节:`, chunk);

        // 尝试解释这些字节
        if (chunk.length === 64) {
            // 作为地址解释
            const address = '0x' + chunk.slice(24); // 地址是后20字节
            console.log(`  作为地址: ${address}`);

            // 作为数字解释
            const bigintValue = BigInt('0x' + chunk);
            console.log(`  作为数字: ${bigintValue.toString()}`);

            // 检查是否是 ETH 地址
            const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
            if (address.toLowerCase() === ETH_TOKEN_ADDRESS.toLowerCase()) {
                console.log(`  ❌ 这是 ETH 地址！`);
            }
        }
        console.log('');
    });

    // 特别分析可能的字段
    console.log('🔍 字段分析:');
    if (chunks.length >= 3) {
        const field1 = '0x' + chunks[0].slice(24);
        const field2 = '0x' + chunks[1].slice(24);
        const field3 = BigInt('0x' + chunks[2]);

        console.log('可能的字段解释:');
        console.log('- 字段1 (sellToken?):', field1);
        console.log('- 字段2 (buyToken?):', field2);
        console.log('- 字段3 (数量?):', field3.toString());

        // 检查 ETH 地址
        const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const isField1ETH = field1.toLowerCase() === ETH_TOKEN_ADDRESS.toLowerCase();
        const isField2ETH = field2.toLowerCase() === ETH_TOKEN_ADDRESS.toLowerCase();

        console.log('\nETH 地址检查:');
        console.log('- 字段1 是 ETH:', isField1ETH);
        console.log('- 字段2 是 ETH:', isField2ETH);
        console.log('- ETH_TOKEN_ADDRESS:', ETH_TOKEN_ADDRESS);

        if (isField1ETH || isField2ETH) {
            console.log('🎯 找到问题：检测到 ETH 地址！');
        } else {
            console.log('🤔 奇怪：没有检测到 ETH 地址...');
        }
    }

    // 分析错误结构（InvalidTransformDataError 应该是 errorCode + bytes）
    console.log('\n🔬 错误结构分析:');
    console.log('错误应该包含:');
    console.log('1. uint8 errorCode');
    console.log('2. bytes transformData');

    // 前32字节可能是 errorCode (但实际上应该只是 uint8)
    if (chunks.length > 0) {
        const errorCodeValue = BigInt('0x' + chunks[0]);
        console.log('可能的 errorCode:', errorCodeValue.toString());
        if (errorCodeValue === 0n) {
            console.log('✅ errorCode = 0 (INVALID_TOKENS)');
        } else if (errorCodeValue === 1n) {
            console.log('✅ errorCode = 1 (INVALID_ARRAY_LENGTH)');
        }
    }
}

simpleErrorAnalysis().catch(console.error);
