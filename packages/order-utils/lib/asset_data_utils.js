"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.assetDataUtils = void 0;
const ethers_1 = require("ethers");
const types_1 = require("@0x/types");
const utils_1 = require("@0x/utils");
const _ = __importStar(require("lodash"));
// 使用 ethers v6 AbiCoder
const abiCoder = ethers_1.ethers.AbiCoder.defaultAbiCoder();
// Asset Proxy IDs
const ERC20_ASSET_PROXY_ID = '0xf47261b0';
const ERC721_ASSET_PROXY_ID = '0x02571792';
const ERC1155_ASSET_PROXY_ID = '0xa7cb5fb7';
const ERC20_BRIDGE_ASSET_PROXY_ID = '0xdc1600f3';
const MULTI_ASSET_PROXY_ID = '0x94cfcdd7';
const STATIC_CALL_PROXY_ID = '0xc339d10a';
exports.assetDataUtils = {
    encodeERC20AssetData(tokenAddress) {
        const encoded = abiCoder.encode(['address'], [tokenAddress]);
        return ERC20_ASSET_PROXY_ID + encoded.slice(2);
    },
    encodeERC20BridgeAssetData(tokenAddress, bridgeAddress, bridgeData) {
        const encoded = abiCoder.encode(['address', 'address', 'bytes'], [tokenAddress, bridgeAddress, bridgeData]);
        return ERC20_BRIDGE_ASSET_PROXY_ID + encoded.slice(2);
    },
    encodeERC721AssetData(tokenAddress, tokenId) {
        const encoded = abiCoder.encode(['address', 'uint256'], [tokenAddress, tokenId]);
        return ERC721_ASSET_PROXY_ID + encoded.slice(2);
    },
    encodeERC1155AssetData(tokenAddress, tokenIds, tokenValues, callbackData) {
        const encoded = abiCoder.encode(['address', 'uint256[]', 'uint256[]', 'bytes'], [tokenAddress, tokenIds, tokenValues, callbackData]);
        return ERC1155_ASSET_PROXY_ID + encoded.slice(2);
    },
    encodeMultiAssetData(values, nestedAssetData) {
        const encoded = abiCoder.encode(['uint256[]', 'bytes[]'], [values, nestedAssetData]);
        return MULTI_ASSET_PROXY_ID + encoded.slice(2);
    },
    encodeStaticCallAssetData(staticCallTargetAddress, staticCallData, expectedReturnDataHash) {
        const encoded = abiCoder.encode(['address', 'bytes', 'bytes32'], [staticCallTargetAddress, staticCallData, expectedReturnDataHash]);
        return STATIC_CALL_PROXY_ID + encoded.slice(2);
    },
    /**
     * Decode any assetData into its corresponding assetData object
     * @param assetData Hex encoded assetData string to decode
     * @return Either a ERC20, ERC20Bridge, ERC721, ERC1155, StaticCall, or MultiAsset assetData object
     */
    decodeAssetDataOrThrow(assetData) {
        const assetProxyId = utils_1.hexUtils.slice(assetData, 0, 4);
        const encodedData = '0x' + assetData.slice(10); // Remove proxy ID, keep encoded data
        switch (assetProxyId) {
            case types_1.AssetProxyId.ERC20: {
                const [tokenAddress] = abiCoder.decode(['address'], encodedData);
                return {
                    assetProxyId,
                    tokenAddress,
                };
            }
            case types_1.AssetProxyId.ERC20Bridge: {
                const [tokenAddress, bridgeAddress, bridgeData] = abiCoder.decode(['address', 'address', 'bytes'], encodedData);
                return {
                    assetProxyId,
                    tokenAddress,
                    bridgeAddress,
                    bridgeData,
                };
            }
            case types_1.AssetProxyId.ERC721: {
                const [tokenAddress, tokenId] = abiCoder.decode(['address', 'uint256'], encodedData);
                return {
                    assetProxyId,
                    tokenAddress,
                    tokenId: BigInt(tokenId),
                };
            }
            case types_1.AssetProxyId.ERC1155: {
                const [tokenAddress, tokenIds, tokenValues, callbackData] = abiCoder.decode(['address', 'uint256[]', 'uint256[]', 'bytes'], encodedData);
                return {
                    assetProxyId,
                    tokenAddress,
                    tokenIds: tokenIds.map((id) => BigInt(id)),
                    tokenValues: tokenValues.map((value) => BigInt(value)),
                    callbackData,
                };
            }
            case types_1.AssetProxyId.MultiAsset: {
                const [amounts, nestedAssetData] = abiCoder.decode(['uint256[]', 'bytes[]'], encodedData);
                const multiAssetData = {
                    assetProxyId,
                    amounts: amounts.map((amount) => BigInt(amount)),
                    nestedAssetData,
                };
                return multiAssetData;
            }
            case types_1.AssetProxyId.StaticCall: {
                const [callTarget, staticCallData, callResultHash] = abiCoder.decode(['address', 'bytes', 'bytes32'], encodedData);
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
    decodeMultiAssetDataRecursively(assetData) {
        const decodedAssetData = exports.assetDataUtils.decodeAssetDataOrThrow(assetData);
        if (decodedAssetData.assetProxyId !== types_1.AssetProxyId.MultiAsset) {
            throw new Error(`Not a MultiAssetData. Use 'decodeAssetDataOrThrow' instead`);
        }
        const amounts = [];
        const decodedNestedAssetData = decodedAssetData.nestedAssetData.map((nestedAssetDataElement, index) => {
            const decodedNestedAssetDataElement = exports.assetDataUtils.decodeAssetDataOrThrow(nestedAssetDataElement);
            if (decodedNestedAssetDataElement.assetProxyId === types_1.AssetProxyId.MultiAsset) {
                const recursivelyDecodedAssetData = exports.assetDataUtils.decodeMultiAssetDataRecursively(nestedAssetDataElement);
                amounts.push(recursivelyDecodedAssetData.amounts.map(amountElement => amountElement * decodedAssetData.amounts[index]));
                return recursivelyDecodedAssetData.nestedAssetData;
            }
            else {
                amounts.push(decodedAssetData.amounts[index]);
                return decodedNestedAssetDataElement;
            }
        });
        const flattenedAmounts = _.flattenDeep(amounts);
        const flattenedDecodedNestedAssetData = _.flattenDeep(decodedNestedAssetData);
        return {
            assetProxyId: decodedAssetData.assetProxyId,
            amounts: flattenedAmounts,
            nestedAssetData: flattenedDecodedNestedAssetData,
        };
    },
    isERC20TokenAssetData(assetData) {
        return assetData.assetProxyId === types_1.AssetProxyId.ERC20;
    },
    isERC20BridgeAssetData(assetData) {
        return assetData.assetProxyId === types_1.AssetProxyId.ERC20Bridge;
    },
    isERC1155TokenAssetData(assetData) {
        return assetData.assetProxyId === types_1.AssetProxyId.ERC1155;
    },
    isERC721TokenAssetData(assetData) {
        return assetData.assetProxyId === types_1.AssetProxyId.ERC721;
    },
    isMultiAssetData(assetData) {
        return assetData.assetProxyId === types_1.AssetProxyId.MultiAsset;
    },
    isStaticCallAssetData(assetData) {
        return assetData.assetProxyId === types_1.AssetProxyId.StaticCall;
    },
};
