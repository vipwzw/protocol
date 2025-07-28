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
exports.StringDataType = void 0;
const ethereum_types_1 = require("ethereum-types");
const ethUtil = __importStar(require("ethereumjs-util"));
const blob_1 = require("../abstract_data_types/types/blob");
const constants_1 = require("../utils/constants");
class StringDataType extends blob_1.AbstractBlobDataType {
    static matchType(type) {
        return type === ethereum_types_1.SolidityTypes.String;
    }
    constructor(dataItem, dataTypeFactory) {
        super(dataItem, dataTypeFactory, StringDataType._SIZE_KNOWN_AT_COMPILE_TIME);
        if (!StringDataType.matchType(dataItem.type)) {
            throw new Error(`Tried to instantiate String with bad input: ${dataItem}`);
        }
    }
    // Disable prefer-function-over-method for inherited abstract methods.
    /* tslint:disable prefer-function-over-method */
    encodeValue(value) {
        // Encoded value is of the form: <length><value>, with each field padded to be word-aligned.
        // 1/3 Construct the value
        const valueBuf = Buffer.from(value);
        const valueLengthInBytes = valueBuf.byteLength;
        const wordsToStoreValuePadded = Math.ceil(valueLengthInBytes / constants_1.constants.EVM_WORD_WIDTH_IN_BYTES);
        const bytesToStoreValuePadded = wordsToStoreValuePadded * constants_1.constants.EVM_WORD_WIDTH_IN_BYTES;
        const valueBufPadded = ethUtil.setLengthRight(valueBuf, bytesToStoreValuePadded);
        // 2/3 Construct the length
        const lengthBuf = ethUtil.toBuffer(valueLengthInBytes);
        const lengthBufPadded = ethUtil.setLengthLeft(lengthBuf, constants_1.constants.EVM_WORD_WIDTH_IN_BYTES);
        // 3/3 Combine length and value
        const encodedValue = Buffer.concat([lengthBufPadded, valueBufPadded]);
        return encodedValue;
    }
    decodeValue(calldata) {
        // Encoded value is of the form: <length><value>, with each field padded to be word-aligned.
        // 1/2 Decode length
        const lengthBufPadded = calldata.popWord();
        const lengthHexPadded = ethUtil.bufferToHex(lengthBufPadded);
        const length = parseInt(lengthHexPadded, constants_1.constants.HEX_BASE);
        // 2/2 Decode value
        const wordsToStoreValuePadded = Math.ceil(length / constants_1.constants.EVM_WORD_WIDTH_IN_BYTES);
        const valueBufPadded = calldata.popWords(wordsToStoreValuePadded);
        const valueBuf = valueBufPadded.slice(0, length);
        const value = valueBuf.toString('utf8');
        return value;
    }
    getDefaultValue() {
        return StringDataType._DEFAULT_VALUE;
    }
    getSignatureType() {
        return ethereum_types_1.SolidityTypes.String;
    }
}
exports.StringDataType = StringDataType;
StringDataType._SIZE_KNOWN_AT_COMPILE_TIME = false;
StringDataType._DEFAULT_VALUE = '';
