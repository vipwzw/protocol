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
exports.PointerCalldataBlock = void 0;
const ethUtil = __importStar(require("ethereumjs-util"));
const constants_1 = require("../../utils/constants");
const calldata_block_1 = require("../calldata_block");
class PointerCalldataBlock extends calldata_block_1.CalldataBlock {
    constructor(name, signature, parentName, dependency, parent) {
        const headerSizeInBytes = PointerCalldataBlock._EMPTY_HEADER_SIZE;
        const bodySizeInBytes = PointerCalldataBlock._DEPENDENT_PAYLOAD_SIZE_IN_BYTES;
        super(name, signature, parentName, headerSizeInBytes, bodySizeInBytes);
        this._parent = parent;
        this._dependency = dependency;
        this._aliasFor = undefined;
    }
    toBuffer() {
        const destinationOffset = this._aliasFor !== undefined ? this._aliasFor.getOffsetInBytes() : this._dependency.getOffsetInBytes();
        const parentOffset = this._parent.getOffsetInBytes();
        const parentHeaderSize = this._parent.getHeaderSizeInBytes();
        const pointer = destinationOffset - (parentOffset + parentHeaderSize);
        const pointerHex = `0x${pointer.toString(constants_1.constants.HEX_BASE)}`;
        const pointerBuf = ethUtil.toBuffer(pointerHex);
        const pointerBufPadded = ethUtil.setLengthLeft(pointerBuf, constants_1.constants.EVM_WORD_WIDTH_IN_BYTES);
        return pointerBufPadded;
    }
    getDependency() {
        return this._dependency;
    }
    setAlias(block) {
        this._aliasFor = block;
        this._setName(`${this.getName()} (alias for ${block.getName()})`);
    }
    getAlias() {
        return this._aliasFor;
    }
    getRawData() {
        const dependencyRawData = this._dependency.getRawData();
        const rawDataComponents = [];
        rawDataComponents.push(PointerCalldataBlock.RAW_DATA_START);
        rawDataComponents.push(dependencyRawData);
        rawDataComponents.push(PointerCalldataBlock.RAW_DATA_END);
        const rawData = Buffer.concat(rawDataComponents);
        return rawData;
    }
}
exports.PointerCalldataBlock = PointerCalldataBlock;
PointerCalldataBlock.RAW_DATA_START = Buffer.from('<');
PointerCalldataBlock.RAW_DATA_END = Buffer.from('>');
PointerCalldataBlock._DEPENDENT_PAYLOAD_SIZE_IN_BYTES = 32;
PointerCalldataBlock._EMPTY_HEADER_SIZE = 0;
