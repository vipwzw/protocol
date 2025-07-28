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
const contract_wrappers_1 = require("@0x/contract-wrappers");
const types_1 = require("@0x/types");
const utils_1 = require("@0x/utils");
const _ = __importStar(require("lodash"));
const fakeProvider = { isEIP1193: true };
const assetDataEncoder = new contract_wrappers_1.IAssetDataContract(utils_1.NULL_ADDRESS, fakeProvider);
exports.assetDataUtils = {
    encodeERC20AssetData(tokenAddress) {
        return assetDataEncoder.ERC20Token(tokenAddress).getABIEncodedTransactionData();
    },
    encodeERC20BridgeAssetData(tokenAddress, bridgeAddress, bridgeData) {
        return assetDataEncoder.ERC20Bridge(tokenAddress, bridgeAddress, bridgeData).getABIEncodedTransactionData();
    },
    encodeERC721AssetData(tokenAddress, tokenId) {
        return assetDataEncoder.ERC721Token(tokenAddress, tokenId).getABIEncodedTransactionData();
    },
    encodeERC1155AssetData(tokenAddress, tokenIds, tokenValues, callbackData) {
        return assetDataEncoder
            .ERC1155Assets(tokenAddress, tokenIds, tokenValues, callbackData)
            .getABIEncodedTransactionData();
    },
    encodeMultiAssetData(values, nestedAssetData) {
        return assetDataEncoder.MultiAsset(values, nestedAssetData).getABIEncodedTransactionData();
    },
    encodeStaticCallAssetData(staticCallTargetAddress, staticCallData, expectedReturnDataHash) {
        return assetDataEncoder
            .StaticCall(staticCallTargetAddress, staticCallData, expectedReturnDataHash)
            .getABIEncodedTransactionData();
    },
    /**
     * Decode any assetData into its corresponding assetData object
     * @param assetData Hex encoded assetData string to decode
     * @return Either a ERC20, ERC20Bridge, ERC721, ERC1155, StaticCall, or MultiAsset assetData object
     */
    decodeAssetDataOrThrow(assetData) {
        const assetProxyId = utils_1.hexUtils.slice(assetData, 0, 4); // tslint:disable-line:custom-no-magic-numbers
        switch (assetProxyId) {
            case types_1.AssetProxyId.ERC20: {
                const tokenAddress = assetDataEncoder.getABIDecodedTransactionData('ERC20Token', assetData);
                return {
                    assetProxyId,
                    tokenAddress,
                };
            }
            case types_1.AssetProxyId.ERC20Bridge: {
                const [tokenAddress, bridgeAddress, bridgeData] = assetDataEncoder.getABIDecodedTransactionData('ERC20Bridge', assetData);
                return {
                    assetProxyId,
                    tokenAddress,
                    bridgeAddress,
                    bridgeData,
                };
            }
            case types_1.AssetProxyId.ERC721: {
                const [tokenAddress, tokenId] = assetDataEncoder.getABIDecodedTransactionData('ERC721Token', assetData);
                return {
                    assetProxyId,
                    tokenAddress,
                    tokenId,
                };
            }
            case types_1.AssetProxyId.ERC1155: {
                const [tokenAddress, tokenIds, tokenValues, callbackData,] = assetDataEncoder.getABIDecodedTransactionData('ERC1155Assets', assetData);
                return {
                    assetProxyId,
                    tokenAddress,
                    tokenIds,
                    tokenValues,
                    callbackData,
                };
            }
            case types_1.AssetProxyId.MultiAsset: {
                const [amounts, nestedAssetData] = assetDataEncoder.getABIDecodedTransactionData('MultiAsset', assetData);
                const multiAssetData = {
                    assetProxyId,
                    amounts,
                    nestedAssetData,
                };
                return multiAssetData;
            }
            case types_1.AssetProxyId.StaticCall:
                const [callTarget, staticCallData, callResultHash] = assetDataEncoder.getABIDecodedTransactionData('StaticCall', assetData);
                return {
                    assetProxyId,
                    callTarget,
                    staticCallData,
                    callResultHash,
                };
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
        const decodedAssetData = exports.assetDataUtils.decodeAssetDataOrThrow(assetData); // tslint:disable-line:no-unnecessary-type-assertion
        if (decodedAssetData.assetProxyId !== types_1.AssetProxyId.MultiAsset) {
            throw new Error(`Not a MultiAssetData. Use 'decodeAssetDataOrThrow' instead`);
        }
        const amounts = [];
        const decodedNestedAssetData = decodedAssetData.nestedAssetData.map((nestedAssetDataElement, index) => {
            const decodedNestedAssetDataElement = exports.assetDataUtils.decodeAssetDataOrThrow(nestedAssetDataElement);
            if (decodedNestedAssetDataElement.assetProxyId === types_1.AssetProxyId.MultiAsset) {
                const recursivelyDecodedAssetData = exports.assetDataUtils.decodeMultiAssetDataRecursively(nestedAssetDataElement);
                amounts.push(recursivelyDecodedAssetData.amounts.map(amountElement => amountElement.times(decodedAssetData.amounts[index])));
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
            // tslint:disable-next-line:no-unnecessary-type-assertion
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
//# sourceMappingURL=asset_data_utils.js.map