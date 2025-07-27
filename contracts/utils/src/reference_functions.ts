import { BigNumber, SafeMathRevertErrors } from '@0x/utils';

const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

// Helper function to convert bigint to BigNumber for error reporting
function toBigNumber(value: bigint): BigNumber {
    return new BigNumber(value.toString());
}

/**
 * Add two `uint256` values. Reverts on overflow.
 */
export function safeAdd(a: bigint, b: bigint): bigint {
    const r = a + b;
    if (r > MAX_UINT256) {
        throw new SafeMathRevertErrors.Uint256BinOpError(
            SafeMathRevertErrors.BinOpErrorCodes.AdditionOverflow, 
            toBigNumber(a), 
            toBigNumber(b)
        );
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
            toBigNumber(a),
            toBigNumber(b),
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
            toBigNumber(a),
            toBigNumber(b),
        );
    }
    return r;
}

/**
 * Divides two `uint256` values. Reverts on division by zero.
 */
export function safeDiv(a: bigint, b: bigint): bigint {
    if (b === BigInt(0)) {
        throw new SafeMathRevertErrors.Uint256BinOpError(
            SafeMathRevertErrors.BinOpErrorCodes.DivisionByZero, 
            toBigNumber(a), 
            toBigNumber(b)
        );
    }
    return a / b;
}
