export declare class RemainingFillableCalculator {
    private readonly _isPercentageFee;
    private readonly _transferrableAssetAmount;
    private readonly _transferrableFeeAmount;
    private readonly _remainingOrderAssetAmount;
    private readonly _remainingOrderFeeAmount;
    private readonly _orderFee;
    private readonly _orderAssetAmount;
    constructor(orderFee: bigint, orderAssetAmount: bigint, isPercentageFee: boolean, transferrableAssetAmount: bigint, transferrableFeeAmount: bigint, remainingOrderAssetAmount: bigint);
    computeRemainingFillable(): bigint;
    private _hasSufficientFundsForFeeAndTransferAmount;
    private _calculatePartiallyFillableAssetAmount;
}
