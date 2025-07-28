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
exports.DataType = void 0;
const _ = __importStar(require("lodash"));
const calldata_1 = require("../calldata/calldata");
const raw_calldata_1 = require("../calldata/raw_calldata");
const constants_1 = require("../utils/constants");
class DataType {
    constructor(dataItem, factory) {
        this._dataItem = dataItem;
        this._factory = factory;
    }
    getDataItem() {
        return this._dataItem;
    }
    getFactory() {
        return this._factory;
    }
    encode(value, rules, selector) {
        const rules_ = { ...constants_1.constants.DEFAULT_ENCODING_RULES, ...rules };
        const calldata = new calldata_1.Calldata(rules_);
        if (selector !== undefined) {
            calldata.setSelector(selector);
        }
        const block = this.generateCalldataBlock(value);
        calldata.setRoot(block);
        const encodedCalldata = calldata.toString();
        return encodedCalldata;
    }
    decode(calldata, rules, selector) {
        if (selector !== undefined && !_.startsWith(calldata, selector)) {
            throw new Error(`Tried to decode calldata, but it was missing the function selector. Expected prefix '${selector}'. Got '${calldata}'.`);
        }
        const hasSelector = selector !== undefined;
        const rawCalldata = new raw_calldata_1.RawCalldata(calldata, hasSelector);
        const rules_ = { ...constants_1.constants.DEFAULT_DECODING_RULES, ...rules };
        const value = rules_.isStrictMode || rawCalldata.getSizeInBytes() > 0
            ? this.generateValue(rawCalldata, rules_)
            : this.getDefaultValue(rules_);
        return value;
    }
    decodeAsArray(returndata, rules) {
        const value = this.decode(returndata, rules);
        const valuesAsArray = _.isObject(value) ? _.values(value) : [value];
        return valuesAsArray;
    }
    getSignature(isDetailed) {
        if (_.isEmpty(this._dataItem.name) || !isDetailed) {
            return this.getSignatureType();
        }
        const name = this.getDataItem().name;
        const lastIndexOfScopeDelimiter = name.lastIndexOf('.');
        const isScopedName = lastIndexOfScopeDelimiter !== undefined && lastIndexOfScopeDelimiter > 0;
        const shortName = isScopedName ? name.substr(lastIndexOfScopeDelimiter + 1) : name;
        const detailedSignature = `${shortName} ${this.getSignatureType()}`;
        return detailedSignature;
    }
}
exports.DataType = DataType;
