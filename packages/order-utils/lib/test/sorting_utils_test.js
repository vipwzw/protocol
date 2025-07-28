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
const utils_1 = require("@0x/utils");
const chai = __importStar(require("chai"));
require("mocha");
const src_1 = require("../src");
const chai_setup_1 = require("./utils/chai_setup");
const test_order_factory_1 = require("./utils/test_order_factory");
chai_setup_1.chaiSetup.configure();
const expect = chai.expect;
describe('sortingUtils', () => {
    describe('#sortOrdersByFeeAdjustedRate', () => {
        const feeRate = new utils_1.BigNumber(1); // ZRX costs 1 unit of takerAsset per 1 unit of ZRX
        // rate: 2 takerAsset / makerAsset
        const testOrder1 = test_order_factory_1.testOrderFactory.generateTestSignedOrder({
            makerAssetAmount: new utils_1.BigNumber(100),
            takerAssetAmount: new utils_1.BigNumber(200),
        });
        // rate: 1 takerAsset / makerAsset
        const testOrder2 = test_order_factory_1.testOrderFactory.generateTestSignedOrder({
            makerAssetAmount: new utils_1.BigNumber(100),
            takerAssetAmount: new utils_1.BigNumber(100),
        });
        // rate: 2.5 takerAsset / makerAsset
        const testOrder3 = test_order_factory_1.testOrderFactory.generateTestSignedOrder({
            makerAssetAmount: new utils_1.BigNumber(100),
            takerAssetAmount: new utils_1.BigNumber(200),
            takerFee: new utils_1.BigNumber(50),
        });
        it('correctly sorts by fee adjusted rate when feeRate is Provided', async () => {
            const orders = [testOrder1, testOrder2, testOrder3];
            const sortedOrders = src_1.sortingUtils.sortOrdersByFeeAdjustedRate(orders, feeRate);
            expect(sortedOrders).to.deep.equal([testOrder2, testOrder1, testOrder3]);
        });
        it('correctly sorts by fee adjusted rate when no feeRate is Provided', async () => {
            const orders = [testOrder1, testOrder2, testOrder3];
            const sortedOrders = src_1.sortingUtils.sortOrdersByFeeAdjustedRate(orders);
            expect(sortedOrders).to.deep.equal([testOrder2, testOrder1, testOrder3]);
        });
    });
    describe('#sortFeeOrdersByFeeAdjustedRate', () => {
        // rate: 200 takerAsset / makerAsset
        const testOrder1 = test_order_factory_1.testOrderFactory.generateTestSignedOrder({
            makerAssetAmount: new utils_1.BigNumber(100),
            takerAssetAmount: new utils_1.BigNumber(200),
            takerFee: new utils_1.BigNumber(99),
        });
        // rate: 1 takerAsset / makerAsset
        const testOrder2 = test_order_factory_1.testOrderFactory.generateTestSignedOrder({
            makerAssetAmount: new utils_1.BigNumber(100),
            takerAssetAmount: new utils_1.BigNumber(100),
        });
        // rate: 4 takerAsset / makerAsset
        const testOrder3 = test_order_factory_1.testOrderFactory.generateTestSignedOrder({
            makerAssetAmount: new utils_1.BigNumber(100),
            takerAssetAmount: new utils_1.BigNumber(200),
            takerFee: new utils_1.BigNumber(50),
        });
        it('correctly sorts by fee adjusted rate', async () => {
            const orders = [testOrder1, testOrder2, testOrder3];
            const sortedOrders = src_1.sortingUtils.sortFeeOrdersByFeeAdjustedRate(orders);
            expect(sortedOrders).to.deep.equal([testOrder2, testOrder3, testOrder1]);
        });
    });
});
//# sourceMappingURL=sorting_utils_test.js.map