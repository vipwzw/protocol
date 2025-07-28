import { Order } from '@0x/types';
import { BigNumber } from '@0x/utils';
/**
 * ABI encoder for `FillQuoteTransformer.TransformData`
 */
export declare const fillQuoteTransformerDataEncoder: any;
/**
 * Market operation for `FillQuoteTransformerData`.
 */
export declare enum FillQuoteTransformerSide {
    Sell = 0,
    Buy = 1
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
    maxOrderFillAmounts: BigNumber[];
    fillAmount: BigNumber;
    refundReceiver: string;
    rfqtTakerAddress: string;
}
/**
 * ABI-encode a `FillQuoteTransformer.TransformData` type.
 */
export declare function encodeFillQuoteTransformerData(data: FillQuoteTransformerData): string;
/**
 * ABI-decode a `FillQuoteTransformer.TransformData` type.
 */
export declare function decodeFillQuoteTransformerData(encoded: string): FillQuoteTransformerData;
/**
 * ABI encoder for `WethTransformer.TransformData`
 */
export declare const wethTransformerDataEncoder: any;
/**
 * `WethTransformer.TransformData`
 */
export interface WethTransformerData {
    token: string;
    amount: BigNumber;
}
/**
 * ABI-encode a `WethTransformer.TransformData` type.
 */
export declare function encodeWethTransformerData(data: WethTransformerData): string;
/**
 * ABI-decode a `WethTransformer.TransformData` type.
 */
export declare function decodeWethTransformerData(encoded: string): WethTransformerData;
/**
 * ABI encoder for `PayTakerTransformer.TransformData`
 */
export declare const payTakerTransformerDataEncoder: any;
/**
 * `PayTakerTransformer.TransformData`
 */
export interface PayTakerTransformerData {
    tokens: string[];
    amounts: BigNumber[];
}
/**
 * ABI-encode a `PayTakerTransformer.TransformData` type.
 */
export declare function encodePayTakerTransformerData(data: PayTakerTransformerData): string;
/**
 * ABI-decode a `PayTakerTransformer.TransformData` type.
 */
export declare function decodePayTakerTransformerData(encoded: string): PayTakerTransformerData;
/**
 * ABI encoder for `affiliateFeetransformer.TransformData`
 */
export declare const affiliateFeeTransformerDataEncoder: any;
/**
 * `AffiliateFeeTransformer.TransformData`
 */
export interface AffiliateFeeTransformerData {
    fees: Array<{
        token: string;
        amount: BigNumber;
        recipient: string;
    }>;
}
/**
 * ABI-encode a `AffiliateFeeTransformer.TransformData` type.
 */
export declare function encodeAffiliateFeeTransformerData(data: AffiliateFeeTransformerData): string;
/**
 * ABI-decode a `AffiliateFeeTransformer.TransformData` type.
 */
export declare function decodeAffiliateFeeTransformerData(encoded: string): AffiliateFeeTransformerData;
/**
 * ABI encoder for `PositiveSlippageFeeTransformer.TransformData`
 */
export declare const positiveSlippageFeeTransformerDataEncoder: any;
/**
 * `PositiveSlippageFeeTransformer.TransformData`
 */
export interface PositiveSlippageFeeTransformerData {
    token: string;
    bestCaseAmount: BigNumber;
    recipient: string;
}
/**
 * ABI-encode a `PositiveSlippageFeeTransformer.TransformData` type.
 */
export declare function encodePositiveSlippageFeeTransformerData(data: PositiveSlippageFeeTransformerData): string;
/**
 * ABI-decode a `PositiveSlippageFeeTransformer.TransformData` type.
 */
export declare function decodePositiveSlippageFeeTransformerData(encoded: string): PositiveSlippageFeeTransformerData;
/**
 * Find the nonce for a transformer given its deployer.
 * If `deployer` is the null address, zero will always be returned.
 */
export declare function findTransformerNonce(transformer: string, deployer?: string, maxGuesses?: number): number;
/**
 * Compute the deployed address for a transformer given a deployer and nonce.
 */
export declare function getTransformerAddress(deployer: string, nonce: number): string;
