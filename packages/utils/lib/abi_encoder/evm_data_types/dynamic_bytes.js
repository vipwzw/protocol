"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicBytesDataType = void 0;
const ethereum_types_1 = require("ethereum-types");
const ethUtil = __importStar(require("ethereumjs-util"));
// @ts-ignore
const _ = __importStar(require("lodash"));
const blob_1 = require("../abstract_data_types/types/blob");
const constants_1 = require("../utils/constants");
class DynamicBytesDataType extends blob_1.AbstractBlobDataType {
    constructor(dataItem, dataTypeFactory) {
        super(dataItem, dataTypeFactory, DynamicBytesDataType._SIZE_KNOWN_AT_COMPILE_TIME);
        if (!DynamicBytesDataType.matchType(dataItem.type)) {
            throw new Error(`Tried to instantiate Dynamic Bytes with bad input: ${dataItem}`);
        }
    }
    static matchType(type) {
        return type === ethereum_types_1.SolidityTypes.Bytes;
    }
    static _sanityCheckValue(value) {
        if (typeof value !== 'string') {
            return;
        }
        if (!_.startsWith(value, '0x')) {
            throw new Error(`Tried to encode non-hex value. Value must include '0x' prefix.`);
        }
        else if (value.length % 2 !== 0) {
            throw new Error(`Tried to assign ${value}, which is contains a half-byte. Use full bytes only.`);
        }
    }
    // Disable prefer-function-over-method for inherited abstract methods.
    /* tslint:disable prefer-function-over-method */
    encodeValue(value) {
        // Encoded value is of the form: <length><value>, with each field padded to be word-aligned.
        // 1/3 Construct the length
        DynamicBytesDataType._sanityCheckValue(value);
        const valueBuf = ethUtil.toBuffer(value);
        const wordsToStoreValuePadded = Math.ceil(valueBuf.byteLength / constants_1.constants.EVM_WORD_WIDTH_IN_BYTES);
        const bytesToStoreValuePadded = wordsToStoreValuePadded * constants_1.constants.EVM_WORD_WIDTH_IN_BYTES;
        const lengthBuf = ethUtil.toBuffer(valueBuf.byteLength);
        const lengthBufPadded = ethUtil.setLengthLeft(lengthBuf, constants_1.constants.EVM_WORD_WIDTH_IN_BYTES);
        // 2/3 Construct the value
        const valueBufPadded = ethUtil.setLengthRight(valueBuf, bytesToStoreValuePadded);
        // 3/3 Combine length and value
        const encodedValue = Buffer.concat([lengthBufPadded, valueBufPadded]);
        return encodedValue;
    }
    decodeValue(calldata) {
        // Encoded value is of the form: <length><value>, with each field padded to be word-aligned.
        // 1/2 Decode length
        const lengthBuf = calldata.popWord();
        const lengthHex = ethUtil.bufferToHex(lengthBuf);
        const length = parseInt(lengthHex, constants_1.constants.HEX_BASE);
        // 2/2 Decode value
        const wordsToStoreValuePadded = Math.ceil(length / constants_1.constants.EVM_WORD_WIDTH_IN_BYTES);
        const valueBufPadded = calldata.popWords(wordsToStoreValuePadded);
        const valueBuf = valueBufPadded.slice(0, length);
        const value = ethUtil.bufferToHex(valueBuf);
        DynamicBytesDataType._sanityCheckValue(value);
        return value;
    }
    getDefaultValue() {
        return DynamicBytesDataType._DEFAULT_VALUE;
    }
    getSignatureType() {
        return ethereum_types_1.SolidityTypes.Bytes;
    }
}
exports.DynamicBytesDataType = DynamicBytesDataType;
DynamicBytesDataType._SIZE_KNOWN_AT_COMPILE_TIME = false;
DynamicBytesDataType._DEFAULT_VALUE = '0x';
