import { hexUtils, NULL_ADDRESS } from '@0x/utils';
import { ethers } from 'ethers';
import * as ethjs from 'ethereumjs-util';

import { LimitOrder, LimitOrderFields, OtcOrder, OtcOrderFields, RfqOrder, RfqOrderFields } from './orders';
import { Signature, SIGNATURE_ABI } from './signature_utils';

const BRIDGE_ORDER_ABI_COMPONENTS = [
    { name: 'source', type: 'bytes32' },
    { name: 'takerTokenAmount', type: 'uint256' },
    { name: 'makerTokenAmount', type: 'uint256' },
    { name: 'bridgeData', type: 'bytes' },
];

const LIMIT_ORDER_INFO_ABI_COMPONENTS = [
    {
        name: 'order',
        type: 'tuple',
        components: LimitOrder.STRUCT_ABI,
    },
    {
        name: 'signature',
        type: 'tuple',
        components: SIGNATURE_ABI,
    },
    { name: 'maxTakerTokenFillAmount', type: 'uint256' },
];

const RFQ_ORDER_INFO_ABI_COMPONENTS = [
    {
        name: 'order',
        type: 'tuple',
        components: RfqOrder.STRUCT_ABI,
    },
    {
        name: 'signature',
        type: 'tuple',
        components: SIGNATURE_ABI,
    },
    { name: 'maxTakerTokenFillAmount', type: 'uint256' },
];

const OTC_ORDER_INFO_ABI_COMPONENTS = [
    {
        name: 'order',
        type: 'tuple',
        components: OtcOrder.STRUCT_ABI,
    },
    {
        name: 'signature',
        type: 'tuple',
        components: SIGNATURE_ABI,
    },
    { name: 'maxTakerTokenFillAmount', type: 'uint256' },
];

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
            
            // 处理 bytes 类型（string）
            if (component.type === 'bytes') {
                // 如果值是空数组或 undefined/null，返回 '0x'
                if (Array.isArray(value) && value.length === 0) {
                    return '0x';
                }
                return value || '0x'; // 确保 bytes 类型至少是 '0x'
            }
            
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

/**
 * ABI encoder for `FillQuoteTransformer.TransformData`
 * 使用 ethers AbiCoder 替代 AbiEncoder
 */
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

// 定义 FillQuoteTransformerData 的完整 ABI (匹配测试合约结构)
const FILL_QUOTE_TRANSFORMER_DATA_ABI = {
    type: 'tuple',
    components: [
        { name: 'side', type: 'uint8' },
        { name: 'sellToken', type: 'address' },
        { name: 'buyToken', type: 'address' },
        { name: 'bridgeOrders', type: 'tuple[]', components: BRIDGE_ORDER_ABI_COMPONENTS },
        { name: 'limitOrders', type: 'bytes' },
        { name: 'rfqOrders', type: 'bytes' },
        { name: 'fillSequence', type: 'uint8[]' },
        { name: 'fillAmount', type: 'uint256' },
        { name: 'refundReceiver', type: 'address' },
        { name: 'otcOrders', type: 'bytes' }
    ]
};

// 创建 ethers Interface 用于编码/解码
const fillQuoteInterface = new ethers.Interface([
    {
        type: 'function',
        name: 'encodeFillQuoteData',
        inputs: [FILL_QUOTE_TRANSFORMER_DATA_ABI]
    }
]);

export const fillQuoteTransformerDataEncoder = {
    encode: (data: FillQuoteTransformerData): string => {
        // 转换为数组格式以兼容 ethers.js v6
        const arrayData = convertToArrayFormat(data, FILL_QUOTE_TRANSFORMER_DATA_ABI.components);
        // 使用 ethers Interface 编码，去掉函数选择器（前4字节）
        const encoded = fillQuoteInterface.encodeFunctionData('encodeFillQuoteData', [arrayData]);
        return '0x' + encoded.slice(10); // 去掉 '0x' + 4字节函数选择器
    },
    decode: (encoded: string): FillQuoteTransformerData => {
        // 添加正确的函数选择器进行解码
        const func = fillQuoteInterface.getFunction('encodeFillQuoteData');
        if (!func) {
            throw new Error('Function encodeFillQuoteData not found in interface');
        }
        const funcSelector = func.selector;
        const withSelector = funcSelector + encoded.slice(2);
        const decoded = fillQuoteInterface.decodeFunctionData('encodeFillQuoteData', withSelector);
        return decoded[0] as FillQuoteTransformerData;
    }
};

/**
 * Market operation for `FillQuoteTransformerData`.
 */
export enum FillQuoteTransformerSide {
    Sell,
    Buy,
}

/**
 * `FillQuoteTransformer.OrderType`
 */
export enum FillQuoteTransformerOrderType {
    Bridge,
    Limit,
    Rfq,
    Otc,
}

/**
 * Transform data for `FillQuoteTransformer.transform()`.
 * 注意：这个结构匹配测试合约期望的格式
 */
export interface FillQuoteTransformerData {
    side: FillQuoteTransformerSide;
    sellToken: string;
    buyToken: string;
    bridgeOrders: FillQuoteTransformerBridgeOrder[];
    limitOrders: string | any[]; // 兼容数组和字符串
    rfqOrders: string | any[];   // 兼容数组和字符串
    fillSequence: FillQuoteTransformerOrderType[];
    fillAmount: bigint;
    refundReceiver: string;
    otcOrders: string | any[];   // 兼容数组和字符串
}

/**
 * Identifies the DEX protocol used to fill a bridge order.
 * Note: These need to correspond exactly with BridgeProtocols.sol!
 */
export enum BridgeProtocol {
    Unknown,
    Curve,
    UniswapV2,
    Uniswap,
    Balancer,
    Kyber_DEPRECATED,
    Mooniswap,
    MStable,
    Oasis_DEPRECATED,
    Shell,
    Dodo,
    DodoV2,
    CryptoCom,
    Bancor,
    CoFiX_DEPRECATED,
    Nerve,
    MakerPsm,
    BalancerV2,
    UniswapV3,
    KyberDmm,
    CurveV2,
    Lido,
    Clipper, // Not used: Clipper is now using PLP interface
    AaveV2,
    Compound,
    BalancerV2Batch,
    GMX,
    Platypus,
    BancorV3,
    Solidly,
    Synthetix,
    WOOFi,
    AaveV3,
    KyberElastic,
    Barter,
    TraderJoeV2,
    VelodromeV2,
    MaverickV1,
}

/**
 * `FillQuoteTransformer.BridgeOrder`
 */
export interface FillQuoteTransformerBridgeOrder {
    // A bytes32 hex where the upper 16 bytes are an int128, right-aligned
    // protocol ID and the lower 16 bytes are a bytes16, left-aligned,
    // ASCII source name.
    source: string;
    takerTokenAmount: bigint;
    makerTokenAmount: bigint;
    bridgeData: string;
}

/**
 * Represents either `FillQuoteTransformer.LimitOrderInfo`
 * or `FillQuoteTransformer.RfqOrderInfo`
 */
interface FillQuoteTransformerNativeOrderInfo<T> {
    order: T;
    signature: Signature;
    maxTakerTokenFillAmount: bigint;
}

/**
 * `FillQuoteTransformer.LimitOrderInfo`
 */
export type FillQuoteTransformerLimitOrderInfo = FillQuoteTransformerNativeOrderInfo<LimitOrderFields>;

/**
 * `FillQuoteTransformer.RfqOrderInfo`
 */
export type FillQuoteTransformerRfqOrderInfo = FillQuoteTransformerNativeOrderInfo<RfqOrderFields>;

/**
 * `FillQuoteTransformer.OtcOrderInfo`
 */
export type FillQuoteTransformerOtcOrderInfo = FillQuoteTransformerNativeOrderInfo<OtcOrderFields>;

/**
 * ABI-encode a `FillQuoteTransformer.TransformData` type.
 */
export function encodeFillQuoteTransformerData(data: FillQuoteTransformerData): string {
    return fillQuoteTransformerDataEncoder.encode(data);
}

/**
 * ABI-decode a `FillQuoteTransformer.TransformData` type.
 */
export function decodeFillQuoteTransformerData(encoded: string): FillQuoteTransformerData {
    return fillQuoteTransformerDataEncoder.decode(encoded);
}

/**
 * ABI encoder for `WethTransformer.TransformData`
 * 使用 ethers AbiCoder 替代 AbiEncoder
 */
// WETH Transformer Data ABI 组件
const WETH_TRANSFORMER_DATA_ABI_COMPONENTS = [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' }
];

export const wethTransformerDataEncoder = {
    encode: (data: [WethTransformerData]): string => {
        // 转换为数组格式以兼容 ethers.js v6
        const arrayData = convertToArrayFormat(data[0], WETH_TRANSFORMER_DATA_ABI_COMPONENTS);
        return abiCoder.encode(['tuple(address,uint256)'], [arrayData]);
    },
    decode: (encoded: string): [WethTransformerData] => {
        const [decoded] = abiCoder.decode(['tuple(address,uint256)'], encoded);
        return [decoded as WethTransformerData];
    }
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
    return wethTransformerDataEncoder.decode(encoded)[0];
}

/**
 * ABI encoder for `PayTakerTransformer.TransformData`
 * 使用 ethers AbiCoder 替代 AbiEncoder
 */
// PayTaker Transformer Data ABI 组件
const PAY_TAKER_TRANSFORMER_DATA_ABI_COMPONENTS = [
    { name: 'tokens', type: 'address[]' },
    { name: 'amounts', type: 'uint256[]' }
];

export const payTakerTransformerDataEncoder = {
    encode: (data: [PayTakerTransformerData]): string => {
        // 转换为数组格式以兼容 ethers.js v6
        const arrayData = convertToArrayFormat(data[0], PAY_TAKER_TRANSFORMER_DATA_ABI_COMPONENTS);
        return abiCoder.encode(['tuple(address[],uint256[])'], [arrayData]);
    },
    decode: (encoded: string): [PayTakerTransformerData] => {
        const [decoded] = abiCoder.decode(['tuple(address[],uint256[])'], encoded);
        return [decoded as PayTakerTransformerData];
    }
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
    return payTakerTransformerDataEncoder.decode(encoded)[0];
}

/**
 * ABI encoder for `affiliateFeetransformer.TransformData`
 * 使用 ethers AbiCoder 替代 AbiEncoder
 */
// AffiliateFee Transformer Data ABI 组件
const AFFILIATE_FEE_TRANSFORMER_DATA_ABI_COMPONENTS = [
    { 
        name: 'fees', 
        type: 'tuple[]', 
        components: [
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'recipient', type: 'address' }
        ]
    }
];

export const affiliateFeeTransformerDataEncoder = {
    encode: (data: AffiliateFeeTransformerData): string => {
        // 转换为数组格式以兼容 ethers.js v6
        const arrayData = convertToArrayFormat(data, AFFILIATE_FEE_TRANSFORMER_DATA_ABI_COMPONENTS);
        return abiCoder.encode(['tuple(tuple(address,uint256,address)[])'], [arrayData]);
    },
    decode: (encoded: string): AffiliateFeeTransformerData => {
        const [decoded] = abiCoder.decode(['tuple(tuple(address,uint256,address)[])'], encoded);
        return decoded as AffiliateFeeTransformerData;
    }
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
 * Find the nonce for a transformer given its deployer.
 * If `deployer` is the null address, zero will always be returned.
 */
export function findTransformerNonce(transformer: string, deployer: string = NULL_ADDRESS, maxGuesses = 1024): number {
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
    return ethjs.bufferToHex(ethjs.rlphash([deployer, nonce] as any).slice(12));
}

/**
 * ABI encoder for `PositiveSlippageFeeTransformer.TransformData`
 * 使用 ethers AbiCoder 替代 AbiEncoder
 */
// PositiveSlippageFee Transformer Data ABI 组件
const POSITIVE_SLIPPAGE_FEE_TRANSFORMER_DATA_ABI_COMPONENTS = [
    { name: 'token', type: 'address' },
    { name: 'bestCaseAmount', type: 'uint256' },
    { name: 'recipient', type: 'address' }
];

export const positiveSlippageFeeTransformerDataEncoder = {
    encode: (data: PositiveSlippageFeeTransformerData): string => {
        // 转换为数组格式以兼容 ethers.js v6
        const arrayData = convertToArrayFormat(data, POSITIVE_SLIPPAGE_FEE_TRANSFORMER_DATA_ABI_COMPONENTS);
        return abiCoder.encode(['tuple(address,uint256,address)'], [arrayData]);
    },
    decode: (encoded: string): PositiveSlippageFeeTransformerData => {
        const [decoded] = abiCoder.decode(['tuple(address,uint256,address)'], encoded);
        return decoded as PositiveSlippageFeeTransformerData;
    }
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
 * Packs a bridge protocol ID and an ASCII DEX name into a single byte32.
 */
export function encodeBridgeSourceId(protocol: BridgeProtocol, name: string): string {
    const nameBuf = Buffer.from(name);
    if (nameBuf.length > 16) {
        throw new Error(`"${name}" is too long to be a bridge source name (max of 16 ascii chars)`);
    }
    return hexUtils.concat(
        hexUtils.leftPad(hexUtils.toHex(protocol), 16),
        hexUtils.rightPad(hexUtils.toHex(Buffer.from(name)), 16),
    );
}
