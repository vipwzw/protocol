import { hexUtils } from '@0x/utils';
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
