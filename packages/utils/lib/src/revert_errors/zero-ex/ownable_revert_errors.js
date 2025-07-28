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
exports.OnlyOwnerError = exports.MigrateCallFailedError = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var MigrateCallFailedError = /** @class */ (function (_super) {
    __extends(MigrateCallFailedError, _super);
    function MigrateCallFailedError(target, resultData) {
        return _super.call(this, 'MigrateCallFailedError', 'MigrateCallFailedError(address target, bytes resultData)', {
            target: target,
            resultData: resultData,
        }) || this;
    }
    return MigrateCallFailedError;
}(revert_error_1.RevertError));
exports.MigrateCallFailedError = MigrateCallFailedError;
var OnlyOwnerError = /** @class */ (function (_super) {
    __extends(OnlyOwnerError, _super);
    function OnlyOwnerError(sender, owner) {
        return _super.call(this, 'OnlyOwnerError', 'OnlyOwnerError(address sender, bytes owner)', {
            sender: sender,
            owner: owner,
        }) || this;
    }
    return OnlyOwnerError;
}(revert_error_1.RevertError));
exports.OnlyOwnerError = OnlyOwnerError;
// This is identical to the one in utils.
// export class TransferOwnerToZeroError extends RevertError {
//     constructor() {
//         super('TransferOwnerToZeroError', 'TransferOwnerToZeroError()', {});
//     }
// }
var types = [MigrateCallFailedError, OnlyOwnerError];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
