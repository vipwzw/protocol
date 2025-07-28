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
exports.IntDataType = void 0;
var ethereum_types_1 = require("ethereum-types");
var configured_bignumber_1 = require("../../configured_bignumber");
var blob_1 = require("../abstract_data_types/types/blob");
var constants_1 = require("../utils/constants");
var EncoderMath = require("../utils/math");
// tslint:disable:custom-no-magic-numbers
var IntDataType = /** @class */ (function (_super) {
    __extends(IntDataType, _super);
    function IntDataType(dataItem, dataTypeFactory) {
        var _this = _super.call(this, dataItem, dataTypeFactory, IntDataType._SIZE_KNOWN_AT_COMPILE_TIME) || this;
        if (!IntDataType.matchType(dataItem.type)) {
            throw new Error("Tried to instantiate Int with bad input: ".concat(dataItem));
        }
        _this._width = IntDataType._decodeWidthFromType(dataItem.type);
        _this._minValue = IntDataType._WIDTH_TO_MIN_VALUE[_this._width];
        _this._maxValue = IntDataType._WIDTH_TO_MAX_VALUE[_this._width];
        return _this;
    }
    IntDataType.matchType = function (type) {
        return IntDataType._MATCHER.test(type);
    };
    IntDataType._decodeWidthFromType = function (type) {
        var matches = IntDataType._MATCHER.exec(type);
        var width = matches !== null && matches.length === 2 && matches[1] !== undefined
            ? parseInt(matches[1], constants_1.constants.DEC_BASE)
            : IntDataType._DEFAULT_WIDTH;
        return width;
    };
    IntDataType.prototype.encodeValue = function (value) {
        var encodedValue = EncoderMath.safeEncodeNumericValue(value, this._minValue, this._maxValue);
        return encodedValue;
    };
    IntDataType.prototype.decodeValue = function (calldata) {
        var valueBuf = calldata.popWord();
        var value = EncoderMath.safeDecodeNumericValue(valueBuf, this._minValue, this._maxValue);
        if (this._width === constants_1.constants.NUMBER_OF_BYTES_IN_INT8) {
            return value.toNumber();
        }
        return value;
    };
    IntDataType.prototype.getDefaultValue = function () {
        var defaultValue = IntDataType._DEFAULT_VALUE;
        if (this._width === constants_1.constants.NUMBER_OF_BYTES_IN_INT8) {
            return defaultValue.toNumber();
        }
        return defaultValue;
    };
    IntDataType.prototype.getSignatureType = function () {
        return "".concat(ethereum_types_1.SolidityTypes.Int).concat(this._width);
    };
    IntDataType._MATCHER = RegExp('^int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256){0,1}$');
    IntDataType._SIZE_KNOWN_AT_COMPILE_TIME = true;
    IntDataType._MAX_WIDTH = 256;
    IntDataType._DEFAULT_WIDTH = IntDataType._MAX_WIDTH;
    IntDataType._DEFAULT_VALUE = new configured_bignumber_1.BigNumber(0);
    IntDataType._WIDTH_TO_MIN_VALUE = Object.assign.apply(Object, __spreadArray([{}], __spreadArray([], new Array(32), true).map(function (_x, i) {
        var _a;
        var width = (i + 1) * 8;
        return _a = {}, _a[width] = new configured_bignumber_1.BigNumber(2).exponentiatedBy(width - 1).times(-1), _a;
    }), false));
    IntDataType._WIDTH_TO_MAX_VALUE = Object.assign.apply(Object, __spreadArray([{}], __spreadArray([], new Array(32), true).map(function (_x, i) {
        var _a;
        var width = (i + 1) * 8;
        return _a = {}, _a[width] = new configured_bignumber_1.BigNumber(2).exponentiatedBy(width - 1).minus(1), _a;
    }), false));
    return IntDataType;
}(blob_1.AbstractBlobDataType));
exports.IntDataType = IntDataType;
