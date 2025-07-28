"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderCalculationUtils = void 0;
// BigNumber 已替换为 bigint
const constants_1 = require("./constants");
exports.orderCalculationUtils = {
    /**
     * Determines if the order is expired given the current time
     * @param order The order for expiry calculation
     */
    isOrderExpired(order) {
        return exports.orderCalculationUtils.willOrderExpire(order, 0);
    },
    /**
     * Calculates if the order will expire in the future.
     * @param order The order for expiry calculation
     * @param secondsFromNow The amount of seconds from current time
     */
    willOrderExpire(order, secondsFromNow) {
        const millisecondsInSecond = 1000;
        const currentUnixTimestampSec = BigInt(Math.floor(Date.now() / millisecondsInSecond));
        return order.expirationTimeSeconds < (currentUnixTimestampSec + BigInt(secondsFromNow));
    },
    /**
     * Determines if the order is open and fillable by any taker.
     * @param order The order
     */
    isOpenOrder(order) {
        return order.takerAddress === constants_1.constants.NULL_ADDRESS;
    },
    /**
     * Given an amount of taker asset, calculate the the amount of maker asset
     * @param order The order
     * @param makerFillAmount the amount of taker asset
     */
    getMakerFillAmount(order, takerFillAmount) {
        // Round down because exchange rate favors Maker
        const makerFillAmount = (takerFillAmount * order.makerAssetAmount) / order.takerAssetAmount;
        return makerFillAmount;
    },
    /**
     * Given an amount of maker asset, calculate the equivalent amount in taker asset
     * @param order The order
     * @param makerFillAmount the amount of maker asset
     */
    getTakerFillAmount(order, makerFillAmount) {
        // Round up because exchange rate favors Maker
        const numerator = makerFillAmount * order.takerAssetAmount;
        const takerFillAmount = (numerator + order.makerAssetAmount - 1n) / order.makerAssetAmount; // 向上取整
        return takerFillAmount;
    },
    /**
     * Given an amount of taker asset, calculate the fee amount required for the taker
     * @param order The order
     * @param takerFillAmount the amount of taker asset
     */
    getTakerFeeAmount(order, takerFillAmount) {
        // Round down because Taker fee rate favors Taker
        const takerFeeAmount = (takerFillAmount * order.takerFee) / order.takerAssetAmount;
        return takerFeeAmount;
    },
    /**
     * Given an amount of maker asset, calculate the fee amount required for the maker
     * @param order The order
     * @param makerFillAmount the amount of maker asset
     */
    getMakerFeeAmount(order, makerFillAmount) {
        // Round down because Maker fee rate favors Maker
        const makerFeeAmount = (makerFillAmount * order.makerFee) / order.makerAssetAmount;
        return makerFeeAmount;
    },
    /**
     * Given a desired amount of ZRX from a fee order, calculate the amount of taker asset required to fill.
     * Also calculate how much ZRX needs to be purchased in order to fill the desired amount plus the taker fee amount
     * @param order The order
     * @param makerFillAmount the amount of maker asset
     */
    getTakerFillAmountForFeeOrder(order, makerFillAmount) {
        // For each unit of TakerAsset we buy (MakerAsset - TakerFee)
        // 使用 bigint 进行计算，向上取整
        const numerator = makerFillAmount * order.takerAssetAmount;
        const denominator = order.makerAssetAmount - order.takerFee;
        const adjustedTakerFillAmount = (numerator + denominator - 1n) / denominator; // 向上取整
        // The amount that we buy will be greater than makerFillAmount, since we buy some amount for fees.
        const adjustedMakerFillAmount = exports.orderCalculationUtils.getMakerFillAmount(order, adjustedTakerFillAmount);
        return [adjustedTakerFillAmount, adjustedMakerFillAmount];
    },
};
