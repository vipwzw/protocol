// AbiEncoder 已移除，使用 ethers AbiCoder
import { AssetProxyId } from '@0x/utils';
import { keccak256 } from 'ethereum-cryptography/keccak';
import { ethers } from 'ethers';
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
export function decodeERC721AssetData(encoded: string): [string, bigint] {
    // return assetDataIface.getABIDecodedTransactionData<[string, bigint]>('ERC721Token', encoded);
    return ['ERC721Token', 0n]; // Placeholder
}

/**
 * Decode ERC1155 asset data.
 */
export function decodeERC1155AssetData(encoded: string): [string, bigint[], bigint[], string] {
    // return assetDataIface.getABIDecodedTransactionData<[string, bigint[], bigint[], string]>(
    //     'ERC1155Assets',
    //     encoded,
    // );
    return ['ERC1155Assets', [], [], '']; // Placeholder
}

/**
 * Decode MultiAsset asset data.
 */
export function decodeMultiAssetData(encoded: string): [bigint[], string[]] {
    // return assetDataIface.getABIDecodedTransactionData<[bigint[], string[]]>('MultiAsset', encoded);
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
    // ERC20 asset data format: 4-byte proxy ID + 32-byte token address = 36 bytes
    // This matches the ERC20Proxy contract's expectation in decodeERC20AssetData()
    
    // ERC20 proxy ID: bytes4(keccak256("ERC20Token(address)"))
    const proxyIdHash = keccak256(Buffer.from('ERC20Token(address)', 'utf8'));
    const proxyId = '0x' + Buffer.from(proxyIdHash.slice(0, 4)).toString('hex');
    
    // Encode: proxyId (4 bytes) + tokenAddress (32 bytes) = 36 bytes
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = proxyId + coder.encode(['address'], [tokenAddress]).slice(2);
    
    return encoded;
}

/**
 * Encode ERC721 asset data.
 */
export function encodeERC721AssetData(tokenAddress: string, tokenId: bigint): string {
    // ERC721 asset data format: 4-byte proxy ID + 32-byte token address + 32-byte token ID = 68 bytes
    
    // ERC721 proxy ID: bytes4(keccak256("ERC721Token(address,uint256)"))
    const proxyIdHash = keccak256(Buffer.from('ERC721Token(address,uint256)', 'utf8'));
    const proxyId = '0x' + Buffer.from(proxyIdHash.slice(0, 4)).toString('hex');
    
    // Encode: proxyId (4 bytes) + tokenAddress (32 bytes) + tokenId (32 bytes) = 68 bytes
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = proxyId + coder.encode(['address', 'uint256'], [tokenAddress, tokenId]).slice(2);
    
    return encoded;
}

/**
 * Encode ERC1155 asset data.
 */
export function encodeERC1155AssetData(
    tokenAddress: string,
    tokenIds: bigint[],
    values: bigint[],
    callbackData: string,
): string {
    // ERC1155 proxy ID: bytes4(keccak256("ERC1155Assets(address,uint256[],uint256[],bytes)"))
    const proxyIdHash = keccak256(Buffer.from('ERC1155Assets(address,uint256[],uint256[],bytes)', 'utf8'));
    const proxyId = '0x' + Buffer.from(proxyIdHash.slice(0, 4)).toString('hex');
    
    // Encode the data
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = proxyId + coder.encode(
        ['address', 'uint256[]', 'uint256[]', 'bytes'],
        [tokenAddress, tokenIds, values, callbackData]
    ).slice(2);
    
    return encoded;
}

/**
 * Encode MultiAsset asset data.
 */
export function encodeMultiAssetData(values: bigint[], nestedAssetData: string[]): string {
    // MultiAsset proxy ID: bytes4(keccak256("MultiAsset(uint256[],bytes[])"))
    const proxyIdHash = keccak256(Buffer.from('MultiAsset(uint256[],bytes[])', 'utf8'));
    const proxyId = '0x' + Buffer.from(proxyIdHash.slice(0, 4)).toString('hex');
    
    // Encode the data
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = proxyId + coder.encode(
        ['uint256[]', 'bytes[]'],
        [values, nestedAssetData]
    ).slice(2);
    
    return encoded;
}

/**
 * Encode StaticCall asset data.
 */
export function encodeStaticCallAssetData(
    staticCallTargetAddress: string,
    staticCallData: string,
    expectedReturnDataHash: string,
): string {
    // StaticCall proxy ID: bytes4(keccak256("StaticCall(address,bytes,bytes32)"))
    const proxyIdHash = keccak256(Buffer.from('StaticCall(address,bytes,bytes32)', 'utf8'));
    const proxyId = '0x' + Buffer.from(proxyIdHash.slice(0, 4)).toString('hex');
    
    // Encode the data
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = proxyId + coder.encode(
        ['address', 'bytes', 'bytes32'],
        [staticCallTargetAddress, staticCallData, expectedReturnDataHash]
    ).slice(2);
    
    return encoded;
}

/**
 * Encode ERC20Bridge asset data.
 */
export function encodeERC20BridgeAssetData(tokenAddress: string, bridgeAddress: string, bridgeData: string): string {
    // ERC20Bridge proxy ID: bytes4(keccak256("ERC20Bridge(address,address,bytes)"))
    const proxyIdHash = keccak256(Buffer.from('ERC20Bridge(address,address,bytes)', 'utf8'));
    const proxyId = '0x' + Buffer.from(proxyIdHash.slice(0, 4)).toString('hex');
    
    // Encode the data
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = proxyId + coder.encode(
        ['address', 'address', 'bytes'],
        [tokenAddress, bridgeAddress, bridgeData]
    ).slice(2);
    
    return encoded;
}
