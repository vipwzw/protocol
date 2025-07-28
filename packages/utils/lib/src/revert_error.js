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
exports.RawRevertError = exports.AnyRevertError = exports.StringRevertError = exports.RevertError = void 0;
exports.registerRevertErrorType = registerRevertErrorType;
exports.decodeBytesAsRevertError = decodeBytesAsRevertError;
exports.decodeThrownErrorAsRevertError = decodeThrownErrorAsRevertError;
exports.coerceThrownErrorAsRevertError = coerceThrownErrorAsRevertError;
exports.getThrownErrorRevertErrorBytes = getThrownErrorRevertErrorBytes;
var ethUtil = require("ethereumjs-util");
var _ = require("lodash");
var util_1 = require("util");
var AbiEncoder = require("./abi_encoder");
var configured_bignumber_1 = require("./configured_bignumber");
/**
 * Register a RevertError type so that it can be decoded by
 * `decodeRevertError`.
 * @param revertClass A class that inherits from RevertError.
 * @param force Allow overwriting registered types.
 */
function registerRevertErrorType(revertClass, force) {
    if (force === void 0) { force = false; }
    RevertError.registerType(revertClass, force);
}
/**
 * Decode an ABI encoded revert error.
 * Throws if the data cannot be decoded as a known RevertError type.
 * @param bytes The ABI encoded revert error. Either a hex string or a Buffer.
 * @param coerce Coerce unknown selectors into a `RawRevertError` type.
 * @return A RevertError object.
 */
function decodeBytesAsRevertError(bytes, coerce) {
    if (coerce === void 0) { coerce = false; }
    return RevertError.decode(bytes, coerce);
}
/**
 * Decode a thrown error.
 * Throws if the data cannot be decoded as a known RevertError type.
 * @param error Any thrown error.
 * @param coerce Coerce unknown selectors into a `RawRevertError` type.
 * @return A RevertError object.
 */
function decodeThrownErrorAsRevertError(error, coerce) {
    if (coerce === void 0) { coerce = false; }
    if (error instanceof RevertError) {
        return error;
    }
    return RevertError.decode(getThrownErrorRevertErrorBytes(error), coerce);
}
/**
 * Coerce a thrown error into a `RevertError`. Always succeeds.
 * @param error Any thrown error.
 * @return A RevertError object.
 */
function coerceThrownErrorAsRevertError(error) {
    if (error instanceof RevertError) {
        return error;
    }
    try {
        return decodeThrownErrorAsRevertError(error, true);
    }
    catch (err) {
        if (isGanacheTransactionRevertError(error)) {
            throw err;
        }
        // Handle geth transaction reverts.
        if (isGethTransactionRevertError(error)) {
            // Geth transaction reverts are opaque, meaning no useful data is returned,
            // so we just return an AnyRevertError type.
            return new AnyRevertError();
        }
        // Coerce plain errors into a StringRevertError.
        return new StringRevertError(error.message);
    }
}
/**
 * Base type for revert errors.
 */
var RevertError = /** @class */ (function (_super) {
    __extends(RevertError, _super);
    /**
     * Create a RevertError instance with optional parameter values.
     * Parameters that are left undefined will not be tested in equality checks.
     * @param declaration Function-style declaration of the revert (e.g., Error(string message))
     * @param values Optional mapping of parameters to values.
     * @param raw Optional encoded form of the revert error. If supplied, this
     *        instance will be treated as a `RawRevertError`, meaning it can only
     *        match other `RawRevertError` types with the same encoded payload.
     */
    function RevertError(name, declaration, values, raw) {
        var _newTarget = this.constructor;
        var _this = _super.call(this, createErrorMessage(name, values)) || this;
        _this.values = {};
        if (declaration !== undefined) {
            _this.abi = declarationToAbi(declaration);
            if (values !== undefined) {
                _.assign(_this.values, _.cloneDeep(values));
            }
        }
        _this._raw = raw;
        // Extending Error is tricky; we need to explicitly set the prototype.
        Object.setPrototypeOf(_this, _newTarget.prototype);
        return _this;
    }
    /**
     * Decode an ABI encoded revert error.
     * Throws if the data cannot be decoded as a known RevertError type.
     * @param bytes The ABI encoded revert error. Either a hex string or a Buffer.
     * @param coerce Whether to coerce unknown selectors into a `RawRevertError` type.
     * @return A RevertError object.
     */
    RevertError.decode = function (bytes, coerce) {
        if (coerce === void 0) { coerce = false; }
        if (bytes instanceof RevertError) {
            return bytes;
        }
        var _bytes = bytes instanceof Buffer ? ethUtil.bufferToHex(bytes) : ethUtil.addHexPrefix(bytes);
        // tslint:disable-next-line: custom-no-magic-numbers
        var selector = _bytes.slice(2, 10);
        if (!(selector in RevertError._typeRegistry)) {
            if (coerce) {
                return new RawRevertError(bytes);
            }
            throw new Error("Unknown selector: ".concat(selector));
        }
        var _a = RevertError._typeRegistry[selector], type = _a.type, decoder = _a.decoder;
        var instance = new type();
        try {
            Object.assign(instance, { values: decoder(_bytes) });
            instance.message = instance.toString();
            return instance;
        }
        catch (err) {
            throw new Error("Bytes ".concat(_bytes, " cannot be decoded as a revert error of type ").concat(instance.signature, ": ").concat(err.message));
        }
    };
    /**
     * Register a RevertError type so that it can be decoded by
     * `RevertError.decode`.
     * @param revertClass A class that inherits from RevertError.
     * @param force Allow overwriting existing registrations.
     */
    RevertError.registerType = function (revertClass, force) {
        if (force === void 0) { force = false; }
        var instance = new revertClass();
        if (!force && instance.selector in RevertError._typeRegistry) {
            throw new Error("RevertError type with signature \"".concat(instance.signature, "\" is already registered"));
        }
        if (_.isNil(instance.abi)) {
            throw new Error("Attempting to register a RevertError class with no ABI");
        }
        RevertError._typeRegistry[instance.selector] = {
            type: revertClass,
            decoder: createDecoder(instance.abi),
        };
    };
    Object.defineProperty(RevertError.prototype, "name", {
        /**
         * Get the ABI name for this revert.
         */
        get: function () {
            if (!_.isNil(this.abi)) {
                return this.abi.name;
            }
            return "<".concat(this.typeName, ">");
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RevertError.prototype, "typeName", {
        /**
         * Get the class name of this type.
         */
        get: function () {
            // tslint:disable-next-line: no-string-literal
            return this.constructor.name;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RevertError.prototype, "selector", {
        /**
         * Get the hex selector for this revert (without leading '0x').
         */
        get: function () {
            if (!_.isNil(this.abi)) {
                return toSelector(this.abi);
            }
            if (this._isRawType) {
                // tslint:disable-next-line: custom-no-magic-numbers
                return this._raw.slice(2, 10);
            }
            return '';
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RevertError.prototype, "signature", {
        /**
         * Get the signature for this revert: e.g., 'Error(string)'.
         */
        get: function () {
            if (!_.isNil(this.abi)) {
                return toSignature(this.abi);
            }
            return '';
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RevertError.prototype, "arguments", {
        /**
         * Get the ABI arguments for this revert.
         */
        get: function () {
            if (!_.isNil(this.abi)) {
                return this.abi.arguments || [];
            }
            return [];
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RevertError.prototype, Symbol.toStringTag, {
        get: function () {
            return this.toString();
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Compares this instance with another.
     * Fails if instances are not of the same type.
     * Only fields/values defined in both instances are compared.
     * @param other Either another RevertError instance, hex-encoded bytes, or a Buffer of the ABI encoded revert.
     * @return True if both instances match.
     */
    RevertError.prototype.equals = function (other) {
        var _other = other;
        if (_other instanceof Buffer) {
            _other = ethUtil.bufferToHex(_other);
        }
        if (typeof _other === 'string') {
            _other = RevertError.decode(_other);
        }
        if (!(_other instanceof RevertError)) {
            return false;
        }
        // If either is of the `AnyRevertError` type, always succeed.
        if (this._isAnyType || _other._isAnyType) {
            return true;
        }
        // If either are raw types, they must match their raw data.
        if (this._isRawType || _other._isRawType) {
            return this._raw === _other._raw;
        }
        // Must be of same type.
        if (this.constructor !== _other.constructor) {
            return false;
        }
        // Must share the same parameter values if defined in both instances.
        for (var _i = 0, _a = Object.keys(this.values); _i < _a.length; _i++) {
            var name_1 = _a[_i];
            var a = this.values[name_1];
            var b = _other.values[name_1];
            if (a === b) {
                continue;
            }
            if (!_.isNil(a) && !_.isNil(b)) {
                var type = this._getArgumentByName(name_1).type;
                if (!checkArgEquality(type, a, b)) {
                    return false;
                }
            }
        }
        return true;
    };
    RevertError.prototype.encode = function () {
        if (this._raw !== undefined) {
            return this._raw;
        }
        if (!this._hasAllArgumentValues) {
            throw new Error("Instance of ".concat(this.typeName, " does not have all its parameter values set."));
        }
        var encoder = createEncoder(this.abi);
        return encoder(this.values);
    };
    RevertError.prototype.toString = function () {
        if (this._isRawType) {
            return "".concat(this.constructor.name, "(").concat(this._raw, ")");
        }
        var values = _.omitBy(this.values, function (v) { return _.isNil(v); });
        // tslint:disable-next-line: forin
        for (var k in values) {
            var argType = this._getArgumentByName(k).type;
            if (argType === 'bytes') {
                // Try to decode nested revert errors.
                try {
                    values[k] = RevertError.decode(values[k]);
                }
                catch (err) { } // tslint:disable-line:no-empty
            }
        }
        var inner = _.isEmpty(values) ? '' : (0, util_1.inspect)(values);
        return "".concat(this.constructor.name, "(").concat(inner, ")");
    };
    RevertError.prototype._getArgumentByName = function (name) {
        var arg = _.find(this.arguments, function (a) { return a.name === name; });
        if (_.isNil(arg)) {
            throw new Error("RevertError ".concat(this.signature, " has no argument named ").concat(name));
        }
        return arg;
    };
    Object.defineProperty(RevertError.prototype, "_isAnyType", {
        get: function () {
            return _.isNil(this.abi) && _.isNil(this._raw);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RevertError.prototype, "_isRawType", {
        get: function () {
            return !_.isNil(this._raw);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RevertError.prototype, "_hasAllArgumentValues", {
        get: function () {
            if (_.isNil(this.abi) || _.isNil(this.abi.arguments)) {
                return false;
            }
            for (var _i = 0, _a = this.abi.arguments; _i < _a.length; _i++) {
                var arg = _a[_i];
                if (_.isNil(this.values[arg.name])) {
                    return false;
                }
            }
            return true;
        },
        enumerable: false,
        configurable: true
    });
    // Map of types registered via `registerType`.
    RevertError._typeRegistry = {};
    return RevertError;
}(Error));
exports.RevertError = RevertError;
var PARITY_TRANSACTION_REVERT_ERROR_MESSAGE = /^VM execution error/;
var GANACHE_TRANSACTION_REVERT_ERROR_MESSAGE = /^VM Exception while processing transaction: revert/;
var GETH_TRANSACTION_REVERT_ERROR_MESSAGE = /always failing transaction$/;
/**
 * Try to extract the ecnoded revert error bytes from a thrown `Error`.
 */
function getThrownErrorRevertErrorBytes(error) {
    // Handle ganache transaction reverts.
    if (isGanacheTransactionRevertError(error)) {
        return error.data;
    }
    else if (isParityTransactionRevertError(error)) {
        // Parity returns { data: 'Reverted 0xa6bcde47...', ... }
        var data = error.data;
        var hexDataIndex = data.indexOf('0x');
        if (hexDataIndex !== -1) {
            return data.slice(hexDataIndex);
        }
    }
    else {
        // Handle geth transaction reverts.
        if (isGethTransactionRevertError(error)) {
            // Geth transaction reverts are opaque, meaning no useful data is returned,
            // so we do nothing.
        }
    }
    throw new Error("Cannot decode thrown Error \"".concat(error.message, "\" as a RevertError"));
}
function isParityTransactionRevertError(error) {
    if (PARITY_TRANSACTION_REVERT_ERROR_MESSAGE.test(error.message) && 'code' in error && 'data' in error) {
        return true;
    }
    return false;
}
function isGanacheTransactionRevertError(error) {
    if (GANACHE_TRANSACTION_REVERT_ERROR_MESSAGE.test(error.message) && 'data' in error) {
        return true;
    }
    return false;
}
function isGethTransactionRevertError(error) {
    return GETH_TRANSACTION_REVERT_ERROR_MESSAGE.test(error.message);
}
/**
 * RevertError type for standard string reverts.
 */
var StringRevertError = /** @class */ (function (_super) {
    __extends(StringRevertError, _super);
    function StringRevertError(message) {
        return _super.call(this, 'StringRevertError', 'Error(string message)', { message: message }) || this;
    }
    return StringRevertError;
}(RevertError));
exports.StringRevertError = StringRevertError;
/**
 * Special RevertError type that matches with any other RevertError instance.
 */
var AnyRevertError = /** @class */ (function (_super) {
    __extends(AnyRevertError, _super);
    function AnyRevertError() {
        return _super.call(this, 'AnyRevertError') || this;
    }
    return AnyRevertError;
}(RevertError));
exports.AnyRevertError = AnyRevertError;
/**
 * Special RevertError type that is not decoded.
 */
var RawRevertError = /** @class */ (function (_super) {
    __extends(RawRevertError, _super);
    function RawRevertError(encoded) {
        return _super.call(this, 'RawRevertError', undefined, undefined, typeof encoded === 'string' ? encoded : ethUtil.bufferToHex(encoded)) || this;
    }
    return RawRevertError;
}(RevertError));
exports.RawRevertError = RawRevertError;
/**
 * Create an error message for a RevertError.
 * @param name The name of the RevertError.
 * @param values The values for the RevertError.
 */
function createErrorMessage(name, values) {
    if (values === undefined) {
        return "".concat(name, "()");
    }
    var _values = _.omitBy(values, function (v) { return _.isNil(v); });
    var inner = _.isEmpty(_values) ? '' : (0, util_1.inspect)(_values);
    return "".concat(name, "(").concat(inner, ")");
}
/**
 * Parse a solidity function declaration into a RevertErrorAbi object.
 * @param declaration Function declaration (e.g., 'foo(uint256 bar)').
 * @return A RevertErrorAbi object.
 */
function declarationToAbi(declaration) {
    var m = /^\s*([_a-z][a-z0-9_]*)\((.*)\)\s*$/i.exec(declaration);
    if (!m) {
        throw new Error("Invalid Revert Error signature: \"".concat(declaration, "\""));
    }
    var _a = m.slice(1), name = _a[0], args = _a[1];
    var argList = _.filter(args.split(','));
    var argData = _.map(argList, function (a) {
        // Match a function parameter in the format 'TYPE ID', where 'TYPE' may be
        // an array type.
        m = /^\s*(([_a-z][a-z0-9_]*)(\[\d*\])*)\s+([_a-z][a-z0-9_]*)\s*$/i.exec(a);
        if (!m) {
            throw new Error("Invalid Revert Error signature: \"".concat(declaration, "\""));
        }
        // tslint:disable: custom-no-magic-numbers
        return {
            name: m[4],
            type: m[1],
        };
        // tslint:enable: custom-no-magic-numbers
    });
    var r = {
        type: 'error',
        name: name,
        arguments: _.isEmpty(argData) ? [] : argData,
    };
    return r;
}
function checkArgEquality(type, lhs, rhs) {
    // Try to compare as decoded revert errors first.
    try {
        return RevertError.decode(lhs).equals(RevertError.decode(rhs));
    }
    catch (err) {
        // no-op
    }
    if (type === 'address') {
        return normalizeAddress(lhs) === normalizeAddress(rhs);
    }
    else if (type === 'bytes' || /^bytes(\d+)$/.test(type)) {
        return normalizeBytes(lhs) === normalizeBytes(rhs);
    }
    else if (type === 'string') {
        return lhs === rhs;
    }
    else if (/\[\d*\]$/.test(type)) {
        // An array type.
        // tslint:disable: custom-no-magic-numbers
        // Arguments must be arrays and have the same dimensions.
        if (lhs.length !== rhs.length) {
            return false;
        }
        var m = /^(.+)\[(\d*)\]$/.exec(type);
        var baseType = m[1];
        var isFixedLength = m[2].length !== 0;
        if (isFixedLength) {
            var length_1 = parseInt(m[2], 10);
            // Fixed-size arrays have a fixed dimension.
            if (lhs.length !== length_1) {
                return false;
            }
        }
        // Recurse into sub-elements.
        for (var _i = 0, _a = _.zip(lhs, rhs); _i < _a.length; _i++) {
            var _b = _a[_i], slhs = _b[0], srhs = _b[1];
            if (!checkArgEquality(baseType, slhs, srhs)) {
                return false;
            }
        }
        return true;
        // tslint:enable: no-magic-numbers
    }
    // tslint:disable-next-line
    return new configured_bignumber_1.BigNumber(lhs || 0).eq(rhs);
}
function normalizeAddress(addr) {
    var ADDRESS_SIZE = 20;
    return ethUtil.bufferToHex(ethUtil.setLengthLeft(ethUtil.toBuffer(ethUtil.addHexPrefix(addr)), ADDRESS_SIZE));
}
function normalizeBytes(bytes) {
    return ethUtil.addHexPrefix(bytes).toLowerCase();
}
function createEncoder(abi) {
    var encoder = AbiEncoder.createMethod(abi.name, abi.arguments || []);
    return function (values) {
        var valuesArray = _.map(abi.arguments, function (arg) { return values[arg.name]; });
        return encoder.encode(valuesArray);
    };
}
function createDecoder(abi) {
    var encoder = AbiEncoder.createMethod(abi.name, abi.arguments || []);
    return function (hex) {
        return encoder.decode(hex);
    };
}
function toSignature(abi) {
    var argTypes = _.map(abi.arguments, function (a) { return a.type; });
    var args = argTypes.join(',');
    return "".concat(abi.name, "(").concat(args, ")");
}
function toSelector(abi) {
    return (ethUtil
        .keccak256(Buffer.from(toSignature(abi)))
        // tslint:disable-next-line: custom-no-magic-numbers
        .slice(0, 4)
        .toString('hex'));
}
// Register StringRevertError
RevertError.registerType(StringRevertError);
// tslint:disable-next-line max-file-line-count
