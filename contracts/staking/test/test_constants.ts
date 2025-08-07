// Test constants for staking tests
export const constants = {
    NULL_ADDRESS: '0x0000000000000000000000000000000000000000',
    NULL_BYTES: '0x',
    ZERO_AMOUNT: 0n,
    DUMMY_TOKEN_DECIMALS: 18n,
    MAX_CODE_SIZE: 0x6000, // 24,576 bytes (EIP-170 limit)
} as const;

// Utility function for filtering logs
export function filterLogsToArguments(logs: any[], eventName: string): any[] {
    return logs
        .filter(log => log.fragment && log.fragment.name === eventName)
        .map(log => log.args);
}

// Random address generator
export function randomAddress(): string {
    const { ethers } = require('hardhat');
    return ethers.Wallet.createRandom().address;
}

// Convert to base unit amount
export function toBaseUnitAmount(amount: number | string | bigint, decimals: number = 18): bigint {
    const multiplier = 10n ** BigInt(decimals);
    return BigInt(amount) * multiplier;
}

// Random integer generator
export function getRandomInteger(min: number = 0, max: number = 1000000): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Type alias for numeric types
export type Numberish = number | string | bigint;

// Helper to convert various types to bigint for comparison
export function toBigInt(value: Numberish): bigint {
    if (typeof value === 'bigint') {
        return value;
    }
    return BigInt(value);
}

// Short zip utility
export function shortZip<T, U>(arr1: T[], arr2: U[]): Array<[T, U]> {
    const minLength = Math.min(arr1.length, arr2.length);
    const result: Array<[T, U]> = [];
    for (let i = 0; i < minLength; i++) {
        result.push([arr1[i], arr2[i]]);
    }
    return result;
}

// BigInt assertion utilities
export function expectBigIntEqual(actual: bigint, expected: bigint, message?: string): void {
    const { expect } = require('chai');
    expect(actual, message).to.equal(expected);
}

export function expectBigIntEqualWithMessage(actual: bigint, expected: bigint, message: string): void {
    const { expect } = require('chai');
    expect(actual, message).to.equal(expected);
}

export function expectBigIntGreaterThan(actual: bigint, expected: bigint, message?: string): void {
    const { expect } = require('chai');
    expect(actual, message).to.be.greaterThan(expected);
}

export function expectBigIntLessThan(actual: bigint, expected: bigint, message?: string): void {
    const { expect } = require('chai');
    expect(actual, message).to.be.lessThan(expected);
}

export function expectBigIntGreaterThanOrEqual(actual: bigint, expected: bigint, message?: string): void {
    const { expect } = require('chai');
    expect(actual >= expected, message || `Expected ${actual} to be >= ${expected}`).to.be.true;
}

export function expectBigIntLessThanOrEqual(actual: bigint, expected: bigint, message?: string): void {
    const { expect } = require('chai');
    expect(actual <= expected, message || `Expected ${actual} to be <= ${expected}`).to.be.true;
}

// Hex utilities replacement
export const hexUtils = {
    leftPad(value: number | string | bigint, size: number = 64): string {
        const { ethers } = require('hardhat');
        const hex = BigInt(value).toString(16);
        return '0x' + hex.padStart(size, '0');
    },
    
    random(): string {
        const { ethers } = require('hardhat');
        return ethers.hexlify(ethers.randomBytes(32));
    },
    
    concat(...args: string[]): string {
        const { ethers } = require('hardhat');
        return ethers.concat(args);
    },
    
    size(hexString: string): number {
        return (hexString.length - 2) / 2; // Remove '0x' and divide by 2
    }
};