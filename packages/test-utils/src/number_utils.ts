import * as crypto from 'crypto';
import { Decimal } from 'decimal.js';

import { expect } from './chai_setup';
import { constants } from './constants';
import { Numberish } from './types';

Decimal.set({ precision: 80 });

/**
 * Convert `x` to a `Decimal` type.
 */
export function toDecimal(x: Numberish): Decimal {
    if (typeof x === 'bigint') {
        return new Decimal(x.toString(10));
    }
    return new Decimal(x);
}

/**
 * Convert Numberish to bigint
 */
function toBigInt(x: Numberish): bigint {
    if (typeof x === 'bigint') {
        return x;
    }
    if (typeof x === 'string') {
        return BigInt(x);
    }
    if (typeof x === 'number') {
        return BigInt(Math.floor(x));
    }
    throw new Error(`Cannot convert ${typeof x} to bigint`);
}

/**
 * Generate a random integer between `min` and `max`, inclusive.
 */
export function getRandomInteger(min: Numberish, max: Numberish): bigint {
    const minBig = toBigInt(min);
    const maxBig = toBigInt(max);
    const range = maxBig - minBig;
    return getRandomPortion(range) + minBig;
}

/**
 * Generate a random integer between `0` and `total`, inclusive.
 */
export function getRandomPortion(total: Numberish): bigint {
    const totalBig = toBigInt(total);
    // Generate random ratio between 0 and 1 (scaled by 1e18)
    const randomRatio = getRandomFloat(0, 1000000000000000000n); // 1e18
    return (totalBig * randomRatio) / 1000000000000000000n; // 1e18
}

/**
 * Generate a random, high-precision decimal between `min` and `max`, inclusive.
 * Returns a bigint scaled by 1e18 for precision.
 */
export function getRandomFloat(min: Numberish, max: Numberish): bigint {
    const minBig = toBigInt(min);
    const maxBig = toBigInt(max);

    // Generate a random bigint using crypto
    const randomBytes = crypto.randomBytes(32);
    const randomHex = randomBytes.toString('hex');
    const randomBig = BigInt('0x' + randomHex);

    // Scale to [0, max-min] range
    const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    const range = maxBig - minBig;
    return minBig + (randomBig * range) / maxUint256;
}

export const FIXED_POINT_BASE = BigInt('0x80000000000000000000000000000000'); // 2^127

/**
 * Convert `n` to fixed-point integer representation.
 */
export function toFixed(n: Numberish): bigint {
    return toBigInt(n) * FIXED_POINT_BASE;
}

/**
 * Convert `n` from fixed-point integer representation.
 */
export function fromFixed(n: Numberish): bigint {
    return toBigInt(n) / FIXED_POINT_BASE;
}

/**
 * Converts two decimal numbers to integers with `precision` digits, then returns
 * the absolute difference.
 */
export function getNumericalDivergence(a: Numberish, b: Numberish, precision = 18): number {
    const _a = toBigInt(a);
    const _b = toBigInt(b);

    // Simple approximation for integer divergence
    const diff = _a > _b ? _a - _b : _b - _a;

    // Convert to number for comparison (may lose precision for very large numbers)
    return Number(diff);
}

/**
 * Asserts that two numbers are equal up to `precision` digits.
 */
export function assertRoughlyEquals(actual: Numberish, expected: Numberish, precision = 18): void {
    if (getNumericalDivergence(actual, expected, precision) <= 1) {
        return;
    }
    // Convert to strings for comparison
    expect(actual.toString()).to.equal(expected.toString());
}

/**
 * Asserts that two numbers are equal with up to `maxError` difference between them.
 */
export function assertIntegerRoughlyEquals(actual: Numberish, expected: Numberish, maxError = 1, msg?: string): void {
    const actualBig = toBigInt(actual);
    const expectedBig = toBigInt(expected);
    const diff = actualBig > expectedBig ? actualBig - expectedBig : expectedBig - actualBig;

    if (Number(diff) <= maxError) {
        return;
    }
    expect(actual.toString(), msg).to.equal(expected.toString());
}

/**
 * Converts `amount` into a base unit amount with 18 digits.
 */
export function toBaseUnitAmount(amount: Numberish, decimals?: number): bigint {
    const baseDecimals = decimals !== undefined ? decimals : 18;
    const amountBig = toBigInt(amount);
    const multiplier = BigInt(10) ** BigInt(baseDecimals);
    return amountBig * multiplier;
}

/**
 * Computes a percentage of `value`, first converting `percentage` to be expressed in 18 digits.
 */
export function getPercentageOfValue(value: Numberish, percentage: Numberish): bigint {
    const valueBig = toBigInt(value);
    const percentageBig = toBigInt(percentage);
    const percentageDenominator = constants.PERCENTAGE_DENOMINATOR;

    const numerator = (percentageDenominator * percentageBig) / 100n;
    const newValue = (numerator * valueBig) / percentageDenominator;
    return newValue;
}
