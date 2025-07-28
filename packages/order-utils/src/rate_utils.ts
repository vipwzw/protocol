import { schemas } from '@0x/json-schemas';
import { Order } from '@0x/types';
// BigNumber 已替换为 bigint

import { assert } from './assert';
import { constants } from './constants';

export const rateUtils = {
    /**
     * Takes an order and calculates the fee adjusted rate (takerAsset/makerAsset) by calculating how much takerAsset
     * is required to cover the fees (feeRate * takerFee), adding the takerAssetAmount and dividing by makerAssetAmount
     * @param   order       An object that conforms to the order interface
     * @param   feeRate     The market rate of ZRX denominated in takerAssetAmount
     *                      (ex. feeRate is 0.1 takerAsset/ZRX if it takes 1 unit of takerAsset to buy 10 ZRX)
     *                      Defaults to 0
     * @return  The rate (takerAsset/makerAsset) of the order adjusted for fees
     */
    getFeeAdjustedRateOfOrder(order: Order, feeRate: bigint = constants.ZERO_AMOUNT): bigint {
        assert.doesConformToSchema('order', order, schemas.orderSchema);
        assert.isBigNumber('feeRate', feeRate);
        if (feeRate < constants.ZERO_AMOUNT) {
            throw new Error(`Expected feeRate: ${feeRate} to be greater than or equal to 0`);
        }
        const takerAssetAmountNeededToPayForFees = order.takerFee * feeRate;
        const totalTakerAssetAmount = takerAssetAmountNeededToPayForFees + order.takerAssetAmount;
        const rate = totalTakerAssetAmount / order.makerAssetAmount;
        return rate;
    },
    /**
     * Takes a fee order (makerAssetData corresponds to ZRX and takerAssetData corresponds to WETH) and calculates
     * the fee adjusted rate (WETH/ZRX) by dividing the takerAssetAmount by the makerAmount minus the takerFee
     * @param   feeOrder    An object that conforms to the order interface
     * @return  The rate (WETH/ZRX) of the fee order adjusted for fees
     */
    getFeeAdjustedRateOfFeeOrder(feeOrder: Order): bigint {
        assert.doesConformToSchema('feeOrder', feeOrder, schemas.orderSchema);
        const zrxAmountAfterFees = feeOrder.makerAssetAmount - feeOrder.takerFee;
        if (zrxAmountAfterFees <= constants.ZERO_AMOUNT) {
            throw new Error(
                `Expected takerFee: ${JSON.stringify(feeOrder.takerFee)} to be less than makerAssetAmount: ${JSON.stringify(
                    feeOrder.makerAssetAmount,
                )}`
            );
        }
        const rate = feeOrder.takerAssetAmount / zrxAmountAfterFees;
        return rate;
    },
};
