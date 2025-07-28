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
exports.sortingUtils = void 0;
const json_schemas_1 = require("@0x/json-schemas");
const _ = __importStar(require("lodash"));
const assert_1 = require("./assert");
const constants_1 = require("./constants");
const rate_utils_1 = require("./rate_utils");
exports.sortingUtils = {
    /**
     * Takes an array of orders and sorts them by takerAsset/makerAsset rate in ascending order (best rate first).
     * Adjusts the rate of each order according to the feeRate and takerFee for that order.
     * @param   orders      An array of objects that extend the Order interface. All orders should specify ZRX as
     *                      the makerAsset and WETH as the takerAsset.
     * @param   feeRate     The market rate of ZRX denominated in takerAssetAmount
     *                      (ex. feeRate is 0.1 takerAsset/ZRX if it takes 1 unit of takerAsset to buy 10 ZRX)
     *                      Defaults to 0
     * @return  The input orders sorted by rate in ascending order
     */
    sortOrdersByFeeAdjustedRate(orders, feeRate = constants_1.constants.ZERO_AMOUNT) {
        assert_1.assert.doesConformToSchema('orders', orders, json_schemas_1.schemas.ordersSchema);
        assert_1.assert.isBigNumber('feeRate', feeRate);
        const rateCalculator = (order) => rate_utils_1.rateUtils.getFeeAdjustedRateOfOrder(order, feeRate);
        const sortedOrders = sortOrders(orders, rateCalculator);
        return sortedOrders;
    },
    /**
     * Takes an array of fee orders (makerAssetData corresponds to ZRX and takerAssetData corresponds to WETH)
     * and sorts them by rate in ascending order (best rate first). Adjusts the rate according to the takerFee.
     * @param   feeOrders       An array of objects that extend the Order interface. All orders should specify ZRX as
     *                          the makerAsset and WETH as the takerAsset.
     * @return  The input orders sorted by rate in ascending order
     */
    sortFeeOrdersByFeeAdjustedRate(feeOrders) {
        assert_1.assert.doesConformToSchema('feeOrders', feeOrders, json_schemas_1.schemas.ordersSchema);
        const rateCalculator = rate_utils_1.rateUtils.getFeeAdjustedRateOfFeeOrder.bind(rate_utils_1.rateUtils);
        const sortedOrders = sortOrders(feeOrders, rateCalculator);
        return sortedOrders;
    },
};
// takes an array of orders, copies them, and sorts the copy based on the rate definition provided by rateCalculator
function sortOrders(orders, rateCalculator) {
    const copiedOrders = _.cloneDeep(orders);
    copiedOrders.sort((firstOrder, secondOrder) => {
        const firstOrderRate = rateCalculator(firstOrder);
        const secondOrderRate = rateCalculator(secondOrder);
        return firstOrderRate.comparedTo(secondOrderRate);
    });
    return copiedOrders;
}
//# sourceMappingURL=sorting_utils.js.map