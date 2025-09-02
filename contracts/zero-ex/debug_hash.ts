import { ethers } from 'hardhat';

async function debugMetaTransactionHash() {
    console.log('🔍 调试MetaTransaction Hash不匹配问题...\n');
    
    // 获取合约实例
    const [owner] = await ethers.getSigners();
    
    // 部署一个简单的测试合约来检查域分隔符
    const TestContract = await ethers.getContractFactory('MetaTransactionsFeature');
    const testContract = await TestContract.deploy(ethers.ZeroAddress);
    await testContract.waitForDeployment();
    
    const contractAddress = await testContract.getAddress();
    console.log('📍 合约地址:', contractAddress);
    
    // 获取合约的EIP712域分隔符
    const domainSeparator = await testContract.EIP712_DOMAIN_SEPARATOR();
    console.log('🔑 合约域分隔符:', domainSeparator);
    
    // 获取网络信息
    const network = await ethers.provider.getNetwork();
    console.log('🌐 网络信息:', {
        chainId: network.chainId.toString(),
        name: network.name
    });
    
    // 创建一个测试MetaTransaction
    const mtxData = {
        signer: owner.address,
        sender: owner.address,
        minGasPrice: 0n,
        maxGasPrice: 1000000000n,
        expirationTimeSeconds: BigInt(Math.floor(Date.now() / 1000) + 3600),
        salt: 12345n,
        callData: '0x12345678',
        value: 0n,
        feeToken: ethers.ZeroAddress,
        feeAmount: 0n
    };
    
    console.log('\n📦 测试MetaTransaction数据:', mtxData);
    
    // 获取合约计算的hash
    const contractHash = await testContract.getMetaTransactionHash(mtxData);
    console.log('\n🔑 合约计算的hash:', contractHash);
    
    // 获取TypeHash
    const typeHash = await testContract.MTX_EIP712_TYPEHASH();
    console.log('📋 MetaTransaction TypeHash:', typeHash);
    
    console.log('\n✅ 调试完成！现在需要检查JavaScript MetaTransaction类的实现');
}

debugMetaTransactionHash().catch(console.error);

