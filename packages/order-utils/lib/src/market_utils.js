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
exports.marketUtils = void 0;
const json_schemas_1 = require("@0x/json-schemas");
const types_1 = require("@0x/types");
// BigNumber 已替换为 bigint
const _ = __importStar(require("lodash"));
const assert_1 = require("./assert");
const constants_1 = require("./constants");
exports.marketUtils = {
    findOrdersThatCoverTakerAssetFillAmount(orders, takerAssetFillAmount, opts) {
        return findOrdersThatCoverAssetFillAmount(orders, takerAssetFillAmount, types_1.MarketOperation.Sell, opts);
    },
    /**
     * Takes an array of orders and returns a subset of those orders that has enough makerAssetAmount
     * in order to fill the input makerAssetFillAmount plus slippageBufferAmount. Iterates from first order to last order.
     * Sort the input by ascending rate in order to get the subset of orders that will cost the least ETH.
     * @param   orders                      An array of objects that extend the Order interface. All orders should specify the same makerAsset.
     *                                      All orders should specify WETH as the takerAsset.
     * @param   makerAssetFillAmount        The amount of makerAsset desired to be filled.
     * @param   opts                        Optional arguments this function accepts.
     * @return  Resulting orders and remaining fill amount that could not be covered by the input.
     */
    findOrdersThatCoverMakerAssetFillAmount(orders, makerAssetFillAmount, opts) {
        return findOrdersThatCoverAssetFillAmount(orders, makerAssetFillAmount, types_1.MarketOperation.Buy, opts);
    },
    /**
     * Takes an array of orders and an array of feeOrders. Returns a subset of the feeOrders that has enough ZRX
     * in order to fill the takerFees required by orders plus a slippageBufferAmount.
     * Iterates from first feeOrder to last. Sort the feeOrders by ascending rate in order to get the subset of
     * feeOrders that will cost the least ETH.
     * @param   orders      An array of objects that extend the Order interface. All orders should specify ZRX as
     *                      the makerAsset and WETH as the takerAsset.
     * @param   feeOrders   An array of objects that extend the Order interface. All orders should specify ZRX as
     *                      the makerAsset and WETH as the takerAsset.
     * @param   opts        Optional arguments this function accepts.
     * @return  Resulting orders and remaining fee amount that could not be covered by the input.
     */
    findFeeOrdersThatCoverFeesForTargetOrders(orders, feeOrders, opts) {
        assert_1.assert.doesConformToSchema('orders', orders, json_schemas_1.schemas.ordersSchema);
        assert_1.assert.doesConformToSchema('feeOrders', feeOrders, json_schemas_1.schemas.ordersSchema);
        // try to get remainingFillableMakerAssetAmounts from opts, if it's not there, use makerAssetAmount values from orders
        const remainingFillableMakerAssetAmounts = _.get(opts, 'remainingFillableMakerAssetAmounts', _.map(orders, order => order.makerAssetAmount));
        _.forEach(remainingFillableMakerAssetAmounts, (amount, index) => assert_1.assert.isValidBaseUnitAmount(`remainingFillableMakerAssetAmount[${index}]`, amount));
        if (orders.length !== remainingFillableMakerAssetAmounts.length) {
            throw new Error('Expected orders.length to equal opts.remainingFillableMakerAssetAmounts.length');
        }
        // try to get remainingFillableFeeAmounts from opts, if it's not there, use makerAssetAmount values from feeOrders
        const remainingFillableFeeAmounts = _.get(opts, 'remainingFillableFeeAmounts', _.map(feeOrders, order => order.makerAssetAmount));
        _.forEach(remainingFillableFeeAmounts, (amount, index) => assert_1.assert.isValidBaseUnitAmount(`remainingFillableFeeAmounts[${index}]`, amount));
        if (feeOrders.length !== remainingFillableFeeAmounts.length) {
            throw new Error('Expected feeOrders.length to equal opts.remainingFillableFeeAmounts.length');
        }
        // try to get slippageBufferAmount from opts, if it's not there, default to 0
        const slippageBufferAmount = _.get(opts, 'slippageBufferAmount', constants_1.constants.ZERO_AMOUNT);
        assert_1.assert.isValidBaseUnitAmount('opts.slippageBufferAmount', slippageBufferAmount);
        // calculate total amount of ZRX needed to fill orders
        const totalFeeAmount = _.reduce(orders, (accFees, order, index) => {
            const makerAssetAmountAvailable = remainingFillableMakerAssetAmounts[index];
            const feeToFillMakerAssetAmountAvailable = (makerAssetAmountAvailable * order.takerFee) / order.makerAssetAmount;
            return accFees + feeToFillMakerAssetAmountAvailable;
        }, constants_1.constants.ZERO_AMOUNT);
        const { resultOrders, remainingFillAmount, ordersRemainingFillableMakerAssetAmounts, } = exports.marketUtils.findOrdersThatCoverMakerAssetFillAmount(feeOrders, totalFeeAmount, {
            remainingFillableMakerAssetAmounts: remainingFillableFeeAmounts,
            slippageBufferAmount,
        });
        return {
            resultFeeOrders: resultOrders,
            remainingFeeAmount: remainingFillAmount,
            feeOrdersRemainingFillableMakerAssetAmounts: ordersRemainingFillableMakerAssetAmounts,
        };
        // TODO: add more orders here to cover rounding
        // https://github.com/0xProject/0x-protocol-specification/blob/master/v2/forwarding-contract-specification.md#over-buying-zrx
    },
};
function findOrdersThatCoverAssetFillAmount(orders, assetFillAmount, operation, opts) {
    const variablePrefix = operation === types_1.MarketOperation.Buy ? 'Maker' : 'Taker';
    assert_1.assert.doesConformToSchema('orders', orders, json_schemas_1.schemas.ordersSchema);
    assert_1.assert.isValidBaseUnitAmount('assetFillAmount', assetFillAmount);
    // try to get remainingFillableTakerAssetAmounts from opts, if it's not there, use takerAssetAmount values from orders
    const remainingFillableAssetAmounts = _.get(opts, `remainingFillable${variablePrefix}AssetAmounts`, _.map(orders, order => (operation === types_1.MarketOperation.Buy ? order.makerAssetAmount : order.takerAssetAmount)));
    _.forEach(remainingFillableAssetAmounts, (amount, index) => assert_1.assert.isValidBaseUnitAmount(`remainingFillable${variablePrefix}AssetAmount[${index}]`, amount));
    if (orders.length !== remainingFillableAssetAmounts.length) {
        throw new Error(`Expected orders.length to equal opts.remainingFillable${variablePrefix}AssetAmounts.length`);
    }
    // try to get slippageBufferAmount from opts, if it's not there, default to 0
    const slippageBufferAmount = _.get(opts, 'slippageBufferAmount', constants_1.constants.ZERO_AMOUNT);
    assert_1.assert.isValidBaseUnitAmount('opts.slippageBufferAmount', slippageBufferAmount);
    // calculate total amount of asset needed to be filled
    const totalFillAmount = assetFillAmount + slippageBufferAmount;
    // iterate through the orders input from left to right until we have enough makerAsset to fill totalFillAmount
    const result = _.reduce(orders, ({ resultOrders, remainingFillAmount, ordersRemainingFillableAssetAmounts }, order, index) => {
        if (remainingFillAmount <= constants_1.constants.ZERO_AMOUNT) {
            return {
                resultOrders,
                remainingFillAmount: constants_1.constants.ZERO_AMOUNT,
                ordersRemainingFillableAssetAmounts,
            };
        }
        else {
            const assetAmountAvailable = remainingFillableAssetAmounts[index];
            const shouldIncludeOrder = assetAmountAvailable > constants_1.constants.ZERO_AMOUNT;
            // if there is no assetAmountAvailable do not append order to resultOrders
            // if we have exceeded the total amount we want to fill set remainingFillAmount to 0
            const newRemainingAmount = remainingFillAmount - assetAmountAvailable;
            return {
                resultOrders: shouldIncludeOrder ? _.concat(resultOrders, order) : resultOrders,
                ordersRemainingFillableAssetAmounts: shouldIncludeOrder
                    ? _.concat(ordersRemainingFillableAssetAmounts, assetAmountAvailable)
                    : ordersRemainingFillableAssetAmounts,
                remainingFillAmount: newRemainingAmount > constants_1.constants.ZERO_AMOUNT ? newRemainingAmount : constants_1.constants.ZERO_AMOUNT,
            };
        }
    }, {
        resultOrders: [],
        remainingFillAmount: totalFillAmount,
        ordersRemainingFillableAssetAmounts: [],
    });
    const { ordersRemainingFillableAssetAmounts: resultOrdersRemainingFillableAssetAmounts, 
    // tslint:disable-next-line: trailing-comma
    ...ordersAndRemainingFillAmount } = result;
    if (operation === types_1.MarketOperation.Buy) {
        return {
            ...ordersAndRemainingFillAmount,
            ordersRemainingFillableMakerAssetAmounts: resultOrdersRemainingFillableAssetAmounts,
        };
    }
    else {
        return {
            ...ordersAndRemainingFillAmount,
            ordersRemainingFillableTakerAssetAmounts: resultOrdersRemainingFillableAssetAmounts,
        };
    }
}
