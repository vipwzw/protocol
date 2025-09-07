// Test constants for staking tests
export const constants = {
    NULL_ADDRESS: '0x0000000000000000000000000000000000000000',
    NULL_BYTES: '0x',
    ZERO_AMOUNT: 0n,
    DUMMY_TOKEN_DECIMALS: 18n,
    MAX_CODE_SIZE: 0x6000, // 24,576 bytes (EIP-170 limit)
    MAX_UINT256: (1n << 256n) - 1n,
    PPM_100_PERCENT: 1000000,
} as const;

// Compute deployed code size (in bytes) from a Hardhat artifact
export function getCodesizeFromArtifact(artifact: any): number {
    const deployedBytecode: string | undefined =
        artifact?.deployedBytecode || artifact?.evm?.deployedBytecode?.object || artifact?.bytecode;
    if (typeof deployedBytecode !== 'string' || !deployedBytecode.startsWith('0x')) {
        return 0;
    }
    return (deployedBytecode.length - 2) / 2;
}

// Utility function for filtering logs
export function filterLogsToArguments(logs: any[], eventName: string): any[] {
    return logs
        .filter(log => log.fragment && log.fragment.name === eventName)
        .map(log => {
            const args = log.args;
            if (!args) {
                return {};
            }
            // Prefer named fields from fragment inputs
            try {
                const named: Record<string, any> = {};
                if (log.fragment && Array.isArray(args) && log.fragment.inputs) {
                    log.fragment.inputs.forEach((input: any, idx: number) => {
                        named[input.name] = args[idx];
                    });
                    return named;
                }
                // Fallback: strip numeric indices from Result-like objects
                for (const [key, value] of Object.entries(args)) {
                    if (Number.isNaN(Number(key))) {
                        named[key] = value;
                    }
                }
                return Object.keys(named).length ? named : args;
            } catch {
                return args;
            }
        });
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

    hash(value: string): string {
        const { ethers } = require('hardhat');
        // If it's hex, hash as bytes; otherwise hash utf8 bytes
        const data = typeof value === 'string' && value.startsWith('0x') ? value : ethers.toUtf8Bytes(value);
        return ethers.keccak256(data);
    },

    slice(hexString: string, bytes: number): string {
        // Supports negative bytes to slice from the end, e.g., -20 for last 20 bytes
        if (typeof hexString !== 'string' || !hexString.startsWith('0x')) {
            throw new Error('hexUtils.slice: expected hex string with 0x prefix');
        }
        const hex = hexString.slice(2);
        const totalBytes = Math.floor(hex.length / 2);
        let startByteIndex = 0;
        if (bytes < 0) {
            const lastBytes = Math.min(totalBytes, Math.abs(bytes));
            startByteIndex = totalBytes - lastBytes;
        } else {
            startByteIndex = Math.min(totalBytes, bytes);
        }
        const sliced = hex.slice(startByteIndex * 2);
        return '0x' + sliced;
    },

    concat(...args: string[]): string {
        const { ethers } = require('hardhat');
        return ethers.concat(args);
    },

    size(hexString: string): number {
        return (hexString.length - 2) / 2; // Remove '0x' and divide by 2
    },
};

// Verify events helper compatible with ethers v6 logs
export function verifyEventsFromLogs(logs: any[], expected: Array<Record<string, any>>, eventName: string): void {
    const { expect } = require('chai');
    const actual = filterLogsToArguments(logs, eventName);
    expect(actual.length, `Expected ${expected.length} '${eventName}' events, got ${actual.length}`).to.equal(
        expected.length,
    );
    for (let i = 0; i < expected.length; i++) {
        const exp = expected[i];
        const act = actual[i] ?? {};
        // Ensure all expected keys match in the actual event
        for (const [key, value] of Object.entries(exp)) {
            expect(act[key], `Event ${eventName} index ${i} key '${key}' mismatch`).to.equal(value);
        }
    }
}
