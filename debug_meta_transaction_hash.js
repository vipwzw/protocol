#!/usr/bin/env node

const { ethers } = require('hardhat');

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
    
    // 计算预期的域分隔符
    const domainTypeHash = ethers.keccak256(ethers.toUtf8Bytes(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    ));
    const nameHash = ethers.keccak256(ethers.toUtf8Bytes("ZeroEx"));
    const versionHash = ethers.keccak256(ethers.toUtf8Bytes("1.0.0"));
    
    const expectedDomainSeparator = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [domainTypeHash, nameHash, versionHash, network.chainId, contractAddress]
        )
    );
    
    console.log('📋 域分隔符组件:');
    console.log('  - domainTypeHash:', domainTypeHash);
    console.log('  - nameHash (ZeroEx):', nameHash);
    console.log('  - versionHash (1.0.0):', versionHash);
    console.log('  - chainId:', network.chainId.toString());
    console.log('  - verifyingContract:', contractAddress);
    
    console.log('\n🔍 域分隔符比较:');
    console.log('  - 合约返回:', domainSeparator);
    console.log('  - 预期计算:', expectedDomainSeparator);
    console.log('  - 匹配:', domainSeparator === expectedDomainSeparator ? '✅' : '❌');
    
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
    
    // 手动计算hash
    const typeHash = await testContract.MTX_EIP712_TYPEHASH();
    console.log('📋 MetaTransaction TypeHash:', typeHash);
    
    const structHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32', 'uint256', 'address', 'uint256'],
            [
                typeHash,
                mtxData.signer,
                mtxData.sender,
                mtxData.minGasPrice,
                mtxData.maxGasPrice,
                mtxData.expirationTimeSeconds,
                mtxData.salt,
                ethers.keccak256(mtxData.callData),
                mtxData.value,
                mtxData.feeToken,
                mtxData.feeAmount
            ]
        )
    );
    
    const manualHash = ethers.keccak256(
        ethers.concat([
            '0x1901',
            domainSeparator,
            structHash
        ])
    );
    
    console.log('\n🔍 Hash计算比较:');
    console.log('  - 合约计算:', contractHash);
    console.log('  - 手动计算:', manualHash);
    console.log('  - 匹配:', contractHash === manualHash ? '✅' : '❌');
    
    if (contractHash !== manualHash) {
        console.log('\n❌ Hash不匹配！可能的原因:');
        console.log('  1. 域分隔符不匹配');
        console.log('  2. 结构hash计算不匹配');
        console.log('  3. TypeHash不匹配');
        
        console.log('\n🔧 调试信息:');
        console.log('  - structHash:', structHash);
        console.log('  - domainSeparator:', domainSeparator);
    } else {
        console.log('\n✅ Hash匹配！问题可能在JavaScript MetaTransaction类的实现');
    }
}

debugMetaTransactionHash().catch(console.error);

