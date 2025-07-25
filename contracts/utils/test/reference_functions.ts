import { constants, describe, expect } from '@0x/contracts-test-utils';
import { SafeMathRevertErrors } from '@0x/utils';

import { safeAdd, safeDiv, safeMul, safeSub } from '../src/reference_functions';

describe('Reference Functions', () => {
    const { ONE_ETHER, MAX_UINT256, ZERO_AMOUNT } = constants;
    const DEFAULT_VALUES = {
        a: ONE_ETHER.times(2),
        b: ONE_ETHER,
    };
    describe('SafeMath', () => {
        describe('safeAdd', () => {
            it('adds two numbers', () => {
                const { a, b } = DEFAULT_VALUES;
                const expected = a.plus(b);
                const actual = safeAdd(a, b);
                // Convert both to strings for comparison to avoid BigNumber comparison issues
                expect(actual.toString()).to.equal(expected.toString());
            });

            it('reverts on overflow', () => {
                const a = MAX_UINT256.dividedToIntegerBy(2);
                const b = MAX_UINT256.dividedToIntegerBy(2).plus(2);
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
                const expected = a.minus(b);
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
                const expected = a.times(b);
                const actual = safeMul(a, b);
                // Convert both to strings for comparison
                expect(actual.toString()).to.equal(expected.toString());
            });

            it('reverts on overflow', () => {
                const a = MAX_UINT256.sqrt().plus(1);
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
                const expected = a.dividedToIntegerBy(b);
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
