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
exports.SpenderERC20TransferFromFailedError = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var SpenderERC20TransferFromFailedError = /** @class */ (function (_super) {
    __extends(SpenderERC20TransferFromFailedError, _super);
    function SpenderERC20TransferFromFailedError(token, owner, to, amount, errorData) {
        return _super.call(this, 'SpenderERC20TransferFromFailedError', 'SpenderERC20TransferFromFailedError(address token, address owner, address to, uint256 amount, bytes errorData)', {
            token: token,
            owner: owner,
            to: to,
            amount: amount,
            errorData: errorData,
        }) || this;
    }
    return SpenderERC20TransferFromFailedError;
}(revert_error_1.RevertError));
exports.SpenderERC20TransferFromFailedError = SpenderERC20TransferFromFailedError;
var types = [SpenderERC20TransferFromFailedError];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
