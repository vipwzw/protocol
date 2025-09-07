/**
 * BigInt utilities and configuration for @0x/utils
 * This replaces the legacy BigNumber configuration with native BigInt support
 */

/**
 * Maximum value for uint256 in Solidity (2^256 - 1)
 */
export const MAX_UINT256 = 2n ** 256n - 1n;

/**
 * Maximum value for int256 in Solidity (2^255 - 1)
 */
export const MAX_INT256 = 2n ** 255n - 1n;

/**
 * Minimum value for int256 in Solidity (-2^255)
 */
export const MIN_INT256 = -(2n ** 255n);

/**
 * Zero value as BigInt
 */
export const ZERO = 0n;

/**
 * One value as BigInt
 */
export const ONE = 1n;

/**
 * Ten value as BigInt (useful for decimal operations)
 */
export const TEN = 10n;

/**
 * Convert various input types to BigInt
 */
export function toBigInt(value: string | number | bigint): bigint {
    if (typeof value === 'bigint') {
        return value;
    }
    if (typeof value === 'string') {
        // Handle hex strings
        if (value.startsWith('0x') || value.startsWith('0X')) {
            return BigInt(value);
        }
        // Handle decimal strings
        return BigInt(value);
    }
    if (typeof value === 'number') {
        if (!Number.isInteger(value)) {
            throw new Error(`Cannot convert non-integer number ${value} to BigInt`);
        }
        return BigInt(value);
    }
    throw new Error(`Cannot convert ${typeof value} to BigInt`);
}

/**
 * Convert BigInt to hex string with 0x prefix
 */
export function toHex(value: bigint): string {
    return '0x' + value.toString(16);
}

/**
 * Convert BigInt to decimal string
 */
export function toString(value: bigint): string {
    return value.toString();
}

/**
 * Check if a value is a BigInt
 */
export function isBigInt(value: any): value is bigint {
    return typeof value === 'bigint';
}

/**
 * Power function for BigInt
 */
export function pow(base: bigint, exponent: bigint): bigint {
    if (exponent < 0n) {
        throw new Error('Negative exponents not supported for BigInt');
    }
    return base ** exponent;
}

/**
 * Absolute value for BigInt
 */
export function abs(value: bigint): bigint {
    return value < 0n ? -value : value;
}

/**
 * Minimum of two BigInt values
 */
export function min(a: bigint, b: bigint): bigint {
    return a < b ? a : b;
}

/**
 * Maximum of two BigInt values
 */
export function max(a: bigint, b: bigint): bigint {
    return a > b ? a : b;
}

/**
 * Safe division that throws on division by zero
 */
export function safeDiv(a: bigint, b: bigint): bigint {
    if (b === 0n) {
        throw new Error('Division by zero');
    }
    return a / b;
}

/**
 * Modulo operation
 */
export function mod(a: bigint, b: bigint): bigint {
    if (b === 0n) {
        throw new Error('Modulo by zero');
    }
    return a % b;
}

/**
 * Square root approximation for BigInt (using Newton's method)
 */
export function sqrt(value: bigint): bigint {
    if (value < 0n) {
        throw new Error('Cannot calculate square root of negative number');
    }
    if (value === 0n) {
        return 0n;
    }

    let x = value;
    let y = (x + 1n) / 2n;

    while (y < x) {
        x = y;
        y = (x + value / x) / 2n;
    }

    return x;
}
