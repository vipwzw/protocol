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
exports.ZeroCantBeAuthorizedError = exports.TargetNotAuthorizedError = exports.TargetAlreadyAuthorizedError = exports.SenderNotAuthorizedError = exports.IndexOutOfBoundsError = exports.AuthorizedAddressMismatchError = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var AuthorizedAddressMismatchError = /** @class */ (function (_super) {
    __extends(AuthorizedAddressMismatchError, _super);
    function AuthorizedAddressMismatchError(authorized, target) {
        return _super.call(this, 'AuthorizedAddressMismatchError', 'AuthorizedAddressMismatchError(address authorized, address target)', {
            authorized: authorized,
            target: target,
        }) || this;
    }
    return AuthorizedAddressMismatchError;
}(revert_error_1.RevertError));
exports.AuthorizedAddressMismatchError = AuthorizedAddressMismatchError;
var IndexOutOfBoundsError = /** @class */ (function (_super) {
    __extends(IndexOutOfBoundsError, _super);
    function IndexOutOfBoundsError(index, len) {
        return _super.call(this, 'IndexOutOfBoundsError', 'IndexOutOfBoundsError(uint256 index, uint256 len)', { index: index, len: len }) || this;
    }
    return IndexOutOfBoundsError;
}(revert_error_1.RevertError));
exports.IndexOutOfBoundsError = IndexOutOfBoundsError;
var SenderNotAuthorizedError = /** @class */ (function (_super) {
    __extends(SenderNotAuthorizedError, _super);
    function SenderNotAuthorizedError(sender) {
        return _super.call(this, 'SenderNotAuthorizedError', 'SenderNotAuthorizedError(address sender)', { sender: sender }) || this;
    }
    return SenderNotAuthorizedError;
}(revert_error_1.RevertError));
exports.SenderNotAuthorizedError = SenderNotAuthorizedError;
var TargetAlreadyAuthorizedError = /** @class */ (function (_super) {
    __extends(TargetAlreadyAuthorizedError, _super);
    function TargetAlreadyAuthorizedError(target) {
        return _super.call(this, 'TargetAlreadyAuthorizedError', 'TargetAlreadyAuthorizedError(address target)', { target: target }) || this;
    }
    return TargetAlreadyAuthorizedError;
}(revert_error_1.RevertError));
exports.TargetAlreadyAuthorizedError = TargetAlreadyAuthorizedError;
var TargetNotAuthorizedError = /** @class */ (function (_super) {
    __extends(TargetNotAuthorizedError, _super);
    function TargetNotAuthorizedError(target) {
        return _super.call(this, 'TargetNotAuthorizedError', 'TargetNotAuthorizedError(address target)', { target: target }) || this;
    }
    return TargetNotAuthorizedError;
}(revert_error_1.RevertError));
exports.TargetNotAuthorizedError = TargetNotAuthorizedError;
var ZeroCantBeAuthorizedError = /** @class */ (function (_super) {
    __extends(ZeroCantBeAuthorizedError, _super);
    function ZeroCantBeAuthorizedError() {
        return _super.call(this, 'ZeroCantBeAuthorizedError', 'ZeroCantBeAuthorizedError()', {}) || this;
    }
    return ZeroCantBeAuthorizedError;
}(revert_error_1.RevertError));
exports.ZeroCantBeAuthorizedError = ZeroCantBeAuthorizedError;
var types = [
    AuthorizedAddressMismatchError,
    IndexOutOfBoundsError,
    SenderNotAuthorizedError,
    TargetAlreadyAuthorizedError,
    TargetNotAuthorizedError,
    ZeroCantBeAuthorizedError,
];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
