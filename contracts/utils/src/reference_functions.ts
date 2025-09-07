import { SafeMathRevertErrors } from '@0x/utils';

const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

/**
 * Add two `uint256` values. Reverts on overflow.
 */
export function safeAdd(a: bigint, b: bigint): bigint {
    const r = a + b;
    if (r > MAX_UINT256) {
        throw new SafeMathRevertErrors.Uint256BinOpError(SafeMathRevertErrors.BinOpErrorCodes.AdditionOverflow, a, b);
    }
    return r;
}

/**
 * Subract two `uint256` values. Reverts on overflow.
 */
export function safeSub(a: bigint, b: bigint): bigint {
    if (a < b) {
        throw new SafeMathRevertErrors.Uint256BinOpError(
            SafeMathRevertErrors.BinOpErrorCodes.SubtractionUnderflow,
            a,
            b,
        );
    }
    return a - b;
}

/**
 * Multiplies two `uint256` values. Reverts on overflow.
 */
export function safeMul(a: bigint, b: bigint): bigint {
    const r = a * b;
    if (r > MAX_UINT256) {
        throw new SafeMathRevertErrors.Uint256BinOpError(
            SafeMathRevertErrors.BinOpErrorCodes.MultiplicationOverflow,
            a,
            b,
        );
    }
    return r;
}

/**
 * Divides two `uint256` values. Reverts on division by zero.
 */
export function safeDiv(a: bigint, b: bigint): bigint {
    if (b === BigInt(0)) {
        throw new SafeMathRevertErrors.Uint256BinOpError(SafeMathRevertErrors.BinOpErrorCodes.DivisionByZero, a, b);
    }
    return a / b;
}
