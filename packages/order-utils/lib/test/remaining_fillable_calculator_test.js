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
const web3_wrapper_1 = require("@0x/web3-wrapper");
const chai = __importStar(require("chai"));
require("mocha");
const remaining_fillable_calculator_1 = require("../src/remaining_fillable_calculator");
const chai_setup_1 = require("./utils/chai_setup");
chai_setup_1.chaiSetup.configure();
const expect = chai.expect;
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
    const zero = new utils_1.BigNumber(0);
    const chainId = 1337;
    const zeroAddress = '0x0';
    const signature = '0x1B61a3ed31b43c8780e905a260a35faefcc527be7516aa11c0256729b5b351bc3340349190569279751135161d22529dc25add4f6069af05be04cacbda2ace225403';
    beforeEach(async () => {
        [makerAmount, takerAmount, makerFeeAmount] = [
            web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(50), decimals),
            web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(5), decimals),
            web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(1), decimals),
        ];
        [transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount] = [
            web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(50), decimals),
            web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(5), decimals),
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
            expect(calculator.computeRemainingFillable()).to.be.bignumber.equal(remainingMakeAssetAmount);
        });
        it('calculates the correct amount when partially filled and funds available', () => {
            signedOrder = buildSignedOrder();
            remainingMakeAssetAmount = web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(1), decimals);
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            expect(calculator.computeRemainingFillable()).to.be.bignumber.equal(remainingMakeAssetAmount);
        });
        it('calculates the amount to be 0 when all fee funds are transferred', () => {
            signedOrder = buildSignedOrder();
            transferrableMakerFeeTokenAmount = zero;
            remainingMakeAssetAmount = signedOrder.makerAssetAmount;
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            expect(calculator.computeRemainingFillable()).to.be.bignumber.equal(zero);
        });
        it('calculates the correct amount when balance is less than remaining fillable', () => {
            signedOrder = buildSignedOrder();
            const partiallyFilledAmount = web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(2), decimals);
            remainingMakeAssetAmount = signedOrder.makerAssetAmount.minus(partiallyFilledAmount);
            transferrableMakeAssetAmount = remainingMakeAssetAmount.minus(partiallyFilledAmount);
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            expect(calculator.computeRemainingFillable()).to.be.bignumber.equal(transferrableMakeAssetAmount);
        });
        describe('Order to Fee Ratio is < 1', () => {
            beforeEach(async () => {
                [makerAmount, takerAmount, makerFeeAmount] = [
                    web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(3), decimals),
                    web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(6), decimals),
                    web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(6), decimals),
                ];
            });
            it('calculates the correct amount when funds unavailable', () => {
                signedOrder = buildSignedOrder();
                remainingMakeAssetAmount = signedOrder.makerAssetAmount;
                const transferredAmount = web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(2), decimals);
                transferrableMakeAssetAmount = remainingMakeAssetAmount.minus(transferredAmount);
                calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
                expect(calculator.computeRemainingFillable()).to.be.bignumber.equal(transferrableMakeAssetAmount);
            });
        });
        describe('Ratio is not evenly divisible', () => {
            beforeEach(async () => {
                [makerAmount, takerAmount, makerFeeAmount] = [
                    web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(3), decimals),
                    web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(7), decimals),
                    web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(7), decimals),
                ];
            });
            it('calculates the correct amount when funds unavailable', () => {
                signedOrder = buildSignedOrder();
                remainingMakeAssetAmount = signedOrder.makerAssetAmount;
                const transferredAmount = web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(2), decimals);
                transferrableMakeAssetAmount = remainingMakeAssetAmount.minus(transferredAmount);
                calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
                const calculatedFillableAmount = calculator.computeRemainingFillable();
                expect(calculatedFillableAmount.isLessThanOrEqualTo(transferrableMakeAssetAmount)).to.be.true();
                expect(calculatedFillableAmount).to.be.bignumber.greaterThan(new utils_1.BigNumber(0));
                const orderToFeeRatio = signedOrder.makerAssetAmount.dividedBy(signedOrder.makerFee);
                const calculatedFeeAmount = calculatedFillableAmount.dividedBy(orderToFeeRatio);
                expect(calculatedFeeAmount).to.be.bignumber.lessThan(transferrableMakerFeeTokenAmount);
            });
        });
    });
    describe('Maker asset is fee asset', () => {
        before(async () => {
            isPercentageFee = true;
        });
        it('calculates the correct amount when unfilled and funds available', () => {
            signedOrder = buildSignedOrder();
            transferrableMakeAssetAmount = makerAmount.plus(makerFeeAmount);
            transferrableMakerFeeTokenAmount = transferrableMakeAssetAmount;
            remainingMakeAssetAmount = signedOrder.makerAssetAmount;
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            expect(calculator.computeRemainingFillable()).to.be.bignumber.equal(remainingMakeAssetAmount);
        });
        it('calculates the correct amount when partially filled and funds available', () => {
            signedOrder = buildSignedOrder();
            remainingMakeAssetAmount = web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(1), decimals);
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            expect(calculator.computeRemainingFillable()).to.be.bignumber.equal(remainingMakeAssetAmount);
        });
        it('calculates the amount to be 0 when all fee funds are transferred', () => {
            signedOrder = buildSignedOrder();
            transferrableMakeAssetAmount = zero;
            transferrableMakerFeeTokenAmount = zero;
            remainingMakeAssetAmount = signedOrder.makerAssetAmount;
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            expect(calculator.computeRemainingFillable()).to.be.bignumber.equal(zero);
        });
        it('calculates the correct amount when balance is less than remaining fillable', () => {
            signedOrder = buildSignedOrder();
            const partiallyFilledAmount = web3_wrapper_1.Web3Wrapper.toBaseUnitAmount(new utils_1.BigNumber(2), decimals);
            remainingMakeAssetAmount = signedOrder.makerAssetAmount.minus(partiallyFilledAmount);
            transferrableMakeAssetAmount = remainingMakeAssetAmount.minus(partiallyFilledAmount);
            transferrableMakerFeeTokenAmount = transferrableMakeAssetAmount;
            const orderToFeeRatio = signedOrder.makerAssetAmount.dividedToIntegerBy(signedOrder.makerFee);
            const expectedFillableAmount = new utils_1.BigNumber(450980);
            calculator = new remaining_fillable_calculator_1.RemainingFillableCalculator(signedOrder.makerFee, signedOrder.makerAssetAmount, isPercentageFee, transferrableMakeAssetAmount, transferrableMakerFeeTokenAmount, remainingMakeAssetAmount);
            const calculatedFillableAmount = calculator.computeRemainingFillable();
            const numberOfFillsInRatio = calculatedFillableAmount.dividedToIntegerBy(orderToFeeRatio);
            const calculatedFillableAmountPlusFees = calculatedFillableAmount.plus(numberOfFillsInRatio);
            expect(calculatedFillableAmountPlusFees).to.be.bignumber.lessThan(transferrableMakeAssetAmount);
            expect(calculatedFillableAmountPlusFees).to.be.bignumber.lessThan(remainingMakeAssetAmount);
            expect(calculatedFillableAmount).to.be.bignumber.equal(expectedFillableAmount);
            expect(numberOfFillsInRatio.decimalPlaces()).to.be.equal(0);
        });
    });
});
//# sourceMappingURL=remaining_fillable_calculator_test.js.map