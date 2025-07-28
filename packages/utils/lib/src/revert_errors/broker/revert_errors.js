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
exports.OnlyERC1155ProxyError = exports.InvalidFunctionSelectorError = exports.TooFewBrokerAssetsProvidedError = exports.AmountsLengthMustEqualOneError = exports.InvalidFromAddressError = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var InvalidFromAddressError = /** @class */ (function (_super) {
    __extends(InvalidFromAddressError, _super);
    function InvalidFromAddressError(from) {
        return _super.call(this, 'InvalidFromAddressError', 'InvalidFromAddressError(address from)', { from: from }) || this;
    }
    return InvalidFromAddressError;
}(revert_error_1.RevertError));
exports.InvalidFromAddressError = InvalidFromAddressError;
var AmountsLengthMustEqualOneError = /** @class */ (function (_super) {
    __extends(AmountsLengthMustEqualOneError, _super);
    function AmountsLengthMustEqualOneError(amountsLength) {
        return _super.call(this, 'AmountsLengthMustEqualOneError', 'AmountsLengthMustEqualOneError(uint256 amountsLength)', {
            amountsLength: amountsLength,
        }) || this;
    }
    return AmountsLengthMustEqualOneError;
}(revert_error_1.RevertError));
exports.AmountsLengthMustEqualOneError = AmountsLengthMustEqualOneError;
var TooFewBrokerAssetsProvidedError = /** @class */ (function (_super) {
    __extends(TooFewBrokerAssetsProvidedError, _super);
    function TooFewBrokerAssetsProvidedError(numBrokeredAssets) {
        return _super.call(this, 'TooFewBrokerAssetsProvidedError', 'TooFewBrokerAssetsProvidedError(uint256 numBrokeredAssets)', {
            numBrokeredAssets: numBrokeredAssets,
        }) || this;
    }
    return TooFewBrokerAssetsProvidedError;
}(revert_error_1.RevertError));
exports.TooFewBrokerAssetsProvidedError = TooFewBrokerAssetsProvidedError;
var InvalidFunctionSelectorError = /** @class */ (function (_super) {
    __extends(InvalidFunctionSelectorError, _super);
    function InvalidFunctionSelectorError(selector) {
        return _super.call(this, 'InvalidFunctionSelectorError', 'InvalidFunctionSelectorError(bytes4 selector)', { selector: selector }) || this;
    }
    return InvalidFunctionSelectorError;
}(revert_error_1.RevertError));
exports.InvalidFunctionSelectorError = InvalidFunctionSelectorError;
var OnlyERC1155ProxyError = /** @class */ (function (_super) {
    __extends(OnlyERC1155ProxyError, _super);
    function OnlyERC1155ProxyError(sender) {
        return _super.call(this, 'OnlyERC1155ProxyError', 'OnlyERC1155ProxyError(address sender)', { sender: sender }) || this;
    }
    return OnlyERC1155ProxyError;
}(revert_error_1.RevertError));
exports.OnlyERC1155ProxyError = OnlyERC1155ProxyError;
var types = [
    InvalidFromAddressError,
    AmountsLengthMustEqualOneError,
    TooFewBrokerAssetsProvidedError,
    InvalidFunctionSelectorError,
    OnlyERC1155ProxyError,
];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
