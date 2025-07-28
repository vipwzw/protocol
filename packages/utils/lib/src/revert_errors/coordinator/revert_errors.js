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
exports.InvalidApprovalSignatureError = exports.ApprovalExpiredError = exports.InvalidOriginError = exports.SignatureError = exports.SignatureErrorCodes = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var SignatureErrorCodes;
(function (SignatureErrorCodes) {
    SignatureErrorCodes[SignatureErrorCodes["InvalidLength"] = 0] = "InvalidLength";
    SignatureErrorCodes[SignatureErrorCodes["Unsupported"] = 1] = "Unsupported";
    SignatureErrorCodes[SignatureErrorCodes["Illegal"] = 2] = "Illegal";
    SignatureErrorCodes[SignatureErrorCodes["Invalid"] = 3] = "Invalid";
})(SignatureErrorCodes || (exports.SignatureErrorCodes = SignatureErrorCodes = {}));
var SignatureError = /** @class */ (function (_super) {
    __extends(SignatureError, _super);
    function SignatureError(errorCode, hash, signature) {
        return _super.call(this, 'SignatureError', 'SignatureError(uint8 errorCode, bytes32 hash, bytes signature)', {
            errorCode: errorCode,
            hash: hash,
            signature: signature,
        }) || this;
    }
    return SignatureError;
}(revert_error_1.RevertError));
exports.SignatureError = SignatureError;
var InvalidOriginError = /** @class */ (function (_super) {
    __extends(InvalidOriginError, _super);
    function InvalidOriginError(expectedOrigin) {
        return _super.call(this, 'InvalidOriginError', 'InvalidOriginError(address expectedOrigin)', { expectedOrigin: expectedOrigin }) || this;
    }
    return InvalidOriginError;
}(revert_error_1.RevertError));
exports.InvalidOriginError = InvalidOriginError;
var ApprovalExpiredError = /** @class */ (function (_super) {
    __extends(ApprovalExpiredError, _super);
    function ApprovalExpiredError(transactionHash, approvalExpirationTime) {
        return _super.call(this, 'ApprovalExpiredError', 'ApprovalExpiredError(bytes32 transactionHash, uint256 approvalExpirationTime)', {
            transactionHash: transactionHash,
            approvalExpirationTime: approvalExpirationTime,
        }) || this;
    }
    return ApprovalExpiredError;
}(revert_error_1.RevertError));
exports.ApprovalExpiredError = ApprovalExpiredError;
var InvalidApprovalSignatureError = /** @class */ (function (_super) {
    __extends(InvalidApprovalSignatureError, _super);
    function InvalidApprovalSignatureError(transactionHash, approverAddress) {
        return _super.call(this, 'InvalidApprovalSignatureError', 'InvalidApprovalSignatureError(bytes32 transactionHash, address approverAddress)', { transactionHash: transactionHash, approverAddress: approverAddress }) || this;
    }
    return InvalidApprovalSignatureError;
}(revert_error_1.RevertError));
exports.InvalidApprovalSignatureError = InvalidApprovalSignatureError;
var types = [SignatureError, InvalidOriginError, ApprovalExpiredError, InvalidApprovalSignatureError];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
