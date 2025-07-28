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
exports.BinOpError = exports.UnsignedValueError = exports.SignedValueError = exports.BinOpErrorCodes = exports.ValueErrorCodes = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var ValueErrorCodes;
(function (ValueErrorCodes) {
    ValueErrorCodes[ValueErrorCodes["TooSmall"] = 0] = "TooSmall";
    ValueErrorCodes[ValueErrorCodes["TooLarge"] = 1] = "TooLarge";
})(ValueErrorCodes || (exports.ValueErrorCodes = ValueErrorCodes = {}));
var BinOpErrorCodes;
(function (BinOpErrorCodes) {
    BinOpErrorCodes[BinOpErrorCodes["AdditionOverflow"] = 0] = "AdditionOverflow";
    BinOpErrorCodes[BinOpErrorCodes["MultiplicationOverflow"] = 1] = "MultiplicationOverflow";
    BinOpErrorCodes[BinOpErrorCodes["DivisionByZero"] = 2] = "DivisionByZero";
    BinOpErrorCodes[BinOpErrorCodes["DivisionOverflow"] = 3] = "DivisionOverflow";
})(BinOpErrorCodes || (exports.BinOpErrorCodes = BinOpErrorCodes = {}));
var SignedValueError = /** @class */ (function (_super) {
    __extends(SignedValueError, _super);
    function SignedValueError(error, n) {
        return _super.call(this, 'SignedValueError', 'SignedValueError(uint8 error, int256 n)', {
            error: error,
            n: n,
        }) || this;
    }
    return SignedValueError;
}(revert_error_1.RevertError));
exports.SignedValueError = SignedValueError;
var UnsignedValueError = /** @class */ (function (_super) {
    __extends(UnsignedValueError, _super);
    function UnsignedValueError(error, n) {
        return _super.call(this, 'UnsignedValueError', 'UnsignedValueError(uint8 error, uint256 n)', {
            error: error,
            n: n,
        }) || this;
    }
    return UnsignedValueError;
}(revert_error_1.RevertError));
exports.UnsignedValueError = UnsignedValueError;
var BinOpError = /** @class */ (function (_super) {
    __extends(BinOpError, _super);
    function BinOpError(error, a, b) {
        return _super.call(this, 'BinOpError', 'BinOpError(uint8 error, int256 a, int256 b)', {
            error: error,
            a: a,
            b: b,
        }) || this;
    }
    return BinOpError;
}(revert_error_1.RevertError));
exports.BinOpError = BinOpError;
var types = [SignedValueError, UnsignedValueError, BinOpError];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
