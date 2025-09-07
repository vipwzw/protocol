const { ethers } = require('hardhat');
const { fullMigrateAsync } = require('./test/utils/migration');

async function debugContractDomain() {
    console.log('🔍 调试合约Domain Separator...\n');

    const [owner] = await ethers.getSigners();
    const env = {
        provider: ethers.provider,
        txDefaults: { from: owner.address },
        getAccountAddressesAsync: async () => [owner.address],
    };

    // 部署ZeroEx合约
    const zeroEx = await fullMigrateAsync(owner.address, env.provider, env.txDefaults, {});
    const zeroExAddress = await zeroEx.getAddress();

    console.log('📍 ZeroEx合约地址:', zeroExAddress);

    // 部署单独的MetaTransactionsFeature来检查domain separator
    const MetaTransactionsFeature = await ethers.getContractFactory('MetaTransactionsFeature');
    const mtxFeature = await MetaTransactionsFeature.deploy(zeroExAddress);
    await mtxFeature.waitForDeployment();

    const mtxFeatureAddress = await mtxFeature.getAddress();
    console.log('📍 MetaTransactionsFeature地址:', mtxFeatureAddress);

    // 获取domain separator
    const contractDomainSeparator = await mtxFeature.EIP712_DOMAIN_SEPARATOR();
    console.log('🔑 合约Domain Separator:', contractDomainSeparator);

    // 手动计算期望的domain separator
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    const domainTypeHash = ethers.keccak256(
        ethers.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
    );
    const nameHash = ethers.keccak256(ethers.toUtf8Bytes('ZeroEx'));
    const versionHash = ethers.keccak256(ethers.toUtf8Bytes('1.0.0'));

    const expectedDomainSeparator = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [domainTypeHash, nameHash, versionHash, chainId, zeroExAddress],
        ),
    );

    console.log('🔧 期望Domain Separator:', expectedDomainSeparator);
    console.log('📋 参数:');
    console.log('  - ChainId:', chainId);
    console.log('  - VerifyingContract:', zeroExAddress);

    console.log('\n🔍 比较结果:');
    console.log('  - Domain Separator匹配:', contractDomainSeparator === expectedDomainSeparator ? '✅' : '❌');

    console.log('\n✅ 合约Domain调试完成！');
}

debugContractDomain().catch(console.error);
