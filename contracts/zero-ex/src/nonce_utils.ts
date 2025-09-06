// 移除对 @0x/utils 的依赖，使用本地实现
// import { hexUtils } from '@0x/utils';
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
    concat: (...values: (string | number | Buffer)[]): string => {
        return '0x' + values.map(v => hexUtils.toHex(v).replace('0x', '')).join('');
    }
};
import { ethers } from 'ethers';
import * as ethjs from 'ethereumjs-util';

/**
 * Fetch and RLP encode the transaction count (nonce) of an account.
 */
export async function getRLPEncodedAccountNonceAsync(provider: ethers.Provider, address: string): Promise<string> {
    const nonce = await provider.getTransactionCount(address);
    return rlpEncodeNonce(nonce);
}

/**
 * RLP encode the transaction count (nonce) of an account.
 */
export function rlpEncodeNonce(nonce: number): string {
    if (nonce === 0) {
        return '0x80';
    } else if (nonce <= 0x7f) {
        return ethjs.bufferToHex(ethjs.toBuffer(nonce));
    } else {
        const rlpNonce = ethjs.toBuffer(nonce);
        return hexUtils.concat(rlpNonce.length + 0x80, ethjs.bufferToHex(rlpNonce));
    }
}
