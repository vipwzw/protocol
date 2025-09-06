import { Order } from '@0x/utils';
import { ethers } from 'ethers';
import * as ethjs from 'ethereumjs-util';

import { constants } from './constants';

const { NULL_ADDRESS } = constants;

/**
 * 将对象格式的数据转换为数组格式（用于 ethers.js v6 兼容性）
 */
function convertToArrayFormat(obj: any, components: any[]): any {
    if (Array.isArray(obj)) {
        return obj.map(item => convertToArrayFormat(item, components));
    }

    if (typeof obj === 'object' && obj !== null) {
        return components.map(component => {
            const value = obj[component.name];
            if (component.components && Array.isArray(value)) {
                // 处理嵌套的 tuple 数组
                return value.map(item => convertToArrayFormat(item, component.components));
            } else if (component.components && typeof value === 'object') {
                // 处理嵌套的 tuple 对象
                return convertToArrayFormat(value, component.components);
            }
            return value;
        });
    }

    return obj;
}

const ORDER_ABI_COMPONENTS = [
    { name: 'makerAddress', type: 'address' },
    { name: 'takerAddress', type: 'address' },
    { name: 'feeRecipientAddress', type: 'address' },
    { name: 'senderAddress', type: 'address' },
    { name: 'makerAssetAmount', type: 'uint256' },
    { name: 'takerAssetAmount', type: 'uint256' },
    { name: 'makerFee', type: 'uint256' },
    { name: 'takerFee', type: 'uint256' },
    { name: 'expirationTimeSeconds', type: 'uint256' },
    { name: 'salt', type: 'uint256' },
    { name: 'makerAssetData', type: 'bytes' },
    { name: 'takerAssetData', type: 'bytes' },
    { name: 'makerFeeAssetData', type: 'bytes' },
    { name: 'takerFeeAssetData', type: 'bytes' },
];

/**
 * ABI encoder for `FillQuoteTransformer.TransformData`
 * 使用 JSON ABI 格式定义数据结构，更加直观和安全
 */

// 定义 Order 结构的 ABI
const ORDER_ABI = {
    type: 'tuple',
    components: ORDER_ABI_COMPONENTS,
};

// 定义 FillQuoteTransformerData 结构的完整 ABI
const FILL_QUOTE_TRANSFORMER_DATA_ABI = {
    type: 'tuple',
    components: [
        { name: 'side', type: 'uint8' },
        { name: 'sellToken', type: 'address' },
        { name: 'buyToken', type: 'address' },
        { name: 'orders', type: 'tuple[]', components: ORDER_ABI.components },
        { name: 'signatures', type: 'bytes[]' },
        { name: 'maxOrderFillAmounts', type: 'uint256[]' },
        { name: 'fillAmount', type: 'uint256' },
        { name: 'refundReceiver', type: 'address' },
        { name: 'rfqtTakerAddress', type: 'address' },
    ],
};

// 创建 ethers Interface 用于编码/解码
const fillQuoteInterface = new ethers.Interface([
    {
        type: 'function',
        name: 'encodeFillQuoteData',
        inputs: [FILL_QUOTE_TRANSFORMER_DATA_ABI],
    },
]);

export const fillQuoteTransformerDataEncoder = {
    encode: (data: [FillQuoteTransformerData]): string => {
        // 转换为数组格式以兼容 ethers.js v6
        const arrayData = convertToArrayFormat(data[0], FILL_QUOTE_TRANSFORMER_DATA_ABI.components);
        // 使用 ethers Interface 编码，去掉函数选择器（前4字节）
        const encoded = fillQuoteInterface.encodeFunctionData('encodeFillQuoteData', [arrayData]);
        return '0x' + encoded.slice(10); // 去掉 '0x' + 4字节函数选择器
    },
    decode: (encoded: string): [FillQuoteTransformerData] => {
        // 添加正确的函数选择器进行解码
        const funcSelector = fillQuoteInterface.getFunction('encodeFillQuoteData')!.selector;
        const withSelector = funcSelector + encoded.slice(2);
        const decoded = fillQuoteInterface.decodeFunctionData('encodeFillQuoteData', withSelector);
        return [decoded[0] as FillQuoteTransformerData];
    },
};

/**
 * Market operation for `FillQuoteTransformerData`.
 */
export enum FillQuoteTransformerSide {
    Sell,
    Buy,
}

/**
 * `FillQuoteTransformer.TransformData`
 */
export interface FillQuoteTransformerData {
    side: FillQuoteTransformerSide;
    sellToken: string;
    buyToken: string;
    orders: Array<Exclude<Order, ['signature', 'exchangeAddress', 'chainId']>>;
    signatures: string[];
    maxOrderFillAmounts: bigint[];
    fillAmount: bigint;
    refundReceiver: string;
    rfqtTakerAddress: string;
}

/**
 * ABI-encode a `FillQuoteTransformer.TransformData` type.
 */
export function encodeFillQuoteTransformerData(data: FillQuoteTransformerData): string {
    return fillQuoteTransformerDataEncoder.encode([data]);
}

/**
 * ABI-decode a `FillQuoteTransformer.TransformData` type.
 */
export function decodeFillQuoteTransformerData(encoded: string): FillQuoteTransformerData {
    return fillQuoteTransformerDataEncoder.decode(encoded)[0];
}

/**
 * ABI encoder for `WethTransformer.TransformData`
 * 使用 JSON ABI 格式定义数据结构
 */
const WETH_TRANSFORMER_DATA_ABI = {
    type: 'tuple',
    components: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
    ],
};

const wethInterface = new ethers.Interface([
    {
        type: 'function',
        name: 'encodeWethData',
        inputs: [WETH_TRANSFORMER_DATA_ABI],
    },
]);

export const wethTransformerDataEncoder = {
    encode: (data: [WethTransformerData]): string => {
        // 转换为数组格式以兼容 ethers.js v6
        const arrayData = convertToArrayFormat(data[0], WETH_TRANSFORMER_DATA_ABI.components);
        const encoded = wethInterface.encodeFunctionData('encodeWethData', [arrayData]);
        return '0x' + encoded.slice(10);
    },
    decode: (encoded: string): { data: WethTransformerData } => {
        // 添加正确的函数选择器进行解码
        const funcSelector = wethInterface.getFunction('encodeWethData')!.selector;
        const withSelector = funcSelector + encoded.slice(2);
        const decoded = wethInterface.decodeFunctionData('encodeWethData', withSelector);
        return { data: decoded[0] as WethTransformerData };
    },
};

/**
 * `WethTransformer.TransformData`
 */
export interface WethTransformerData {
    token: string;
    amount: bigint;
}

/**
 * ABI-encode a `WethTransformer.TransformData` type.
 */
export function encodeWethTransformerData(data: WethTransformerData): string {
    return wethTransformerDataEncoder.encode([data]);
}

/**
 * ABI-decode a `WethTransformer.TransformData` type.
 */
export function decodeWethTransformerData(encoded: string): WethTransformerData {
    return wethTransformerDataEncoder.decode(encoded).data;
}

/**
 * ABI encoder for `PayTakerTransformer.TransformData`
 * 使用 JSON ABI 格式定义数据结构
 */
const PAY_TAKER_TRANSFORMER_DATA_ABI = {
    type: 'tuple',
    components: [
        { name: 'tokens', type: 'address[]' },
        { name: 'amounts', type: 'uint256[]' },
    ],
};

const payTakerInterface = new ethers.Interface([
    {
        type: 'function',
        name: 'encodePayTakerData',
        inputs: [PAY_TAKER_TRANSFORMER_DATA_ABI],
    },
]);

export const payTakerTransformerDataEncoder = {
    encode: (data: [PayTakerTransformerData]): string => {
        // 转换为数组格式以兼容 ethers.js v6
        const arrayData = convertToArrayFormat(data[0], PAY_TAKER_TRANSFORMER_DATA_ABI.components);
        const encoded = payTakerInterface.encodeFunctionData('encodePayTakerData', [arrayData]);
        return '0x' + encoded.slice(10);
    },
    decode: (encoded: string): { data: PayTakerTransformerData } => {
        // 添加正确的函数选择器进行解码
        const funcSelector = payTakerInterface.getFunction('encodePayTakerData')!.selector;
        const withSelector = funcSelector + encoded.slice(2);
        const decoded = payTakerInterface.decodeFunctionData('encodePayTakerData', withSelector);
        return { data: decoded[0] as PayTakerTransformerData };
    },
};

/**
 * `PayTakerTransformer.TransformData`
 */
export interface PayTakerTransformerData {
    tokens: string[];
    amounts: bigint[];
}

/**
 * ABI-encode a `PayTakerTransformer.TransformData` type.
 */
export function encodePayTakerTransformerData(data: PayTakerTransformerData): string {
    return payTakerTransformerDataEncoder.encode([data]);
}

/**
 * ABI-decode a `PayTakerTransformer.TransformData` type.
 */
export function decodePayTakerTransformerData(encoded: string): PayTakerTransformerData {
    return payTakerTransformerDataEncoder.decode(encoded).data;
}

/**
 * ABI encoder for `AffiliateFeeTransformer.TransformData`
 * 使用 JSON ABI 格式定义数据结构
 */
const AFFILIATE_FEE_TRANSFORMER_DATA_ABI = {
    type: 'tuple',
    components: [
        {
            name: 'fees',
            type: 'tuple[]',
            components: [
                { name: 'token', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'recipient', type: 'address' },
            ],
        },
    ],
};

const affiliateFeeInterface = new ethers.Interface([
    {
        type: 'function',
        name: 'encodeAffiliateFeeData',
        inputs: [AFFILIATE_FEE_TRANSFORMER_DATA_ABI],
    },
]);

export const affiliateFeeTransformerDataEncoder = {
    encode: (data: AffiliateFeeTransformerData): string => {
        // 转换为数组格式以兼容 ethers.js v6
        const arrayData = convertToArrayFormat(data, AFFILIATE_FEE_TRANSFORMER_DATA_ABI.components);
        const encoded = affiliateFeeInterface.encodeFunctionData('encodeAffiliateFeeData', [arrayData]);
        return '0x' + encoded.slice(10);
    },
    decode: (encoded: string): AffiliateFeeTransformerData => {
        // 添加正确的函数选择器进行解码
        const funcSelector = affiliateFeeInterface.getFunction('encodeAffiliateFeeData')!.selector;
        const withSelector = funcSelector + encoded.slice(2);
        const decoded = affiliateFeeInterface.decodeFunctionData('encodeAffiliateFeeData', withSelector);
        return decoded[0] as AffiliateFeeTransformerData;
    },
};

/**
 * `AffiliateFeeTransformer.TransformData`
 */
export interface AffiliateFeeTransformerData {
    fees: Array<{
        token: string;
        amount: bigint;
        recipient: string;
    }>;
}

/**
 * ABI-encode a `AffiliateFeeTransformer.TransformData` type.
 */
export function encodeAffiliateFeeTransformerData(data: AffiliateFeeTransformerData): string {
    return affiliateFeeTransformerDataEncoder.encode(data);
}

/**
 * ABI-decode a `AffiliateFeeTransformer.TransformData` type.
 */
export function decodeAffiliateFeeTransformerData(encoded: string): AffiliateFeeTransformerData {
    return affiliateFeeTransformerDataEncoder.decode(encoded);
}

/**
 * ABI encoder for `PositiveSlippageFeeTransformer.TransformData`
 * 使用 JSON ABI 格式定义数据结构
 */
const POSITIVE_SLIPPAGE_FEE_TRANSFORMER_DATA_ABI = {
    type: 'tuple',
    components: [
        { name: 'token', type: 'address' },
        { name: 'bestCaseAmount', type: 'uint256' },
        { name: 'recipient', type: 'address' },
    ],
};

const positiveSlippageFeeInterface = new ethers.Interface([
    {
        type: 'function',
        name: 'encodePositiveSlippageFeeData',
        inputs: [POSITIVE_SLIPPAGE_FEE_TRANSFORMER_DATA_ABI],
    },
]);

export const positiveSlippageFeeTransformerDataEncoder = {
    encode: (data: PositiveSlippageFeeTransformerData): string => {
        // 转换为数组格式以兼容 ethers.js v6
        const arrayData = convertToArrayFormat(data, POSITIVE_SLIPPAGE_FEE_TRANSFORMER_DATA_ABI.components);
        const encoded = positiveSlippageFeeInterface.encodeFunctionData('encodePositiveSlippageFeeData', [arrayData]);
        return '0x' + encoded.slice(10);
    },
    decode: (encoded: string): PositiveSlippageFeeTransformerData => {
        // 添加正确的函数选择器进行解码
        const funcSelector = positiveSlippageFeeInterface.getFunction('encodePositiveSlippageFeeData')!.selector;
        const withSelector = funcSelector + encoded.slice(2);
        const decoded = positiveSlippageFeeInterface.decodeFunctionData('encodePositiveSlippageFeeData', withSelector);
        return decoded[0] as PositiveSlippageFeeTransformerData;
    },
};

/**
 * `PositiveSlippageFeeTransformer.TransformData`
 */
export interface PositiveSlippageFeeTransformerData {
    token: string;
    bestCaseAmount: bigint;
    recipient: string;
}

/**
 * ABI-encode a `PositiveSlippageFeeTransformer.TransformData` type.
 */
export function encodePositiveSlippageFeeTransformerData(data: PositiveSlippageFeeTransformerData): string {
    return positiveSlippageFeeTransformerDataEncoder.encode(data);
}

/**
 * ABI-decode a `PositiveSlippageFeeTransformer.TransformData` type.
 */
export function decodePositiveSlippageFeeTransformerData(encoded: string): PositiveSlippageFeeTransformerData {
    return positiveSlippageFeeTransformerDataEncoder.decode(encoded);
}

/**
 * Find the nonce for a transformer given its deployer.
 * If `deployer` is the null address, zero will always be returned.
 */
export function findTransformerNonce(
    transformer: string,
    deployer: string = NULL_ADDRESS,
    maxGuesses: number = 1024,
): number {
    if (deployer === NULL_ADDRESS) {
        return 0;
    }
    const lowercaseTransformer = transformer.toLowerCase();
    // Try to guess the nonce.
    for (let nonce = 0; nonce < maxGuesses; ++nonce) {
        const deployedAddress = getTransformerAddress(deployer, nonce);
        if (deployedAddress === lowercaseTransformer) {
            return nonce;
        }
    }
    throw new Error(`${deployer} did not deploy ${transformer}!`);
}

/**
 * Compute the deployed address for a transformer given a deployer and nonce.
 */
export function getTransformerAddress(deployer: string, nonce: number): string {
    return ethjs.bufferToHex(
        // tslint:disable-next-line: custom-no-magic-numbers
        ethjs.rlphash([deployer, nonce] as any).slice(12),
    );
}
