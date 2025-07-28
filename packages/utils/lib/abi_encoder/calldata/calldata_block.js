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
exports.CalldataBlock = void 0;
const ethUtil = __importStar(require("ethereumjs-util"));
class CalldataBlock {
    constructor(name, signature, parentName, headerSizeInBytes, bodySizeInBytes) {
        this._name = name;
        this._signature = signature;
        this._parentName = parentName;
        this._offsetInBytes = 0;
        this._headerSizeInBytes = headerSizeInBytes;
        this._bodySizeInBytes = bodySizeInBytes;
    }
    _setHeaderSize(headerSizeInBytes) {
        this._headerSizeInBytes = headerSizeInBytes;
    }
    _setBodySize(bodySizeInBytes) {
        this._bodySizeInBytes = bodySizeInBytes;
    }
    _setName(name) {
        this._name = name;
    }
    getName() {
        return this._name;
    }
    getParentName() {
        return this._parentName;
    }
    getSignature() {
        return this._signature;
    }
    getHeaderSizeInBytes() {
        return this._headerSizeInBytes;
    }
    getBodySizeInBytes() {
        return this._bodySizeInBytes;
    }
    getSizeInBytes() {
        return this.getHeaderSizeInBytes() + this.getBodySizeInBytes();
    }
    getOffsetInBytes() {
        return this._offsetInBytes;
    }
    setOffset(offsetInBytes) {
        this._offsetInBytes = offsetInBytes;
    }
    computeHash() {
        const rawData = this.getRawData();
        const hash = ethUtil.keccak256(rawData);
        return hash;
    }
}
exports.CalldataBlock = CalldataBlock;
