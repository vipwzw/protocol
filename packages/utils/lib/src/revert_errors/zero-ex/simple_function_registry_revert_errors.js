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
exports.NotInRollbackHistoryError = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var NotInRollbackHistoryError = /** @class */ (function (_super) {
    __extends(NotInRollbackHistoryError, _super);
    function NotInRollbackHistoryError(selector, targetImpl) {
        return _super.call(this, 'NotInRollbackHistoryError', 'NotInRollbackHistoryError(bytes4 selector, address targetImpl)', {
            selector: selector,
            targetImpl: targetImpl,
        }) || this;
    }
    return NotInRollbackHistoryError;
}(revert_error_1.RevertError));
exports.NotInRollbackHistoryError = NotInRollbackHistoryError;
var types = [NotInRollbackHistoryError];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
