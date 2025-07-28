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
exports.ArrayDataType = void 0;
const _ = __importStar(require("lodash"));
const set_1 = require("../abstract_data_types/types/set");
const constants_1 = require("../utils/constants");
class ArrayDataType extends set_1.AbstractSetDataType {
    static matchType(type) {
        return ArrayDataType._MATCHER.test(type);
    }
    static decodeElementTypeAndLengthFromType(type) {
        const matches = ArrayDataType._MATCHER.exec(type);
        if (matches === null || matches.length !== 3) {
            throw new Error(`Could not parse array: ${type}`);
        }
        else if (matches[1] === undefined) {
            throw new Error(`Could not parse array type: ${type}`);
        }
        else if (matches[2] === undefined) {
            throw new Error(`Could not parse array length: ${type}`);
        }
        const arrayElementType = matches[1];
        const arrayLength = _.isEmpty(matches[2]) ? undefined : parseInt(matches[2], constants_1.constants.DEC_BASE);
        return [arrayElementType, arrayLength];
    }
    constructor(dataItem, dataTypeFactory) {
        // Construct parent
        const isArray = true;
        const [arrayElementType, arrayLength] = ArrayDataType.decodeElementTypeAndLengthFromType(dataItem.type);
        super(dataItem, dataTypeFactory, isArray, arrayLength, arrayElementType);
        // Set array properties
        this._elementType = arrayElementType;
    }
    getSignatureType() {
        return this._computeSignature(false);
    }
    getSignature(isDetailed) {
        if (_.isEmpty(this.getDataItem().name) || !isDetailed) {
            return this.getSignatureType();
        }
        const name = this.getDataItem().name;
        const lastIndexOfScopeDelimiter = name.lastIndexOf('.');
        const isScopedName = lastIndexOfScopeDelimiter !== undefined && lastIndexOfScopeDelimiter > 0;
        const shortName = isScopedName ? name.substr(lastIndexOfScopeDelimiter + 1) : name;
        const detailedSignature = `${shortName} ${this._computeSignature(isDetailed)}`;
        return detailedSignature;
    }
    _computeSignature(isDetailed) {
        // Compute signature for a single array element
        const elementDataItem = {
            type: this._elementType,
            name: '',
        };
        const elementComponents = this.getDataItem().components;
        if (elementComponents !== undefined) {
            elementDataItem.components = elementComponents;
        }
        const elementDataType = this.getFactory().create(elementDataItem);
        const elementSignature = elementDataType.getSignature(isDetailed);
        // Construct signature for array of type `element`
        if (this._arrayLength === undefined) {
            return `${elementSignature}[]`;
        }
        else {
            return `${elementSignature}[${this._arrayLength}]`;
        }
    }
}
exports.ArrayDataType = ArrayDataType;
ArrayDataType._MATCHER = RegExp('^(.+)\\[([0-9]*)\\]$');
