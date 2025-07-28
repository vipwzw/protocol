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
exports.AddressDataType = void 0;
const ethereum_types_1 = require("ethereum-types");
const ethUtil = __importStar(require("ethereumjs-util"));
const _ = __importStar(require("lodash"));
const blob_1 = require("../abstract_data_types/types/blob");
const constants_1 = require("../utils/constants");
class AddressDataType extends blob_1.AbstractBlobDataType {
    static matchType(type) {
        return type === ethereum_types_1.SolidityTypes.Address;
    }
    constructor(dataItem, dataTypeFactory) {
        super(dataItem, dataTypeFactory, AddressDataType._SIZE_KNOWN_AT_COMPILE_TIME);
        if (!AddressDataType.matchType(dataItem.type)) {
            throw new Error(`Tried to instantiate Address with bad input: ${dataItem}`);
        }
    }
    // Disable prefer-function-over-method for inherited abstract methods.
    /* tslint:disable prefer-function-over-method */
    encodeValue(value) {
        if (!ethUtil.isValidAddress(value)) {
            throw new Error(`Invalid address: '${value}'`);
        }
        const valueBuf = ethUtil.toBuffer(value);
        const encodedValueBuf = ethUtil.setLengthLeft(valueBuf, constants_1.constants.EVM_WORD_WIDTH_IN_BYTES);
        return encodedValueBuf;
    }
    decodeValue(calldata) {
        const valueBufPadded = calldata.popWord();
        const valueBuf = valueBufPadded.slice(AddressDataType._DECODED_ADDRESS_OFFSET_IN_BYTES);
        const value = ethUtil.bufferToHex(valueBuf);
        const valueLowercase = _.toLower(value);
        return valueLowercase;
    }
    getDefaultValue() {
        return AddressDataType._DEFAULT_VALUE;
    }
    getSignatureType() {
        return ethereum_types_1.SolidityTypes.Address;
    }
}
exports.AddressDataType = AddressDataType;
AddressDataType._SIZE_KNOWN_AT_COMPILE_TIME = true;
AddressDataType._ADDRESS_SIZE_IN_BYTES = 20;
AddressDataType._DECODED_ADDRESS_OFFSET_IN_BYTES = constants_1.constants.EVM_WORD_WIDTH_IN_BYTES - AddressDataType._ADDRESS_SIZE_IN_BYTES;
AddressDataType._DEFAULT_VALUE = '0x0000000000000000000000000000000000000000';
