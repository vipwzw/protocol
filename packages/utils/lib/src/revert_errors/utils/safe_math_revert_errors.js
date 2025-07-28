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
exports.Uint256DowncastError = exports.Uint64BinOpError = exports.Uint96BinOpError = exports.Uint256BinOpError = exports.DowncastErrorCodes = exports.BinOpErrorCodes = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var BinOpErrorCodes;
(function (BinOpErrorCodes) {
    BinOpErrorCodes[BinOpErrorCodes["AdditionOverflow"] = 0] = "AdditionOverflow";
    BinOpErrorCodes[BinOpErrorCodes["MultiplicationOverflow"] = 1] = "MultiplicationOverflow";
    BinOpErrorCodes[BinOpErrorCodes["SubtractionUnderflow"] = 2] = "SubtractionUnderflow";
    BinOpErrorCodes[BinOpErrorCodes["DivisionByZero"] = 3] = "DivisionByZero";
})(BinOpErrorCodes || (exports.BinOpErrorCodes = BinOpErrorCodes = {}));
var DowncastErrorCodes;
(function (DowncastErrorCodes) {
    DowncastErrorCodes[DowncastErrorCodes["ValueTooLargeToDowncastToUint32"] = 0] = "ValueTooLargeToDowncastToUint32";
    DowncastErrorCodes[DowncastErrorCodes["ValueTooLargeToDowncastToUint64"] = 1] = "ValueTooLargeToDowncastToUint64";
    DowncastErrorCodes[DowncastErrorCodes["ValueTooLargeToDowncastToUint96"] = 2] = "ValueTooLargeToDowncastToUint96";
    DowncastErrorCodes[DowncastErrorCodes["ValueTooLargeToDowncastToUint128"] = 3] = "ValueTooLargeToDowncastToUint128";
})(DowncastErrorCodes || (exports.DowncastErrorCodes = DowncastErrorCodes = {}));
var Uint256BinOpError = /** @class */ (function (_super) {
    __extends(Uint256BinOpError, _super);
    function Uint256BinOpError(error, a, b) {
        return _super.call(this, 'Uint256BinOpError', 'Uint256BinOpError(uint8 error, uint256 a, uint256 b)', {
            error: error,
            a: a,
            b: b,
        }) || this;
    }
    return Uint256BinOpError;
}(revert_error_1.RevertError));
exports.Uint256BinOpError = Uint256BinOpError;
var Uint96BinOpError = /** @class */ (function (_super) {
    __extends(Uint96BinOpError, _super);
    function Uint96BinOpError(error, a, b) {
        return _super.call(this, 'Uint96BinOpError', 'Uint96BinOpError(uint8 error, uint96 a, uint96 b)', {
            error: error,
            a: a,
            b: b,
        }) || this;
    }
    return Uint96BinOpError;
}(revert_error_1.RevertError));
exports.Uint96BinOpError = Uint96BinOpError;
var Uint64BinOpError = /** @class */ (function (_super) {
    __extends(Uint64BinOpError, _super);
    function Uint64BinOpError(error, a, b) {
        return _super.call(this, 'Uint64BinOpError', 'Uint64BinOpError(uint8 error, uint64 a, uint64 b)', {
            error: error,
            a: a,
            b: b,
        }) || this;
    }
    return Uint64BinOpError;
}(revert_error_1.RevertError));
exports.Uint64BinOpError = Uint64BinOpError;
var Uint256DowncastError = /** @class */ (function (_super) {
    __extends(Uint256DowncastError, _super);
    function Uint256DowncastError(error, a) {
        return _super.call(this, 'Uint256DowncastError', 'Uint256DowncastError(uint8 error, uint256 a)', {
            error: error,
            a: a,
        }) || this;
    }
    return Uint256DowncastError;
}(revert_error_1.RevertError));
exports.Uint256DowncastError = Uint256DowncastError;
var types = [Uint256BinOpError, Uint96BinOpError, Uint64BinOpError, Uint256DowncastError];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
