import * as chai from 'chai';
import 'mocha';

import { rateUtils } from '../src';

import { chaiSetup } from './utils/chai_setup';
import { testOrderFactory } from './utils/test_order_factory';

chaiSetup.configure();
const expect = chai.expect;

describe('rateUtils', () => {
    const testOrder = testOrderFactory.generateTestSignedOrder({
        makerAssetAmount: BigInt(100),
        takerAssetAmount: BigInt(100),
        takerFee: BigInt(20),
    });
    describe('#getFeeAdjustedRateOfOrder', () => {
        it('throws when feeRate is less than zero', async () => {
            const feeRate = BigInt(-1);
            expect(() => rateUtils.getFeeAdjustedRateOfOrder(testOrder, feeRate)).to.throw(
                'Expected feeRate: -1 to be greater than or equal to 0',
            );
        });
        it('correctly calculates fee adjusted rate when feeRate is provided', async () => {
            const feeRate = BigInt(2); // ZRX costs 2 units of takerAsset per 1 unit of ZRX
            const feeAdjustedRate = rateUtils.getFeeAdjustedRateOfOrder(testOrder, feeRate);
            // the order actually takes 100 + (2 * 20) = 140 takerAsset units to fill 100 units of makerAsset
            // rate = 140 / 100 = 1 (bigint 整数除法)
            expect(feeAdjustedRate).to.equal(1n);
        });
        it('correctly calculates fee adjusted rate when no feeRate is provided', async () => {
            const feeAdjustedRate = rateUtils.getFeeAdjustedRateOfOrder(testOrder);
            // because no feeRate was provided we just assume 0 fees
            // the order actually takes 100 takerAsset units to fill 100 units of makerAsset
            expect(feeAdjustedRate).to.equal(BigInt(1));
        });
    });
    describe('#getFeeAdjustedRateOfFeeOrder', () => {
        it('throws when takerFee exceeds makerAssetAmount', async () => {
            const badOrder = testOrderFactory.generateTestSignedOrder({
                makerAssetAmount: BigInt(100),
                takerFee: BigInt(101),
            });
            expect(() => rateUtils.getFeeAdjustedRateOfFeeOrder(badOrder)).to.throw(
                'Expected takerFee: "101" to be less than makerAssetAmount: "100"',
            );
        });
        it('correctly calculates fee adjusted rate', async () => {
            const feeAdjustedRate = rateUtils.getFeeAdjustedRateOfFeeOrder(testOrder);
            // the order actually takes 100 takerAsset units to fill (100 - 20) = 80 units of makerAsset
            // rate = 100 / 80 = 1 (bigint 整数除法，1.25 向下取整为 1)
            expect(feeAdjustedRate).to.equal(1n);
        });
    });
});
