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
exports.MismanagedMemoryError = void 0;
var revert_error_1 = require("../../revert_error");
var MismanagedMemoryError = /** @class */ (function (_super) {
    __extends(MismanagedMemoryError, _super);
    function MismanagedMemoryError(freeMemPtr, addressArrayEndPtr) {
        return _super.call(this, 'MismanagedMemoryError', 'MismanagedMemoryError(uint256 freeMemPtr, uint256 addressArrayEndPtr)', {
            freeMemPtr: freeMemPtr,
            addressArrayEndPtr: addressArrayEndPtr,
        }) || this;
    }
    return MismanagedMemoryError;
}(revert_error_1.RevertError));
exports.MismanagedMemoryError = MismanagedMemoryError;
// Register the MismanagedMemoryError type
revert_error_1.RevertError.registerType(MismanagedMemoryError);
