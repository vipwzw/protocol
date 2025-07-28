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
exports.MethodDataType = void 0;
const ethUtil = __importStar(require("ethereumjs-util"));
const _ = __importStar(require("lodash"));
const set_1 = require("../abstract_data_types/types/set");
const constants_1 = require("../utils/constants");
const tuple_1 = require("./tuple");
class MethodDataType extends set_1.AbstractSetDataType {
    constructor(abi, dataTypeFactory) {
        const methodDataItem = { type: 'method', name: abi.name, components: abi.inputs };
        super(methodDataItem, dataTypeFactory);
        this._methodSignature = this._computeSignature();
        this._methodSelector = this._computeSelector();
        const returnDataItem = { type: 'tuple', name: abi.name, components: abi.outputs };
        this._returnDataType = new tuple_1.TupleDataType(returnDataItem, this.getFactory());
    }
    encode(value, rules) {
        const calldata = super.encode(value, rules, this._methodSelector);
        return calldata;
    }
    decode(calldata, rules) {
        const value = super.decode(calldata, rules, this._methodSelector);
        return value;
    }
    strictDecode(calldata, rules) {
        const value = super.decode(calldata, { ...rules, isStrictMode: true }, this._methodSelector);
        const valueAsArray = _.isObject(value) ? _.values(value) : [value];
        switch (valueAsArray.length) {
            case 0:
                return undefined;
            case 1:
                return valueAsArray[0];
            default:
                return valueAsArray;
        }
    }
    encodeReturnValues(value, rules) {
        const returnData = this._returnDataType.encode(value, rules);
        return returnData;
    }
    decodeReturnValues(returndata, rules) {
        const returnValues = this._returnDataType.decode(returndata, rules);
        return returnValues;
    }
    strictDecodeReturnValue(returndata, rules) {
        const returnValues = this._returnDataType.decode(returndata, { ...rules, isStrictMode: true });
        const returnValuesAsArray = _.isObject(returnValues) ? _.values(returnValues) : [returnValues];
        switch (returnValuesAsArray.length) {
            case 0:
                return undefined;
            case 1:
                return returnValuesAsArray[0];
            default:
                return returnValuesAsArray;
        }
    }
    getSignatureType() {
        return this._methodSignature;
    }
    getSelector() {
        return this._methodSelector;
    }
    getReturnValueDataItem() {
        const returnValueDataItem = this._returnDataType.getDataItem();
        return returnValueDataItem;
    }
    _computeSignature() {
        const memberSignature = this._computeSignatureOfMembers();
        const methodSignature = `${this.getDataItem().name}${memberSignature}`;
        return methodSignature;
    }
    _computeSelector() {
        const signature = this._computeSignature();
        const selector = ethUtil.bufferToHex(ethUtil.toBuffer(ethUtil
            .keccak256(Buffer.from(signature))
            .slice(constants_1.constants.HEX_SELECTOR_BYTE_OFFSET_IN_CALLDATA, constants_1.constants.HEX_SELECTOR_LENGTH_IN_BYTES)));
        return selector;
    }
}
exports.MethodDataType = MethodDataType;
