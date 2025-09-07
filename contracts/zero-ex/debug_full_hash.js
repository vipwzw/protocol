const { MetaTransaction } = require('@0x/protocol-utils');
const { ethers } = require('hardhat');

async function debugFullHash() {
    console.log('🔍 完整调试Hash计算过程...\n');

    const chainId = 31337;
    const verifyingContract = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

    // 测试数据
    const mtxData = {
        signer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        sender: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        minGasPrice: 0n,
        maxGasPrice: 1000000000n,
        expirationTimeSeconds: 1756779385n,
        salt: 12345n,
        callData: '0x12345678',
        value: 0n,
        feeToken: '0x0000000000000000000000000000000000000000',
        feeAmount: 0n,
        chainId: chainId,
        verifyingContract: verifyingContract,
    };

    console.log('📦 测试数据:', mtxData);

    // JavaScript计算
    const mtx = new MetaTransaction(mtxData);
    const jsStructHash = mtx.getStructHash();
    const jsHash = mtx.getHash();

    console.log('\n🔑 JavaScript计算:');
    console.log('  - StructHash:', jsStructHash);
    console.log('  - Final Hash:', jsHash);

    // 手动计算struct hash
    const typeHash = '0xe866282978e74dc892efa3621df30a058ca4d374a338824c0b89f1dfdcb0ea04';
    const callDataHash = ethers.keccak256(mtxData.callData);

    const manualStructHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            [
                'bytes32',
                'address',
                'address',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
                'bytes32',
                'uint256',
                'address',
                'uint256',
            ],
            [
                typeHash,
                mtxData.signer,
                mtxData.sender,
                mtxData.minGasPrice,
                mtxData.maxGasPrice,
                mtxData.expirationTimeSeconds,
                mtxData.salt,
                callDataHash,
                mtxData.value,
                mtxData.feeToken,
                mtxData.feeAmount,
            ],
        ),
    );

    console.log('\n🔧 手动计算:');
    console.log('  - TypeHash:', typeHash);
    console.log('  - CallDataHash:', callDataHash);
    console.log('  - StructHash:', manualStructHash);

    // 手动计算domain separator
    const domainTypeHash = ethers.keccak256(
        ethers.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
    );
    const nameHash = ethers.keccak256(ethers.toUtf8Bytes('ZeroEx'));
    const versionHash = ethers.keccak256(ethers.toUtf8Bytes('1.0.0'));

    const domainSeparator = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [domainTypeHash, nameHash, versionHash, chainId, verifyingContract],
        ),
    );

    // 手动计算最终hash
    const manualFinalHash = ethers.keccak256(ethers.concat(['0x1901', domainSeparator, manualStructHash]));

    console.log('  - DomainSeparator:', domainSeparator);
    console.log('  - Final Hash:', manualFinalHash);

    console.log('\n🔍 比较结果:');
    console.log('  - StructHash匹配:', jsStructHash === manualStructHash ? '✅' : '❌');
    console.log('  - FinalHash匹配:', jsHash === manualFinalHash ? '✅' : '❌');

    console.log('\n✅ 完整调试完成！');
}

debugFullHash().catch(console.error);
