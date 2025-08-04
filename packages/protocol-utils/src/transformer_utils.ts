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
 * ABI encoder for `FillQuoteTransformer.TransformData`
 * 使用 ethers AbiCoder 替代 AbiEncoder
 * TODO: 实现完整的编码逻辑
 */
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

export const fillQuoteTransformerDataEncoder = {
    encode: (data: any): string => {
        // 临时实现，返回空数据
        return '0x';
    },
    decode: (encoded: string): any => {
        // 临时实现，返回空对象
        return {};
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
 */
export interface FillQuoteTransformerData {
    side: FillQuoteTransformerSide;
    sellToken: string;
    buyToken: string;
    bridgeOrders: FillQuoteTransformerBridgeOrder[];
    limitOrders: FillQuoteTransformerLimitOrderInfo[];
    rfqOrders: FillQuoteTransformerRfqOrderInfo[];
    otcOrders: FillQuoteTransformerOtcOrderInfo[];  // 恢复到原始位置
    fillSequence: FillQuoteTransformerOrderType[];
    fillAmount: bigint;
    refundReceiver: string;
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
    return fillQuoteTransformerDataEncoder.encode([data]);
}

/**
 * ABI-decode a `FillQuoteTransformer.TransformData` type.
 */
export function decodeFillQuoteTransformerData(encoded: string): FillQuoteTransformerData {
    return fillQuoteTransformerDataEncoder.decode(encoded).data;
}

/**
 * ABI encoder for `WethTransformer.TransformData`
 * 使用 ethers AbiCoder 替代 AbiEncoder
 */
export const wethTransformerDataEncoder = {
    encode: (data: [WethTransformerData]): string => {
        return abiCoder.encode(['tuple(address,uint256)'], [data]);
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
export const payTakerTransformerDataEncoder = {
    encode: (data: [PayTakerTransformerData]): string => {
        return abiCoder.encode(['tuple(address[],uint256[])'], [data]);
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
export const affiliateFeeTransformerDataEncoder = {
    encode: (data: AffiliateFeeTransformerData): string => {
        return abiCoder.encode(['tuple(tuple(address,uint256,address)[])'], [data]);
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
export const positiveSlippageFeeTransformerDataEncoder = {
    encode: (data: PositiveSlippageFeeTransformerData): string => {
        return abiCoder.encode(['tuple(address,uint256,address)'], [data]);
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
