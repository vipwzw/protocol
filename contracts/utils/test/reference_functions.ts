import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SafeMathRevertErrors } from '@0x/utils';

import { safeAdd, safeDiv, safeMul, safeSub } from '../src/reference_functions';

// 现代化常量定义
const MAX_UINT256 = ethers.MaxUint256;
const ZERO_AMOUNT = 0n;
const ONE_ETHER = ethers.parseEther('1');

// Helper function for bigint square root calculation
function bigintSqrt(value: bigint): bigint {
    if (value === BigInt(0)) return BigInt(0);
    if (value < BigInt(4)) return BigInt(1);

    let x = value;
    let y = (value + BigInt(1)) / BigInt(2);

    while (y < x) {
        x = y;
        y = (y + value / y) / BigInt(2);
    }

    return x;
}

describe('Reference Functions', () => {
    const DEFAULT_VALUES = {
        a: ONE_ETHER * BigInt(2),
        b: ONE_ETHER,
    };
    describe('SafeMath', () => {
        describe('safeAdd', () => {
            it('adds two numbers', () => {
                const { a, b } = DEFAULT_VALUES;
                const expected = a + b;
                const actual = safeAdd(a, b);
                // Convert both to strings for comparison to avoid BigNumber comparison issues
                expect(actual.toString()).to.equal(expected.toString());
            });

            it('reverts on overflow', () => {
                const a = MAX_UINT256 / BigInt(2);
                const b = MAX_UINT256 / BigInt(2) + BigInt(2);
                const expectedError = new SafeMathRevertErrors.Uint256BinOpError(
                    SafeMathRevertErrors.BinOpErrorCodes.AdditionOverflow,
                    a,
                    b,
                );
                expect(() => safeAdd(a, b)).to.throw(expectedError.message);
            });
        });

        describe('safeSub', () => {
            it('subracts two numbers', () => {
                const { a, b } = DEFAULT_VALUES;
                const expected = a - b;
                const actual = safeSub(a, b);
                // Convert both to strings for comparison
                expect(actual.toString()).to.equal(expected.toString());
            });

            it('reverts on underflow', () => {
                const { a, b } = DEFAULT_VALUES;
                const expectedError = new SafeMathRevertErrors.Uint256BinOpError(
                    SafeMathRevertErrors.BinOpErrorCodes.SubtractionUnderflow,
                    b,
                    a,
                );
                expect(() => safeSub(b, a)).to.throw(expectedError.message);
            });
        });

        describe('safeMul', () => {
            it('multiplies two numbers', () => {
                const { a, b } = DEFAULT_VALUES;
                const expected = a * b;
                const actual = safeMul(a, b);
                // Convert both to strings for comparison
                expect(actual.toString()).to.equal(expected.toString());
            });

            it('reverts on overflow', () => {
                const a = bigintSqrt(MAX_UINT256) + BigInt(1);
                const b = a;
                const expectedError = new SafeMathRevertErrors.Uint256BinOpError(
                    SafeMathRevertErrors.BinOpErrorCodes.MultiplicationOverflow,
                    a,
                    b,
                );
                expect(() => safeMul(a, b)).to.throw(expectedError.message);
            });
        });

        describe('safeDiv', () => {
            it('multiplies two numbers', () => {
                const { a, b } = DEFAULT_VALUES;
                const expected = a / b;
                const actual = safeDiv(a, b);
                // Convert both to strings for comparison
                expect(actual.toString()).to.equal(expected.toString());
            });

            it('reverts if denominator is zero', () => {
                const { a } = DEFAULT_VALUES;
                const expectedError = new SafeMathRevertErrors.Uint256BinOpError(
                    SafeMathRevertErrors.BinOpErrorCodes.DivisionByZero,
                    a,
                    ZERO_AMOUNT,
                );
                expect(() => safeDiv(a, ZERO_AMOUNT)).to.throw(expectedError.message);
            });
        });
    });
});
