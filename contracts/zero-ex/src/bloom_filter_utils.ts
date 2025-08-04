import { hexUtils } from '@0x/utils';

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
