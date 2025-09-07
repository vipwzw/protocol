const { MetaTransaction } = require('@0x/protocol-utils');
const { ethers } = require('hardhat');

async function debugTypeHash() {
    console.log('🔍 调试TypeHash差异...\n');

    // JavaScript TypeHash
    const jsTypeHash = MetaTransaction.TYPE_HASH;
    console.log('🔑 JavaScript TypeHash:', jsTypeHash);

    // 手动计算TypeHash
    const typeString =
        'MetaTransactionData(address signer,address sender,uint256 minGasPrice,uint256 maxGasPrice,uint256 expirationTimeSeconds,uint256 salt,bytes callData,uint256 value,address feeToken,uint256 feeAmount)';
    const manualTypeHash = ethers.keccak256(ethers.toUtf8Bytes(typeString));
    console.log('🔧 手动计算TypeHash:', manualTypeHash);

    // 合约中的TypeHash字符串
    const contractTypeString =
        'MetaTransactionData(address signer,address sender,uint256 minGasPrice,uint256 maxGasPrice,uint256 expirationTimeSeconds,uint256 salt,bytes callData,uint256 value,address feeToken,uint256 feeAmount)';
    const contractTypeHash = ethers.keccak256(ethers.toUtf8Bytes(contractTypeString));
    console.log('📋 合约TypeHash:', contractTypeHash);

    console.log('\n🔍 比较结果:');
    console.log('  - JS vs Manual:', jsTypeHash === manualTypeHash ? '✅' : '❌');
    console.log('  - Manual vs Contract:', manualTypeHash === contractTypeHash ? '✅' : '❌');

    console.log('\n✅ TypeHash调试完成！');
}

debugTypeHash().catch(console.error);
