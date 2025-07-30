import { BigNumber } from '@0x/utils';
import { constants, describe, expect } from '@0x/contracts-test-utils';
import { SafeMathRevertErrors } from '@0x/utils';

import { safeAdd, safeDiv, safeMul, safeSub } from '../src/reference_functions';

// Helper function to create BigNumber for error comparison
function toBigNumber(value: bigint): BigNumber {
    return new BigNumber(value.toString());
}

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
    const { ONE_ETHER, MAX_UINT256, ZERO_AMOUNT } = constants;
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
                    toBigNumber(a),
                    toBigNumber(b),
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
                    toBigNumber(b),
                    toBigNumber(a),
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
                    toBigNumber(a),
                    toBigNumber(b),
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
                    toBigNumber(a),
                    toBigNumber(ZERO_AMOUNT),
                );
                expect(() => safeDiv(a, ZERO_AMOUNT)).to.throw(expectedError.message);
            });
        });
    });
});
