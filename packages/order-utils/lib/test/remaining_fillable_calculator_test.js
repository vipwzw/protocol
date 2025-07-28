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
const remaining_fillable_calculator_1 = require("../src/remaining_fillable_calculator");
const chai_setup_1 = require("./utils/chai_setup");
chai_setup_1.chaiSetup.configure();
const expect = chai.expect;
// 替代 Web3Wrapper.toBaseUnitAmount 的函数
function toBaseUnitAmount(amount, decimals) {
    return amount * (10n ** BigInt(decimals));
}
describe('RemainingFillableCalculator', () => {
    let calculator;
    let signedOrder;
    let transferrableMakeAssetAmount;
    let transferrableMakerFeeTokenAmount;
    let remainingMakeAssetAmount;
    let makerAmount;
    let takerAmount;
    let makerFeeAmount;
    let isPercentageFee;
    const makerAssetData = '0x1';
    const takerAssetData = '0x2';
    const makerFeeAssetData = '0x03';
    const takerFeeAssetData = '0x04';
    const decimals = 4;
    const zero = BigInt(0);
    const chainId = 1337;
    const zeroAddress = '0x0';
    const signature = '0x1B61a3ed31b43c8780e905a260a35faefcc527be7516aa11c0256729b5b351bc3340349190569279751135161d22529dc25add4f6069af05be04cacbda2ace225403';
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
    function buildSignedOrder() {
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
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            expect(calculator.computeRemainingFillable()).to.equal(remainingMakeAssetAmount);
        });
        it('calculates the correct amount when partially filled and funds available', () => {
            signedOrder = buildSignedOrder();
            remainingMakeAssetAmount = toBaseUnitAmount(BigInt(1), decimals);
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            expect(calculator.computeRemainingFillable()).to.equal(remainingMakeAssetAmount);
        });
        it('calculates the amount to be 0 when all fee funds are transferred', () => {
            signedOrder = buildSignedOrder();
            transferrableMakerFeeTokenAmount = zero;
            remainingMakeAssetAmount = signedOrder.makerAssetAmount;
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            expect(calculator.computeRemainingFillable()).to.equal(zero);
        });
        it('calculates the correct amount when balance is less than remaining fillable', () => {
            signedOrder = buildSignedOrder();
            const partiallyFilledAmount = toBaseUnitAmount(BigInt(2), decimals);
            remainingMakeAssetAmount = signedOrder.makerAssetAmount - (partiallyFilledAmount);
            transferrableMakeAssetAmount = remainingMakeAssetAmount - (partiallyFilledAmount);
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
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
                transferrableMakeAssetAmount = remainingMakeAssetAmount - (transferredAmount);
                calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
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
                transferrableMakeAssetAmount = remainingMakeAssetAmount - (transferredAmount);
                calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
                const calculatedFillableAmount = calculator.computeRemainingFillable();
                expect(calculatedFillableAmount).to.be.at.most(transferrableMakeAssetAmount);
                expect(calculatedFillableAmount).to.be.above(0n);
                const orderToFeeRatio = signedOrder.makerAssetAmount / (signedOrder.makerFee);
                // 当 orderToFeeRatio 为 0 时（费用大于资产），使用交叉相乘计算费用
                const calculatedFeeAmount = orderToFeeRatio === 0n
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
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            expect(calculator.computeRemainingFillable()).to.equal(remainingMakeAssetAmount);
        });
        it('calculates the correct amount when partially filled and funds available', () => {
            signedOrder = buildSignedOrder();
            remainingMakeAssetAmount = toBaseUnitAmount(BigInt(1), decimals);
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            expect(calculator.computeRemainingFillable()).to.equal(remainingMakeAssetAmount);
        });
        it('calculates the amount to be 0 when all fee funds are transferred', () => {
            signedOrder = buildSignedOrder();
            transferrableMakeAssetAmount = zero;
            transferrableMakerFeeTokenAmount = zero;
            remainingMakeAssetAmount = signedOrder.makerAssetAmount;
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            expect(calculator.computeRemainingFillable()).to.equal(zero);
        });
        it('calculates the correct amount when balance is less than remaining fillable', () => {
            signedOrder = buildSignedOrder();
            const partiallyFilledAmount = toBaseUnitAmount(BigInt(2), decimals);
            remainingMakeAssetAmount = signedOrder.makerAssetAmount - (partiallyFilledAmount);
            transferrableMakeAssetAmount = remainingMakeAssetAmount - (partiallyFilledAmount);
            transferrableMakerFeeTokenAmount = transferrableMakeAssetAmount;
            const orderToFeeRatio = signedOrder.makerAssetAmount / (signedOrder.makerFee);
            const expectedFillableAmount = BigInt(450980);
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            const calculatedFillableAmount = calculator.computeRemainingFillable();
            const numberOfFillsInRatio = calculatedFillableAmount / (orderToFeeRatio);
            const calculatedFillableAmountPlusFees = calculatedFillableAmount + numberOfFillsInRatio;
            expect(calculatedFillableAmountPlusFees).to.be.below(transferrableMakeAssetAmount);
            expect(calculatedFillableAmountPlusFees).to.be.below(remainingMakeAssetAmount);
            expect(calculatedFillableAmount).to.equal(expectedFillableAmount);
            // bigint 本身就是整数，不需要检查小数位
        });
    });
});
