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
exports.SetCalldataBlock = void 0;
// @ts-ignore
const _ = __importStar(require("lodash"));
const calldata_block_1 = require("../calldata_block");
class SetCalldataBlock extends calldata_block_1.CalldataBlock {
    constructor(name, signature, parentName) {
        super(name, signature, parentName, 0, 0);
        this._members = [];
        this._header = undefined;
    }
    getRawData() {
        const rawDataComponents = [];
        if (this._header !== undefined) {
            rawDataComponents.push(this._header);
        }
        _.each(this._members, (member) => {
            const memberBuffer = member.getRawData();
            rawDataComponents.push(memberBuffer);
        });
        const rawData = Buffer.concat(rawDataComponents);
        return rawData;
    }
    setMembers(members) {
        this._members = members;
    }
    setHeader(header) {
        this._setHeaderSize(header.byteLength);
        this._header = header;
    }
    toBuffer() {
        if (this._header !== undefined) {
            return this._header;
        }
        return Buffer.from('');
    }
    getMembers() {
        return this._members;
    }
}
exports.SetCalldataBlock = SetCalldataBlock;
