const { MetaTransaction } = require('@0x/protocol-utils');
const { ethers } = require('hardhat');
const { fullMigrateAsync } = require('./test/utils/migration');

async function debugDetailedHash() {
    console.log('🔍 详细调试MetaTransaction Hash不匹配问题...\n');

    const [owner] = await ethers.getSigners();
    const env = {
        provider: ethers.provider,
        txDefaults: { from: owner.address },
        getAccountAddressesAsync: async () => [owner.address],
    };

    // 部署完整的ZeroEx合约
    console.log('📦 部署ZeroEx合约...');
    const zeroEx = await fullMigrateAsync(owner.address, env.provider, env.txDefaults, {});
    const zeroExAddress = await zeroEx.getAddress();
    console.log('📍 ZeroEx合约地址:', zeroExAddress);

    // 获取MetaTransactionsFeature
    const feature = await ethers.getContractAt('IMetaTransactionsFeature', zeroExAddress);

    // 获取网络信息
    const network = await ethers.provider.getNetwork();
    console.log('🌐 网络信息:', {
        chainId: network.chainId.toString(),
        name: network.name,
    });

    // 创建固定的测试数据
    const mtxData = {
        signer: owner.address,
        sender: owner.address,
        minGasPrice: 0n,
        maxGasPrice: 1000000000n,
        expirationTimeSeconds: 1756779385n,
        salt: 12345n,
        callData: '0x12345678',
        value: 0n,
        feeToken: ethers.ZeroAddress,
        feeAmount: 0n,
        chainId: Number(network.chainId),
        verifyingContract: zeroExAddress,
    };

    console.log('\n📦 测试MetaTransaction数据:', mtxData);

    // 创建JavaScript MetaTransaction
    const mtx = new MetaTransaction(mtxData);

    // 获取JavaScript计算的各种hash
    const jsHash = mtx.getHash();
    const jsStructHash = mtx.getStructHash();
    const jsTypedData = mtx.getEIP712TypedData();

    console.log('\n🔑 JavaScript计算结果:');
    console.log('  - Hash:', jsHash);
    console.log('  - StructHash:', jsStructHash);
    console.log('  - Domain:', JSON.stringify(jsTypedData.domain, null, 4));

    // 转换为合约结构体格式
    const contractStruct = {
        signer: mtx.signer,
        sender: mtx.sender,
        minGasPrice: mtx.minGasPrice,
        maxGasPrice: mtx.maxGasPrice,
        expirationTimeSeconds: mtx.expirationTimeSeconds,
        salt: mtx.salt,
        callData: mtx.callData,
        value: mtx.value,
        feeToken: mtx.feeToken,
        feeAmount: mtx.feeAmount,
    };

    console.log('\n📋 合约结构体:', contractStruct);

    // 获取合约计算的hash
    try {
        const contractHash = await feature.getMetaTransactionHash(contractStruct);

        console.log('\n🔑 合约计算结果:');
        console.log('  - Hash:', contractHash);

        console.log('\n🔍 比较结果:');
        console.log('  - Hash匹配:', jsHash === contractHash ? '✅' : '❌');
        console.log('  - JavaScript Hash:', jsHash);
        console.log('  - 合约 Hash:', contractHash);
    } catch (error) {
        console.log('\n❌ 合约调用失败:', error.message);
        console.log('  - JavaScript Hash:', jsHash);
    }

    console.log('\n✅ 详细调试完成！');
}

debugDetailedHash().catch(console.error);
