// 移除对 @0x/utils 的依赖，使用本地实现
// import { hexUtils } from '@0x/utils';
import { ethers } from 'ethers';

const hexUtils = {
    toHex: (value: string | number | Buffer | bigint): string => {
        if (typeof value === 'string') {
            return value.startsWith('0x') ? value : '0x' + value;
        }
        if (typeof value === 'number') {
            return '0x' + value.toString(16);
        }
        if (typeof value === 'bigint') {
            return '0x' + value.toString(16);
        }
        if (Buffer.isBuffer(value)) {
            return '0x' + value.toString('hex');
        }
        return '0x' + String(value);
    },
    leftPad: (value: string | number | bigint, length: number = 64): string => {
        let hex = hexUtils.toHex(value).replace('0x', '');
        return '0x' + hex.padStart(length, '0');
    },
    hash: (value: string): string => {
        return ethers.keccak256(value);
    },
    concat: (...values: (string | number | Buffer)[]): string => {
        return '0x' + values.map(v => hexUtils.toHex(v).replace('0x', '')).join('');
    }
};

/**
 * Compute the bloom filter for a list of tokens.
 * Used to filter greedy tokens in the exchange proxy.
 */
export function getTokenListBloomFilter(tokens: string[]): string {
    let filter = hexUtils.leftPad(0);
    for (const token of tokens) {
        // (1 << (keccak256(token) % 256)) | (1 << (token % 256))
        const a = hexUtils.toHex(2n ** (BigInt(hexUtils.hash(hexUtils.leftPad(token))) % 256n));
        const b = hexUtils.toHex(2n ** (BigInt(token) % 256n));
        filter = bitwiseOrWords(filter, bitwiseOrWords(a, b));
    }
    return filter;
}

// Bitwise OR two hex words.
function bitwiseOrWords(a: string, b: string): string {
    const aBits = hexWordToBitArray(a);
    const bBits = hexWordToBitArray(b);
    const resultBits = aBits.slice();
    for (let i = 0; i < 256; ++i) {
        resultBits[i] |= bBits[i];
    }
    return bitArrayToHexWord(resultBits);
}

function hexWordToBitArray(hexWord: string): number[] {
    // Covnert to a binary string.
    const bin = BigInt(hexWord).toString(2);
    // Convert to integers.
    const bits = bin.split('').map((s: string) => parseInt(s, 10));
    // Left the binary string pad with zeroes.
    return new Array(256 - bits.length).fill(0).concat(bits);
}

function bitArrayToHexWord(bits: number[]): string {
    return hexUtils.leftPad(BigInt(`0b${bits.map(b => b.toString()).join('')}`));
}
