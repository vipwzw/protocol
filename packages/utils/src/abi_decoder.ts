import {
    AbiDefinition,
    AbiType,
    DataItem,
    DecodedLogArgs,
    EventAbi,
    LogEntry,
    LogWithDecodedArgs,
    MethodAbi,
    RawLog,
} from 'ethereum-types';
import { ethers, Interface } from 'ethers';
import * as _ from 'lodash';

// AbiEncoder 已移除，直接使用 ethers Interface
import { DecodedCalldata, SelectorToFunctionInfo } from './types';

/**
 * AbiDecoder allows you to decode event logs given a set of supplied contract ABI's. It takes the contract's event
 * signature from the ABI and attempts to decode the logs using it.
 */
export class AbiDecoder {
    private readonly _eventIds: { [signatureHash: string]: { [numIndexedArgs: number]: EventAbi } } = {};
    private readonly _selectorToFunctionInfo: SelectorToFunctionInfo = {};
    /**
     * Retrieves the function selector from calldata.
     * @param calldata hex-encoded calldata.
     * @return hex-encoded function selector.
     */
    private static _getFunctionSelector(calldata: string): string {
        const functionSelectorLength = 10;
        if (!calldata.startsWith('0x') || calldata.length < functionSelectorLength) {
            throw new Error(
                `Malformed calldata. Must include a hex prefix '0x' and 4-byte function selector. Got '${calldata}'`,
            );
        }
        const functionSelector = calldata.substr(0, functionSelectorLength);
        return functionSelector;
    }
    /**
     * Instantiate an AbiDecoder
     * @param abiArrays An array of contract ABI's
     * @return AbiDecoder instance
     */
    constructor(abiArrays: AbiDefinition[][]) {
        _.each(abiArrays, abi => {
            this.addABI(abi);
        });
    }
    /**
     * Attempt to decode a log given the ABI's the AbiDecoder knows about.
     * @param log The log to attempt to decode
     * @return The decoded log if the requisite ABI was available. Otherwise the log unaltered.
     */
    public tryToDecodeLogOrNoop<ArgsType extends DecodedLogArgs>(log: LogEntry): LogWithDecodedArgs<ArgsType> | RawLog {
        // Lookup event corresponding to log
        const eventId = log.topics[0];
        const numIndexedArgs = log.topics.length - 1;
        if (this._eventIds[eventId] === undefined || this._eventIds[eventId][numIndexedArgs] === undefined) {
            return log;
        }
        const event = this._eventIds[eventId][numIndexedArgs];

        // Decode using ethers Interface
        const ethersInterface = new Interface([event]);
        const decodedEvent = ethersInterface.decodeEventLog(event.name, log.data, log.topics);
        
        // Split into indexed and non-indexed data for compatibility
        const decodedIndexedData: any[] = [];
        const decodedNonIndexedData: any[] = [];
        
        event.inputs.forEach((input, index) => {
            if (input.indexed) {
                decodedIndexedData.push(decodedEvent[index]);
            } else {
                decodedNonIndexedData.push(decodedEvent[index]);
            }
        });

        // Construct DecodedLogArgs struct by mapping event parameters to their respective decoded argument.
        const decodedArgs: DecodedLogArgs = {};
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
            args: decodedArgs as ArgsType,
        };
    }
    /**
     * Decodes calldata for a known ABI.
     * @param calldata hex-encoded calldata.
     * @param contractName used to disambiguate similar ABI's (optional).
     * @return Decoded calldata. Includes: function name and signature, along with the decoded arguments.
     */
    public decodeCalldataOrThrow(calldata: string, contractName?: string): DecodedCalldata {
        const functionSelector = AbiDecoder._getFunctionSelector(calldata);
        const candidateFunctionInfos = this._selectorToFunctionInfo[functionSelector];
        if (candidateFunctionInfos === undefined) {
            throw new Error(`No functions registered for selector '${functionSelector}'`);
        }
        const functionInfo = _.find(candidateFunctionInfos, candidateFunctionInfo => {
            return (
                contractName === undefined || _.toLower(contractName) === _.toLower(candidateFunctionInfo.contractName)
            );
        });
        if (functionInfo === undefined) {
            throw new Error(
                `No function registered with selector ${functionSelector} and contract name ${contractName}.`,
            );
        } else if (functionInfo.ethersInterface === undefined) {
            throw new Error(
                `Function Interface is not defined, for function registered with selector ${functionSelector} and contract name ${contractName}.`,
            );
        }
        const functionName = functionInfo.methodAbi.name;
        const functionSignature = functionInfo.functionSignature;
        const decodedData = functionInfo.ethersInterface.decodeFunctionData(functionInfo.methodAbi.name, calldata);
        
        // 将 ethers.js v6 的 Result 对象转换为带参数名称的普通对象
        const functionArguments: { [key: string]: any } = {};
        functionInfo.methodAbi.inputs?.forEach((input, index) => {
            if (input.name && index < decodedData.length) {
                functionArguments[input.name] = decodedData[index];
            }
        });
        
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
    public addABI(abiArray: AbiDefinition[], contractName?: string): void {
        if (abiArray === undefined) {
            return;
        }
        const ethersInterface = new Interface(abiArray as any);
        _.map(abiArray, (abi: AbiDefinition) => {
            switch (abi.type) {
                case AbiType.Event:
                    // tslint:disable-next-line:no-unnecessary-type-assertion
                    this._addEventABI(abi as EventAbi, ethersInterface);
                    break;

                case AbiType.Function:
                    // tslint:disable-next-line:no-unnecessary-type-assertion
                    this._addMethodABI(abi as MethodAbi, contractName);
                    break;

                default:
                    // ignore other types
                    break;
            }
        });
    }
    private _addEventABI(eventAbi: EventAbi, ethersInterface: Interface): void {
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
    private _addMethodABI(methodAbi: MethodAbi, contractName?: string): void {
        const ethersInterface = new Interface([methodAbi]);
        const functionFragment = ethersInterface.getFunction(methodAbi.name);
        if (!functionFragment) {
            throw new Error(`Function ${methodAbi.name} not found in interface`);
        }
        const functionSelector = functionFragment.selector;
        if (!(functionSelector in this._selectorToFunctionInfo)) {
            this._selectorToFunctionInfo[functionSelector] = [];
        }
        // Record a copy of this ABI for each deployment
        const functionSignature = functionFragment.format('full');
        this._selectorToFunctionInfo[functionSelector].push({
            functionSignature,
            methodAbi,
            ethersInterface,
            contractName,
        });
    }
}
