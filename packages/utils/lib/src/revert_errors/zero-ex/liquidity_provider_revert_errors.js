"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoLiquidityProviderForMarketError = exports.LiquidityProviderIncompleteSellError = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var LiquidityProviderIncompleteSellError = /** @class */ (function (_super) {
    __extends(LiquidityProviderIncompleteSellError, _super);
    function LiquidityProviderIncompleteSellError(providerAddress, makerToken, takerToken, sellAmount, boughtAmount, minBuyAmount) {
        return _super.call(this, 'LiquidityProviderIncompleteSellError', 'LiquidityProviderIncompleteSellError(address providerAddress, address makerToken, address takerToken, uint256 sellAmount, uint256 boughtAmount, uint256 minBuyAmount)', {
            providerAddress: providerAddress,
            makerToken: makerToken,
            takerToken: takerToken,
            sellAmount: sellAmount,
            boughtAmount: boughtAmount,
            minBuyAmount: minBuyAmount,
        }) || this;
    }
    return LiquidityProviderIncompleteSellError;
}(revert_error_1.RevertError));
exports.LiquidityProviderIncompleteSellError = LiquidityProviderIncompleteSellError;
var NoLiquidityProviderForMarketError = /** @class */ (function (_super) {
    __extends(NoLiquidityProviderForMarketError, _super);
    function NoLiquidityProviderForMarketError(xAsset, yAsset) {
        return _super.call(this, 'NoLiquidityProviderForMarketError', 'NoLiquidityProviderForMarketError(address xAsset, address yAsset)', {
            xAsset: xAsset,
            yAsset: yAsset,
        }) || this;
    }
    return NoLiquidityProviderForMarketError;
}(revert_error_1.RevertError));
exports.NoLiquidityProviderForMarketError = NoLiquidityProviderForMarketError;
var types = [LiquidityProviderIncompleteSellError, NoLiquidityProviderForMarketError];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
