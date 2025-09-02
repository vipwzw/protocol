const { ethers } = require('hardhat');

async function debugDomainSeparator() {
    console.log('🔍 调试Domain Separator差异...\n');
    
    const chainId = 31337;
    const verifyingContract = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
    const name = 'ZeroEx';
    const version = '1.0.0';
    
    // 手动计算Domain Separator
    const domainTypeHash = ethers.keccak256(ethers.toUtf8Bytes(
        'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
    ));
    
    const nameHash = ethers.keccak256(ethers.toUtf8Bytes(name));
    const versionHash = ethers.keccak256(ethers.toUtf8Bytes(version));
    
    const domainSeparator = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [domainTypeHash, nameHash, versionHash, chainId, verifyingContract]
        )
    );
    
    console.log('🔑 手动计算Domain Separator:', domainSeparator);
    console.log('📋 参数:');
    console.log('  - DomainTypeHash:', domainTypeHash);
    console.log('  - NameHash:', nameHash);
    console.log('  - VersionHash:', versionHash);
    console.log('  - ChainId:', chainId);
    console.log('  - VerifyingContract:', verifyingContract);
    
    console.log('\n✅ Domain Separator调试完成！');
}

debugDomainSeparator().catch(console.error);
