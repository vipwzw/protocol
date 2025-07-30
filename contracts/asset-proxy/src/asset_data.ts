import { AbiEncoder, BigNumber } from '@0x/utils';
import { AssetProxyId } from '@0x/utils';
import { keccak256 } from 'ethereum-cryptography/keccak';
// TODO: Re-enable when TypeChain compilation is successful
// import { IAssetDataContract } from './wrappers';

// TODO: Re-enable asset proxy ID retrieval when contracts are available
// export function getAssetDataProxyId(assetData: string): AssetProxyId {
//     const assetDataContract = new IAssetDataContract('0x0000000000000000000000000000000000000000', {} as any);
//     return assetDataContract.getAssetProxyId.call(assetData) as any;
// }

/**
 * Decode ERC20 asset data.
 */
export function decodeERC20AssetData(encoded: string): string {
    // return assetDataIface.getABIDecodedTransactionData<string>('ERC20Token', encoded);
    return 'ERC20Token'; // Placeholder
}

/**
 * Decode ERC721 asset data.
 */
export function decodeERC721AssetData(encoded: string): [string, BigNumber] {
    // return assetDataIface.getABIDecodedTransactionData<[string, BigNumber]>('ERC721Token', encoded);
    return ['ERC721Token', new BigNumber(0)]; // Placeholder
}

/**
 * Decode ERC1155 asset data.
 */
export function decodeERC1155AssetData(encoded: string): [string, BigNumber[], BigNumber[], string] {
    // return assetDataIface.getABIDecodedTransactionData<[string, BigNumber[], BigNumber[], string]>(
    //     'ERC1155Assets',
    //     encoded,
    // );
    return ['ERC1155Assets', [], [], '']; // Placeholder
}

/**
 * Decode MultiAsset asset data.
 */
export function decodeMultiAssetData(encoded: string): [BigNumber[], string[]] {
    // return assetDataIface.getABIDecodedTransactionData<[BigNumber[], string[]]>('MultiAsset', encoded);
    return [[], []]; // Placeholder
}

/**
 * Decode StaticCall asset data.
 */
export function decodeStaticCallAssetData(encoded: string): [string, string, string] {
    // return assetDataIface.getABIDecodedTransactionData<[string, string, string]>('StaticCall', encoded);
    return ['StaticCall', '', '']; // Placeholder
}

/**
 * Decode ERC20Bridge asset data.
 */
export function decodeERC20BridgeAssetData(encoded: string): [string, string, string] {
    // return assetDataIface.getABIDecodedTransactionData<[string, string, string]>('ERC20Bridge', encoded);
    return ['ERC20Bridge', '', '']; // Placeholder
}

/**
 * Encode ERC20 asset data.
 */
export function encodeERC20AssetData(tokenAddress: string): string {
    // return assetDataIface.ERC20Token(tokenAddress).getABIEncodedTransactionData();
    return 'ERC20Token'; // Placeholder
}

/**
 * Encode ERC721 asset data.
 */
export function encodeERC721AssetData(tokenAddress: string, tokenId: BigNumber): string {
    // return assetDataIface.ERC721Token(tokenAddress, tokenId).getABIEncodedTransactionData();
    return 'ERC721Token'; // Placeholder
}

/**
 * Encode ERC1155 asset data.
 */
export function encodeERC1155AssetData(
    tokenAddress: string,
    tokenIds: BigNumber[],
    values: BigNumber[],
    callbackData: string,
): string {
    // return assetDataIface.ERC1155Assets(tokenAddress, tokenIds, values, callbackData).getABIEncodedTransactionData();
    return 'ERC1155Assets'; // Placeholder
}

/**
 * Encode MultiAsset asset data.
 */
export function encodeMultiAssetData(values: BigNumber[], nestedAssetData: string[]): string {
    // return assetDataIface.MultiAsset(values, nestedAssetData).getABIEncodedTransactionData();
    return 'MultiAsset'; // Placeholder
}

/**
 * Encode StaticCall asset data.
 */
export function encodeStaticCallAssetData(
    staticCallTargetAddress: string,
    staticCallData: string,
    expectedReturnDataHash: string,
): string {
    // return assetDataIface
    //     .StaticCall(staticCallTargetAddress, staticCallData, expectedReturnDataHash)
    //     .getABIEncodedTransactionData();
    return 'StaticCall'; // Placeholder
}

/**
 * Encode ERC20Bridge asset data.
 */
export function encodeERC20BridgeAssetData(tokenAddress: string, bridgeAddress: string, bridgeData: string): string {
    // return assetDataIface.ERC20Bridge(tokenAddress, bridgeAddress, bridgeData).getABIEncodedTransactionData();
    return 'ERC20Bridge'; // Placeholder
}
