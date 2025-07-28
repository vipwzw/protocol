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
exports.MsgValueCannotEqualZeroError = exports.OverspentWethError = exports.UnsupportedFeeError = exports.CompleteSellFailedError = exports.CompleteBuyFailedError = exports.UnregisteredAssetProxyError = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var UnregisteredAssetProxyError = /** @class */ (function (_super) {
    __extends(UnregisteredAssetProxyError, _super);
    function UnregisteredAssetProxyError() {
        return _super.call(this, 'UnregisteredAssetProxyError', 'UnregisteredAssetProxyError()', {}) || this;
    }
    return UnregisteredAssetProxyError;
}(revert_error_1.RevertError));
exports.UnregisteredAssetProxyError = UnregisteredAssetProxyError;
var CompleteBuyFailedError = /** @class */ (function (_super) {
    __extends(CompleteBuyFailedError, _super);
    function CompleteBuyFailedError(expectedAssetBuyAmount, actualAssetBuyAmount) {
        return _super.call(this, 'CompleteBuyFailedError', 'CompleteBuyFailedError(uint256 expectedAssetBuyAmount, uint256 actualAssetBuyAmount)', { expectedAssetBuyAmount: expectedAssetBuyAmount, actualAssetBuyAmount: actualAssetBuyAmount }) || this;
    }
    return CompleteBuyFailedError;
}(revert_error_1.RevertError));
exports.CompleteBuyFailedError = CompleteBuyFailedError;
var CompleteSellFailedError = /** @class */ (function (_super) {
    __extends(CompleteSellFailedError, _super);
    function CompleteSellFailedError(expectedAssetSellAmount, actualAssetSellAmount) {
        return _super.call(this, 'CompleteSellFailedError', 'CompleteSellFailedError(uint256 expectedAssetSellAmount, uint256 actualAssetSellAmount)', { expectedAssetSellAmount: expectedAssetSellAmount, actualAssetSellAmount: actualAssetSellAmount }) || this;
    }
    return CompleteSellFailedError;
}(revert_error_1.RevertError));
exports.CompleteSellFailedError = CompleteSellFailedError;
var UnsupportedFeeError = /** @class */ (function (_super) {
    __extends(UnsupportedFeeError, _super);
    function UnsupportedFeeError(takerFeeAssetData) {
        return _super.call(this, 'UnsupportedFeeError', 'UnsupportedFeeError(bytes takerFeeAssetData)', { takerFeeAssetData: takerFeeAssetData }) || this;
    }
    return UnsupportedFeeError;
}(revert_error_1.RevertError));
exports.UnsupportedFeeError = UnsupportedFeeError;
var OverspentWethError = /** @class */ (function (_super) {
    __extends(OverspentWethError, _super);
    function OverspentWethError(wethSpent, msgValue) {
        return _super.call(this, 'OverspentWethError', 'OverspentWethError(uint256 wethSpent, uint256 msgValue)', {
            wethSpent: wethSpent,
            msgValue: msgValue,
        }) || this;
    }
    return OverspentWethError;
}(revert_error_1.RevertError));
exports.OverspentWethError = OverspentWethError;
var MsgValueCannotEqualZeroError = /** @class */ (function (_super) {
    __extends(MsgValueCannotEqualZeroError, _super);
    function MsgValueCannotEqualZeroError() {
        return _super.call(this, 'MsgValueCannotEqualZeroError', 'MsgValueCannotEqualZeroError()', {}) || this;
    }
    return MsgValueCannotEqualZeroError;
}(revert_error_1.RevertError));
exports.MsgValueCannotEqualZeroError = MsgValueCannotEqualZeroError;
var types = [
    UnregisteredAssetProxyError,
    CompleteBuyFailedError,
    CompleteSellFailedError,
    UnsupportedFeeError,
    OverspentWethError,
    MsgValueCannotEqualZeroError,
];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
