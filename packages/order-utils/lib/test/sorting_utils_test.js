import * as chai from 'chai';
import 'mocha';

import { sortingUtils } from '../src';

import { chaiSetup } from './utils/chai_setup';
import { testOrderFactory } from './utils/test_order_factory';

chaiSetup.configure();
const expect = chai.expect;

describe('sortingUtils', () => {
    describe('#sortOrdersByFeeAdjustedRate', () => {
        const feeRate = BigInt(1); // ZRX costs 1 unit of takerAsset per 1 unit of ZRX
        // rate: 2 takerAsset / makerAsset
        const testOrder1 = testOrderFactory.generateTestSignedOrder({
            makerAssetAmount: BigInt(100),
            takerAssetAmount: BigInt(200),
        });
        // rate: 1 takerAsset / makerAsset
        const testOrder2 = testOrderFactory.generateTestSignedOrder({
            makerAssetAmount: BigInt(100),
            takerAssetAmount: BigInt(100),
        });
        // rate: 2.5 takerAsset / makerAsset
        const testOrder3 = testOrderFactory.generateTestSignedOrder({
            makerAssetAmount: BigInt(100),
            takerAssetAmount: BigInt(200),
            takerFee: BigInt(50),
        });
        it('correctly sorts by fee adjusted rate when feeRate is Provided', async () => {
            const orders = [testOrder1, testOrder2, testOrder3];
            const sortedOrders = sortingUtils.sortOrdersByFeeAdjustedRate(orders, feeRate);
            expect(sortedOrders).to.deep.equal([testOrder2, testOrder1, testOrder3]);
        });
        it('correctly sorts by fee adjusted rate when no feeRate is Provided', async () => {
            const orders = [testOrder1, testOrder2, testOrder3];
            const sortedOrders = sortingUtils.sortOrdersByFeeAdjustedRate(orders);
            expect(sortedOrders).to.deep.equal([testOrder2, testOrder1, testOrder3]);
        });
    });
    describe('#sortFeeOrdersByFeeAdjustedRate', () => {
        // rate: 200 takerAsset / makerAsset
        const testOrder1 = testOrderFactory.generateTestSignedOrder({
            makerAssetAmount: BigInt(100),
            takerAssetAmount: BigInt(200),
            takerFee: BigInt(99),
        });
        // rate: 1 takerAsset / makerAsset
        const testOrder2 = testOrderFactory.generateTestSignedOrder({
            makerAssetAmount: BigInt(100),
            takerAssetAmount: BigInt(100),
        });
        // rate: 4 takerAsset / makerAsset
        const testOrder3 = testOrderFactory.generateTestSignedOrder({
            makerAssetAmount: BigInt(100),
            takerAssetAmount: BigInt(200),
            takerFee: BigInt(50),
        });
        it('correctly sorts by fee adjusted rate', async () => {
            const orders = [testOrder1, testOrder2, testOrder3];
            const sortedOrders = sortingUtils.sortFeeOrdersByFeeAdjustedRate(orders);
            expect(sortedOrders).to.deep.equal([testOrder2, testOrder3, testOrder1]);
        });
    });
});
