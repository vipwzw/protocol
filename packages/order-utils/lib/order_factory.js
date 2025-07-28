"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderFactory = void 0;
const utils_1 = require("@0x/utils");
const constants_1 = require("./constants");
const order_hash_utils_1 = require("./order_hash_utils");
const salt_1 = require("./salt");
const signature_utils_1 = require("./signature_utils");
exports.orderFactory = {
    createOrderFromPartial(partialOrder) {
        const chainId = getChainIdFromPartial(partialOrder);
        const defaultOrder = generateEmptyOrder(chainId);
        return {
            ...defaultOrder,
            ...partialOrder,
        };
    },
    createSignedOrderFromPartial(partialSignedOrder) {
        const chainId = getChainIdFromPartial(partialSignedOrder);
        const defaultOrder = generateEmptySignedOrder(chainId);
        return {
            ...defaultOrder,
            ...partialSignedOrder,
        };
    },
    createOrder(makerAddress, makerAssetAmount, makerAssetData, takerAssetAmount, takerAssetData, exchangeAddress, chainId, createOrderOpts = generateDefaultCreateOrderOpts()) {
        const defaultCreateOrderOpts = generateDefaultCreateOrderOpts();
        const order = {
            makerAddress,
            makerAssetAmount,
            takerAssetAmount,
            makerAssetData,
            takerAssetData,
            makerFeeAssetData: createOrderOpts.makerFeeAssetData || makerAssetData,
            takerFeeAssetData: createOrderOpts.takerFeeAssetData || takerAssetData,
            takerAddress: createOrderOpts.takerAddress || defaultCreateOrderOpts.takerAddress,
            senderAddress: createOrderOpts.senderAddress || defaultCreateOrderOpts.senderAddress,
            makerFee: createOrderOpts.makerFee || defaultCreateOrderOpts.makerFee,
            takerFee: createOrderOpts.takerFee || defaultCreateOrderOpts.takerFee,
            feeRecipientAddress: createOrderOpts.feeRecipientAddress || defaultCreateOrderOpts.feeRecipientAddress,
            salt: createOrderOpts.salt || defaultCreateOrderOpts.salt,
            expirationTimeSeconds: createOrderOpts.expirationTimeSeconds || defaultCreateOrderOpts.expirationTimeSeconds,
            exchangeAddress,
            chainId,
        };
        return order;
    },
    async createSignedOrderAsync(supportedProvider, makerAddress, makerAssetAmount, makerAssetData, takerAssetAmount, takerAssetData, exchangeAddress, createOrderOpts) {
        const order = exports.orderFactory.createOrder(makerAddress, makerAssetAmount, makerAssetData, takerAssetAmount, takerAssetData, exchangeAddress, await utils_1.providerUtils.getChainIdAsync(supportedProvider), createOrderOpts);
        const orderHash = order_hash_utils_1.orderHashUtils.getOrderHash(order);
        const signature = await signature_utils_1.signatureUtils.ecSignHashAsync(supportedProvider, orderHash, makerAddress);
        const signedOrder = { ...order, signature };
        return signedOrder;
    },
};
function getChainIdFromPartial(partialOrder) {
    const chainId = partialOrder.chainId;
    if (chainId === undefined || !Number.isInteger(chainId)) {
        throw new Error('chainId must be valid');
    }
    return chainId;
}
function generateEmptySignedOrder(chainId) {
    return {
        ...generateEmptyOrder(chainId),
        signature: constants_1.constants.NULL_BYTES,
    };
}
function generateEmptyOrder(chainId) {
    return {
        senderAddress: constants_1.constants.NULL_ADDRESS,
        makerAddress: constants_1.constants.NULL_ADDRESS,
        takerAddress: constants_1.constants.NULL_ADDRESS,
        makerFee: constants_1.constants.ZERO_AMOUNT,
        takerFee: constants_1.constants.ZERO_AMOUNT,
        makerAssetAmount: constants_1.constants.ZERO_AMOUNT,
        takerAssetAmount: constants_1.constants.ZERO_AMOUNT,
        makerAssetData: constants_1.constants.NULL_BYTES,
        takerAssetData: constants_1.constants.NULL_BYTES,
        makerFeeAssetData: constants_1.constants.NULL_BYTES,
        takerFeeAssetData: constants_1.constants.NULL_BYTES,
        salt: (0, salt_1.generatePseudoRandomSalt)(),
        feeRecipientAddress: constants_1.constants.NULL_ADDRESS,
        expirationTimeSeconds: constants_1.constants.INFINITE_TIMESTAMP_SEC,
        exchangeAddress: constants_1.constants.NULL_ADDRESS,
        chainId,
    };
}
function generateDefaultCreateOrderOpts() {
    return {
        takerAddress: constants_1.constants.NULL_ADDRESS,
        senderAddress: constants_1.constants.NULL_ADDRESS,
        makerFee: constants_1.constants.ZERO_AMOUNT,
        takerFee: constants_1.constants.ZERO_AMOUNT,
        feeRecipientAddress: constants_1.constants.NULL_ADDRESS,
        salt: (0, salt_1.generatePseudoRandomSalt)(),
        expirationTimeSeconds: constants_1.constants.INFINITE_TIMESTAMP_SEC,
    };
}
