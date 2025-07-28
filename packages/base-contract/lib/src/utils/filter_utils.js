"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterUtils = void 0;
var utils_1 = require("@0x/utils");
var ethUtil = require("ethereumjs-util");
var jsSHA3 = require("js-sha3");
var uuid = require("uuid/v4");
var TOPIC_LENGTH = 32;
exports.filterUtils = {
    generateUUID: function () {
        return uuid();
    },
    getFilter: function (address, eventName, indexFilterValues, abi, blockRange) {
        // tslint:disable:next-line no-unnecessary-type-assertion
        var eventAbi = abi.find(function (abiDefinition) { return abiDefinition.name === eventName; });
        var eventSignature = exports.filterUtils.getEventSignatureFromAbiByName(eventAbi);
        var topicForEventSignature = ethUtil.addHexPrefix(jsSHA3.keccak256(eventSignature));
        var topicsForIndexedArgs = exports.filterUtils.getTopicsForIndexedArgs(eventAbi, indexFilterValues);
        var topics = __spreadArray([topicForEventSignature], topicsForIndexedArgs, true);
        var filter = {
            address: address,
            topics: topics,
        };
        if (blockRange !== undefined) {
            filter = __assign(__assign({}, blockRange), filter);
        }
        return filter;
    },
    getEventSignatureFromAbiByName: function (eventAbi) {
        var types = eventAbi.inputs.map(function (i) { return i.type; });
        var signature = "".concat(eventAbi.name, "(").concat(types.join(','), ")");
        return signature;
    },
    getTopicsForIndexedArgs: function (abi, indexFilterValues) {
        var topics = [];
        for (var _i = 0, _a = abi.inputs; _i < _a.length; _i++) {
            var eventInput = _a[_i];
            if (!eventInput.indexed) {
                continue;
            }
            if (indexFilterValues[eventInput.name] === undefined) {
                // Null is a wildcard topic in a JSON-RPC call
                topics.push(null);
            }
            else {
                // tslint:disable: no-unnecessary-type-assertion
                var value = indexFilterValues[eventInput.name];
                if (utils_1.BigNumber.isBigNumber(value)) {
                    // tslint:disable-next-line custom-no-magic-numbers
                    value = ethUtil.fromSigned(value.toString(10));
                }
                // tslint:enable: no-unnecessary-type-assertion
                var buffer = ethUtil.toBuffer(value);
                var paddedBuffer = ethUtil.setLengthLeft(buffer, TOPIC_LENGTH);
                var topic = ethUtil.bufferToHex(paddedBuffer);
                topics.push(topic);
            }
        }
        return topics;
    },
    matchesFilter: function (log, filter) {
        if (filter.address !== undefined && log.address !== filter.address) {
            return false;
        }
        if (filter.topics !== undefined) {
            return exports.filterUtils.doesMatchTopics(log.topics, filter.topics);
        }
        return true;
    },
    doesMatchTopics: function (logTopics, filterTopics) {
        var matchesTopic = logTopics.map(function (logTopic, i) { return exports.filterUtils.matchesTopic(logTopic, filterTopics[i]); });
        var doesMatchTopics = matchesTopic.every(function (m) { return m; });
        return doesMatchTopics;
    },
    matchesTopic: function (logTopic, filterTopic) {
        if (Array.isArray(filterTopic)) {
            return filterTopic.includes(logTopic);
        }
        if (typeof filterTopic === 'string') {
            return filterTopic === logTopic;
        }
        // null topic is a wildcard
        return true;
    },
};
