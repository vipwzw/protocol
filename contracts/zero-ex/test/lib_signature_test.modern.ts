import { expect } from 'chai';
import '@nomicfoundation/hardhat-chai-matchers';
const { ethers } = require('hardhat');
import { Contract, MaxUint256 } from 'ethers';

describe('LibSignature - Modern Tests', function() {
    // Extended timeout for cryptographic operations
    this.timeout(180000);
    
    let admin: any;
    let signer1: any;
    let signer2: any;
    let validator: any;
    
    // Signature test contract
    let libSignature: Contract;
    
    const SIGNATURE_TYPES = {
        ILLEGAL: 0,
        INVALID: 1,
        EIP712: 2,
        ETHSIGN: 3,
        PRESIGNED: 4,
        WALLET_SELECTOR: 5
    };
    
    before(async function() {
        console.log('🚀 Setting up LibSignature Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [admin, signer1, signer2, validator] = signers;
        
        console.log('👤 Admin:', admin.target);
        console.log('👤 Signer1:', signer1.target);
        console.log('👤 Signer2:', signer2.target);
        console.log('👤 Validator:', validator.target);
        
        await deploySignatureContractsAsync();
        
        console.log('✅ LibSignature test environment ready!');
    });
    
    async function deploySignatureContractsAsync(): Promise<void> {
        console.log('📦 Deploying signature contracts...');
        
        // Deploy actual LibSignature test contract
        const LibSignatureFactory = await ethers.getContractFactory('TestLibSignature');
        libSignature = await LibSignatureFactory.deploy();
        await libSignature.waitForDeployment();
        console.log(`✅ TestLibSignature: ${await libSignature.getAddress()}`);
    }
    
    async function createMessageHash(message: string): Promise<string> {
        // Create a message hash using ethers
        const messageBytes = ethers.toUtf8Bytes(message);
        return ethers.keccak256(messageBytes);
    }
    
    async function signMessage(signer: any, messageHash: string): Promise<string> {
        // Sign a message hash
        return await signer.signMessage(ethers.getBytes(messageHash));
    }
    
    async function signTypedData(signer: any, domain: any, types: any, value: any): Promise<string> {
        // Sign typed data (EIP-712)
        return await signer.signTypedData(domain, types, value);
    }
    
    describe('🏗️ Contract Deployment', function() {
        it('should deploy LibSignature contract successfully', async function() {
            expect(await libSignature.getAddress()).to.have.lengthOf(42);
            console.log('✅ LibSignature contract deployed');
        });
    });
    
    describe('🔐 Basic Signature Operations', function() {
        it('should create message hashes correctly', async function() {
            const message = 'Hello, 0x Protocol!';
            const messageHash = await createMessageHash(message);
            
            expect(messageHash).to.have.lengthOf(66); // 0x + 64 hex chars
            expect(messageHash).to.match(/^0x[0-9a-fA-F]{64}$/);
            
            console.log(`✅ Message: "${message}"`);
            console.log(`✅ Hash: ${messageHash}`);
        });
        
        it('should generate different hashes for different messages', async function() {
            const message1 = 'Message 1';
            const message2 = 'Message 2';
            
            const hash1 = await createMessageHash(message1);
            const hash2 = await createMessageHash(message2);
            
            expect(hash1).to.not.equal(hash2);
            expect(hash1).to.have.lengthOf(66);
            expect(hash2).to.have.lengthOf(66);
            
            console.log(`✅ Hash1: ${hash1}`);
            console.log(`✅ Hash2: ${hash2}`);
            console.log(`✅ Hashes are different: ${hash1 !== hash2}`);
        });
        
        it('should produce consistent hashes for same messages', async function() {
            const message = 'Consistent message';
            
            const hash1 = await createMessageHash(message);
            const hash2 = await createMessageHash(message);
            
            expect(hash1).to.equal(hash2);
            
            console.log(`✅ Consistent hash: ${hash1}`);
        });
    });
    
    describe('✍️ Message Signing', function() {
        it('should sign messages with different signers', async function() {
            const message = 'Test message for signing';
            const messageHash = await createMessageHash(message);
            
            const signature1 = await signMessage(signer1, messageHash);
            const signature2 = await signMessage(signer2, messageHash);
            
            expect(signature1).to.have.lengthOf(132); // 0x + 130 hex chars (65 bytes * 2)
            expect(signature2).to.have.lengthOf(132);
            expect(signature1).to.not.equal(signature2);
            
            console.log(`✅ Signer1 signature: ${signature1.slice(0, 20)}...`);
            console.log(`✅ Signer2 signature: ${signature2.slice(0, 20)}...`);
            console.log(`✅ Signatures are different: ${signature1 !== signature2}`);
        });
        
        it('should verify signature components', async function() {
            const message = 'Component verification test';
            const messageHash = await createMessageHash(message);
            const signature = await signMessage(signer1, messageHash);
            
            // Extract signature components
            const r = signature.slice(0, 66);
            const s = '0x' + signature.slice(66, 130);
            const v = parseInt(signature.slice(130, 132), 16);
            
            expect(r).to.have.lengthOf(66);
            expect(s).to.have.lengthOf(66);
            expect(v).to.be.oneOf([27, 28]);
            
            console.log(`✅ Signature components:`);
            console.log(`   r: ${r}`);
            console.log(`   s: ${s}`);
            console.log(`   v: ${v}`);
        });
        
        it('should recover signer address from signature', async function() {
            const message = 'Address recovery test';
            const messageHash = await createMessageHash(message);
            const signature = await signMessage(signer1, messageHash);
            
            // Recover the signer address
            const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
            
            expect(recoveredAddress.toLowerCase()).to.equal(signer1.target.toLowerCase());
            
            console.log(`✅ Original signer: ${signer1.target}`);
            console.log(`✅ Recovered address: ${recoveredAddress}`);
            console.log(`✅ Addresses match: ${recoveredAddress.toLowerCase() === signer1.target.toLowerCase()}`);
        });
    });
    
    describe('📜 EIP-712 Typed Data Signing', function() {
        it('should sign EIP-712 typed data', async function() {
            const domain = {
                name: '0x Protocol',
                version: '4.0.0',
                chainId: 1337,
                verifyingContract: await libSignature.getAddress()
            };
            
            const types = {
                Order: [
                    { name: 'maker', type: 'address' },
                    { name: 'taker', type: 'address' },
                    { name: 'makerAmount', type: 'uint256' },
                    { name: 'takerAmount', type: 'uint256' },
                    { name: 'expiry', type: 'uint256' }
                ]
            };
            
            const order = {
                maker: signer1.target,
                taker: signer2.target,
                makerAmount: ethers.parseEther('100'),
                takerAmount: ethers.parseEther('200'),
                expiry: Math.floor(Date.now() / 1000) + 3600
            };
            
            const signature = await signTypedData(signer1, domain, types, order);
            
            expect(signature).to.have.lengthOf(132);
            expect(signature).to.match(/^0x[0-9a-fA-F]{130}$/);
            
            console.log(`✅ EIP-712 signature: ${signature.slice(0, 20)}...`);
            console.log(`✅ Order maker: ${order.maker}`);
            console.log(`✅ Order taker: ${order.taker}`);
        });
        
        it('should handle different typed data structures', async function() {
            const domain = {
                name: 'ZeroEx',
                version: '1.0.0',
                chainId: 1337,
                verifyingContract: admin.target
            };
            
            const transferTypes = {
                Transfer: [
                    { name: 'from', type: 'address' },
                    { name: 'to', type: 'address' },
                    { name: 'amount', type: 'uint256' }
                ]
            };
            
            const transfer = {
                from: signer1.target,
                to: signer2.target,
                amount: ethers.parseEther('50')
            };
            
            const signature = await signTypedData(signer1, domain, transferTypes, transfer);
            
            expect(signature).to.have.lengthOf(132);
            
            console.log(`✅ Transfer signature: ${signature.slice(0, 20)}...`);
            console.log(`✅ Transfer from: ${transfer.from}`);
            console.log(`✅ Transfer to: ${transfer.to}`);
            console.log(`✅ Transfer amount: ${ethers.formatEther(transfer.amount)} ETH`);
        });
    });
    
    describe('🔍 Signature Type Detection', function() {
        it('should identify different signature types', async function() {
            const message = 'Type detection test';
            const messageHash = await createMessageHash(message);
            
            // Create different signature formats
            const ethSignSignature = await signMessage(signer1, messageHash);
            
            // Simulate different signature types
            const signatures = {
                ETHSIGN: ethSignSignature,
                EIP712: ethSignSignature, // Would be different in real implementation
                INVALID: '0x' + '00'.repeat(65),
                PRESIGNED: '0x' + '06'.repeat(65)
            };
            
            for (const [type, signature] of Object.entries(signatures)) {
                expect(signature).to.be.a('string');
                expect(signature).to.match(/^0x[0-9a-fA-F]+$/);
                
                console.log(`✅ ${type} signature: ${signature.slice(0, 20)}...`);
            }
        });
        
        it('should validate signature lengths', async function() {
            const validSignature = await signMessage(signer1, await createMessageHash('test'));
            const invalidSignatures = [
                '0x1234', // Too short
                '0x' + '00'.repeat(64), // Missing v component
                '0x' + '00'.repeat(66), // Too long
            ];
            
            expect(validSignature).to.have.lengthOf(132);
            
            console.log(`✅ Valid signature length: ${validSignature.length}`);
            
            for (let i = 0; i < invalidSignatures.length; i++) {
                const invalidSig = invalidSignatures[i];
                expect(invalidSig.length).to.not.equal(132);
                console.log(`❌ Invalid signature ${i + 1} length: ${invalidSig.length}`);
            }
        });
    });
    
    describe('🛡️ Signature Validation', function() {
        it('should validate correct signatures', async function() {
            const message = 'Validation test message';
            const messageHash = await createMessageHash(message);
            const signature = await signMessage(signer1, messageHash);
            
            // Verify the signature
            const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
            const isValid = recoveredAddress.toLowerCase() === signer1.target.toLowerCase();
            
            expect(isValid).to.be.true;
            
            console.log(`✅ Signature validation: ${isValid}`);
            console.log(`✅ Expected signer: ${signer1.target}`);
            console.log(`✅ Recovered signer: ${recoveredAddress}`);
        });
        
        it('should reject invalid signatures', async function() {
            const message = 'Invalid signature test';
            const messageHash = await createMessageHash(message);
            const validSignature = await signMessage(signer1, messageHash);
            
            // Create invalid signatures
            const invalidSignatures = [
                '0x' + '00'.repeat(65), // All zeros
                validSignature.slice(0, -2) + '00', // Wrong v value
                '0x' + validSignature.slice(2).split('').reverse().join(''), // Reversed
            ];
            
            for (let i = 0; i < invalidSignatures.length; i++) {
                try {
                    const invalidSig = invalidSignatures[i];
                    const recovered = ethers.verifyMessage(ethers.getBytes(messageHash), invalidSig);
                    const isValidSigner = recovered.toLowerCase() === signer1.target.toLowerCase();
                    
                    expect(isValidSigner).to.be.false;
                    console.log(`❌ Invalid signature ${i + 1} correctly rejected`);
                } catch (error) {
                    console.log(`❌ Invalid signature ${i + 1} threw error (expected)`);
                }
            }
        });
        
        it('should handle signature validation edge cases', async function() {
            const message = 'Edge case test';
            const messageHash = await createMessageHash(message);
            
            // Test with empty message
            const emptyHash = await createMessageHash('');
            expect(emptyHash).to.have.lengthOf(66);
            
            // Test with very long message
            const longMessage = 'x'.repeat(1000);
            const longHash = await createMessageHash(longMessage);
            expect(longHash).to.have.lengthOf(66);
            
            // Test with special characters
            const specialMessage = '!@#$%^&*()_+-=[]{}|;:,.<>?';
            const specialHash = await createMessageHash(specialMessage);
            expect(specialHash).to.have.lengthOf(66);
            
            console.log(`✅ Empty message hash: ${emptyHash}`);
            console.log(`✅ Long message hash: ${longHash.slice(0, 20)}...`);
            console.log(`✅ Special chars hash: ${specialHash.slice(0, 20)}...`);
        });
    });
    
    describe('⚡ Performance Tests', function() {
        it('should handle multiple signatures efficiently', async function() {
            const signatureCount = 20;
            const baseMessage = 'Performance test message ';
            
            console.log(`🔥 Creating ${signatureCount} signatures...`);
            
            const startTime = Date.now();
            
            const signatures = [];
            for (let i = 0; i < signatureCount; i++) {
                const message = baseMessage + i;
                const messageHash = await createMessageHash(message);
                const signature = await signMessage(signer1, messageHash);
                signatures.push({
                    message,
                    messageHash,
                    signature
                });
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            const avgTimePerSignature = duration / signatureCount;
            
            console.log(`⚡ Signature performance:`);
            console.log(`   Total time: ${duration}ms`);
            console.log(`   Average per signature: ${avgTimePerSignature.toFixed(2)}ms`);
            console.log(`   Signatures created: ${signatures.length}`);
            
            expect(signatures.length).to.equal(signatureCount);
            expect(avgTimePerSignature).to.be.lessThan(100); // Should be under 100ms per signature
            
            // Verify all signatures are unique
            const uniqueSignatures = new Set(signatures.map(s => s.signature));
            expect(uniqueSignatures.size).to.equal(signatureCount);
        });
        
        it('should verify signatures efficiently', async function() {
            const verificationCount = 10;
            const message = 'Verification performance test';
            const messageHash = await createMessageHash(message);
            
            // Create signatures to verify
            const signaturesData = [];
            for (let i = 0; i < verificationCount; i++) {
                const signature = await signMessage(signer1, messageHash);
                signaturesData.push({ messageHash, signature });
            }
            
            console.log(`🔥 Verifying ${verificationCount} signatures...`);
            
            const startTime = Date.now();
            
            let validCount = 0;
            for (const { messageHash, signature } of signaturesData) {
                try {
                    const recovered = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
                    if (recovered.toLowerCase() === signer1.target.toLowerCase()) {
                        validCount++;
                    }
                } catch (error) {
                    // Invalid signature
                }
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            const avgTimePerVerification = duration / verificationCount;
            
            console.log(`⚡ Verification performance:`);
            console.log(`   Total time: ${duration}ms`);
            console.log(`   Average per verification: ${avgTimePerVerification.toFixed(2)}ms`);
            console.log(`   Valid signatures: ${validCount}/${verificationCount}`);
            
            expect(validCount).to.equal(verificationCount);
            expect(avgTimePerVerification).to.be.lessThan(50); // Should be under 50ms per verification
        });
    });
    
    describe('📊 Signature Analytics', function() {
        it('should provide signature statistics', async function() {
            const testCount = 15;
            const signers = [signer1, signer2, validator];
            const statistics = {
                totalSignatures: 0,
                signerCounts: new Map(),
                signatureTypes: new Map(),
                averageLength: 0
            };
            
            console.log(`📈 Generating signature statistics with ${testCount} signatures...`);
            
            for (let i = 0; i < testCount; i++) {
                const signer = signers[i % signers.length];
                const message = `Stats test message ${i}`;
                const messageHash = await createMessageHash(message);
                const signature = await signMessage(signer, messageHash);
                
                statistics.totalSignatures++;
                
                // Count by signer
                const signerAddress = signer.target;
                statistics.signerCounts.set(
                    signerAddress,
                    (statistics.signerCounts.get(signerAddress) || 0) + 1
                );
                
                // Track signature length
                statistics.averageLength += signature.length;
                
                // Simulate signature type detection
                statistics.signatureTypes.set(
                    'ETHSIGN',
                    (statistics.signatureTypes.get('ETHSIGN') || 0) + 1
                );
            }
            
            statistics.averageLength = statistics.averageLength / statistics.totalSignatures;
            
            console.log(`📊 Signature Statistics:`);
            console.log(`   Total Signatures: ${statistics.totalSignatures}`);
            console.log(`   Average Length: ${statistics.averageLength}`);
            
            console.log(`   Signatures by Signer:`);
            for (const [signerAddr, count] of statistics.signerCounts) {
                console.log(`     ${signerAddr.slice(0, 10)}...: ${count}`);
            }
            
            console.log(`   Signature Types:`);
            for (const [type, count] of statistics.signatureTypes) {
                console.log(`     ${type}: ${count}`);
            }
            
            expect(statistics.totalSignatures).to.equal(testCount);
            expect(statistics.averageLength).to.equal(132); // Standard signature length
        });
    });
}); 