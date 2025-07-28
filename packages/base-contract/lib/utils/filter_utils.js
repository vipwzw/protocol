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
exports.filterUtils = void 0;
const utils_1 = require("@0x/utils");
const ethUtil = __importStar(require("ethereumjs-util"));
const jsSHA3 = __importStar(require("js-sha3"));
const uuid_1 = require("uuid");
const TOPIC_LENGTH = 32;
exports.filterUtils = {
    generateUUID() {
        return (0, uuid_1.v4)();
    },
    getFilter(address, eventName, indexFilterValues, abi, blockRange) {
        // tslint:disable:next-line no-unnecessary-type-assertion
        const eventAbi = abi.find(abiDefinition => abiDefinition.name === eventName);
        const eventSignature = exports.filterUtils.getEventSignatureFromAbiByName(eventAbi);
        const topicForEventSignature = ethUtil.addHexPrefix(jsSHA3.keccak256(eventSignature));
        const topicsForIndexedArgs = exports.filterUtils.getTopicsForIndexedArgs(eventAbi, indexFilterValues);
        const topics = [topicForEventSignature, ...topicsForIndexedArgs];
        let filter = {
            address,
            topics,
        };
        if (blockRange !== undefined) {
            filter = {
                ...blockRange,
                ...filter,
            };
        }
        return filter;
    },
    getEventSignatureFromAbiByName(eventAbi) {
        const types = eventAbi.inputs.map(i => i.type);
        const signature = `${eventAbi.name}(${types.join(',')})`;
        return signature;
    },
    getTopicsForIndexedArgs(abi, indexFilterValues) {
        const topics = [];
        for (const eventInput of abi.inputs) {
            if (!eventInput.indexed) {
                continue;
            }
            if (indexFilterValues[eventInput.name] === undefined) {
                // Null is a wildcard topic in a JSON-RPC call
                topics.push(null);
            }
            else {
                // tslint:disable: no-unnecessary-type-assertion
                let value = indexFilterValues[eventInput.name];
                if (utils_1.BigNumber.isBigNumber(value)) {
                    // tslint:disable-next-line custom-no-magic-numbers
                    value = ethUtil.fromSigned(value.toString(10));
                }
                // tslint:enable: no-unnecessary-type-assertion
                const buffer = ethUtil.toBuffer(value);
                const paddedBuffer = ethUtil.setLengthLeft(buffer, TOPIC_LENGTH);
                const topic = ethUtil.bufferToHex(paddedBuffer);
                topics.push(topic);
            }
        }
        return topics;
    },
    matchesFilter(log, filter) {
        if (filter.address !== undefined && log.address !== filter.address) {
            return false;
        }
        if (filter.topics !== undefined) {
            return exports.filterUtils.doesMatchTopics(log.topics, filter.topics);
        }
        return true;
    },
    doesMatchTopics(logTopics, filterTopics) {
        const matchesTopic = logTopics.map((logTopic, i) => exports.filterUtils.matchesTopic(logTopic, filterTopics[i]));
        const doesMatchTopics = matchesTopic.every(m => m);
        return doesMatchTopics;
    },
    matchesTopic(logTopic, filterTopic) {
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
