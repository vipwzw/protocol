// Test setup file for Hardhat
import { expect } from 'chai';
import { ethers } from 'ethers';

// Common test constants
export const TEST_ADDRESSES = {
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    ZRX: '0xE41d2489571d322189246DaFA5ebDe1F4699F498',
    USER: '0x1234567890123456789012345678901234567890',
    SPENDER: '0x0987654321098765432109876543210987654321',
} as const;

export const TEST_VALUES = {
    ONE_ETH: 1000000000000000000n,
    HALF_ETH: 500000000000000000n,
    ZERO: 0n,
    MAX_UINT256: 2n ** 256n - 1n,
} as const;

// Helper functions for testing bigint
export function expectToBeBigInt(value: any): void {
    expect(typeof value).to.equal('bigint');
}

export function expectToEqualBigInt(received: any, expected: bigint): void {
    expect(typeof received).to.equal('bigint');
    expect(received).to.equal(expected);
}

// Create a proper mock EIP-1193 provider
export function createMockProvider(): any {
    return {
        isEIP1193: true,
        async request(request: { method: string; params?: any[] }) {
            // Mock basic responses
            switch (request.method) {
                case 'eth_chainId':
                    return '0x1'; // Mainnet
                case 'eth_accounts':
                    return [TEST_ADDRESSES.USER];
                case 'net_version':
                    return '1';
                default:
                    return '0x0';
            }
        },
        on: () => {},
        removeListener: () => {},
    };
}
