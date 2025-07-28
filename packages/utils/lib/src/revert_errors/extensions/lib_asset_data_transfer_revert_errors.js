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
exports.Erc721AmountMustEqualOneError = exports.UnsupportedAssetProxyError = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var UnsupportedAssetProxyError = /** @class */ (function (_super) {
    __extends(UnsupportedAssetProxyError, _super);
    function UnsupportedAssetProxyError(proxyId) {
        return _super.call(this, 'UnsupportedAssetProxyError', 'UnsupportedAssetProxyError(bytes4 proxyId)', { proxyId: proxyId }) || this;
    }
    return UnsupportedAssetProxyError;
}(revert_error_1.RevertError));
exports.UnsupportedAssetProxyError = UnsupportedAssetProxyError;
var Erc721AmountMustEqualOneError = /** @class */ (function (_super) {
    __extends(Erc721AmountMustEqualOneError, _super);
    function Erc721AmountMustEqualOneError(amount) {
        return _super.call(this, 'Erc721AmountMustEqualOneError', 'Erc721AmountMustEqualOneError(uint256 amount)', {
            amount: amount,
        }) || this;
    }
    return Erc721AmountMustEqualOneError;
}(revert_error_1.RevertError));
exports.Erc721AmountMustEqualOneError = Erc721AmountMustEqualOneError;
var types = [UnsupportedAssetProxyError, Erc721AmountMustEqualOneError];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
