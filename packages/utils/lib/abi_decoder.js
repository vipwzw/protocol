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
exports.AbiDecoder = void 0;
const ethereum_types_1 = require("ethereum-types");
const ethers = __importStar(require("ethers"));
const _ = __importStar(require("lodash"));
const _1 = require(".");
/**
 * AbiDecoder allows you to decode event logs given a set of supplied contract ABI's. It takes the contract's event
 * signature from the ABI and attempts to decode the logs using it.
 */
class AbiDecoder {
    /**
     * Retrieves the function selector from calldata.
     * @param calldata hex-encoded calldata.
     * @return hex-encoded function selector.
     */
    static _getFunctionSelector(calldata) {
        const functionSelectorLength = 10;
        if (!calldata.startsWith('0x') || calldata.length < functionSelectorLength) {
            throw new Error(`Malformed calldata. Must include a hex prefix '0x' and 4-byte function selector. Got '${calldata}'`);
        }
        const functionSelector = calldata.substr(0, functionSelectorLength);
        return functionSelector;
    }
    /**
     * Instantiate an AbiDecoder
     * @param abiArrays An array of contract ABI's
     * @return AbiDecoder instance
     */
    constructor(abiArrays) {
        this._eventIds = {};
        this._selectorToFunctionInfo = {};
        _.each(abiArrays, abi => {
            this.addABI(abi);
        });
    }
    /**
     * Attempt to decode a log given the ABI's the AbiDecoder knows about.
     * @param log The log to attempt to decode
     * @return The decoded log if the requisite ABI was available. Otherwise the log unaltered.
     */
    tryToDecodeLogOrNoop(log) {
        // Lookup event corresponding to log
        const eventId = log.topics[0];
        const numIndexedArgs = log.topics.length - 1;
        if (this._eventIds[eventId] === undefined || this._eventIds[eventId][numIndexedArgs] === undefined) {
            return log;
        }
        const event = this._eventIds[eventId][numIndexedArgs];
        // Create decoders for indexed data
        const indexedDataDecoders = _.mapValues(_.filter(event.inputs, { indexed: true }), input => 
        // tslint:disable:next-line no-unnecessary-type-assertion
        _1.AbiEncoder.create(input));
        // Decode indexed data
        const decodedIndexedData = _.map(log.topics.slice(1), // ignore first topic, which is the event id.
        (input, i) => indexedDataDecoders[i].decode(input));
        // Decode non-indexed data
        const decodedNonIndexedData = _1.AbiEncoder.create(_.filter(event.inputs, { indexed: false })).decodeAsArray(log.data);
        // Construct DecodedLogArgs struct by mapping event parameters to their respective decoded argument.
        const decodedArgs = {};
        let indexedOffset = 0;
        let nonIndexedOffset = 0;
        for (const param of event.inputs) {
            const value = param.indexed
                ? decodedIndexedData[indexedOffset++]
                : decodedNonIndexedData[nonIndexedOffset++];
            if (value === undefined) {
                return log;
            }
            decodedArgs[param.name] = value;
        }
        // Decoding was successful. Return decoded log.
        return {
            ...log,
            event: event.name,
            args: decodedArgs,
        };
    }
    /**
     * Decodes calldata for a known ABI.
     * @param calldata hex-encoded calldata.
     * @param contractName used to disambiguate similar ABI's (optional).
     * @return Decoded calldata. Includes: function name and signature, along with the decoded arguments.
     */
    decodeCalldataOrThrow(calldata, contractName) {
        const functionSelector = AbiDecoder._getFunctionSelector(calldata);
        const candidateFunctionInfos = this._selectorToFunctionInfo[functionSelector];
        if (candidateFunctionInfos === undefined) {
            throw new Error(`No functions registered for selector '${functionSelector}'`);
        }
        const functionInfo = _.find(candidateFunctionInfos, candidateFunctionInfo => {
            return (contractName === undefined || _.toLower(contractName) === _.toLower(candidateFunctionInfo.contractName));
        });
        if (functionInfo === undefined) {
            throw new Error(`No function registered with selector ${functionSelector} and contract name ${contractName}.`);
        }
        else if (functionInfo.abiEncoder === undefined) {
            throw new Error(`Function ABI Encoder is not defined, for function registered with selector ${functionSelector} and contract name ${contractName}.`);
        }
        const functionName = functionInfo.abiEncoder.getDataItem().name;
        const functionSignature = functionInfo.abiEncoder.getSignatureType();
        const functionArguments = functionInfo.abiEncoder.decode(calldata);
        const decodedCalldata = {
            functionName,
            functionSignature,
            functionArguments,
        };
        return decodedCalldata;
    }
    /**
     * Adds a set of ABI definitions, after which calldata and logs targeting these ABI's can be decoded.
     * Additional properties can be included to disambiguate similar ABI's. For example, if two functions
     * have the same signature but different parameter names, then their ABI definitions can be disambiguated
     * by specifying a contract name.
     * @param abiDefinitions ABI definitions for a given contract.
     * @param contractName Name of contract that encapsulates the ABI definitions (optional).
     *                     This can be used when decoding calldata to disambiguate methods with
     *                     the same signature but different parameter names.
     */
    addABI(abiArray, contractName) {
        if (abiArray === undefined) {
            return;
        }
        const ethersInterface = new ethers.Interface(abiArray);
        _.map(abiArray, (abi) => {
            switch (abi.type) {
                case ethereum_types_1.AbiType.Event:
                    // tslint:disable-next-line:no-unnecessary-type-assertion
                    this._addEventABI(abi, ethersInterface);
                    break;
                case ethereum_types_1.AbiType.Function:
                    // tslint:disable-next-line:no-unnecessary-type-assertion
                    this._addMethodABI(abi, contractName);
                    break;
                default:
                    // ignore other types
                    break;
            }
        });
    }
    _addEventABI(eventAbi, ethersInterface) {
        const eventFragment = ethersInterface.getEvent(eventAbi.name);
        if (!eventFragment) {
            throw new Error(`Event ${eventAbi.name} not found in interface`);
        }
        const topic = eventFragment.topicHash;
        const numIndexedArgs = _.reduce(eventAbi.inputs, (sum, input) => (input.indexed ? sum + 1 : sum), 0);
        this._eventIds[topic] = {
            ...this._eventIds[topic],
            [numIndexedArgs]: eventAbi,
        };
    }
    _addMethodABI(methodAbi, contractName) {
        const abiEncoder = new _1.AbiEncoder.Method(methodAbi);
        const functionSelector = abiEncoder.getSelector();
        if (!(functionSelector in this._selectorToFunctionInfo)) {
            this._selectorToFunctionInfo[functionSelector] = [];
        }
        // Recored a copy of this ABI for each deployment
        const functionSignature = abiEncoder.getSignature();
        this._selectorToFunctionInfo[functionSelector].push({
            functionSignature,
            abiEncoder,
            contractName,
        });
    }
}
exports.AbiDecoder = AbiDecoder;
