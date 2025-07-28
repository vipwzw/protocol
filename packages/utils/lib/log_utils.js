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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUtils = void 0;
const chalk_1 = __importDefault(require("chalk"));
// @ts-ignore
const _ = __importStar(require("lodash"));
const DEFAULT_TERMINAL_WIDTH = 80;
const TERMINAL_WIDTH = _.get(process, 'stdout.columns') || DEFAULT_TERMINAL_WIDTH;
exports.logUtils = {
    log(...args) {
        console.log(...args); // tslint:disable-line:no-console
    },
    header(text, padStr = '=') {
        const padLength = TERMINAL_WIDTH - text.length;
        const padLengthEnd = (padLength + 1) / 2;
        const leftPadded = text.padStart(TERMINAL_WIDTH - padLengthEnd, padStr);
        const padded = leftPadded.padEnd(TERMINAL_WIDTH, padStr);
        console.log(padded); // tslint:disable-line:no-console
    },
    warn(...args) {
        console.warn(...args); // tslint:disable-line:no-console
    },
    table(columnarData) {
        const formattedColumnarData = _.mapValues(columnarData, (columnOrColumns, _rowName) => _.isNumber(columnOrColumns) ? columnOrColumns.toLocaleString() : columnOrColumns);
        console.table(formattedColumnarData); // tslint:disable-line:no-console
    },
    logWithTime(arg) {
        exports.logUtils.log(`[${chalk_1.default.gray(new Date().toLocaleTimeString())}] ${arg}`);
    },
};
