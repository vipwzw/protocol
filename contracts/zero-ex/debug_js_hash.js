const { MetaTransaction } = require('@0x/protocol-utils');
const { ethers } = require('hardhat');

async function debugJSMetaTransactionHash() {
    console.log('🔍 调试JavaScript MetaTransaction Hash计算...\n');
    
    const [owner] = await ethers.getSigners();
    
    // 获取网络信息
    const network = await ethers.provider.getNetwork();
    console.log('🌐 网络信息:', {
        chainId: network.chainId.toString(),
        name: network.name
    });
    
    // 创建相同的测试数据
    const mtxData = {
        signer: owner.address,
        sender: owner.address,
        minGasPrice: 0n,
        maxGasPrice: 1000000000n,
        expirationTimeSeconds: 1756779385n,
        salt: 12345n,
        callData: '0x12345678',
        value: 0n,
        feeToken: '0x0000000000000000000000000000000000000000',
        feeAmount: 0n,
        chainId: Number(network.chainId),
        verifyingContract: '0x5FbDB2315678afecb367f032d93F642f64180aa3' // 使用合约地址
    };
    
    console.log('📦 JavaScript MetaTransaction数据:', mtxData);
    
    // 创建MetaTransaction实例
    const mtx = new MetaTransaction(mtxData);
    
    // 获取JavaScript计算的hash
    const jsHash = mtx.getHash();
    console.log('\n🔑 JavaScript计算的hash:', jsHash);
    
    // 获取struct hash
    const structHash = mtx.getStructHash();
    console.log('📋 JavaScript StructHash:', structHash);
    
    // 获取EIP712 TypedData
    const typedData = mtx.getEIP712TypedData();
    console.log('📄 EIP712 TypedData:', JSON.stringify(typedData, null, 2));
    
    console.log('\n✅ JavaScript调试完成！');
}

debugJSMetaTransactionHash().catch(console.error);
