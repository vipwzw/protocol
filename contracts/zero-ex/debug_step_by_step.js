const { MetaTransaction } = require('@0x/protocol-utils');
const { ethers } = require('hardhat');
const { fullMigrateAsync } = require('./test/utils/migration');

async function debugStepByStep() {
    console.log('🔍 逐步调试Hash计算差异...\n');

    const [owner] = await ethers.getSigners();
    const env = {
        provider: ethers.provider,
        txDefaults: { from: owner.address },
        getAccountAddressesAsync: async () => [owner.address],
    };

    // 部署ZeroEx合约
    const zeroEx = await fullMigrateAsync(owner.address, env.provider, env.txDefaults, {});
    const zeroExAddress = await zeroEx.getAddress();
    const feature = await ethers.getContractAt('IMetaTransactionsFeature', zeroExAddress);

    console.log('📍 ZeroEx合约地址:', zeroExAddress);

    // 获取chainId（使用与测试相同的方式）
    let chainId;
    try {
        const chainIdHex = await ethers.provider.send('eth_chainId', []);
        chainId = parseInt(chainIdHex, 16);
    } catch {
        const network = await ethers.provider.getNetwork();
        chainId = Number(network.chainId);
    }
    console.log('🌐 ChainId:', chainId);

    // 创建固定的测试数据（避免随机性）
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
        chainId: chainId,
        verifyingContract: zeroExAddress,
    };

    console.log('\n📦 测试数据:', mtxData);

    // JavaScript计算
    const mtx = new MetaTransaction(mtxData);
    const jsHash = mtx.getHash();
    const jsStructHash = mtx.getStructHash();
    const jsTypedData = mtx.getEIP712TypedData();

    console.log('\n🔑 JavaScript计算:');
    console.log('  - StructHash:', jsStructHash);
    console.log('  - Hash:', jsHash);
    console.log('  - Domain:', JSON.stringify(jsTypedData.domain, null, 4));

    // 合约计算
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

    try {
        const contractHash = await feature.getMetaTransactionHash(contractStruct);
        console.log('\n🔑 合约计算:');
        console.log('  - Hash:', contractHash);

        console.log('\n🔍 最终比较:');
        console.log('  - Hash匹配:', jsHash === contractHash ? '✅' : '❌');
        console.log('  - JavaScript Hash:', jsHash);
        console.log('  - 合约 Hash:', contractHash);

        // 如果不匹配，尝试分析原因
        if (jsHash !== contractHash) {
            console.log('\n🔧 分析差异原因:');
            console.log('  - 可能的原因:');
            console.log('    1. Domain Separator 不同');
            console.log('    2. Struct Hash 计算方式不同');
            console.log('    3. TypeHash 不同');
            console.log('    4. 数据编码方式不同');
        }
    } catch (error) {
        console.log('\n❌ 合约调用失败:', error.message);
    }

    console.log('\n✅ 逐步调试完成！');
}

debugStepByStep().catch(console.error);
