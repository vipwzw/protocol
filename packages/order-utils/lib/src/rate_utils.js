"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateUtils = void 0;
const json_schemas_1 = require("@0x/json-schemas");
// BigNumber 已替换为 bigint
const assert_1 = require("./assert");
const constants_1 = require("./constants");
exports.rateUtils = {
    /**
     * Takes an order and calculates the fee adjusted rate (takerAsset/makerAsset) by calculating how much takerAsset
     * is required to cover the fees (feeRate * takerFee), adding the takerAssetAmount and dividing by makerAssetAmount
     * @param   order       An object that conforms to the order interface
     * @param   feeRate     The market rate of ZRX denominated in takerAssetAmount
     *                      (ex. feeRate is 0.1 takerAsset/ZRX if it takes 1 unit of takerAsset to buy 10 ZRX)
     *                      Defaults to 0
     * @return  The rate (takerAsset/makerAsset) of the order adjusted for fees
     */
    getFeeAdjustedRateOfOrder(order, feeRate = constants_1.constants.ZERO_AMOUNT) {
        assert_1.assert.doesConformToSchema('order', order, json_schemas_1.schemas.orderSchema);
        assert_1.assert.isBigNumber('feeRate', feeRate);
        if (feeRate < constants_1.constants.ZERO_AMOUNT) {
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
    getFeeAdjustedRateOfFeeOrder(feeOrder) {
        assert_1.assert.doesConformToSchema('feeOrder', feeOrder, json_schemas_1.schemas.orderSchema);
        const zrxAmountAfterFees = feeOrder.makerAssetAmount - feeOrder.takerFee;
        if (zrxAmountAfterFees <= constants_1.constants.ZERO_AMOUNT) {
            throw new Error(`Expected takerFee: "${feeOrder.takerFee}" to be less than makerAssetAmount: "${feeOrder.makerAssetAmount}"`);
        }
        const rate = feeOrder.takerAssetAmount / zrxAmountAfterFees;
        return rate;
    },
};
