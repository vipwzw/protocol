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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUtils = void 0;
const chalk_1 = __importDefault(require("chalk"));
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
