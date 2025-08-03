// BigNumber removed - using bigint
import { RevertError } from '../../revert_error';

// tslint:disable:max-classes-per-file

export class UnregisteredAssetProxyError extends RevertError {
    constructor() {
        super('UnregisteredAssetProxyError', 'UnregisteredAssetProxyError()', {});
    }
}

export class CompleteBuyFailedError extends RevertError {
    constructor(
        expectedAssetBuyAmount?: bigint | number | string,
        actualAssetBuyAmount?: bigint | number | string,
    ) {
        super(
            'CompleteBuyFailedError',
            'CompleteBuyFailedError(uint256 expectedAssetBuyAmount, uint256 actualAssetBuyAmount)',
            { expectedAssetBuyAmount, actualAssetBuyAmount },
        );
    }
}

export class CompleteSellFailedError extends RevertError {
    constructor(
        expectedAssetSellAmount?: bigint | number | string,
        actualAssetSellAmount?: bigint | number | string,
    ) {
        super(
            'CompleteSellFailedError',
            'CompleteSellFailedError(uint256 expectedAssetSellAmount, uint256 actualAssetSellAmount)',
            { expectedAssetSellAmount, actualAssetSellAmount },
        );
    }
}

export class UnsupportedFeeError extends RevertError {
    constructor(takerFeeAssetData?: string) {
        super('UnsupportedFeeError', 'UnsupportedFeeError(bytes takerFeeAssetData)', { takerFeeAssetData });
    }
}

export class OverspentWethError extends RevertError {
    constructor(wethSpent?: bigint | number | string, msgValue?: bigint | number | string) {
        super('OverspentWethError', 'OverspentWethError(uint256 wethSpent, uint256 msgValue)', {
            wethSpent,
            msgValue,
        });
    }
}

export class MsgValueCannotEqualZeroError extends RevertError {
    constructor() {
        super('MsgValueCannotEqualZeroError', 'MsgValueCannotEqualZeroError()', {});
    }
}

const types = [
    UnregisteredAssetProxyError,
    CompleteBuyFailedError,
    CompleteSellFailedError,
    UnsupportedFeeError,
    OverspentWethError,
    MsgValueCannotEqualZeroError,
];

// Register the types we've defined.
for (const type of types) {
    RevertError.registerType(type);
}
