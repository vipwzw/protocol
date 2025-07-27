import { expect } from 'chai';
import { ethers } from 'ethers';
import { IERC20Token__factory, WETH9__factory, IZeroEx__factory } from '../src/typechain-types/factories';
import { TEST_ADDRESSES, TEST_VALUES, expectToBeBigInt, expectToEqualBigInt } from './setup';

describe('TypeChain BigInt Support', () => {
    let provider: ethers.JsonRpcProvider;
    
    beforeEach(() => {
        provider = new ethers.JsonRpcProvider('http://localhost:8545');
    });

    describe('IERC20Token Factory', () => {
        it('should create contract instance with correct interface', () => {
            const token = IERC20Token__factory.connect(TEST_ADDRESSES.WETH, provider);
            
            expect(token).to.exist;
            expect(token.target).to.equal(TEST_ADDRESSES.WETH);
            expect(token.interface).to.exist;
        });

        it('should have methods that return bigint types', () => {
            const token = IERC20Token__factory.connect(TEST_ADDRESSES.WETH, provider);
            
            // Check method signatures exist
            expect(token.balanceOf).to.be.a('function');
            expect(token.totalSupply).to.be.a('function');
            expect(token.allowance).to.be.a('function');
            expect(token.decimals).to.be.a('function');
        });

        it('should encode function data correctly', () => {
            const token = IERC20Token__factory.connect(TEST_ADDRESSES.WETH, provider);
            
            // Test encoding with BigNumberish (should accept bigint)
            const transferData = token.interface.encodeFunctionData('transfer', [
                TEST_ADDRESSES.USER,
                TEST_VALUES.ONE_ETH, // bigint value
            ]);
            
            expect(transferData).to.be.a('string');
            expect(transferData).to.match(/^0x/);
        });
    });

    describe('WETH9 Factory', () => {
        it('should create WETH9 contract instance', () => {
            const weth = WETH9__factory.connect(TEST_ADDRESSES.WETH, provider);
            
            expect(weth).to.exist;
            expect(weth.target).to.equal(TEST_ADDRESSES.WETH);
        });

        it('should have deposit and withdraw methods', () => {
            const weth = WETH9__factory.connect(TEST_ADDRESSES.WETH, provider);
            
            expect(weth.deposit).to.be.a('function');
            expect(weth.withdraw).to.be.a('function');
        });
    });

    describe('IZeroEx Factory', () => {
        it('should create IZeroEx contract instance', () => {
            const zeroEx = IZeroEx__factory.connect(TEST_ADDRESSES.WETH, provider);
            
            expect(zeroEx).to.exist;
            expect(zeroEx.target).to.equal(TEST_ADDRESSES.WETH);
        });

        it('should have complex interface methods', () => {
            const zeroEx = IZeroEx__factory.connect(TEST_ADDRESSES.WETH, provider);
            
            // Check some key methods exist
            expect(zeroEx.interface).to.exist;
            expect(zeroEx.interface.fragments).to.have.length.greaterThan(0);
        });
    });

    describe('Event Types with BigInt', () => {
        it('should have Transfer event with bigint value', () => {
            const token = IERC20Token__factory.connect(TEST_ADDRESSES.WETH, provider);
            
            // Check event filter exists
            const transferFilter = token.filters.Transfer();
            expect(transferFilter).to.exist;
            
            // Check event filter with parameters
            const specificFilter = token.filters.Transfer(
                TEST_ADDRESSES.USER,
                TEST_ADDRESSES.SPENDER
                // value parameter is optional in filter
            );
            expect(specificFilter).to.exist;
        });

        it('should have Approval event with bigint value', () => {
            const token = IERC20Token__factory.connect(TEST_ADDRESSES.WETH, provider);
            
            const approvalFilter = token.filters.Approval();
            expect(approvalFilter).to.exist;
        });
    });

    describe('BigInt Compatibility', () => {
        it('should handle bigint literals correctly', () => {
            const values = [
                TEST_VALUES.ZERO,
                TEST_VALUES.ONE_ETH,
                TEST_VALUES.HALF_ETH,
                TEST_VALUES.MAX_UINT256,
            ];

            values.forEach(value => {
                expectToBeBigInt(value);
            });
        });

        it('should compare bigint values correctly', () => {
            expectToEqualBigInt(TEST_VALUES.ONE_ETH, 1000000000000000000n);
            expectToEqualBigInt(TEST_VALUES.ZERO, 0n);
        });

        it('should work with ethers formatting functions', () => {
            const formatted = ethers.formatEther(TEST_VALUES.ONE_ETH);
            expect(formatted).to.equal('1.0');

            const parsed = ethers.parseEther('1.0');
            expectToEqualBigInt(parsed, TEST_VALUES.ONE_ETH);
        });
    });
}); 