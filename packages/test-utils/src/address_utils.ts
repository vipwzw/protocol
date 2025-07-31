import { ethers } from 'ethers';
import * as crypto from 'crypto';

import { constants } from './constants';

/**
 * 生成随机地址
 */
export function randomAddress(): string {
    // 生成 20 字节的随机数据
    const randomBytes = crypto.randomBytes(constants.ADDRESS_LENGTH);
    return ethers.getAddress('0x' + randomBytes.toString('hex'));
}

/**
 * 检查是否为有效地址
 */
export function isValidAddress(address: string): boolean {
    try {
        ethers.getAddress(address);
        return true;
    } catch {
        return false;
    }
}

/**
 * 标准化地址格式（checksum）
 */
export function normalizeAddress(address: string): string {
    return ethers.getAddress(address);
}

/**
 * 生成确定性地址（基于种子）
 */
export function deterministicAddress(seed: string): string {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
    // 取前 20 字节作为地址
    const addressHex = '0x' + hash.slice(2, 42);
    return ethers.getAddress(addressHex);
}

/**
 * 检查地址是否为零地址
 */
export function isNullAddress(address: string): boolean {
    return normalizeAddress(address) === constants.NULL_ADDRESS;
}

/**
 * 生成多个随机地址
 */
export function randomAddresses(count: number): string[] {
    const addresses: string[] = [];
    for (let i = 0; i < count; i++) {
        addresses.push(randomAddress());
    }
    return addresses;
}

/**
 * 从私钥生成地址
 */
export function addressFromPrivateKey(privateKey: string): string {
    const wallet = new ethers.Wallet(privateKey);
    return wallet.address;
}

/**
 * 生成随机私钥和对应地址
 */
export function randomWallet(): { privateKey: string; address: string } {
    const wallet = ethers.Wallet.createRandom();
    return {
        privateKey: wallet.privateKey,
        address: wallet.address
    };
}