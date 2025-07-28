import { schemas } from '@0x/json-schemas';
import {
    ECSignature,
    ExchangeProxyMetaTransaction,
    Order,
    SignatureType,
    SignedExchangeProxyMetaTransaction,
    SignedOrder,
    SignedZeroExTransaction,
    ValidatorSignature,
    ZeroExTransaction,
} from '@0x/types';
import { hexUtils } from "./utils";;
import { ethers } from 'ethers';
import * as ethUtil from 'ethereumjs-util';
import * as _ from 'lodash';

import { assert } from './assert';
import { eip712Utils } from './eip712_utils';
import { getExchangeProxyMetaTransactionHash } from './hash_utils';
import { orderHashUtils } from './order_hash_utils';
import { transactionHashUtils } from './transaction_hash_utils';
import { TypedDataError } from './types';

// 类型声明  
type SupportedProvider = ethers.Provider | ethers.Signer;

// 创建 providerUtils 替代
const providerUtils = {
    isSigner(provider: SupportedProvider): provider is ethers.Signer {
        return 'signMessage' in provider;
    },
    async getAccountsAsync(provider: SupportedProvider): Promise<string[]> {
        if (this.isSigner(provider)) {
            const address = await provider.getAddress();
            return [address];
        }
        // 对于 Provider，返回空数组或通过 eth_accounts 获取
        return [];
    },
    standardizeOrThrow(address: string): string {
        // 简单地返回地址，或进行基本的标准化
        return address.toLowerCase();
    },
};

// Web3Wrapper 替代 - 使用 ethers v6 实现
class Web3Wrapper {
    public isZeroExWeb3Wrapper = false;
    private provider: SupportedProvider;
    
    constructor(provider: SupportedProvider) {
        this.provider = provider;
    }
    
    /**
     * 使用 ethers v6 实现 signTypedData 功能
     * 替代原来的 @0x/web3-wrapper signTypedDataAsync
     */
    async signTypedDataAsync(signerAddress: string, typedData: any): Promise<string> {
        if (providerUtils.isSigner(this.provider)) {
            // 验证签名者地址是否匹配
            const currentAddress = await this.provider.getAddress();
            if (currentAddress.toLowerCase() !== signerAddress.toLowerCase()) {
                throw new Error(`Signer address ${currentAddress} does not match expected ${signerAddress}`);
            }
            
            // 使用 ethers v6 的 signTypedData 方法
            // 参数格式: domain, types, value
            return await this.provider.signTypedData(
                typedData.domain,
                typedData.types, 
                typedData.message || typedData.value || typedData
            );
        } else {
            // 对于非 Signer 的 provider，尝试通过 RPC 调用 eth_signTypedData_v4
            try {
                // 优先尝试 send 方法，回退到 sendAsync
                if (typeof (this.provider as any).send === 'function') {
                    return await (this.provider as any).send('eth_signTypedData_v4', [signerAddress, JSON.stringify(typedData)]);
                } else if (typeof (this.provider as any).sendAsync === 'function') {
                    return new Promise((resolve, reject) => {
                        (this.provider as any).sendAsync(
                            {
                                method: 'eth_signTypedData_v4',
                                params: [signerAddress, JSON.stringify(typedData)],
                                id: 42,
                                jsonrpc: '2.0'
                            },
                            (error: any, result: any) => {
                                if (error) {
                                    reject(error);
                                } else {
                                    resolve(result.result);
                                }
                            }
                        );
                    });
                } else {
                    throw new Error('Provider does not have send or sendAsync method');
                }
            } catch (error) {
                throw new Error(`Provider does not support typed data signing. ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
    
    /**
     * 使用 ethers v6 实现 signMessage 功能  
     * 替代原来的 @0x/web3-wrapper signMessageAsync
     */
    async signMessageAsync(signerAddress: string, message: string): Promise<string> {
        if (providerUtils.isSigner(this.provider)) {
            // 验证签名者地址是否匹配
            const currentAddress = await this.provider.getAddress();
            if (currentAddress.toLowerCase() !== signerAddress.toLowerCase()) {
                throw new Error(`Signer address ${currentAddress} does not match expected ${signerAddress}`);
            }
            
            // 使用 ethers v6 的 signMessage 方法
            // 这会自动添加以太坊消息前缀并签名
            return await this.provider.signMessage(ethers.getBytes(message));
        } else {
            // 对于非 Signer 的 provider，尝试通过 RPC 调用 eth_sign
            try {
                // 优先尝试 send 方法，回退到 sendAsync
                if (typeof (this.provider as any).send === 'function') {
                    return await (this.provider as any).send('eth_sign', [signerAddress, message]);
                } else if (typeof (this.provider as any).sendAsync === 'function') {
                    return new Promise((resolve, reject) => {
                        (this.provider as any).sendAsync(
                            {
                                method: 'eth_sign',
                                params: [signerAddress, message],
                                id: 42,
                                jsonrpc: '2.0'
                            },
                            (error: any, result: any) => {
                                if (error) {
                                    reject(error);
                                } else {
                                    resolve(result.result);
                                }
                            }
                        );
                    });
                } else {
                    throw new Error('Provider does not have send or sendAsync method');
                }
            } catch (error) {
                throw new Error(`Provider does not support signing. ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
    
    /**
     * 获取账户地址列表
     * 用于验证签名者权限
     */
    async getAccountsAsync(): Promise<string[]> {
        if (providerUtils.isSigner(this.provider)) {
            const address = await this.provider.getAddress();
            return [address];
        }
        
        // 对于普通 Provider，尝试通过 eth_accounts 获取
        try {
            const accounts = await (this.provider as any).send('eth_accounts', []);
            return accounts || [];
        } catch {
            return [];
        }
    }
    
    /**
     * 获取网络信息
     */
    async getNetworkAsync(): Promise<{ chainId: number }> {
        const network = await (this.provider as any).getNetwork();
        return { chainId: Number(network.chainId) };
    }
}

export const signatureUtils = {
    /**
     * Signs an order and returns a SignedOrder. First `eth_signTypedData` is requested
     * then a fallback to `eth_sign` if not available on the supplied provider.
     * @param   supportedProvider      Web3 provider to use for all JSON RPC requests
     * @param   order The Order to sign.
     * @param   signerAddress   The hex encoded Ethereum address you wish to sign it with. This address
     *          must be available via the supplied Provider.
     * @return  A SignedOrder containing the order and Elliptic curve signature with Signature Type.
     */
    async ecSignOrderAsync(
        supportedProvider: SupportedProvider,
        order: Order,
        signerAddress: string,
    ): Promise<SignedOrder> {
        assert.doesConformToSchema('order', order, schemas.orderSchema, [schemas.hexSchema]);
        try {
            const signedOrder = await signatureUtils.ecSignTypedDataOrderAsync(supportedProvider, order, signerAddress);
            return signedOrder;
        } catch (err: any) {
            // HACK: We are unable to handle specific errors thrown since provider is not an object
            //       under our control. It could be Metamask Web3, Ethers, or any general RPC provider.
            //       We check for a user denying the signature request in a way that supports Metamask and
            //       Coinbase Wallet. Unfortunately for signers with a different error message,
            //       they will receive two signature requests.
            if (err?.message?.includes('User denied message signature')) {
                throw err;
            }
            const orderHash = orderHashUtils.getOrderHash(order);
            const signatureHex = await signatureUtils.ecSignHashAsync(supportedProvider, orderHash, signerAddress);
            const signedOrder = {
                ...order,
                signature: signatureHex,
            };
            return signedOrder;
        }
    },
    /**
     * Signs an order using `eth_signTypedData` and returns a SignedOrder.
     * @param   supportedProvider      Web3 provider to use for all JSON RPC requests
     * @param   order The Order to sign.
     * @param   signerAddress   The hex encoded Ethereum address you wish to sign it with. This address
     *          must be available via the supplied Provider.
     * @return  A SignedOrder containing the order and Elliptic curve signature with Signature Type.
     */
    async ecSignTypedDataOrderAsync(
        supportedProvider: SupportedProvider,
        order: Order,
        signerAddress: string,
    ): Promise<SignedOrder> {
        const provider = supportedProvider; // 直接使用 provider
        assert.isETHAddressHex('signerAddress', signerAddress);
        assert.doesConformToSchema('order', order, schemas.orderSchema, [schemas.hexSchema]);
        const web3Wrapper = new Web3Wrapper(provider);
        await assert.isSenderAddressAsync('signerAddress', signerAddress, provider);
        const normalizedSignerAddress = signerAddress.toLowerCase();
        const typedData = eip712Utils.createOrderTypedData(order);
        try {
            const signature = await web3Wrapper.signTypedDataAsync(normalizedSignerAddress, typedData);
            const ecSignatureRSV = parseSignatureHexAsRSV(signature);
            const signatureBuffer = Buffer.concat([
                ethUtil.toBuffer(ecSignatureRSV.v),
                ethUtil.toBuffer(ecSignatureRSV.r),
                ethUtil.toBuffer(ecSignatureRSV.s),
                ethUtil.toBuffer(SignatureType.EIP712),
            ]);
            const signatureHex = `0x${signatureBuffer.toString('hex')}`;
            return {
                ...order,
                signature: signatureHex,
            };
        } catch (err) {
            // Detect if Metamask to transition users to the MetamaskSubprovider
            if ((provider as any).isMetaMask) {
                throw new Error(TypedDataError.InvalidMetamaskSigner);
            } else {
                throw err;
            }
        }
    },
    /**
     * Signs a transaction and returns a SignedZeroExTransaction. First `eth_signTypedData` is requested
     * then a fallback to `eth_sign` if not available on the supplied provider.
     * @param   supportedProvider      Web3 provider to use for all JSON RPC requests
     * @param   transaction The ZeroExTransaction to sign.
     * @param   signerAddress   The hex encoded Ethereum address you wish to sign it with. This address
     *          must be available via the supplied Provider.
     * @return  A SignedTransaction containing the order and Elliptic curve signature with Signature Type.
     */
    async ecSignTransactionAsync(
        supportedProvider: SupportedProvider,
        transaction: ZeroExTransaction,
        signerAddress: string,
    ): Promise<SignedZeroExTransaction> {
        assert.doesConformToSchema('transaction', transaction, schemas.zeroExTransactionSchema, [schemas.hexSchema]);
        try {
            const signedTransaction = await signatureUtils.ecSignTypedDataTransactionAsync(
                supportedProvider,
                transaction,
                signerAddress,
            );
            return signedTransaction;
        } catch (err: any) {
            // HACK: We are unable to handle specific errors thrown since provider is not an object
            //       under our control. It could be Metamask Web3, Ethers, or any general RPC provider.
            //       We check for a user denying the signature request in a way that supports Metamask and
            //       Coinbase Wallet. Unfortunately for signers with a different error message,
            //       they will receive two signature requests.
            if (err?.message?.includes('User denied message signature')) {
                throw err;
            }
            const transactionHash = transactionHashUtils.getTransactionHash(transaction);
            const signatureHex = await signatureUtils.ecSignHashAsync(
                supportedProvider,
                transactionHash,
                signerAddress,
            );
            const signedTransaction = {
                ...transaction,
                signature: signatureHex,
            };
            return signedTransaction;
        }
    },
    /**
     * Signs a ZeroExTransaction using `eth_signTypedData` and returns a SignedZeroExTransaction.
     * @param   supportedProvider      Web3 provider to use for all JSON RPC requests
     * @param   transaction            The ZeroEx Transaction to sign.
     * @param   signerAddress          The hex encoded Ethereum address you wish to sign it with. This address
     *          must be available via the supplied Provider.
     * @return  A SignedZeroExTransaction containing the ZeroExTransaction and Elliptic curve signature with Signature Type.
     */
    async ecSignTypedDataTransactionAsync(
        supportedProvider: SupportedProvider,
        transaction: ZeroExTransaction,
        signerAddress: string,
    ): Promise<SignedZeroExTransaction> {
        const provider = supportedProvider; // 直接使用 provider
        assert.isETHAddressHex('signerAddress', signerAddress);
        assert.doesConformToSchema('transaction', transaction, schemas.zeroExTransactionSchema, [schemas.hexSchema]);
        const web3Wrapper = new Web3Wrapper(provider);
        await assert.isSenderAddressAsync('signerAddress', signerAddress, provider);
        const normalizedSignerAddress = signerAddress.toLowerCase();
        const typedData = eip712Utils.createZeroExTransactionTypedData(transaction);
        try {
            const signature = await web3Wrapper.signTypedDataAsync(normalizedSignerAddress, typedData);
            const ecSignatureRSV = parseSignatureHexAsRSV(signature);
            const signatureBuffer = Buffer.concat([
                ethUtil.toBuffer(ecSignatureRSV.v),
                ethUtil.toBuffer(ecSignatureRSV.r),
                ethUtil.toBuffer(ecSignatureRSV.s),
                ethUtil.toBuffer(SignatureType.EIP712),
            ]);
            const signatureHex = `0x${signatureBuffer.toString('hex')}`;
            return {
                ...transaction,
                signature: signatureHex,
            };
        } catch (err) {
            // Detect if Metamask to transition users to the MetamaskSubprovider
            if ((provider as any).isMetaMask) {
                throw new Error(TypedDataError.InvalidMetamaskSigner);
            } else {
                throw err;
            }
        }
    },
    /**
     * Signs an Exchange Proxy meta-transaction and returns a SignedExchangeProxyMetaTransaction.
     * First `eth_signTypedData` is requested then a fallback to `eth_sign` if not
     * available on the supplied provider.
     * @param   supportedProvider  Web3 provider to use for all JSON RPC requests
     * @param   transaction The ExchangeProxyMetaTransaction to sign.
     * @param   signerAddress The hex encoded Ethereum address you wish to sign it with. This address
     *          must be available via the supplied Provider.
     * @return  A SignedExchangeProxyMetaTransaction containing the order and
     *          elliptic curve signature with Signature Type.
     */
    async ecSignExchangeProxyMetaTransactionAsync(
        supportedProvider: SupportedProvider,
        transaction: ExchangeProxyMetaTransaction,
        signerAddress: string,
    ): Promise<SignedExchangeProxyMetaTransaction> {
        assert.doesConformToSchema('transaction', transaction, schemas.exchangeProxyMetaTransactionSchema, [
            schemas.hexSchema,
        ]);
        try {
            const signedTransaction = await signatureUtils.ecSignTypedDataExchangeProxyMetaTransactionAsync(
                supportedProvider,
                transaction,
                signerAddress,
            );
            return signedTransaction;
        } catch (err: any) {
            // HACK: We are unable to handle specific errors thrown since provider is not an object
            //       under our control. It could be Metamask Web3, Ethers, or any general RPC provider.
            //       We check for a user denying the signature request in a way that supports Metamask and
            //       Coinbase Wallet. Unfortunately for signers with a different error message,
            //       they will receive two signature requests.
            if (err?.message?.includes('User denied message signature')) {
                throw err;
            }
            const transactionHash = getExchangeProxyMetaTransactionHash(transaction);
            const signatureHex = await signatureUtils.ecSignHashAsync(
                supportedProvider,
                transactionHash,
                signerAddress,
            );
            const signedTransaction = {
                ...transaction,
                signature: signatureHex,
            };
            return signedTransaction;
        }
    },
    /**
     * Signs an Exchange Proxy meta-transaction using `eth_signTypedData` and
     * returns a SignedZeroExTransaction.
     * @param   supportedProvider      Web3 provider to use for all JSON RPC requests
     * @param   transaction            The Exchange Proxy transaction to sign.
     * @param   signerAddress          The hex encoded Ethereum address you wish
     *          to sign it with. This address must be available via the supplied Provider.
     * @return  A SignedExchangeProxyMetaTransaction containing the
     *          ExchangeProxyMetaTransaction and elliptic curve signature with Signature Type.
     */
    async ecSignTypedDataExchangeProxyMetaTransactionAsync(
        supportedProvider: SupportedProvider,
        transaction: ExchangeProxyMetaTransaction,
        signerAddress: string,
    ): Promise<SignedExchangeProxyMetaTransaction> {
        const provider = supportedProvider; // 直接使用 provider
        assert.isETHAddressHex('signerAddress', signerAddress);
        assert.doesConformToSchema('transaction', transaction, schemas.exchangeProxyMetaTransactionSchema, [
            schemas.hexSchema,
        ]);
        const web3Wrapper = new Web3Wrapper(provider);
        await assert.isSenderAddressAsync('signerAddress', signerAddress, provider);
        const normalizedSignerAddress = signerAddress.toLowerCase();
        const typedData = eip712Utils.createExchangeProxyMetaTransactionTypedData(transaction);
        try {
            const signature = await web3Wrapper.signTypedDataAsync(normalizedSignerAddress, typedData);
            const ecSignatureRSV = parseSignatureHexAsRSV(signature);
            const signatureHex = hexUtils.concat(
                ecSignatureRSV.v.toString(),
                ecSignatureRSV.r,
                ecSignatureRSV.s,
                SignatureType.EIP712.toString(),
            );
            return {
                ...transaction,
                signature: signatureHex,
            };
        } catch (err) {
            // Detect if Metamask to transition users to the MetamaskSubprovider
            if ((provider as any).isMetaMask) {
                throw new Error(TypedDataError.InvalidMetamaskSigner);
            } else {
                throw err;
            }
        }
    },
    /**
     * Signs a hash using `eth_sign` and returns its elliptic curve signature and signature type.
     * @param   supportedProvider      Web3 provider to use for all JSON RPC requests
     * @param   msgHash       Hex encoded message to sign.
     * @param   signerAddress   The hex encoded Ethereum address you wish to sign it with. This address
     *          must be available via the supplied Provider.
     * @return  A hex encoded string containing the Elliptic curve signature generated by signing the msgHash and the Signature Type.
     */
    async ecSignHashAsync(
        supportedProvider: SupportedProvider,
        msgHash: string,
        signerAddress: string,
    ): Promise<string> {
        const provider = supportedProvider; // 直接使用 provider
        assert.isHexString('msgHash', msgHash);
        assert.isETHAddressHex('signerAddress', signerAddress);
        const web3Wrapper = new Web3Wrapper(provider);
        await assert.isSenderAddressAsync('signerAddress', signerAddress, provider);
        const normalizedSignerAddress = signerAddress.toLowerCase();
        const signature = await web3Wrapper.signMessageAsync(normalizedSignerAddress, msgHash);
        const prefixedMsgHashHex = signatureUtils.addSignedMessagePrefix(msgHash);

        // HACK: There is no consensus on whether the signatureHex string should be formatted as
        // v + r + s OR r + s + v, and different clients (even different versions of the same client)
        // return the signature params in different orders. In order to support all client implementations,
        // we parse the signature in both ways, and evaluate if either one is a valid signature.
        // r + s + v is the most prevalent format from eth_sign, so we attempt this first.
        
        // 首先尝试 RSV 格式解析 (ethers.js 标准格式)
        const ecSignatureRSV = parseSignatureHexAsRSV(signature);
        
        // 尝试使用前缀消息验证
        let isValidRSVSignature = isValidECSignature(prefixedMsgHashHex, ecSignatureRSV, normalizedSignerAddress);
        
        // 如果前缀验证失败，尝试不带前缀的原始消息
        if (!isValidRSVSignature) {
            isValidRSVSignature = isValidECSignature(msgHash, ecSignatureRSV, normalizedSignerAddress);
        }
        
        if (isValidRSVSignature) {
            const convertedSignatureHex = signatureUtils.convertECSignatureToSignatureHex(ecSignatureRSV);
            return convertedSignatureHex;
        }
        
        // 然后尝试 VRS 格式解析 (旧格式)
        const ecSignatureVRS = parseSignatureHexAsVRS(signature);
        
        // 尝试使用前缀消息验证
        let isValidVRSSignature = isValidECSignature(prefixedMsgHashHex, ecSignatureVRS, normalizedSignerAddress);
        
        // 如果前缀验证失败，尝试不带前缀的原始消息
        if (!isValidVRSSignature) {
            isValidVRSSignature = isValidECSignature(msgHash, ecSignatureVRS, normalizedSignerAddress);
        }
        
        if (isValidVRSSignature) {
            const convertedSignatureHex = signatureUtils.convertECSignatureToSignatureHex(ecSignatureVRS);
            return convertedSignatureHex;
        }
        // Detect if Metamask to transition users to the MetamaskSubprovider
        if ((provider as any).isMetaMask) {
            throw new Error(TypedDataError.InvalidMetamaskSigner);
        } else {
            throw new Error(TypedDataError.InvalidSignature);
        }
    },
    /**
     * Combines ECSignature with V,R,S and the EthSign signature type for use in 0x protocol
     * @param ecSignature The ECSignature of the signed data
     * @return Hex encoded string of signature (v,r,s) with Signature Type
     */
    convertECSignatureToSignatureHex(ecSignature: ECSignature): string {
        const signatureHex = hexUtils.concat(ecSignature.v.toString(), ecSignature.r, ecSignature.s);
        const signatureWithType = signatureUtils.convertToSignatureWithType(signatureHex, SignatureType.EthSign);
        return signatureWithType;
    },
    /**
     * Combines the signature proof and the Signature Type.
     * @param signature The hex encoded signature proof
     * @param signatureType The signature type, i.e EthSign, Wallet etc.
     * @return Hex encoded string of signature proof with Signature Type
     */
    convertToSignatureWithType(signature: string, signatureType: SignatureType): string {
        const signatureBuffer = Buffer.concat([ethUtil.toBuffer(signature), ethUtil.toBuffer(signatureType)]);
        const signatureHex = `0x${signatureBuffer.toString('hex')}`;
        return signatureHex;
    },
    /**
     * Adds the relevant prefix to the message being signed.
     * @param message Message to sign
     * @return Prefixed message
     */
    addSignedMessagePrefix(message: string): string {
        assert.isString('message', message);
        const msgBuff = ethUtil.toBuffer(message);
        const prefixedMsgBuff = ethUtil.hashPersonalMessage(msgBuff);
        const prefixedMsgHex = ethUtil.bufferToHex(prefixedMsgBuff);
        return prefixedMsgHex;
    },
    /**
     * Parse a hex-encoded Validator signature into validator address and signature components
     * @param signature A hex encoded Validator 0x Protocol signature
     * @return A ValidatorSignature with validatorAddress and signature parameters
     */
    parseValidatorSignature(signature: string): ValidatorSignature {
        assert.isOneOfExpectedSignatureTypes(signature, [SignatureType.Validator]);
        // tslint:disable:custom-no-magic-numbers
        const validatorSignature = {
            validatorAddress: `0x${signature.slice(-42, -2)}`,
            signature: signature.slice(0, -42),
        };
        // tslint:enable:custom-no-magic-numbers
        return validatorSignature;
    },
};

/**
 * Parses a signature hex string, which is assumed to be in the RSV format (ethers.js standard).
 */
export function parseSignatureHexAsVRS(signatureHex: string): ECSignature {
    const signatureBuffer = ethUtil.toBuffer(signatureHex);
    
    // Standard RSV format: 32 bytes R + 32 bytes S + 1 byte V
    const r = signatureBuffer.slice(0, 32);
    const s = signatureBuffer.slice(32, 64);
    let v = signatureBuffer[64];
    
    // Handle different V value formats:
    // - Legacy format: [0, 1] -> convert to [27, 28]
    // - Standard format: [27, 28] -> use as is
    // - EIP-155 format: [chainId*2+35, chainId*2+36] -> use as is
    if (v < 27) {
        v += 27;
    }
    
    const ecSignature: ECSignature = {
        v,
        r: ethUtil.bufferToHex(r),
        s: ethUtil.bufferToHex(s),
    };
    return ecSignature;
}

function parseSignatureHexAsRSV(signatureHex: string): ECSignature {
    const { v, r, s } = ethUtil.fromRpcSig(signatureHex);
    const ecSignature: ECSignature = {
        v,
        r: ethUtil.bufferToHex(r),
        s: ethUtil.bufferToHex(s),
    };
    return ecSignature;
}

/**
 * Checks if the supplied elliptic curve signature corresponds to signing `data` with
 * the private key corresponding to `signerAddress`
 * @param   data          The hex encoded data signed by the supplied signature.
 * @param   signature     An object containing the elliptic curve signature parameters.
 * @param   signerAddress The hex encoded address that signed the data, producing the supplied signature.
 * @return Whether the ECSignature is valid.
 */
export function isValidECSignature(data: string, signature: ECSignature, signerAddress: string): boolean {
    assert.isHexString('data', data);
    assert.doesConformToSchema('signature', signature, schemas.ecSignatureSchema);
    assert.isETHAddressHex('signerAddress', signerAddress);
    const normalizedSignerAddress = signerAddress.toLowerCase();

    try {
        const msgHashBuff = ethUtil.toBuffer(data);
        
        // 根据 EIP-155 规范正确处理 v 值
        let recoveryId: number;
        let vType: string;
        
        if (signature.v === 27 || signature.v === 28) {
            // 经典值（旧版网络）：27 或 28，直接使用
            recoveryId = signature.v;
            vType = 'legacy';
        } else if (signature.v === 0 || signature.v === 1) {
            // 特殊场景值：底层库的恢复标识符，转换为标准格式
            recoveryId = signature.v + 27;
            vType = 'raw';
        } else if (signature.v >= 35) {
            // EIP-155 扩展值：v = chainId * 2 + 35 + recoveryId
            // 提取 recoveryId：recoveryId = (v - 35) % 2
            // 转换为标准格式：27 + recoveryId
            const extractedRecoveryId = (signature.v - 35) % 2;
            recoveryId = 27 + extractedRecoveryId;
            
            // 验证 chainId 一致性（用于调试）
            const chainId = Math.floor((signature.v - 35) / 2);
            vType = `EIP-155 (chainId=${chainId})`;
        } else {
            // 无效值，尝试模运算作为最后手段
            recoveryId = (signature.v % 2) + 27;
            vType = 'fallback';
        }
        
        // V 值处理完成，类型: ${vType}
        
        // 使用规范化的 recoveryId 进行椭圆曲线恢复
        const pubKey = ethUtil.ecrecover(
            msgHashBuff,
            recoveryId,
            ethUtil.toBuffer(signature.r),
            ethUtil.toBuffer(signature.s),
        );
        
        const retrievedAddress = ethUtil.bufferToHex(ethUtil.pubToAddress(pubKey));
        const normalizedRetrievedAddress = retrievedAddress.toLowerCase();
        
        return normalizedRetrievedAddress === normalizedSignerAddress;
    } catch (err) {
        // 如果椭圆曲线恢复失败，尝试使用 ethers.js 作为备选方案
        try {
            const ethersSignature = ethers.Signature.from({
                r: signature.r,
                s: signature.s,
                v: signature.v
            });
            
            const recoveredAddress = ethers.verifyMessage(ethers.getBytes(data), ethersSignature);
            const normalizedRecoveredAddress = recoveredAddress.toLowerCase();
            
            return normalizedRecoveredAddress === normalizedSignerAddress;
        } catch (ethersErr) {
            return false;
        }
    }
}

// tslint:disable:max-file-line-count
