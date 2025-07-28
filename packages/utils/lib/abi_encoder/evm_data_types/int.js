"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntDataType = void 0;
const ethereum_types_1 = require("ethereum-types");
const configured_bignumber_1 = require("../../configured_bignumber");
const blob_1 = require("../abstract_data_types/types/blob");
const constants_1 = require("../utils/constants");
const EncoderMath = __importStar(require("../utils/math"));
// tslint:disable:custom-no-magic-numbers
class IntDataType extends blob_1.AbstractBlobDataType {
    static matchType(type) {
        return IntDataType._MATCHER.test(type);
    }
    static _decodeWidthFromType(type) {
        const matches = IntDataType._MATCHER.exec(type);
        const width = matches !== null && matches.length === 2 && matches[1] !== undefined
            ? parseInt(matches[1], constants_1.constants.DEC_BASE)
            : IntDataType._DEFAULT_WIDTH;
        return width;
    }
    constructor(dataItem, dataTypeFactory) {
        super(dataItem, dataTypeFactory, IntDataType._SIZE_KNOWN_AT_COMPILE_TIME);
        if (!IntDataType.matchType(dataItem.type)) {
            throw new Error(`Tried to instantiate Int with bad input: ${dataItem}`);
        }
        this._width = IntDataType._decodeWidthFromType(dataItem.type);
        this._minValue = IntDataType._WIDTH_TO_MIN_VALUE[this._width];
        this._maxValue = IntDataType._WIDTH_TO_MAX_VALUE[this._width];
    }
    encodeValue(value) {
        const encodedValue = EncoderMath.safeEncodeNumericValue(value, this._minValue, this._maxValue);
        return encodedValue;
    }
    decodeValue(calldata) {
        const valueBuf = calldata.popWord();
        const value = EncoderMath.safeDecodeNumericValue(valueBuf, this._minValue, this._maxValue);
        if (this._width === constants_1.constants.NUMBER_OF_BYTES_IN_INT8) {
            return value.toNumber();
        }
        return value;
    }
    getDefaultValue() {
        const defaultValue = IntDataType._DEFAULT_VALUE;
        if (this._width === constants_1.constants.NUMBER_OF_BYTES_IN_INT8) {
            return defaultValue.toNumber();
        }
        return defaultValue;
    }
    getSignatureType() {
        return `${ethereum_types_1.SolidityTypes.Int}${this._width}`;
    }
}
exports.IntDataType = IntDataType;
IntDataType._MATCHER = RegExp('^int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256){0,1}$');
IntDataType._SIZE_KNOWN_AT_COMPILE_TIME = true;
IntDataType._MAX_WIDTH = 256;
IntDataType._DEFAULT_WIDTH = IntDataType._MAX_WIDTH;
IntDataType._DEFAULT_VALUE = new configured_bignumber_1.BigNumber(0);
IntDataType._WIDTH_TO_MIN_VALUE = Object.assign({}, ...[...new Array(32)].map((_x, i) => {
    const width = (i + 1) * 8;
    return { [width]: new configured_bignumber_1.BigNumber(2).exponentiatedBy(width - 1).times(-1) };
}));
IntDataType._WIDTH_TO_MAX_VALUE = Object.assign({}, ...[...new Array(32)].map((_x, i) => {
    const width = (i + 1) * 8;
    return { [width]: new configured_bignumber_1.BigNumber(2).exponentiatedBy(width - 1).minus(1) };
}));
