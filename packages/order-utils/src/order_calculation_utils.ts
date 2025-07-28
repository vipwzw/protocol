import { Order } from '@0x/types';
// BigNumber 已替换为 bigint

import { constants } from './constants';

export const orderCalculationUtils = {
    /**
     * Determines if the order is expired given the current time
     * @param order The order for expiry calculation
     */
    isOrderExpired(order: Order): boolean {
        return orderCalculationUtils.willOrderExpire(order, 0);
    },
    /**
     * Calculates if the order will expire in the future.
     * @param order The order for expiry calculation
     * @param secondsFromNow The amount of seconds from current time
     */
    willOrderExpire(order: Order, secondsFromNow: number): boolean {
        const millisecondsInSecond = 1000;
        const currentUnixTimestampSec = BigInt(Math.floor(Date.now() / millisecondsInSecond));
        return order.expirationTimeSeconds < (currentUnixTimestampSec + BigInt(secondsFromNow));
    },
    /**
     * Determines if the order is open and fillable by any taker.
     * @param order The order
     */
    isOpenOrder(order: Order): boolean {
        return order.takerAddress === constants.NULL_ADDRESS;
    },
    /**
     * Given an amount of taker asset, calculate the the amount of maker asset
     * @param order The order
     * @param makerFillAmount the amount of taker asset
     */
    getMakerFillAmount(order: Order, takerFillAmount: bigint): bigint {
        // Round down because exchange rate favors Maker
        const makerFillAmount = (takerFillAmount * order.makerAssetAmount) / order.takerAssetAmount;
        return makerFillAmount;
    },
    /**
     * Given an amount of maker asset, calculate the equivalent amount in taker asset
     * @param order The order
     * @param makerFillAmount the amount of maker asset
     */
    getTakerFillAmount(order: Order, makerFillAmount: bigint): bigint {
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
    getTakerFeeAmount(order: Order, takerFillAmount: bigint): bigint {
        // Round down because Taker fee rate favors Taker
        const takerFeeAmount = (takerFillAmount * order.takerFee) / order.takerAssetAmount;
        return takerFeeAmount;
    },
    /**
     * Given an amount of maker asset, calculate the fee amount required for the maker
     * @param order The order
     * @param makerFillAmount the amount of maker asset
     */
    getMakerFeeAmount(order: Order, makerFillAmount: bigint): bigint {
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
    getTakerFillAmountForFeeOrder(order: Order, makerFillAmount: bigint): [bigint, bigint] {
        // For each unit of TakerAsset we buy (MakerAsset - TakerFee)
        // 使用 bigint 进行计算，向上取整
        const numerator = makerFillAmount * order.takerAssetAmount;
        const denominator = order.makerAssetAmount - order.takerFee;
        const adjustedTakerFillAmount = (numerator + denominator - 1n) / denominator; // 向上取整
        // The amount that we buy will be greater than makerFillAmount, since we buy some amount for fees.
        const adjustedMakerFillAmount = orderCalculationUtils.getMakerFillAmount(order, adjustedTakerFillAmount);
        return [adjustedTakerFillAmount, adjustedMakerFillAmount];
    },
};
