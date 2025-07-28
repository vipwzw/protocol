"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUtils = void 0;
var chalk_1 = require("chalk");
var _ = require("lodash");
var DEFAULT_TERMINAL_WIDTH = 80;
var TERMINAL_WIDTH = _.get(process, 'stdout.columns') || DEFAULT_TERMINAL_WIDTH;
exports.logUtils = {
    log: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        console.log.apply(console, args); // tslint:disable-line:no-console
    },
    header: function (text, padStr) {
        if (padStr === void 0) { padStr = '='; }
        var padLength = TERMINAL_WIDTH - text.length;
        var padLengthEnd = (padLength + 1) / 2;
        var leftPadded = text.padStart(TERMINAL_WIDTH - padLengthEnd, padStr);
        var padded = leftPadded.padEnd(TERMINAL_WIDTH, padStr);
        console.log(padded); // tslint:disable-line:no-console
    },
    warn: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        console.warn.apply(console, args); // tslint:disable-line:no-console
    },
    table: function (columnarData) {
        var formattedColumnarData = _.mapValues(columnarData, function (columnOrColumns, _rowName) {
            return _.isNumber(columnOrColumns) ? columnOrColumns.toLocaleString() : columnOrColumns;
        });
        console.table(formattedColumnarData); // tslint:disable-line:no-console
    },
    logWithTime: function (arg) {
        exports.logUtils.log("[".concat(chalk_1.default.gray(new Date().toLocaleTimeString()), "] ").concat(arg));
    },
};
