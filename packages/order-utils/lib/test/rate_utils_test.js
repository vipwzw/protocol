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
const chai = __importStar(require("chai"));
require("mocha");
const src_1 = require("../src");
const chai_setup_1 = require("./utils/chai_setup");
const test_order_factory_1 = require("./utils/test_order_factory");
chai_setup_1.chaiSetup.configure();
const expect = chai.expect;
describe('rateUtils', () => {
    const testOrder = test_order_factory_1.testOrderFactory.generateTestSignedOrder({
        makerAssetAmount: BigInt(100),
        takerAssetAmount: BigInt(100),
        takerFee: BigInt(20),
    });
    describe('#getFeeAdjustedRateOfOrder', () => {
        it('throws when feeRate is less than zero', async () => {
            const feeRate = BigInt(-1);
            expect(() => src_1.rateUtils.getFeeAdjustedRateOfOrder(testOrder, feeRate)).to.throw('Expected feeRate: -1 to be greater than or equal to 0');
        });
        it('correctly calculates fee adjusted rate when feeRate is provided', async () => {
            const feeRate = BigInt(2); // ZRX costs 2 units of takerAsset per 1 unit of ZRX
            const feeAdjustedRate = src_1.rateUtils.getFeeAdjustedRateOfOrder(testOrder, feeRate);
            // the order actually takes 100 + (2 * 20) = 140 takerAsset units to fill 100 units of makerAsset
            // rate = 140 / 100 = 1 (bigint 整数除法)
            expect(feeAdjustedRate).to.equal(1n);
        });
        it('correctly calculates fee adjusted rate when no feeRate is provided', async () => {
            const feeAdjustedRate = src_1.rateUtils.getFeeAdjustedRateOfOrder(testOrder);
            // because no feeRate was provided we just assume 0 fees
            // the order actually takes 100 takerAsset units to fill 100 units of makerAsset
            expect(feeAdjustedRate).to.equal(BigInt(1));
        });
    });
    describe('#getFeeAdjustedRateOfFeeOrder', () => {
        it('throws when takerFee exceeds makerAssetAmount', async () => {
            const badOrder = test_order_factory_1.testOrderFactory.generateTestSignedOrder({
                makerAssetAmount: BigInt(100),
                takerFee: BigInt(101),
            });
            expect(() => src_1.rateUtils.getFeeAdjustedRateOfFeeOrder(badOrder)).to.throw('Expected takerFee: "101" to be less than makerAssetAmount: "100"');
        });
        it('correctly calculates fee adjusted rate', async () => {
            const feeAdjustedRate = src_1.rateUtils.getFeeAdjustedRateOfFeeOrder(testOrder);
            // the order actually takes 100 takerAsset units to fill (100 - 20) = 80 units of makerAsset
            // rate = 100 / 80 = 1 (bigint 整数除法，1.25 向下取整为 1)
            expect(feeAdjustedRate).to.equal(1n);
        });
    });
});
