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
exports.InvalidByteOperationError = exports.InvalidByteOperationErrorCodes = void 0;
var revert_error_1 = require("../../revert_error");
var InvalidByteOperationErrorCodes;
(function (InvalidByteOperationErrorCodes) {
    InvalidByteOperationErrorCodes[InvalidByteOperationErrorCodes["FromLessThanOrEqualsToRequired"] = 0] = "FromLessThanOrEqualsToRequired";
    InvalidByteOperationErrorCodes[InvalidByteOperationErrorCodes["ToLessThanOrEqualsLengthRequired"] = 1] = "ToLessThanOrEqualsLengthRequired";
    InvalidByteOperationErrorCodes[InvalidByteOperationErrorCodes["LengthGreaterThanZeroRequired"] = 2] = "LengthGreaterThanZeroRequired";
    InvalidByteOperationErrorCodes[InvalidByteOperationErrorCodes["LengthGreaterThanOrEqualsFourRequired"] = 3] = "LengthGreaterThanOrEqualsFourRequired";
    InvalidByteOperationErrorCodes[InvalidByteOperationErrorCodes["LengthGreaterThanOrEqualsTwentyRequired"] = 4] = "LengthGreaterThanOrEqualsTwentyRequired";
    InvalidByteOperationErrorCodes[InvalidByteOperationErrorCodes["LengthGreaterThanOrEqualsThirtyTwoRequired"] = 5] = "LengthGreaterThanOrEqualsThirtyTwoRequired";
    InvalidByteOperationErrorCodes[InvalidByteOperationErrorCodes["LengthGreaterThanOrEqualsNestedBytesLengthRequired"] = 6] = "LengthGreaterThanOrEqualsNestedBytesLengthRequired";
    InvalidByteOperationErrorCodes[InvalidByteOperationErrorCodes["DestinationLengthGreaterThanOrEqualSourceLengthRequired"] = 7] = "DestinationLengthGreaterThanOrEqualSourceLengthRequired";
})(InvalidByteOperationErrorCodes || (exports.InvalidByteOperationErrorCodes = InvalidByteOperationErrorCodes = {}));
var InvalidByteOperationError = /** @class */ (function (_super) {
    __extends(InvalidByteOperationError, _super);
    function InvalidByteOperationError(error, offset, required) {
        return _super.call(this, 'InvalidByteOperationError', 'InvalidByteOperationError(uint8 error, uint256 offset, uint256 required)', {
            error: error,
            offset: offset,
            required: required,
        }) || this;
    }
    return InvalidByteOperationError;
}(revert_error_1.RevertError));
exports.InvalidByteOperationError = InvalidByteOperationError;
// Register the InvalidByteOperationError type
revert_error_1.RevertError.registerType(InvalidByteOperationError);
