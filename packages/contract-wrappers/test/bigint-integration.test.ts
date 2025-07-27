import { expect } from 'chai';
import { ethers } from 'ethers';
import { TEST_VALUES, expectToBeBigInt, expectToEqualBigInt } from './setup';

describe('BigInt Integration Tests', () => {
    describe('Native BigInt Support', () => {
        it('should work with bigint literals', () => {
            const value = 1000000000000000000n;
            expectToBeBigInt(value);
            expectToEqualBigInt(value, TEST_VALUES.ONE_ETH);
        });

        it('should perform arithmetic operations', () => {
            const a = 1000000000000000000n;
            const b = 500000000000000000n;
            
            const sum = a + b;
            const diff = a - b;
            const product = a * 2n;
            const quotient = a / 2n;
            
            expectToEqualBigInt(sum, 1500000000000000000n);
            expectToEqualBigInt(diff, 500000000000000000n);
            expectToEqualBigInt(product, 2000000000000000000n);
            expectToEqualBigInt(quotient, 500000000000000000n);
        });

        it('should handle comparison operations', () => {
            const small = 100n;
            const large = 1000n;
            
            expect(large > small).to.be.true;
            expect(small < large).to.be.true;
            expect(large >= large).to.be.true;
            expect(small <= small).to.be.true;
            expect(large === large).to.be.true;
            // Test inequality using string comparison to avoid TypeScript strict checking
            expect(large.toString() !== small.toString()).to.be.true;
        });
    });

    describe('Ethers v6 BigInt Integration', () => {
        it('should parse and format ether values correctly', () => {
            const oneEther = ethers.parseEther('1.0');
            expectToBeBigInt(oneEther);
            expectToEqualBigInt(oneEther, TEST_VALUES.ONE_ETH);
            
            const formatted = ethers.formatEther(oneEther);
            expect(formatted).to.equal('1.0');
        });

        it('should handle wei conversions', () => {
            const oneGwei = ethers.parseUnits('1', 'gwei');
            const oneWei = ethers.parseUnits('1', 'wei');
            
            expectToBeBigInt(oneGwei);
            expectToBeBigInt(oneWei);
            
            expect(oneGwei).to.equal(1000000000n);
            expect(oneWei).to.equal(1n);
        });

        it('should work with large numbers', () => {
            const maxUint256 = ethers.MaxUint256;
            expectToBeBigInt(maxUint256);
            
            // Test that it equals 2^256 - 1
            expectToEqualBigInt(maxUint256, TEST_VALUES.MAX_UINT256);
        });
    });

    describe('Type Safety with BigInt', () => {
        it('should maintain type safety in arithmetic', () => {
            const balance = TEST_VALUES.ONE_ETH;
            const amount = TEST_VALUES.HALF_ETH;
            
            // These operations should all return bigint
            const newBalance = balance - amount;
            const doubled = balance * 2n;
            const percentage = balance / 100n;
            
            expectToBeBigInt(newBalance);
            expectToBeBigInt(doubled);
            expectToBeBigInt(percentage);
        });

        it('should handle edge cases', () => {
            const zero = 0n;
            const max = TEST_VALUES.MAX_UINT256;
            
            expectToBeBigInt(zero);
            expectToBeBigInt(max);
            
            // Test boundaries
            expect(zero < TEST_VALUES.ONE_ETH).to.be.true;
            expect(max > TEST_VALUES.ONE_ETH).to.be.true;
        });
    });

    describe('Serialization and String Conversion', () => {
        it('should convert to string correctly', () => {
            expect(TEST_VALUES.ONE_ETH.toString()).to.equal('1000000000000000000');
            expect(TEST_VALUES.ZERO.toString()).to.equal('0');
            expect(TEST_VALUES.HALF_ETH.toString()).to.equal('500000000000000000');
        });

        it('should work with JSON when converted to string', () => {
            const data = {
                balance: TEST_VALUES.ONE_ETH.toString(),
                allowance: TEST_VALUES.MAX_UINT256.toString(),
            };
            
            const json = JSON.stringify(data);
            expect(json).to.be.a('string');
            
            const parsed = JSON.parse(json);
            expect(parsed.balance).to.equal('1000000000000000000');
        });

        it('should reconstruct from string', () => {
            const original = TEST_VALUES.ONE_ETH;
            const stringified = original.toString();
            const reconstructed = BigInt(stringified);
            
            expectToEqualBigInt(reconstructed, original);
        });
    });
}); 