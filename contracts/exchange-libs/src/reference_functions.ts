import { orderHashUtils } from '@0x/test-utils';
import { SafeMathRevertErrors } from '@0x/contracts-utils';
import { FillResults, MatchedFillResults, Order } from '@0x/utils';
import { BigNumber, ExchangeRevertErrors, LibMathRevertErrors } from '@0x/utils';

// Helper function to convert bigint to BigNumber for error messages
function toBigNumber(value: bigint): BigNumber {
    return new BigNumber(value.toString());
}

// 在 Solidity 0.8+ 中，原生支持溢出检查，不再需要 SafeMath
// JavaScript/TypeScript 中的 bigint 也有足够的精度处理 uint256

/**
 * Checks if rounding error >= 0.1% when rounding down.
 */
export function isRoundingErrorFloor(numerator: bigint, denominator: bigint, target: bigint): boolean {
    if (denominator === 0n) {
        throw new LibMathRevertErrors.DivisionByZeroError();
    }
    if (numerator === 0n || target === 0n) {
        return false;
    }
    const remainder = (numerator * target) % denominator;
    // Need to do this separately because solidity evaluates RHS of the comparison expression first.
    const rhs = numerator * target;
    const lhs = remainder * 1000n;
    return lhs >= rhs;
}

/**
 * Checks if rounding error >= 0.1% when rounding up.
 */
export function isRoundingErrorCeil(numerator: bigint, denominator: bigint, target: bigint): boolean {
    if (denominator === 0n) {
        throw new LibMathRevertErrors.DivisionByZeroError();
    }
    if (numerator === 0n || target === 0n) {
        return false;
    }
    let remainder = (numerator * target) % denominator;
    if (remainder === 0n) {
        return false;
    }
    remainder = denominator - remainder;
    const rhs = numerator * target;
    const lhs = remainder * 1000n;
    return lhs >= rhs;
}

/**
 * Calculates partial value given a numerator and denominator rounded down.
 *      Reverts if rounding error is >= 0.1%
 */
export function safeGetPartialAmountFloor(numerator: bigint, denominator: bigint, target: bigint): bigint {
    if (isRoundingErrorFloor(numerator, denominator, target)) {
        throw new LibMathRevertErrors.RoundingError(toBigNumber(numerator), toBigNumber(denominator), toBigNumber(target));
    }
    return (numerator * target) / denominator;
}

/**
 * Calculates partial value given a numerator and denominator rounded down.
 *      Reverts if rounding error is >= 0.1%
 */
export function safeGetPartialAmountCeil(numerator: bigint, denominator: bigint, target: bigint): bigint {
    if (isRoundingErrorCeil(numerator, denominator, target)) {
        throw new LibMathRevertErrors.RoundingError(toBigNumber(numerator), toBigNumber(denominator), toBigNumber(target));
    }
    return (numerator * target + denominator - 1n) / denominator;
}

/**
 * Calculates partial value given a numerator and denominator rounded down.
 */
export function getPartialAmountFloor(numerator: bigint, denominator: bigint, target: bigint): bigint {
    return (numerator * target) / denominator;
}

/**
 * Calculates partial value given a numerator and denominator rounded down.
 */
export function getPartialAmountCeil(numerator: bigint, denominator: bigint, target: bigint): bigint {
    const sub = denominator - 1n; // This is computed first to simulate Solidity's order of operations
    return (numerator * target + sub) / denominator;
}

/**
 * Adds properties of two `FillResults`.
 */
export function addFillResults(a: FillResults, b: FillResults): FillResults {
    return {
        makerAssetFilledAmount: a.makerAssetFilledAmount + b.makerAssetFilledAmount,
        takerAssetFilledAmount: a.takerAssetFilledAmount + b.takerAssetFilledAmount,
        makerFeePaid: a.makerFeePaid + b.makerFeePaid,
        takerFeePaid: a.takerFeePaid + b.takerFeePaid,
        protocolFeePaid: a.protocolFeePaid + b.protocolFeePaid,
    };
}

/**
 * Calculates amounts filled and fees paid by maker and taker.
 */
export function calculateFillResults(
    order: Order,
    takerAssetFilledAmount: bigint,
    protocolFeeMultiplier: bigint,
    gasPrice: bigint,
): FillResults {
    const makerAssetFilledAmount = safeGetPartialAmountFloor(
        takerAssetFilledAmount,
        order.takerAssetAmount,
        order.makerAssetAmount,
    );
    const makerFeePaid = safeGetPartialAmountFloor(takerAssetFilledAmount, order.takerAssetAmount, order.makerFee);
    const takerFeePaid = safeGetPartialAmountFloor(takerAssetFilledAmount, order.takerAssetAmount, order.takerFee);
    return {
        makerAssetFilledAmount,
        takerAssetFilledAmount,
        makerFeePaid,
        takerFeePaid,
        protocolFeePaid: protocolFeeMultiplier * gasPrice,
    };
}

/**
 * Calculates amounts filled and fees paid by maker and taker.
 */
export function calculateMatchResults(
    leftOrder: Order,
    rightOrder: Order,
    protocolFeeMultiplier: BigNumber,
    gasPrice: BigNumber,
    withMaximalFill: boolean = false,
): MatchedFillResults {
    // Initialize empty fill results.
    const leftFillResults: FillResults = {
        makerAssetFilledAmount: new BigNumber(0),
        takerAssetFilledAmount: new BigNumber(0),
        makerFeePaid: new BigNumber(0),
        takerFeePaid: new BigNumber(0),
        protocolFeePaid: new BigNumber(0),
    };
    const rightFillResults: FillResults = {
        makerAssetFilledAmount: new BigNumber(0),
        takerAssetFilledAmount: new BigNumber(0),
        makerFeePaid: new BigNumber(0),
        takerFeePaid: new BigNumber(0),
        protocolFeePaid: new BigNumber(0),
    };
    let profitInLeftMakerAsset = new BigNumber(0);
    let profitInRightMakerAsset = new BigNumber(0);

    // Assert matchable
    if (
        leftOrder.makerAssetAmount
            .times(rightOrder.makerAssetAmount)
            .lt(leftOrder.takerAssetAmount.times(rightOrder.takerAssetAmount))
    ) {
        throw new ExchangeRevertErrors.NegativeSpreadError(
            orderHashUtils.getOrderHashHex(leftOrder),
            orderHashUtils.getOrderHashHex(rightOrder),
        );
    }

    // Asset Transfer Amounts
    if (leftOrder.takerAssetAmount.gt(rightOrder.makerAssetAmount)) {
        leftFillResults.makerAssetFilledAmount = safeGetPartialAmountFloor(
            leftOrder.makerAssetAmount,
            leftOrder.takerAssetAmount,
            rightOrder.makerAssetAmount,
        );
        leftFillResults.takerAssetFilledAmount = rightOrder.makerAssetAmount;
        rightFillResults.makerAssetFilledAmount = rightOrder.makerAssetAmount;
        rightFillResults.takerAssetFilledAmount = rightOrder.takerAssetAmount;
    } else if (withMaximalFill && leftOrder.makerAssetAmount.lt(rightOrder.takerAssetAmount)) {
        leftFillResults.makerAssetFilledAmount = leftOrder.makerAssetAmount;
        leftFillResults.takerAssetFilledAmount = leftOrder.takerAssetAmount;
        rightFillResults.makerAssetFilledAmount = safeGetPartialAmountFloor(
            rightOrder.makerAssetAmount,
            rightOrder.takerAssetAmount,
            leftOrder.makerAssetAmount,
        );
        rightFillResults.takerAssetFilledAmount = leftOrder.makerAssetAmount;
    } else if (!withMaximalFill && leftOrder.takerAssetAmount.lt(rightOrder.makerAssetAmount)) {
        leftFillResults.makerAssetFilledAmount = leftOrder.makerAssetAmount;
        leftFillResults.takerAssetFilledAmount = leftOrder.takerAssetAmount;
        rightFillResults.makerAssetFilledAmount = leftOrder.takerAssetAmount;
        rightFillResults.takerAssetFilledAmount = safeGetPartialAmountCeil(
            rightOrder.takerAssetAmount,
            rightOrder.makerAssetAmount,
            leftOrder.takerAssetAmount,
        );
    } else {
        leftFillResults.makerAssetFilledAmount = leftOrder.makerAssetAmount;
        leftFillResults.takerAssetFilledAmount = leftOrder.takerAssetAmount;
        rightFillResults.makerAssetFilledAmount = rightOrder.makerAssetAmount;
        rightFillResults.takerAssetFilledAmount = rightOrder.takerAssetAmount;
    }

    // Profit
    profitInLeftMakerAsset = leftFillResults.makerAssetFilledAmount.minus(rightFillResults.makerAssetFilledAmount);
    profitInRightMakerAsset = rightFillResults.makerAssetFilledAmount.minus(leftFillResults.makerAssetFilledAmount);

    // Fees
    leftFillResults.makerFeePaid = safeGetPartialAmountFloor(
        leftFillResults.makerAssetFilledAmount,
        leftOrder.makerAssetAmount,
        leftOrder.makerFee,
    );
    leftFillResults.takerFeePaid = safeGetPartialAmountFloor(
        leftFillResults.takerAssetFilledAmount,
        leftOrder.takerAssetAmount,
        leftOrder.takerFee,
    );
    rightFillResults.makerFeePaid = safeGetPartialAmountFloor(
        rightFillResults.makerAssetFilledAmount,
        rightOrder.makerAssetAmount,
        rightOrder.makerFee,
    );
    rightFillResults.takerFeePaid = safeGetPartialAmountFloor(
        rightFillResults.takerAssetFilledAmount,
        rightOrder.takerAssetAmount,
        rightOrder.takerFee,
    );

    // Protocol Fee
    leftFillResults.protocolFeePaid = protocolFeeMultiplier * gasPrice;
    rightFillResults.protocolFeePaid = protocolFeeMultiplier * gasPrice;

    return {
        left: leftFillResults,
        right: rightFillResults,
        profitInLeftMakerAsset,
        profitInRightMakerAsset,
    };
}

export const LibFractions = {
    add: (n1: BigNumber, d1: BigNumber, n2: BigNumber, d2: BigNumber): [BigNumber, BigNumber] => {
        if (n1.isZero()) {
            return [n2, d2];
        }
        if (n2.isZero()) {
            return [n1, d1];
        }
            const numerator = n1.times(d2).plus(n2.times(d1));
        const denominator = d1.times(d2);
        return [numerator, denominator];
    },
    normalize: (
        numerator: BigNumber,
        denominator: BigNumber,
        maxValue: BigNumber = new BigNumber(2).exponentiatedBy(127),
    ): [BigNumber, BigNumber] => {
        if (numerator.isGreaterThan(maxValue) || denominator.isGreaterThan(maxValue)) {
            let rescaleBase = numerator.isGreaterThanOrEqualTo(denominator) ? numerator : denominator;
            rescaleBase = rescaleBase.dividedToIntegerBy(maxValue);
            return [numerator.dividedToIntegerBy(rescaleBase), denominator.dividedToIntegerBy(rescaleBase)];
        } else {
            return [numerator, denominator];
        }
    },
};
