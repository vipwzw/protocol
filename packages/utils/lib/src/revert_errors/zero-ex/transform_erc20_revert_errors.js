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
exports.InvalidTakerFeeTokenError = exports.InvalidTokenReceivedError = exports.WrongNumberOfTokensReceivedError = exports.InvalidERC20AssetDataError = exports.InsufficientProtocolFeeError = exports.InsufficientTakerTokenError = exports.IncompleteFillBuyQuoteError = exports.IncompleteFillSellQuoteError = exports.InvalidTransformDataError = exports.InvalidTransformDataErrorCode = exports.InvalidExecutionContextError = exports.OnlyCallableByDeployerError = exports.TransformerFailedError = exports.NegativeTransformERC20OutputError = exports.IncompleteTransformERC20Error = exports.InsufficientEthAttachedError = void 0;
var revert_error_1 = require("../../revert_error");
// tslint:disable:max-classes-per-file
var InsufficientEthAttachedError = /** @class */ (function (_super) {
    __extends(InsufficientEthAttachedError, _super);
    function InsufficientEthAttachedError(ethAttached, ethNeeded) {
        return _super.call(this, 'InsufficientEthAttachedError', 'InsufficientEthAttachedError(uint256 ethAttached, uint256 ethNeeded)', {
            ethAttached: ethAttached,
            ethNeeded: ethNeeded,
        }) || this;
    }
    return InsufficientEthAttachedError;
}(revert_error_1.RevertError));
exports.InsufficientEthAttachedError = InsufficientEthAttachedError;
var IncompleteTransformERC20Error = /** @class */ (function (_super) {
    __extends(IncompleteTransformERC20Error, _super);
    function IncompleteTransformERC20Error(outputToken, outputTokenAmount, minOutputTokenAmount) {
        return _super.call(this, 'IncompleteTransformERC20Error', 'IncompleteTransformERC20Error(address outputToken, uint256 outputTokenAmount, uint256 minOutputTokenAmount)', {
            outputToken: outputToken,
            outputTokenAmount: outputTokenAmount,
            minOutputTokenAmount: minOutputTokenAmount,
        }) || this;
    }
    return IncompleteTransformERC20Error;
}(revert_error_1.RevertError));
exports.IncompleteTransformERC20Error = IncompleteTransformERC20Error;
var NegativeTransformERC20OutputError = /** @class */ (function (_super) {
    __extends(NegativeTransformERC20OutputError, _super);
    function NegativeTransformERC20OutputError(outputToken, outputTokenLostAmount) {
        return _super.call(this, 'NegativeTransformERC20OutputError', 'NegativeTransformERC20OutputError(address outputToken, uint256 outputTokenLostAmount)', {
            outputToken: outputToken,
            outputTokenLostAmount: outputTokenLostAmount,
        }) || this;
    }
    return NegativeTransformERC20OutputError;
}(revert_error_1.RevertError));
exports.NegativeTransformERC20OutputError = NegativeTransformERC20OutputError;
var TransformerFailedError = /** @class */ (function (_super) {
    __extends(TransformerFailedError, _super);
    function TransformerFailedError(transformer, transformerData, resultData) {
        return _super.call(this, 'TransformerFailedError', 'TransformerFailedError(address transformer, bytes transformerData, bytes resultData)', {
            transformer: transformer,
            transformerData: transformerData,
            resultData: resultData,
        }) || this;
    }
    return TransformerFailedError;
}(revert_error_1.RevertError));
exports.TransformerFailedError = TransformerFailedError;
var OnlyCallableByDeployerError = /** @class */ (function (_super) {
    __extends(OnlyCallableByDeployerError, _super);
    function OnlyCallableByDeployerError(caller, deployer) {
        return _super.call(this, 'OnlyCallableByDeployerError', 'OnlyCallableByDeployerError(address caller, address deployer)', {
            caller: caller,
            deployer: deployer,
        }) || this;
    }
    return OnlyCallableByDeployerError;
}(revert_error_1.RevertError));
exports.OnlyCallableByDeployerError = OnlyCallableByDeployerError;
var InvalidExecutionContextError = /** @class */ (function (_super) {
    __extends(InvalidExecutionContextError, _super);
    function InvalidExecutionContextError(actualContext, expectedContext) {
        return _super.call(this, 'InvalidExecutionContextError', 'InvalidExecutionContextError(address actualContext, address expectedContext)', {
            actualContext: actualContext,
            expectedContext: expectedContext,
        }) || this;
    }
    return InvalidExecutionContextError;
}(revert_error_1.RevertError));
exports.InvalidExecutionContextError = InvalidExecutionContextError;
var InvalidTransformDataErrorCode;
(function (InvalidTransformDataErrorCode) {
    InvalidTransformDataErrorCode[InvalidTransformDataErrorCode["InvalidTokens"] = 0] = "InvalidTokens";
    InvalidTransformDataErrorCode[InvalidTransformDataErrorCode["InvalidArrayLength"] = 1] = "InvalidArrayLength";
})(InvalidTransformDataErrorCode || (exports.InvalidTransformDataErrorCode = InvalidTransformDataErrorCode = {}));
var InvalidTransformDataError = /** @class */ (function (_super) {
    __extends(InvalidTransformDataError, _super);
    function InvalidTransformDataError(errorCode, transformData) {
        return _super.call(this, 'InvalidTransformDataError', 'InvalidTransformDataError(uint8 errorCode, bytes transformData)', {
            errorCode: errorCode,
            transformData: transformData,
        }) || this;
    }
    return InvalidTransformDataError;
}(revert_error_1.RevertError));
exports.InvalidTransformDataError = InvalidTransformDataError;
var IncompleteFillSellQuoteError = /** @class */ (function (_super) {
    __extends(IncompleteFillSellQuoteError, _super);
    function IncompleteFillSellQuoteError(sellToken, soldAmount, sellAmount) {
        return _super.call(this, 'IncompleteFillSellQuoteError', 'IncompleteFillSellQuoteError(address sellToken, uint256 soldAmount, uint256 sellAmount)', {
            sellToken: sellToken,
            soldAmount: soldAmount,
            sellAmount: sellAmount,
        }) || this;
    }
    return IncompleteFillSellQuoteError;
}(revert_error_1.RevertError));
exports.IncompleteFillSellQuoteError = IncompleteFillSellQuoteError;
var IncompleteFillBuyQuoteError = /** @class */ (function (_super) {
    __extends(IncompleteFillBuyQuoteError, _super);
    function IncompleteFillBuyQuoteError(buyToken, boughtAmount, buyAmount) {
        return _super.call(this, 'IncompleteFillBuyQuoteError', 'IncompleteFillBuyQuoteError(address buyToken, uint256 boughtAmount, uint256 buyAmount)', {
            buyToken: buyToken,
            boughtAmount: boughtAmount,
            buyAmount: buyAmount,
        }) || this;
    }
    return IncompleteFillBuyQuoteError;
}(revert_error_1.RevertError));
exports.IncompleteFillBuyQuoteError = IncompleteFillBuyQuoteError;
var InsufficientTakerTokenError = /** @class */ (function (_super) {
    __extends(InsufficientTakerTokenError, _super);
    function InsufficientTakerTokenError(tokenBalance, tokensNeeded) {
        return _super.call(this, 'InsufficientTakerTokenError', 'InsufficientTakerTokenError(uint256 tokenBalance, uint256 tokensNeeded)', {
            tokenBalance: tokenBalance,
            tokensNeeded: tokensNeeded,
        }) || this;
    }
    return InsufficientTakerTokenError;
}(revert_error_1.RevertError));
exports.InsufficientTakerTokenError = InsufficientTakerTokenError;
var InsufficientProtocolFeeError = /** @class */ (function (_super) {
    __extends(InsufficientProtocolFeeError, _super);
    function InsufficientProtocolFeeError(ethBalance, ethNeeded) {
        return _super.call(this, 'InsufficientProtocolFeeError', 'InsufficientProtocolFeeError(uint256 ethBalance, uint256 ethNeeded)', {
            ethBalance: ethBalance,
            ethNeeded: ethNeeded,
        }) || this;
    }
    return InsufficientProtocolFeeError;
}(revert_error_1.RevertError));
exports.InsufficientProtocolFeeError = InsufficientProtocolFeeError;
var InvalidERC20AssetDataError = /** @class */ (function (_super) {
    __extends(InvalidERC20AssetDataError, _super);
    function InvalidERC20AssetDataError(assetData) {
        return _super.call(this, 'InvalidERC20AssetDataError', 'InvalidERC20AssetDataError(bytes assetData)', {
            assetData: assetData,
        }) || this;
    }
    return InvalidERC20AssetDataError;
}(revert_error_1.RevertError));
exports.InvalidERC20AssetDataError = InvalidERC20AssetDataError;
var WrongNumberOfTokensReceivedError = /** @class */ (function (_super) {
    __extends(WrongNumberOfTokensReceivedError, _super);
    function WrongNumberOfTokensReceivedError(actual, expected) {
        return _super.call(this, 'WrongNumberOfTokensReceivedError', 'WrongNumberOfTokensReceivedError(uint256 actual, uint256 expected)', {
            actual: actual,
            expected: expected,
        }) || this;
    }
    return WrongNumberOfTokensReceivedError;
}(revert_error_1.RevertError));
exports.WrongNumberOfTokensReceivedError = WrongNumberOfTokensReceivedError;
var InvalidTokenReceivedError = /** @class */ (function (_super) {
    __extends(InvalidTokenReceivedError, _super);
    function InvalidTokenReceivedError(token) {
        return _super.call(this, 'InvalidTokenReceivedError', 'InvalidTokenReceivedError(address token)', {
            token: token,
        }) || this;
    }
    return InvalidTokenReceivedError;
}(revert_error_1.RevertError));
exports.InvalidTokenReceivedError = InvalidTokenReceivedError;
var InvalidTakerFeeTokenError = /** @class */ (function (_super) {
    __extends(InvalidTakerFeeTokenError, _super);
    function InvalidTakerFeeTokenError(token) {
        return _super.call(this, 'InvalidTakerFeeTokenError', 'InvalidTakerFeeTokenError(address token)', {
            token: token,
        }) || this;
    }
    return InvalidTakerFeeTokenError;
}(revert_error_1.RevertError));
exports.InvalidTakerFeeTokenError = InvalidTakerFeeTokenError;
var types = [
    InsufficientEthAttachedError,
    IncompleteTransformERC20Error,
    NegativeTransformERC20OutputError,
    TransformerFailedError,
    IncompleteFillSellQuoteError,
    IncompleteFillBuyQuoteError,
    InsufficientTakerTokenError,
    InsufficientProtocolFeeError,
    InvalidERC20AssetDataError,
    WrongNumberOfTokensReceivedError,
    InvalidTokenReceivedError,
    InvalidTransformDataError,
    InvalidTakerFeeTokenError,
    OnlyCallableByDeployerError,
    InvalidExecutionContextError,
];
// Register the types we've defined.
for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
    var type = types_1[_i];
    revert_error_1.RevertError.registerType(type);
}
