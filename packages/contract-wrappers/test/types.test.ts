import { expect } from 'chai';
import { ContractWrappersConfig, OrderInfo, TraderInfo, OrderStatus } from '../src/types';
import { TEST_VALUES, expectToBeBigInt } from './setup';

describe('Types with BigInt Support', () => {
    describe('ContractWrappersConfig', () => {
        it('should accept bigint gasPrice', () => {
            const config: ContractWrappersConfig = {
                chainId: 1,
                gasPrice: TEST_VALUES.ONE_ETH, // bigint
            };

            expect(config.gasPrice).to.exist;
            expectToBeBigInt(config.gasPrice!);
        });

        it('should work without gasPrice', () => {
            const config: ContractWrappersConfig = {
                chainId: 1,
            };

            expect(config.gasPrice).to.be.undefined;
        });
    });

    describe('OrderInfo', () => {
        it('should have bigint orderTakerAssetFilledAmount', () => {
            const orderInfo: OrderInfo = {
                orderStatus: OrderStatus.Fillable,
                orderHash: '0x1234567890abcdef',
                orderTakerAssetFilledAmount: TEST_VALUES.HALF_ETH,
            };

            expectToBeBigInt(orderInfo.orderTakerAssetFilledAmount);
            expect(orderInfo.orderTakerAssetFilledAmount).to.equal(TEST_VALUES.HALF_ETH);
            expect(orderInfo.orderStatus).to.equal(OrderStatus.Fillable);
        });
    });

    describe('TraderInfo', () => {
        it('should have all bigint balance and allowance fields', () => {
            const traderInfo: TraderInfo = {
                makerBalance: TEST_VALUES.ONE_ETH,
                makerAllowance: TEST_VALUES.MAX_UINT256,
                takerBalance: TEST_VALUES.HALF_ETH,
                takerAllowance: TEST_VALUES.ZERO,
                makerZrxBalance: TEST_VALUES.ONE_ETH,
                makerZrxAllowance: TEST_VALUES.ONE_ETH,
                takerZrxBalance: TEST_VALUES.HALF_ETH,
                takerZrxAllowance: TEST_VALUES.HALF_ETH,
            };

            // Test all fields are bigint
            expectToBeBigInt(traderInfo.makerBalance);
            expectToBeBigInt(traderInfo.makerAllowance);
            expectToBeBigInt(traderInfo.takerBalance);
            expectToBeBigInt(traderInfo.takerAllowance);
            expectToBeBigInt(traderInfo.makerZrxBalance);
            expectToBeBigInt(traderInfo.makerZrxAllowance);
            expectToBeBigInt(traderInfo.takerZrxBalance);
            expectToBeBigInt(traderInfo.takerZrxAllowance);
        });
    });

    describe('BigInt Operations', () => {
        it('should perform basic bigint arithmetic', () => {
            const sum = TEST_VALUES.ONE_ETH + TEST_VALUES.HALF_ETH;
            const expected = 1500000000000000000n;

            expectToBeBigInt(sum);
            expect(sum).to.equal(expected);
        });

        it('should handle bigint comparisons', () => {
            expect(TEST_VALUES.ONE_ETH > TEST_VALUES.HALF_ETH).to.be.true;
            expect(TEST_VALUES.ZERO < TEST_VALUES.ONE_ETH).to.be.true;
            expect(TEST_VALUES.MAX_UINT256 > TEST_VALUES.ONE_ETH).to.be.true;
        });

        it('should convert to string correctly', () => {
            expect(TEST_VALUES.ONE_ETH.toString()).to.equal('1000000000000000000');
            expect(TEST_VALUES.ZERO.toString()).to.equal('0');
        });
    });
});
