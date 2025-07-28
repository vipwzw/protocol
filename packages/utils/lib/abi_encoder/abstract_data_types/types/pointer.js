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
exports.AbstractPointerDataType = void 0;
const ethUtil = __importStar(require("ethereumjs-util"));
const pointer_1 = require("../../calldata/blocks/pointer");
const constants_1 = require("../../utils/constants");
const data_type_1 = require("../data_type");
class AbstractPointerDataType extends data_type_1.DataType {
    constructor(dataItem, factory, destination, parent) {
        super(dataItem, factory);
        this._destination = destination;
        this._parent = parent;
    }
    generateCalldataBlock(value, parentBlock) {
        if (parentBlock === undefined) {
            throw new Error(`DependentDataType requires a parent block to generate its block`);
        }
        const destinationBlock = this._destination.generateCalldataBlock(value, parentBlock);
        const name = this.getDataItem().name;
        const signature = this.getSignature();
        const parentName = parentBlock.getName();
        const block = new pointer_1.PointerCalldataBlock(name, signature, parentName, destinationBlock, parentBlock);
        return block;
    }
    generateValue(calldata, rules) {
        const destinationOffsetBuf = calldata.popWord();
        const destinationOffsetHex = ethUtil.bufferToHex(destinationOffsetBuf);
        const destinationOffsetRelative = parseInt(destinationOffsetHex, constants_1.constants.HEX_BASE);
        const destinationOffsetAbsolute = calldata.toAbsoluteOffset(destinationOffsetRelative);
        const currentOffset = calldata.getOffset();
        calldata.setOffset(destinationOffsetAbsolute);
        const value = this._destination.generateValue(calldata, rules);
        calldata.setOffset(currentOffset);
        return value;
    }
    // Disable prefer-function-over-method for inherited abstract method.
    /* tslint:disable prefer-function-over-method */
    isStatic() {
        return true;
    }
}
exports.AbstractPointerDataType = AbstractPointerDataType;
