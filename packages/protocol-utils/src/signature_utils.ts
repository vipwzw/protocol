import { SupportedProvider } from 'ethereum-types';
import { EIP712TypedData } from '@0x/utils';
import { hexUtils, providerUtils, signTypedDataUtils } from '@0x/utils';
import { ethers } from 'ethers';
import * as ethjs from 'ethereumjs-util';

/**
 * Valid signature types on the Exchange Proxy.
 */
export enum SignatureType {
    Illegal = 0,
    Invalid = 1,
    EIP712 = 2,
    EthSign = 3,
    PreSigned = 4,
}

/**
 * Represents a raw EC signature.
 */
export interface ECSignature {
    v: number;
    r: string;
    s: string;
}

/**
 * A complete signature on the Exchange Proxy.
 */
export interface Signature extends ECSignature {
    signatureType: SignatureType;
}

/**
 * ABI definition for the `Signature` struct.
 */
export const SIGNATURE_ABI = [
    { name: 'signatureType', type: 'uint8' },
    { name: 'v', type: 'uint8' },
    { name: 'r', type: 'bytes32' },
    { name: 's', type: 'bytes32' },
];

/**
 * Sign a hash with the EthSign signature type on a provider.
 */
export async function ethSignHashWithProviderAsync(
    hash: string,
    signer: string,
    provider: SupportedProvider,
): Promise<Signature> {
    // 对于 Hardhat 测试环境，使用改进的 getSigner 方法
    try {
        if (provider && typeof provider === 'object' && 'getSigner' in provider) {
            // 使用 provider 的 getSigner 方法 (支持测试环境)
            const targetSigner = await (provider as any).getSigner(signer);
            if (targetSigner && targetSigner.signMessage) {
                const rpcSig = await targetSigner.signMessage(ethers.getBytes(hash));
                return {
                    ...parseRpcSignature(rpcSig),
                    signatureType: SignatureType.EthSign,
                };
            }
        }

        // 检查直接的 ethers provider with getSigners
        if (provider && typeof provider === 'object' && 'getSigners' in provider) {
            const signers = await (provider as any).getSigners();
            const testSigner = signers[0];
            if (testSigner) {
                const rpcSig = await testSigner.signMessage(ethers.getBytes(hash));
                return {
                    ...parseRpcSignature(rpcSig),
                    signatureType: SignatureType.EthSign,
                };
            }
        }
    } catch (hardhatError: any) {
        console.warn(`Hardhat signing failed: ${hardhatError.message}`);
    }

    // 处理其他类型的 provider (保持向后兼容)
    let ethersProvider: ethers.JsonRpcProvider;

    if (typeof provider === 'string') {
        ethersProvider = new ethers.JsonRpcProvider(provider);
    } else if (provider && typeof provider === 'object' && 'host' in provider) {
        const url = `http://${provider.host}:${(provider as any).port || 8545}`;
        ethersProvider = new ethers.JsonRpcProvider(url);
    } else {
        ethersProvider = new ethers.JsonRpcProvider('http://localhost:8545');
    }

    const ethersigner = await ethersProvider.getSigner(signer);
    const rpcSig = await ethersigner.signMessage(ethers.getBytes(hash));
    return {
        ...parseRpcSignature(rpcSig),
        signatureType: SignatureType.EthSign,
    };
}

/**
 * Sign a hash with the EthSign signature type, given a private key.
 */
export function ethSignHashWithKey(hash: string, key: string): Signature {
    const ethHash = hexUtils.toHex(
        ethjs.keccak256(ethjs.toBuffer(hexUtils.concat(Buffer.from('\x19Ethereum Signed Message:\n32'), hash))),
    );
    return {
        ...ecSignHashWithKey(ethHash, key),
        signatureType: SignatureType.EthSign,
    };
}

/**
 * Sign a typed data object with the EIP712 signature type on a provider.
 */
export async function eip712SignTypedDataWithProviderAsync(
    data: EIP712TypedData,
    signer: string,
    provider: SupportedProvider,
): Promise<Signature> {
    // 对于 Hardhat 测试环境，使用改进的 getSigner 方法
    try {
        if (provider && typeof provider === 'object' && 'getSigner' in provider) {
            // 使用 provider 的 getSigner 方法 (支持测试环境)
            const targetSigner = await (provider as any).getSigner(signer);
            if (targetSigner && targetSigner.signTypedData) {
                const rpcSig = await targetSigner.signTypedData(data.domain, data.types, data.message);
                return {
                    ...parseRpcSignature(rpcSig),
                    signatureType: SignatureType.EIP712,
                };
            }
        }

        // 检查直接的 ethers provider with getSigners
        if (provider && typeof provider === 'object' && 'getSigners' in provider) {
            const signers = await (provider as any).getSigners();
            const testSigner = signers[0];
            if (testSigner) {
                const rpcSig = await testSigner.signTypedData(data.domain, data.types, data.message);
                return {
                    ...parseRpcSignature(rpcSig),
                    signatureType: SignatureType.EIP712,
                };
            }
        }
    } catch (hardhatError: any) {
        console.warn(`Hardhat EIP712 signing failed: ${hardhatError.message}`);
    }

    // 处理其他类型的 provider (保持向后兼容)
    let ethersProvider: ethers.JsonRpcProvider;

    if (typeof provider === 'string') {
        ethersProvider = new ethers.JsonRpcProvider(provider);
    } else if (provider && typeof provider === 'object' && 'host' in provider) {
        const url = `http://${provider.host}:${(provider as any).port || 8545}`;
        ethersProvider = new ethers.JsonRpcProvider(url);
    } else {
        ethersProvider = new ethers.JsonRpcProvider('http://localhost:8545');
    }

    const ethersigner = await ethersProvider.getSigner(signer);
    const rpcSig = await ethersigner.signTypedData(data.domain, data.types, data.message);
    return {
        ...parseRpcSignature(rpcSig),
        signatureType: SignatureType.EIP712,
    };
}

/**
 * Sign a typed data object with the EIP712 signature type, given a private key.
 */
export function eip712SignTypedDataWithKey(typedData: EIP712TypedData, key: string): Signature {
    const hash = hexUtils.toHex(signTypedDataUtils.generateTypedDataHash(typedData));
    return {
        ...ecSignHashWithKey(hash, key),
        signatureType: SignatureType.EIP712,
    };
}

/**
 * Sign an EIP712 hash with the EIP712 signature type, given a private key.
 */
export function eip712SignHashWithKey(hash: string, key: string): Signature {
    return {
        ...ecSignHashWithKey(hash, key),
        signatureType: SignatureType.EIP712,
    };
}

/**
 * Generate the EC signature for a hash given a private key.
 */
export function ecSignHashWithKey(hash: string, key: string): ECSignature {
    const { v, r, s } = ethjs.ecsign(ethjs.toBuffer(hash), ethjs.toBuffer(key));
    return {
        v,
        r: ethjs.bufferToHex(r),
        s: ethjs.bufferToHex(s),
    };
}

// Parse a hex signature returned by an RPC call into an `ECSignature`.
function parseRpcSignature(rpcSig: string): ECSignature {
    if (hexUtils.size(rpcSig) !== 65) {
        throw new Error(`Invalid RPC signature length: "${rpcSig}"`);
    }
    // Some providers encode V as 0,1 instead of 27,28.
    const VALID_V_VALUES = [0, 1, 27, 28];
    // Some providers return the signature packed as V,R,S and others R,S,V.
    // Try to guess which encoding it is (with a slight preference for R,S,V).
    let v = parseInt(rpcSig.slice(-2), 16);
    if (VALID_V_VALUES.includes(v)) {
        // Format is R,S,V
        v = v >= 27 ? v : v + 27;
        return {
            r: hexUtils.slice(rpcSig, 0, 32),
            s: hexUtils.slice(rpcSig, 32, 64),
            v,
        };
    }
    // Format should be V,R,S
    v = parseInt(rpcSig.slice(2, 4), 16);
    if (!VALID_V_VALUES.includes(v)) {
        throw new Error(`Cannot determine RPC signature layout from V value: "${rpcSig}"`);
    }
    v = v >= 27 ? v : v + 27;
    return {
        v,
        r: hexUtils.slice(rpcSig, 1, 33),
        s: hexUtils.slice(rpcSig, 33, 65),
    };
}
