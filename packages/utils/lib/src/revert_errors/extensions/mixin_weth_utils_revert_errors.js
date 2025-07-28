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
exports.EthFeeLengthMismatchError = exports.DefaultFunctionWethContractOnlyError = exports.InsufficientEthForFeeError = exports.UnregisteredAssetProxyError = void 0;
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
var InsufficientEthForFeeError = /** @class */ (function (_super) {
    __extends(InsufficientEthForFeeError, _super);
    function InsufficientEthForFeeError(ethFeeRequired, ethAvailable) {
        return _super.call(this, 'InsufficientEthForFeeError', 'InsufficientEthForFeeError(uint256 ethFeeRequired, uint256 ethAvailable)', { ethFeeRequired: ethFeeRequired, ethAvailable: ethAvailable }) || this;
    }
    return InsufficientEthForFeeError;
}(revert_error_1.RevertError));
exports.InsufficientEthForFeeError = InsufficientEthForFeeError;
var DefaultFunctionWethContractOnlyError = /** @class */ (function (_super) {
    __extends(DefaultFunctionWethContractOnlyError, _super);
    function DefaultFunctionWethContractOnlyError(senderAddress) {
        return _super.call(this, 'DefaultFunctionWethContractOnlyError', 'DefaultFunctionWethContractOnlyError(address senderAddress)', {
            senderAddress: senderAddress,
        }) || this;
    }
    return DefaultFunctionWethContractOnlyError;
}(revert_error_1.RevertError));
exports.DefaultFunctionWethContractOnlyError = DefaultFunctionWethContractOnlyError;
var EthFeeLengthMismatchError = /** @class */ (function (_super) {
    __extends(EthFeeLengthMismatchError, _super);
    function EthFeeLengthMismatchError(ethFeesLength, feeRecipientsLength) {
        return _super.call(this, 'EthFeeLengthMismatchError', 'EthFeeLengthMismatchError(uint256 ethFeesLength, uint256 feeRecipientsLength)', {
            ethFeesLength: ethFeesLength,
            feeRecipientsLength: feeRecipientsLength,
        }) || this;
    }
    return EthFeeLengthMismatchError;
}(revert_error_1.RevertError));
exports.EthFeeLengthMismatchError = EthFeeLengthMismatchError;
var types = [InsufficientEthForFeeError, DefaultFunctionWethContractOnlyError, EthFeeLengthMismatchError];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
