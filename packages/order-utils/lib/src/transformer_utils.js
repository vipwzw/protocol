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
exports.positiveSlippageFeeTransformerDataEncoder = exports.affiliateFeeTransformerDataEncoder = exports.payTakerTransformerDataEncoder = exports.wethTransformerDataEncoder = exports.FillQuoteTransformerSide = exports.fillQuoteTransformerDataEncoder = void 0;
exports.encodeFillQuoteTransformerData = encodeFillQuoteTransformerData;
exports.decodeFillQuoteTransformerData = decodeFillQuoteTransformerData;
exports.encodeWethTransformerData = encodeWethTransformerData;
exports.decodeWethTransformerData = decodeWethTransformerData;
exports.encodePayTakerTransformerData = encodePayTakerTransformerData;
exports.decodePayTakerTransformerData = decodePayTakerTransformerData;
exports.encodeAffiliateFeeTransformerData = encodeAffiliateFeeTransformerData;
exports.decodeAffiliateFeeTransformerData = decodeAffiliateFeeTransformerData;
exports.encodePositiveSlippageFeeTransformerData = encodePositiveSlippageFeeTransformerData;
exports.decodePositiveSlippageFeeTransformerData = decodePositiveSlippageFeeTransformerData;
exports.findTransformerNonce = findTransformerNonce;
exports.getTransformerAddress = getTransformerAddress;
// 临时注释掉 AbiEncoder 导入，这个文件需要重构
// import { AbiEncoder } from '@0x/utils';
// 临时的 AbiEncoder 模拟对象
const AbiEncoder = {
    Method: class {
        constructor(abi) { }
        encode(values) { return '0x'; }
        getSignature() { return ''; }
    },
    create(dataItem) {
        return {
            encode: (values) => '0x',
            decode: (data) => ({}),
            getSignature: () => ''
        };
    }
};
const ethjs = __importStar(require("ethereumjs-util"));
const constants_1 = require("./constants");
const { NULL_ADDRESS } = constants_1.constants;
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
 */
exports.fillQuoteTransformerDataEncoder = AbiEncoder.create([
    {
        name: 'data',
        type: 'tuple',
        components: [
            { name: 'side', type: 'uint8' },
            { name: 'sellToken', type: 'address' },
            { name: 'buyToken', type: 'address' },
            {
                name: 'orders',
                type: 'tuple[]',
                components: ORDER_ABI_COMPONENTS,
            },
            { name: 'signatures', type: 'bytes[]' },
            { name: 'maxOrderFillAmounts', type: 'uint256[]' },
            { name: 'fillAmount', type: 'uint256' },
            { name: 'refundReceiver', type: 'address' },
            { name: 'rfqtTakerAddress', type: 'address' },
        ],
    },
]);
/**
 * Market operation for `FillQuoteTransformerData`.
 */
var FillQuoteTransformerSide;
(function (FillQuoteTransformerSide) {
    FillQuoteTransformerSide[FillQuoteTransformerSide["Sell"] = 0] = "Sell";
    FillQuoteTransformerSide[FillQuoteTransformerSide["Buy"] = 1] = "Buy";
})(FillQuoteTransformerSide || (exports.FillQuoteTransformerSide = FillQuoteTransformerSide = {}));
/**
 * ABI-encode a `FillQuoteTransformer.TransformData` type.
 */
function encodeFillQuoteTransformerData(data) {
    return exports.fillQuoteTransformerDataEncoder.encode([data]);
}
/**
 * ABI-decode a `FillQuoteTransformer.TransformData` type.
 */
function decodeFillQuoteTransformerData(encoded) {
    return exports.fillQuoteTransformerDataEncoder.decode(encoded).data;
}
/**
 * ABI encoder for `WethTransformer.TransformData`
 */
exports.wethTransformerDataEncoder = AbiEncoder.create([
    {
        name: 'data',
        type: 'tuple',
        components: [
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
    },
]);
/**
 * ABI-encode a `WethTransformer.TransformData` type.
 */
function encodeWethTransformerData(data) {
    return exports.wethTransformerDataEncoder.encode([data]);
}
/**
 * ABI-decode a `WethTransformer.TransformData` type.
 */
function decodeWethTransformerData(encoded) {
    return exports.wethTransformerDataEncoder.decode(encoded).data;
}
/**
 * ABI encoder for `PayTakerTransformer.TransformData`
 */
exports.payTakerTransformerDataEncoder = AbiEncoder.create([
    {
        name: 'data',
        type: 'tuple',
        components: [
            { name: 'tokens', type: 'address[]' },
            { name: 'amounts', type: 'uint256[]' },
        ],
    },
]);
/**
 * ABI-encode a `PayTakerTransformer.TransformData` type.
 */
function encodePayTakerTransformerData(data) {
    return exports.payTakerTransformerDataEncoder.encode([data]);
}
/**
 * ABI-decode a `PayTakerTransformer.TransformData` type.
 */
function decodePayTakerTransformerData(encoded) {
    return exports.payTakerTransformerDataEncoder.decode(encoded).data;
}
/**
 * ABI encoder for `affiliateFeetransformer.TransformData`
 */
exports.affiliateFeeTransformerDataEncoder = AbiEncoder.create({
    name: 'data',
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
});
/**
 * ABI-encode a `AffiliateFeeTransformer.TransformData` type.
 */
function encodeAffiliateFeeTransformerData(data) {
    return exports.affiliateFeeTransformerDataEncoder.encode(data);
}
/**
 * ABI-decode a `AffiliateFeeTransformer.TransformData` type.
 */
function decodeAffiliateFeeTransformerData(encoded) {
    return exports.affiliateFeeTransformerDataEncoder.decode(encoded);
}
/**
 * ABI encoder for `PositiveSlippageFeeTransformer.TransformData`
 */
exports.positiveSlippageFeeTransformerDataEncoder = AbiEncoder.create({
    name: 'data',
    type: 'tuple',
    components: [
        { name: 'token', type: 'address' },
        { name: 'bestCaseAmount', type: 'uint256' },
        { name: 'recipient', type: 'address' },
    ],
});
/**
 * ABI-encode a `PositiveSlippageFeeTransformer.TransformData` type.
 */
function encodePositiveSlippageFeeTransformerData(data) {
    return exports.positiveSlippageFeeTransformerDataEncoder.encode(data);
}
/**
 * ABI-decode a `PositiveSlippageFeeTransformer.TransformData` type.
 */
function decodePositiveSlippageFeeTransformerData(encoded) {
    return exports.positiveSlippageFeeTransformerDataEncoder.decode(encoded);
}
/**
 * Find the nonce for a transformer given its deployer.
 * If `deployer` is the null address, zero will always be returned.
 */
function findTransformerNonce(transformer, deployer = NULL_ADDRESS, maxGuesses = 1024) {
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
function getTransformerAddress(deployer, nonce) {
    return ethjs.bufferToHex(
    // tslint:disable-next-line: custom-no-magic-numbers
    ethjs.rlphash([deployer, nonce]).slice(12));
}
