// Local test utilities to replace @0x/test-utils
import { expect } from 'chai';
import { ContractArtifact } from 'ethereum-types';
import { ethers } from 'hardhat';

// Constants
export const constants = {
    MAX_CODE_SIZE: 0x6000, // 24,576 bytes (EIP-170 limit)
    NULL_ADDRESS: '0x0000000000000000000000000000000000000000',
    NULL_BYTES: '0x',
    ZERO_AMOUNT: 0n,
    DUMMY_TOKEN_DECIMALS: 18n,
} as const;

// Export chai expect for convenience
export { expect };

// Utility function to get codesize from artifact
export function getCodesizeFromArtifact(artifact: ContractArtifact): number {
    if (!artifact.compilerOutput?.evm?.bytecode?.object) {
        throw new Error('Invalid artifact: missing bytecode');
    }
    
    const bytecode = artifact.compilerOutput.evm.bytecode.object;
    // Remove 0x prefix if present
    const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
    // Each byte is represented by 2 hex characters
    return cleanBytecode.length / 2;
}

// Random address generator
export function randomAddress(): string {
    return ethers.Wallet.createRandom().address;
}

// Convert to base unit amount (equivalent to toBaseUnitAmount)
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

// Transaction defaults
export const txDefaults = {
    gasLimit: 6000000,
    gasPrice: ethers.parseUnits('20', 'gwei'),
};

// Log filtering helper
export function filterLogsToArguments(logs: any[], eventName: string): any[] {
    return logs
        .filter(log => log.event === eventName)
        .map(log => log.args);
}

// Event verification helper
export function verifyEventsFromLogs(logs: any[], expectedEvents: any[]): void {
    expect(logs).to.have.length(expectedEvents.length);
    for (let i = 0; i < expectedEvents.length; i++) {
        const log = logs[i];
        const expectedEvent = expectedEvents[i];
        expect(log.event).to.equal(expectedEvent.event);
        // Additional event validation can be added here
    }
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

// Note: describe is available globally in test environment, no need to export

// hexUtils replacement - simple hex utilities
export const hexUtils = {
    concat: (...args: string[]): string => {
        return '0x' + args.map(arg => arg.startsWith('0x') ? arg.slice(2) : arg).join('');
    },
    
    toHex: (value: number | string | bigint): string => {
        return '0x' + BigInt(value).toString(16);
    },
    
    random: (length: number = 32): string => {
        const chars = '0123456789abcdef';
        let result = '0x';
        for (let i = 0; i < length * 2; i++) {
            result += chars[Math.floor(Math.random() * 16)];
        }
        return result;
    },
    
    slice: (hex: string, start: number, end?: number): string => {
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        const sliced = cleanHex.slice(start * 2, end ? end * 2 : undefined);
        return '0x' + sliced;
    },
    
    leftPad: (hex: string | number | bigint, length: number): string => {
        const hexStr = hex.toString();
        const cleanHex = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr;
        const padded = cleanHex.padStart(length, '0');
        return '0x' + padded;
    }
};

// BigInt comparison helpers for chai assertions
export function expectBigIntEqual(actual: bigint, expected: bigint): void {
    expect(actual).to.equal(expected);
}

export function expectBigIntGreaterThan(actual: bigint, expected: bigint): void {
    expect(actual > expected).to.be.true;
}

export function expectBigIntLessThan(actual: bigint, expected: bigint): void {
    expect(actual < expected).to.be.true;
}