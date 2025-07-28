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
exports.constants = void 0;
const ethUtil = __importStar(require("ethereumjs-util"));
exports.constants = {
    EVM_WORD_WIDTH_IN_BYTES: 32,
    EVM_WORD_WIDTH_IN_BITS: 256,
    HEX_BASE: 16,
    DEC_BASE: 10,
    BIN_BASE: 2,
    HEX_SELECTOR_LENGTH_IN_CHARS: 10,
    HEX_SELECTOR_LENGTH_IN_BYTES: 4,
    HEX_SELECTOR_BYTE_OFFSET_IN_CALLDATA: 0,
    // Disable no-object-literal-type-assertion so we can enforce cast
    /* tslint:disable no-object-literal-type-assertion */
    DEFAULT_DECODING_RULES: { shouldConvertStructsToObjects: true, isStrictMode: false },
    DEFAULT_ENCODING_RULES: { shouldOptimize: true, shouldAnnotate: false },
    /* tslint:enable no-object-literal-type-assertion */
    EMPTY_EVM_WORD_STRING: '0x0000000000000000000000000000000000000000000000000000000000000000',
    EMPTY_EVM_WORD_BUFFER: ethUtil.toBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'),
    NUMBER_OF_BYTES_IN_UINT8: 8,
    NUMBER_OF_BYTES_IN_INT8: 8,
};
