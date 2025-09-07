// 使用原生 bigint 替代 BigNumber

export class RemainingFillableCalculator {
    private readonly _isPercentageFee: boolean;
    // Transferrable Amount is the minimum of Approval and Balance
    private readonly _transferrableAssetAmount: bigint;
    private readonly _transferrableFeeAmount: bigint;
    private readonly _remainingOrderAssetAmount: bigint;
    private readonly _remainingOrderFeeAmount: bigint;
    private readonly _orderFee: bigint;
    private readonly _orderAssetAmount: bigint;
    constructor(
        orderFee: bigint,
        orderAssetAmount: bigint,
        isPercentageFee: boolean,
        transferrableAssetAmount: bigint,
        transferrableFeeAmount: bigint,
        remainingOrderAssetAmount: bigint,
    ) {
        this._orderFee = orderFee;
        this._orderAssetAmount = orderAssetAmount;
        this._isPercentageFee = isPercentageFee;
        this._transferrableAssetAmount = transferrableAssetAmount;
        this._transferrableFeeAmount = transferrableFeeAmount;
        this._remainingOrderAssetAmount = remainingOrderAssetAmount;
        this._remainingOrderFeeAmount =
            orderAssetAmount === 0n ? 0n : (remainingOrderAssetAmount * orderFee) / orderAssetAmount;
    }
    public computeRemainingFillable(): bigint {
        if (this._hasSufficientFundsForFeeAndTransferAmount()) {
            return this._remainingOrderAssetAmount;
        }
        if (this._orderFee === 0n) {
            return this._remainingOrderAssetAmount < this._transferrableAssetAmount
                ? this._remainingOrderAssetAmount
                : this._transferrableAssetAmount;
        }
        return this._calculatePartiallyFillableAssetAmount();
    }
    private _hasSufficientFundsForFeeAndTransferAmount(): boolean {
        if (this._isPercentageFee) {
            const totalTransferAmountRequired = this._remainingOrderAssetAmount + this._remainingOrderFeeAmount;
            const hasSufficientFunds = this._transferrableAssetAmount >= totalTransferAmountRequired;
            return hasSufficientFunds;
        } else {
            const hasSufficientFundsForTransferAmount =
                this._transferrableAssetAmount >= this._remainingOrderAssetAmount;
            const hasSufficientFundsForFeeAmount = this._transferrableFeeAmount >= this._remainingOrderFeeAmount;
            const hasSufficientFunds = hasSufficientFundsForTransferAmount && hasSufficientFundsForFeeAmount;
            return hasSufficientFunds;
        }
    }
    private _calculatePartiallyFillableAssetAmount(): bigint {
        // Given an order for 200 wei for 2 Fee wei fee, find 100 wei for 1 Fee wei. Order ratio is then 100:1
        if (this._orderFee === 0n) {
            // 如果没有费用，直接返回可转移的资产数量
            return this._transferrableAssetAmount >= this._remainingOrderAssetAmount
                ? this._remainingOrderAssetAmount
                : this._transferrableAssetAmount;
        }
        const orderToFeeRatio = this._orderAssetAmount / this._orderFee;
        // The number of times the trader (maker or taker) can fill the order, if each fill only required the transfer of a single
        // baseUnit of fee tokens.
        // Given 2 Fee wei, the maximum amount of times trader can fill this order, in terms of fees, is 2
        const fillableTimesInFeeBaseUnits =
            this._transferrableFeeAmount < this._remainingOrderFeeAmount
                ? this._transferrableFeeAmount
                : this._remainingOrderFeeAmount;

        // The number of times the trader can fill the order, given the traders asset Balance
        // 当 orderToFeeRatio 为 0 时（费用大于资产），使用交叉相乘避免除零
        let fillableTimesInAssetUnits: bigint;
        if (orderToFeeRatio === 0n) {
            // 当 orderAssetAmount < orderFee 时，使用交叉相乘: transferrableAssetAmount * orderFee / orderAssetAmount
            fillableTimesInAssetUnits = (this._transferrableAssetAmount * this._orderFee) / this._orderAssetAmount;
        } else {
            fillableTimesInAssetUnits = this._transferrableAssetAmount / orderToFeeRatio;
        }
        let partiallyFillableAssetAmount: bigint;
        if (this._isPercentageFee) {
            // If Fee is the trader asset, the Fee and the trader fill amount need to be removed from the same pool;
            // 200 Fee wei for 2Fee wei fee can only be filled once (need 202 Fee wei)
            const totalAssetPooled = this._transferrableAssetAmount;
            // The purchasing power here is less as the tokens are taken from the same Pool
            // For every one number of fills, we have to take an extra Fee out of the pool

            // 为了避免精度丢失，重新排列计算顺序：
            // 原来: fillableTimesInAssetUnits = totalAssetPooled / (orderToFeeRatio + 1n)
            //       partiallyFillableAssetAmount = (fillableTimesInAssetUnits * orderAssetAmount) / orderFee
            // 改为: partiallyFillableAssetAmount = (totalAssetPooled * orderAssetAmount) / ((orderToFeeRatio + 1n) * orderFee)
            partiallyFillableAssetAmount =
                (totalAssetPooled * this._orderAssetAmount) / ((orderToFeeRatio + 1n) * this._orderFee);
        } else {
            // When Ratio is not fully divisible there can be remainders which cannot be represented, so they are floored.
            // This can result in a RoundingError being thrown by the Exchange Contract.
            partiallyFillableAssetAmount = (fillableTimesInAssetUnits * this._orderAssetAmount) / this._orderFee;
        }
        const partiallyFillableFeeAmount = (fillableTimesInFeeBaseUnits * this._orderAssetAmount) / this._orderFee;
        const partiallyFillableAmount =
            partiallyFillableAssetAmount < partiallyFillableFeeAmount
                ? partiallyFillableAssetAmount
                : partiallyFillableFeeAmount;
        return partiallyFillableAmount;
    }
}
