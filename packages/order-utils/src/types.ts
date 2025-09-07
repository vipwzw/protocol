// bigint 已替换为 bigint

export enum TypedDataError {
    InvalidSignature = 'INVALID_SIGNATURE',
    InvalidMetamaskSigner = "MetaMask provider must be wrapped in a MetamaskSubprovider (from the '@0x/subproviders' package) in order to work with this method.",
}

export interface CreateOrderOpts {
    takerAddress?: string;
    senderAddress?: string;
    makerFee?: bigint;
    takerFee?: bigint;
    feeRecipientAddress?: string;
    salt?: bigint;
    expirationTimeSeconds?: bigint;
    makerFeeAssetData?: string;
    takerFeeAssetData?: string;
}

export interface ValidateOrderFillableOpts {
    expectedFillTakerTokenAmount?: bigint;
    validateRemainingOrderAmountIsFillable?: boolean;
    simulationTakerAddress?: string;
}

/**
 * remainingFillableMakerAssetAmount: An array of bigints corresponding to the `orders` parameter.
 * You can use `OrderStateUtils` `@0x/order-utils` to perform blockchain lookups for these values.
 * Defaults to `makerAssetAmount` values from the orders param.
 * slippageBufferAmount: An additional amount of makerAsset to be covered by the result in case of trade collisions or partial fills.
 * Defaults to 0
 */
export interface FindOrdersThatCoverMakerAssetFillAmountOpts {
    remainingFillableMakerAssetAmounts?: bigint[];
    slippageBufferAmount?: bigint;
}

/**
 * remainingFillableMakerAssetAmount: An array of bigints corresponding to the `orders` parameter.
 * You can use `OrderStateUtils` `@0x/order-utils` to perform blockchain lookups for these values.
 * Defaults to `makerAssetAmount` values from the orders param.
 * slippageBufferAmount: An additional amount of makerAsset to be covered by the result in case of trade collisions or partial fills.
 * Defaults to 0
 */
export interface FindOrdersThatCoverTakerAssetFillAmountOpts {
    remainingFillableTakerAssetAmounts?: bigint[];
    slippageBufferAmount?: bigint;
}

/**
 * remainingFillableMakerAssetAmount: An array of bigints corresponding to the `orders` parameter.
 * You can use `OrderStateUtils` `@0x/order-utils` to perform blockchain lookups for these values.
 * Defaults to `makerAssetAmount` values from the orders param.
 * remainingFillableFeeAmounts: An array of bigints corresponding to the feeOrders parameter.
 * You can use OrderStateUtils @0x/order-utils to perform blockchain lookups for these values.
 * Defaults to `makerAssetAmount` values from the feeOrders param.
 * slippageBufferAmount: An additional amount of fee to be covered by the result in case of trade collisions or partial fills.
 * Defaults to 0
 */
export interface FindFeeOrdersThatCoverFeesForTargetOrdersOpts {
    remainingFillableMakerAssetAmounts?: bigint[];
    remainingFillableFeeAmounts?: bigint[];
    slippageBufferAmount?: bigint;
}

export interface FeeOrdersAndRemainingFeeAmount<T> {
    resultFeeOrders: T[];
    feeOrdersRemainingFillableMakerAssetAmounts: bigint[];
    remainingFeeAmount: bigint;
}

export interface OrdersAndRemainingMakerFillAmount<T> {
    resultOrders: T[];
    ordersRemainingFillableMakerAssetAmounts: bigint[];
    remainingFillAmount: bigint;
}

export interface OrdersAndRemainingTakerFillAmount<T> {
    resultOrders: T[];
    ordersRemainingFillableTakerAssetAmounts: bigint[];
    remainingFillAmount: bigint;
}
