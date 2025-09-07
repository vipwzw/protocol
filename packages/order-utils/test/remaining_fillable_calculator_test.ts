import { SignedOrder } from '@0x/utils';
import * as chai from 'chai';
import 'mocha';

import { RemainingFillableCalculator } from '../src/remaining_fillable_calculator';

import { chaiSetup } from './utils/chai_setup';

chaiSetup.configure();
const expect = chai.expect;

// 替代 Web3Wrapper.toBaseUnitAmount 的函数
function toBaseUnitAmount(amount: bigint, decimals: number): bigint {
    return amount * 10n ** BigInt(decimals);
}

describe('RemainingFillableCalculator', () => {
    let calculator: RemainingFillableCalculator;
    let signedOrder: SignedOrder;
    let transferrableMakeAssetAmount: bigint;
    let transferrableMakerFeeTokenAmount: bigint;
    let remainingMakeAssetAmount: bigint;
    let makerAmount: bigint;
    let takerAmount: bigint;
    let makerFeeAmount: bigint;
    let isPercentageFee: boolean;
    const makerAssetData: string = '0x1';
    const takerAssetData: string = '0x2';
    const makerFeeAssetData: string = '0x03';
    const takerFeeAssetData: string = '0x04';
    const decimals: number = 4;
    const zero: bigint = BigInt(0);
    const chainId: number = 1337;
    const zeroAddress = '0x0';
    const signature: string =
        '0x1B61a3ed31b43c8780e905a260a35faefcc527be7516aa11c0256729b5b351bc3340349190569279751135161d22529dc25add4f6069af05be04cacbda2ace225403';
    beforeEach(async () => {
        [makerAmount, takerAmount, makerFeeAmount] = [
            toBaseUnitAmount(BigInt(50), decimals),
            toBaseUnitAmount(BigInt(5), decimals),
            toBaseUnitAmount(BigInt(1), decimals),
        ];
        [transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount] = [
            toBaseUnitAmount(BigInt(50), decimals),
            toBaseUnitAmount(BigInt(5), decimals),
        ];
    });
    function buildSignedOrder(): SignedOrder {
        return {
            signature,
            feeRecipientAddress: zeroAddress,
            senderAddress: zeroAddress,
            makerAddress: zeroAddress,
            takerAddress: zeroAddress,
            makerFee: makerFeeAmount,
            takerFee: zero,
            makerAssetAmount: makerAmount,
            takerAssetAmount: takerAmount,
            makerAssetData,
            takerAssetData,
            makerFeeAssetData,
            takerFeeAssetData,
            salt: zero,
            expirationTimeSeconds: zero,
            exchangeAddress: zeroAddress,
            chainId,
        };
    }
    describe('Maker asset is not fee asset', () => {
        before(async () => {
            isPercentageFee = false;
        });
        it('calculates the correct amount when unfilled and funds available', () => {
            signedOrder = buildSignedOrder();
            remainingMakeAssetAmount = signedOrder.makerAssetAmount;
            calculator = new RemainingFillableCalculator(
                signedOrder.makerFee,
                signedOrder.makerAssetAmount,
                isPercentageFee,
                transferrableMakeAssetAmount,
                transferrableMakerFeeTokenAmount,
                remainingMakeAssetAmount,
            );
            expect(calculator.computeRemainingFillable()).to.equal(remainingMakeAssetAmount);
        });
        it('calculates the correct amount when partially filled and funds available', () => {
            signedOrder = buildSignedOrder();
            remainingMakeAssetAmount = toBaseUnitAmount(BigInt(1), decimals);
            calculator = new RemainingFillableCalculator(
                signedOrder.makerFee,
                signedOrder.makerAssetAmount,
                isPercentageFee,
                transferrableMakeAssetAmount,
                transferrableMakerFeeTokenAmount,
                remainingMakeAssetAmount,
            );
            expect(calculator.computeRemainingFillable()).to.equal(remainingMakeAssetAmount);
        });
        it('calculates the amount to be 0 when all fee funds are transferred', () => {
            signedOrder = buildSignedOrder();
            transferrableMakerFeeTokenAmount = zero;
            remainingMakeAssetAmount = signedOrder.makerAssetAmount;
            calculator = new RemainingFillableCalculator(
                signedOrder.makerFee,
                signedOrder.makerAssetAmount,
                isPercentageFee,
                transferrableMakeAssetAmount,
                transferrableMakerFeeTokenAmount,
                remainingMakeAssetAmount,
            );
            expect(calculator.computeRemainingFillable()).to.equal(zero);
        });
        it('calculates the correct amount when balance is less than remaining fillable', () => {
            signedOrder = buildSignedOrder();
            const partiallyFilledAmount = toBaseUnitAmount(BigInt(2), decimals);
            remainingMakeAssetAmount = signedOrder.makerAssetAmount - partiallyFilledAmount;
            transferrableMakeAssetAmount = remainingMakeAssetAmount - partiallyFilledAmount;
            calculator = new RemainingFillableCalculator(
                signedOrder.makerFee,
                signedOrder.makerAssetAmount,
                isPercentageFee,
                transferrableMakeAssetAmount,
                transferrableMakerFeeTokenAmount,
                remainingMakeAssetAmount,
            );
            expect(calculator.computeRemainingFillable()).to.equal(transferrableMakeAssetAmount);
        });
        describe('Order to Fee Ratio is < 1', () => {
            beforeEach(async () => {
                [makerAmount, takerAmount, makerFeeAmount] = [
                    toBaseUnitAmount(BigInt(3), decimals),
                    toBaseUnitAmount(BigInt(6), decimals),
                    toBaseUnitAmount(BigInt(6), decimals),
                ];
            });
            it('calculates the correct amount when funds unavailable', () => {
                signedOrder = buildSignedOrder();
                remainingMakeAssetAmount = signedOrder.makerAssetAmount;
                const transferredAmount = toBaseUnitAmount(BigInt(2), decimals);
                transferrableMakeAssetAmount = remainingMakeAssetAmount - transferredAmount;
                calculator = new RemainingFillableCalculator(
                    signedOrder.makerFee,
                    signedOrder.makerAssetAmount,
                    isPercentageFee,
                    transferrableMakeAssetAmount,
                    transferrableMakerFeeTokenAmount,
                    remainingMakeAssetAmount,
                );
                expect(calculator.computeRemainingFillable()).to.equal(transferrableMakeAssetAmount);
            });
        });
        describe('Ratio is not evenly divisible', () => {
            beforeEach(async () => {
                [makerAmount, takerAmount, makerFeeAmount] = [
                    toBaseUnitAmount(BigInt(3), decimals),
                    toBaseUnitAmount(BigInt(7), decimals),
                    toBaseUnitAmount(BigInt(7), decimals),
                ];
            });
            it('calculates the correct amount when funds unavailable', () => {
                signedOrder = buildSignedOrder();
                remainingMakeAssetAmount = signedOrder.makerAssetAmount;
                const transferredAmount = toBaseUnitAmount(BigInt(2), decimals);
                transferrableMakeAssetAmount = remainingMakeAssetAmount - transferredAmount;
                calculator = new RemainingFillableCalculator(
                    signedOrder.makerFee,
                    signedOrder.makerAssetAmount,
                    isPercentageFee,
                    transferrableMakeAssetAmount,
                    transferrableMakerFeeTokenAmount,
                    remainingMakeAssetAmount,
                );
                const calculatedFillableAmount = calculator.computeRemainingFillable();
                expect(calculatedFillableAmount).to.be.at.most(transferrableMakeAssetAmount);
                expect(calculatedFillableAmount).to.be.above(0n);
                const orderToFeeRatio = signedOrder.makerAssetAmount / signedOrder.makerFee;
                // 当 orderToFeeRatio 为 0 时（费用大于资产），使用交叉相乘计算费用
                const calculatedFeeAmount =
                    orderToFeeRatio === 0n
                        ? (calculatedFillableAmount * signedOrder.makerFee) / signedOrder.makerAssetAmount
                        : calculatedFillableAmount / orderToFeeRatio;
                expect(calculatedFeeAmount).to.be.below(transferrableMakerFeeTokenAmount);
            });
        });
    });
    describe('Maker asset is fee asset', () => {
        before(async () => {
            isPercentageFee = true;
        });
        it('calculates the correct amount when unfilled and funds available', () => {
            signedOrder = buildSignedOrder();
            transferrableMakeAssetAmount = makerAmount + makerFeeAmount;
            transferrableMakerFeeTokenAmount = transferrableMakeAssetAmount;
            remainingMakeAssetAmount = signedOrder.makerAssetAmount;
            calculator = new RemainingFillableCalculator(
                signedOrder.makerFee,
                signedOrder.makerAssetAmount,
                isPercentageFee,
                transferrableMakeAssetAmount,
                transferrableMakerFeeTokenAmount,
                remainingMakeAssetAmount,
            );
            expect(calculator.computeRemainingFillable()).to.equal(remainingMakeAssetAmount);
        });
        it('calculates the correct amount when partially filled and funds available', () => {
            signedOrder = buildSignedOrder();
            remainingMakeAssetAmount = toBaseUnitAmount(BigInt(1), decimals);
            calculator = new RemainingFillableCalculator(
                signedOrder.makerFee,
                signedOrder.makerAssetAmount,
                isPercentageFee,
                transferrableMakeAssetAmount,
                transferrableMakerFeeTokenAmount,
                remainingMakeAssetAmount,
            );
            expect(calculator.computeRemainingFillable()).to.equal(remainingMakeAssetAmount);
        });
        it('calculates the amount to be 0 when all fee funds are transferred', () => {
            signedOrder = buildSignedOrder();
            transferrableMakeAssetAmount = zero;
            transferrableMakerFeeTokenAmount = zero;
            remainingMakeAssetAmount = signedOrder.makerAssetAmount;
            calculator = new RemainingFillableCalculator(
                signedOrder.makerFee,
                signedOrder.makerAssetAmount,
                isPercentageFee,
                transferrableMakeAssetAmount,
                transferrableMakerFeeTokenAmount,
                remainingMakeAssetAmount,
            );
            expect(calculator.computeRemainingFillable()).to.equal(zero);
        });
        it('calculates the correct amount when balance is less than remaining fillable', () => {
            signedOrder = buildSignedOrder();
            const partiallyFilledAmount = toBaseUnitAmount(BigInt(2), decimals);
            remainingMakeAssetAmount = signedOrder.makerAssetAmount - partiallyFilledAmount;
            transferrableMakeAssetAmount = remainingMakeAssetAmount - partiallyFilledAmount;
            transferrableMakerFeeTokenAmount = transferrableMakeAssetAmount;

            const orderToFeeRatio = signedOrder.makerAssetAmount / signedOrder.makerFee;
            const expectedFillableAmount = BigInt(450980);
            calculator = new RemainingFillableCalculator(
                signedOrder.makerFee,
                signedOrder.makerAssetAmount,
                isPercentageFee,
                transferrableMakeAssetAmount,
                transferrableMakerFeeTokenAmount,
                remainingMakeAssetAmount,
            );
            const calculatedFillableAmount = calculator.computeRemainingFillable();
            const numberOfFillsInRatio = calculatedFillableAmount / orderToFeeRatio;
            const calculatedFillableAmountPlusFees = calculatedFillableAmount + numberOfFillsInRatio;
            expect(calculatedFillableAmountPlusFees).to.be.below(transferrableMakeAssetAmount);
            expect(calculatedFillableAmountPlusFees).to.be.below(remainingMakeAssetAmount);
            expect(calculatedFillableAmount).to.equal(expectedFillableAmount);
            // bigint 本身就是整数，不需要检查小数位
        });
    });
});
