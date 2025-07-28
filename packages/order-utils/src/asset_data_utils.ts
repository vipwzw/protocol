import { ethers } from 'ethers';
import {
    AssetData,
    AssetProxyId,
    ERC1155AssetData,
    ERC20AssetData,
    ERC20BridgeAssetData,
    ERC721AssetData,
    MultiAssetData,
    MultiAssetDataWithRecursiveDecoding,
    SingleAssetData,
    StaticCallAssetData,
} from '@0x/types';
import { hexUtils, NULL_ADDRESS } from '@0x/utils';
import * as _ from 'lodash';

// 使用 ethers v6 AbiCoder
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

// Asset Proxy IDs
const ERC20_ASSET_PROXY_ID = '0xf47261b0';
const ERC721_ASSET_PROXY_ID = '0x02571792';
const ERC1155_ASSET_PROXY_ID = '0xa7cb5fb7';
const ERC20_BRIDGE_ASSET_PROXY_ID = '0xdc1600f3';
const MULTI_ASSET_PROXY_ID = '0x94cfcdd7';
const STATIC_CALL_PROXY_ID = '0xc339d10a';

export const assetDataUtils = {
    encodeERC20AssetData(tokenAddress: string): string {
        const encoded = abiCoder.encode(['address'], [tokenAddress]);
        return ERC20_ASSET_PROXY_ID + encoded.slice(2);
    },
    
    encodeERC20BridgeAssetData(tokenAddress: string, bridgeAddress: string, bridgeData: string): string {
        const encoded = abiCoder.encode(['address', 'address', 'bytes'], [tokenAddress, bridgeAddress, bridgeData]);
        return ERC20_BRIDGE_ASSET_PROXY_ID + encoded.slice(2);
    },
    
    encodeERC721AssetData(tokenAddress: string, tokenId: bigint): string {
        const encoded = abiCoder.encode(['address', 'uint256'], [tokenAddress, tokenId]);
        return ERC721_ASSET_PROXY_ID + encoded.slice(2);
    },
    
    encodeERC1155AssetData(
        tokenAddress: string,
        tokenIds: bigint[],
        tokenValues: bigint[],
        callbackData: string,
    ): string {
        const encoded = abiCoder.encode(
            ['address', 'uint256[]', 'uint256[]', 'bytes'],
            [tokenAddress, tokenIds, tokenValues, callbackData]
        );
        return ERC1155_ASSET_PROXY_ID + encoded.slice(2);
    },
    
    encodeMultiAssetData(values: bigint[], nestedAssetData: string[]): string {
        const encoded = abiCoder.encode(['uint256[]', 'bytes[]'], [values, nestedAssetData]);
        return MULTI_ASSET_PROXY_ID + encoded.slice(2);
    },
    
    encodeStaticCallAssetData(
        staticCallTargetAddress: string,
        staticCallData: string,
        expectedReturnDataHash: string,
    ): string {
        const encoded = abiCoder.encode(
            ['address', 'bytes', 'bytes32'],
            [staticCallTargetAddress, staticCallData, expectedReturnDataHash]
        );
        return STATIC_CALL_PROXY_ID + encoded.slice(2);
    },

    /**
     * Decode any assetData into its corresponding assetData object
     * @param assetData Hex encoded assetData string to decode
     * @return Either a ERC20, ERC20Bridge, ERC721, ERC1155, StaticCall, or MultiAsset assetData object
     */
    decodeAssetDataOrThrow(assetData: string): AssetData {
        const assetProxyId = hexUtils.slice(assetData, 0, 4);
        const encodedData = '0x' + assetData.slice(10); // Remove proxy ID, keep encoded data
        
        switch (assetProxyId) {
            case AssetProxyId.ERC20: {
                const [tokenAddress] = abiCoder.decode(['address'], encodedData);
                return {
                    assetProxyId,
                    tokenAddress,
                };
            }
            case AssetProxyId.ERC20Bridge: {
                const [tokenAddress, bridgeAddress, bridgeData] = abiCoder.decode(
                    ['address', 'address', 'bytes'],
                    encodedData
                );
                return {
                    assetProxyId,
                    tokenAddress,
                    bridgeAddress,
                    bridgeData,
                };
            }
            case AssetProxyId.ERC721: {
                const [tokenAddress, tokenId] = abiCoder.decode(['address', 'uint256'], encodedData);
                return {
                    assetProxyId,
                    tokenAddress,
                    tokenId: BigInt(tokenId),
                };
            }
            case AssetProxyId.ERC1155: {
                const [tokenAddress, tokenIds, tokenValues, callbackData] = abiCoder.decode(
                    ['address', 'uint256[]', 'uint256[]', 'bytes'],
                    encodedData
                );
                return {
                    assetProxyId,
                    tokenAddress,
                    tokenIds: tokenIds.map((id: any) => BigInt(id)),
                    tokenValues: tokenValues.map((value: any) => BigInt(value)),
                    callbackData,
                };
            }
            case AssetProxyId.MultiAsset: {
                const [amounts, nestedAssetData] = abiCoder.decode(['uint256[]', 'bytes[]'], encodedData);
                const multiAssetData: MultiAssetData = {
                    assetProxyId,
                    amounts: amounts.map((amount: any) => BigInt(amount)),
                    nestedAssetData,
                };
                return multiAssetData;
            }
            case AssetProxyId.StaticCall: {
                const [callTarget, staticCallData, callResultHash] = abiCoder.decode(
                    ['address', 'bytes', 'bytes32'],
                    encodedData
                );
                return {
                    assetProxyId,
                    callTarget,
                    staticCallData,
                    callResultHash,
                };
            }
            default:
                throw new Error(`Unhandled asset proxy ID: ${assetProxyId}`);
        }
    },

    /**
     * Decodes a MultiAsset assetData hex string into its corresponding amounts and decoded nestedAssetData elements (all nested elements are flattened)
     * @param assetData Hex encoded assetData string to decode
     * @return An object containing the decoded amounts and nestedAssetData
     */
    decodeMultiAssetDataRecursively(assetData: string): MultiAssetDataWithRecursiveDecoding {
        const decodedAssetData = assetDataUtils.decodeAssetDataOrThrow(assetData) as MultiAssetData;
        if (decodedAssetData.assetProxyId !== AssetProxyId.MultiAsset) {
            throw new Error(`Not a MultiAssetData. Use 'decodeAssetDataOrThrow' instead`);
        }
        const amounts: any[] = [];
        const decodedNestedAssetData = decodedAssetData.nestedAssetData.map((nestedAssetDataElement, index) => {
            const decodedNestedAssetDataElement = assetDataUtils.decodeAssetDataOrThrow(nestedAssetDataElement);
            if (decodedNestedAssetDataElement.assetProxyId === AssetProxyId.MultiAsset) {
                const recursivelyDecodedAssetData = assetDataUtils.decodeMultiAssetDataRecursively(
                    nestedAssetDataElement,
                );
                amounts.push(
                    recursivelyDecodedAssetData.amounts.map(amountElement =>
                        amountElement * decodedAssetData.amounts[index],
                    ),
                );
                return recursivelyDecodedAssetData.nestedAssetData;
            } else {
                amounts.push(decodedAssetData.amounts[index]);
                return decodedNestedAssetDataElement;
            }
        });
        const flattenedAmounts = _.flattenDeep(amounts) as bigint[];
        const flattenedDecodedNestedAssetData = _.flattenDeep(decodedNestedAssetData as any[]) as SingleAssetData[];
        return {
            assetProxyId: decodedAssetData.assetProxyId,
            amounts: flattenedAmounts,
            nestedAssetData: flattenedDecodedNestedAssetData,
        };
    },

    isERC20TokenAssetData(assetData: AssetData): assetData is ERC20AssetData {
        return assetData.assetProxyId === AssetProxyId.ERC20;
    },
    
    isERC20BridgeAssetData(assetData: AssetData): assetData is ERC20BridgeAssetData {
        return assetData.assetProxyId === AssetProxyId.ERC20Bridge;
    },
    
    isERC1155TokenAssetData(assetData: AssetData): assetData is ERC1155AssetData {
        return assetData.assetProxyId === AssetProxyId.ERC1155;
    },
    
    isERC721TokenAssetData(assetData: AssetData): assetData is ERC721AssetData {
        return assetData.assetProxyId === AssetProxyId.ERC721;
    },
    
    isMultiAssetData(assetData: AssetData): assetData is MultiAssetData {
        return assetData.assetProxyId === AssetProxyId.MultiAsset;
    },
    
    isStaticCallAssetData(assetData: AssetData): assetData is StaticCallAssetData {
        return assetData.assetProxyId === AssetProxyId.StaticCall;
    },
};
