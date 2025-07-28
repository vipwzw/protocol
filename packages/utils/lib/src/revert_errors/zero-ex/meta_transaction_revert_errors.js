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
exports.MetaTransactionCallFailedError = exports.MetaTransactionInvalidSignatureError = exports.MetaTransactionInsufficientEthError = exports.MetaTransactionGasPriceError = exports.MetaTransactionExpiredError = exports.MetaTransactionWrongSenderError = exports.MetaTransactionUnsupportedFunctionError = exports.MetaTransactionAlreadyExecutedError = exports.InvalidMetaTransactionsArrayLengthsError = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var InvalidMetaTransactionsArrayLengthsError = /** @class */ (function (_super) {
    __extends(InvalidMetaTransactionsArrayLengthsError, _super);
    function InvalidMetaTransactionsArrayLengthsError(mtxCount, signatureCount) {
        return _super.call(this, 'InvalidMetaTransactionsArrayLengthsError', 'InvalidMetaTransactionsArrayLengthsError(uint256 mtxCount, uint256 signatureCount)', {
            mtxCount: mtxCount,
            signatureCount: signatureCount,
        }) || this;
    }
    return InvalidMetaTransactionsArrayLengthsError;
}(revert_error_1.RevertError));
exports.InvalidMetaTransactionsArrayLengthsError = InvalidMetaTransactionsArrayLengthsError;
var MetaTransactionAlreadyExecutedError = /** @class */ (function (_super) {
    __extends(MetaTransactionAlreadyExecutedError, _super);
    function MetaTransactionAlreadyExecutedError(mtxHash, executedBlockNumber) {
        return _super.call(this, 'MetaTransactionAlreadyExecutedError', 'MetaTransactionAlreadyExecutedError(bytes32 mtxHash, uint256 executedBlockNumber)', {
            mtxHash: mtxHash,
            executedBlockNumber: executedBlockNumber,
        }) || this;
    }
    return MetaTransactionAlreadyExecutedError;
}(revert_error_1.RevertError));
exports.MetaTransactionAlreadyExecutedError = MetaTransactionAlreadyExecutedError;
var MetaTransactionUnsupportedFunctionError = /** @class */ (function (_super) {
    __extends(MetaTransactionUnsupportedFunctionError, _super);
    function MetaTransactionUnsupportedFunctionError(mtxHash, selector) {
        return _super.call(this, 'MetaTransactionUnsupportedFunctionError', 'MetaTransactionUnsupportedFunctionError(bytes32 mtxHash, bytes4 selector)', {
            mtxHash: mtxHash,
            selector: selector,
        }) || this;
    }
    return MetaTransactionUnsupportedFunctionError;
}(revert_error_1.RevertError));
exports.MetaTransactionUnsupportedFunctionError = MetaTransactionUnsupportedFunctionError;
var MetaTransactionWrongSenderError = /** @class */ (function (_super) {
    __extends(MetaTransactionWrongSenderError, _super);
    function MetaTransactionWrongSenderError(mtxHash, sender, expectedSender) {
        return _super.call(this, 'MetaTransactionWrongSenderError', 'MetaTransactionWrongSenderError(bytes32 mtxHash, address sender, address expectedSender)', {
            mtxHash: mtxHash,
            sender: sender,
            expectedSender: expectedSender,
        }) || this;
    }
    return MetaTransactionWrongSenderError;
}(revert_error_1.RevertError));
exports.MetaTransactionWrongSenderError = MetaTransactionWrongSenderError;
var MetaTransactionExpiredError = /** @class */ (function (_super) {
    __extends(MetaTransactionExpiredError, _super);
    function MetaTransactionExpiredError(mtxHash, time, expirationTime) {
        return _super.call(this, 'MetaTransactionExpiredError', 'MetaTransactionExpiredError(bytes32 mtxHash, uint256 time, uint256 expirationTime)', {
            mtxHash: mtxHash,
            time: time,
            expirationTime: expirationTime,
        }) || this;
    }
    return MetaTransactionExpiredError;
}(revert_error_1.RevertError));
exports.MetaTransactionExpiredError = MetaTransactionExpiredError;
var MetaTransactionGasPriceError = /** @class */ (function (_super) {
    __extends(MetaTransactionGasPriceError, _super);
    function MetaTransactionGasPriceError(mtxHash, gasPrice, minGasPrice, maxGasPrice) {
        return _super.call(this, 'MetaTransactionGasPriceError', 'MetaTransactionGasPriceError(bytes32 mtxHash, uint256 gasPrice, uint256 minGasPrice, uint256 maxGasPrice)', {
            mtxHash: mtxHash,
            gasPrice: gasPrice,
            minGasPrice: minGasPrice,
            maxGasPrice: maxGasPrice,
        }) || this;
    }
    return MetaTransactionGasPriceError;
}(revert_error_1.RevertError));
exports.MetaTransactionGasPriceError = MetaTransactionGasPriceError;
var MetaTransactionInsufficientEthError = /** @class */ (function (_super) {
    __extends(MetaTransactionInsufficientEthError, _super);
    function MetaTransactionInsufficientEthError(mtxHash, ethBalance, ethRequired) {
        return _super.call(this, 'MetaTransactionInsufficientEthError', 'MetaTransactionInsufficientEthError(bytes32 mtxHash, uint256 ethBalance, uint256 ethRequired)', {
            mtxHash: mtxHash,
            ethBalance: ethBalance,
            ethRequired: ethRequired,
        }) || this;
    }
    return MetaTransactionInsufficientEthError;
}(revert_error_1.RevertError));
exports.MetaTransactionInsufficientEthError = MetaTransactionInsufficientEthError;
var MetaTransactionInvalidSignatureError = /** @class */ (function (_super) {
    __extends(MetaTransactionInvalidSignatureError, _super);
    function MetaTransactionInvalidSignatureError(mtxHash, signature, errData) {
        return _super.call(this, 'MetaTransactionInvalidSignatureError', 'MetaTransactionInvalidSignatureError(bytes32 mtxHash, bytes signature, bytes errData)', {
            mtxHash: mtxHash,
            signature: signature,
            errData: errData,
        }) || this;
    }
    return MetaTransactionInvalidSignatureError;
}(revert_error_1.RevertError));
exports.MetaTransactionInvalidSignatureError = MetaTransactionInvalidSignatureError;
var MetaTransactionCallFailedError = /** @class */ (function (_super) {
    __extends(MetaTransactionCallFailedError, _super);
    function MetaTransactionCallFailedError(mtxHash, callData, returnData) {
        return _super.call(this, 'MetaTransactionCallFailedError', 'MetaTransactionCallFailedError(bytes32 mtxHash, bytes callData, bytes returnData)', {
            mtxHash: mtxHash,
            callData: callData,
            returnData: returnData,
        }) || this;
    }
    return MetaTransactionCallFailedError;
}(revert_error_1.RevertError));
exports.MetaTransactionCallFailedError = MetaTransactionCallFailedError;
var types = [
    InvalidMetaTransactionsArrayLengthsError,
    MetaTransactionAlreadyExecutedError,
    MetaTransactionUnsupportedFunctionError,
    MetaTransactionWrongSenderError,
    MetaTransactionExpiredError,
    MetaTransactionGasPriceError,
    MetaTransactionInsufficientEthError,
    MetaTransactionInvalidSignatureError,
    MetaTransactionCallFailedError,
];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
