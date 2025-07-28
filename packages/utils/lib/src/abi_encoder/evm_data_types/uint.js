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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIntDataType = void 0;
var ethereum_types_1 = require("ethereum-types");
var configured_bignumber_1 = require("../../configured_bignumber");
var blob_1 = require("../abstract_data_types/types/blob");
var constants_1 = require("../utils/constants");
var EncoderMath = require("../utils/math");
// tslint:disable:custom-no-magic-numbers
var UIntDataType = /** @class */ (function (_super) {
    __extends(UIntDataType, _super);
    function UIntDataType(dataItem, dataTypeFactory) {
        var _this = _super.call(this, dataItem, dataTypeFactory, UIntDataType._SIZE_KNOWN_AT_COMPILE_TIME) || this;
        if (!UIntDataType.matchType(dataItem.type)) {
            throw new Error("Tried to instantiate UInt with bad input: ".concat(dataItem));
        }
        _this._width = UIntDataType._decodeWidthFromType(dataItem.type);
        _this._maxValue = UIntDataType._WIDTH_TO_MAX_VALUE[_this._width];
        return _this;
    }
    UIntDataType.matchType = function (type) {
        return UIntDataType._MATCHER.test(type);
    };
    UIntDataType._decodeWidthFromType = function (type) {
        var matches = UIntDataType._MATCHER.exec(type);
        var width = matches !== null && matches.length === 2 && matches[1] !== undefined
            ? parseInt(matches[1], constants_1.constants.DEC_BASE)
            : UIntDataType._DEFAULT_WIDTH;
        return width;
    };
    UIntDataType.prototype.encodeValue = function (value) {
        var encodedValue = EncoderMath.safeEncodeNumericValue(value, UIntDataType._MIN_VALUE, this._maxValue);
        return encodedValue;
    };
    UIntDataType.prototype.decodeValue = function (calldata) {
        var valueBuf = calldata.popWord();
        var value = EncoderMath.safeDecodeNumericValue(valueBuf, UIntDataType._MIN_VALUE, this._maxValue);
        if (this._width === constants_1.constants.NUMBER_OF_BYTES_IN_UINT8) {
            return value.toNumber();
        }
        return value;
    };
    UIntDataType.prototype.getDefaultValue = function () {
        var defaultValue = UIntDataType._DEFAULT_VALUE;
        if (this._width === constants_1.constants.NUMBER_OF_BYTES_IN_UINT8) {
            return defaultValue.toNumber();
        }
        return defaultValue;
    };
    UIntDataType.prototype.getSignatureType = function () {
        return "".concat(ethereum_types_1.SolidityTypes.Uint).concat(this._width);
    };
    UIntDataType._MATCHER = RegExp('^uint(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256){0,1}$');
    UIntDataType._SIZE_KNOWN_AT_COMPILE_TIME = true;
    UIntDataType._MAX_WIDTH = 256;
    UIntDataType._DEFAULT_WIDTH = UIntDataType._MAX_WIDTH;
    UIntDataType._MIN_VALUE = new configured_bignumber_1.BigNumber(0);
    UIntDataType._DEFAULT_VALUE = new configured_bignumber_1.BigNumber(0);
    UIntDataType._WIDTH_TO_MAX_VALUE = Object.assign.apply(Object, __spreadArray([{}], __spreadArray([], new Array(32), true).map(function (_x, i) {
        var _a;
        var width = (i + 1) * 8;
        return _a = {}, _a[width] = new configured_bignumber_1.BigNumber(2).exponentiatedBy(width).minus(1), _a;
    }), false));
    return UIntDataType;
}(blob_1.AbstractBlobDataType));
exports.UIntDataType = UIntDataType;
