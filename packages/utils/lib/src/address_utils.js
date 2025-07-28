"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressUtils = void 0;
var ethereumjs_util_1 = require("ethereumjs-util");
var _ = require("lodash");
var hex_utils_1 = require("./hex_utils");
var BASIC_ADDRESS_REGEX = /^(0x)?[0-9a-f]{40}$/i;
var SAME_CASE_ADDRESS_REGEX = /^(0x)?([0-9a-f]{40}|[0-9A-F]{40})$/;
var ADDRESS_LENGTH = 40;
exports.addressUtils = {
    isChecksumAddress: function (address) {
        return (0, ethereumjs_util_1.isValidChecksumAddress)(address);
    },
    isAddress: function (address) {
        if (!BASIC_ADDRESS_REGEX.test(address)) {
            // Check if it has the basic requirements of an address
            return false;
        }
        else if (SAME_CASE_ADDRESS_REGEX.test(address)) {
            // If it's all small caps or all all caps, return true
            return true;
        }
        else {
            // Otherwise check each case
            var isValidChecksummedAddress = exports.addressUtils.isChecksumAddress(address);
            return isValidChecksummedAddress;
        }
    },
    padZeros: function (address) {
        return (0, ethereumjs_util_1.addHexPrefix)(_.padStart((0, ethereumjs_util_1.stripHexPrefix)(address), ADDRESS_LENGTH, '0'));
    },
    generatePseudoRandomAddress: function () {
        // tslint:disable-next-line: custom-no-magic-numbers
        return hex_utils_1.hexUtils.random(20);
    },
};
