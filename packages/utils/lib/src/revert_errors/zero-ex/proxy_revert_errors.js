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
exports.BootstrapCallFailedError = exports.InvalidDieCallerError = exports.InvalidBootstrapCallerError = exports.NotImplementedError = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var NotImplementedError = /** @class */ (function (_super) {
    __extends(NotImplementedError, _super);
    function NotImplementedError(selector) {
        return _super.call(this, 'NotImplementedError', 'NotImplementedError(bytes4 selector)', {
            selector: selector,
        }) || this;
    }
    return NotImplementedError;
}(revert_error_1.RevertError));
exports.NotImplementedError = NotImplementedError;
var InvalidBootstrapCallerError = /** @class */ (function (_super) {
    __extends(InvalidBootstrapCallerError, _super);
    function InvalidBootstrapCallerError(caller, expectedCaller) {
        return _super.call(this, 'InvalidBootstrapCallerError', 'InvalidBootstrapCallerError(address caller, address expectedCaller)', {
            caller: caller,
            expectedCaller: expectedCaller,
        }) || this;
    }
    return InvalidBootstrapCallerError;
}(revert_error_1.RevertError));
exports.InvalidBootstrapCallerError = InvalidBootstrapCallerError;
var InvalidDieCallerError = /** @class */ (function (_super) {
    __extends(InvalidDieCallerError, _super);
    function InvalidDieCallerError(caller, expectedCaller) {
        return _super.call(this, 'InvalidDieCallerError', 'InvalidDieCallerError(address caller, address expectedCaller)', {
            caller: caller,
            expectedCaller: expectedCaller,
        }) || this;
    }
    return InvalidDieCallerError;
}(revert_error_1.RevertError));
exports.InvalidDieCallerError = InvalidDieCallerError;
var BootstrapCallFailedError = /** @class */ (function (_super) {
    __extends(BootstrapCallFailedError, _super);
    function BootstrapCallFailedError(target, resultData) {
        return _super.call(this, 'BootstrapCallFailedError', 'BootstrapCallFailedError(address target, bytes resultData)', {
            target: target,
            resultData: resultData,
        }) || this;
    }
    return BootstrapCallFailedError;
}(revert_error_1.RevertError));
exports.BootstrapCallFailedError = BootstrapCallFailedError;
var types = [BootstrapCallFailedError, InvalidBootstrapCallerError, InvalidDieCallerError, NotImplementedError];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
