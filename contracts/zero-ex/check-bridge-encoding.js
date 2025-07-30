const { ethers } = require('hardhat');

async function checkBridgeEncoding() {
    console.log('🔍 检查 bridgeData 编码...');

    // 使用测试中的实际数据
    const bridgeAddress = '0x48BaCB9266a570d521063EF5dD96e61686DbE788';
    const boughtAmount = 766215889084000000n;

    console.log('测试数据:');
    console.log('- bridgeAddress:', bridgeAddress);
    console.log('- boughtAmount:', boughtAmount.toString());

    // 我们当前的实现
    const bridgeAddressHex = ethers.zeroPadValue(bridgeAddress, 32);
    const offsetHex = ethers.zeroPadValue('0x20', 32);
    const boughtAmountHex = ethers.zeroPadValue(ethers.toBeHex(boughtAmount), 32);

    const ourResult = bridgeAddressHex + offsetHex.slice(2) + boughtAmountHex.slice(2);

    console.log('\n🔍 我们的 bridgeData 编码:');
    console.log('- bridgeAddressHex:', bridgeAddressHex);
    console.log('- offsetHex:', offsetHex);
    console.log('- boughtAmountHex:', boughtAmountHex);
    console.log('- 完整结果:', ourResult);
    console.log('- 长度:', ourResult.length, '字符');

    // 检查各部分
    console.log('\n🔍 分解检查:');
    console.log('- 第1部分 (桥接地址):', ourResult.slice(0, 66));
    console.log('- 第2部分 (偏移量):', '0x' + ourResult.slice(66, 130));
    console.log('- 第3部分 (购买数量):', '0x' + ourResult.slice(130, 194));

    // 验证解码
    console.log('\n🔍 验证解码:');
    try {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        // 尝试按照 _tradeZeroExBridge 期望的格式解码
        const decoded = abiCoder.decode(['address', 'bytes'], ourResult);
        console.log('- 解码成功:');
        console.log('  - provider:', decoded[0]);
        console.log('  - lpData:', decoded[1]);

        // 进一步解码 lpData
        const lpDataDecoded = abiCoder.decode(['uint256'], decoded[1]);
        console.log('  - lpData 解码后的数量:', lpDataDecoded[0].toString());
    } catch (error) {
        console.log('❌ 解码失败:', error.message);
        console.log('这说明我们的编码格式可能有问题');
    }
}

checkBridgeEncoding().catch(console.error);
