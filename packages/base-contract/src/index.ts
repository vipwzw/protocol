import { assert } from './assert_utils';
import { schemas } from '@0x/json-schemas';
import {
    AbiDecoder,
    AbiEncoder,
    abiUtils,
    BigNumber,
    decodeBytesAsRevertError,
    decodeThrownErrorAsRevertError,
    providerUtils,
    RevertError,
    StringRevertError,
} from '@0x/utils';
import { ethers } from 'ethers';
import VM from '@ethereumjs/vm';
import { RunCallOpts } from '@ethereumjs/vm/dist/runCall';
import {
    AbiDefinition,
    AbiType,
    BlockParam,
    CallData,
    ContractAbi,
    DataItem,
    DecodedLogArgs,
    LogWithDecodedArgs,
    MethodAbi,
    RawLog,
    TransactionReceiptWithDecodedLogs,
    TxData,
    TxDataPayable,
    ZeroExProvider,
} from 'ethereum-types';
import * as _ from 'lodash';
import * as util from 'ethereumjs-util';

export interface TxOpts {
    pollingIntervalMs?: number;
    timeoutMs?: number;
}

export class PromiseWithTransactionHash<T> extends Promise<T> {
    public readonly txHashPromise: Promise<string>;
    constructor(
        txHashPromise: Promise<string>,
        resultPromise: Promise<T>,
    ) {
        super((resolve, reject) => {
            resultPromise.then(resolve, reject);
        });
        this.txHashPromise = txHashPromise;
    }
}

export interface AbiEncoderByFunctionSignature {
    [key: string]: AbiEncoder.Method;
}

export interface EncoderOverrides {
    encodeInput: (functionName: string, values: any) => string;
    decodeOutput: (functionName: string, data: string) => any;
}

export class BaseContract {
    protected _abiEncoderByFunctionSignature: AbiEncoderByFunctionSignature;
    protected _provider: ethers.Provider;
    protected _abiDecoder: AbiDecoder;
    protected _contractDefaults: any;
    protected _encoderOverrides: Partial<EncoderOverrides>;
    public abi: ContractAbi;
    public address: string;
    public contractName: string;
    public constructorArgs: any[] = [];
    public _deployedBytecodeIfExists?: Buffer;
    private _evmIfExists?: VM;
    private _evmAccountIfExists?: util.Address;

    protected static _formatABIDataItemList(
        abis: DataItem[],
        values: any[],
        formatter: (type: string, value: any) => any,
    ): any {
        return abis.reduce((formatted: any, abi, i) => {
            const itemValue = values[i];
            formatted[abi.name] = formatter(abi.type, itemValue);
            return formatted;
        }, {});
    }

    protected static _lowercaseAddress(type: string, value: string): string {
        return type === 'address' ? value.toLowerCase() : value;
    }

    protected static _bigNumberToString(_type: string, value: BigNumber): string {
        return value.toString();
    }

    protected static _lookupConstructorAbi(abi: ContractAbi): MethodAbi {
        const constructorAbiIfExists = _.find(
            abi,
            (abiDefinition: AbiDefinition) => abiDefinition.type === AbiType.Constructor,
        ) as MethodAbi;
        if (constructorAbiIfExists === undefined) {
            throw new Error('No constructor found in the contract ABI');
        }
        return constructorAbiIfExists;
    }

    protected static _throwIfThrownErrorIsRevertError(error: Error): void {
        const revertError = decodeThrownErrorAsRevertError(error);
        if (revertError) {
            throw revertError;
        }
    }

    protected static _throwIfCallResultIsRevertError(rawCallResult: string): void {
        const revertError = decodeBytesAsRevertError(rawCallResult);
        if (revertError) {
            throw revertError;
        }
    }

    protected static _throwIfUnexpectedEmptyCallResult(rawCallResult: string): void {
        if (rawCallResult === '0x') {
            throw new Error('Contract call result was unexpected empty (0x)');
        }
    }

    protected static _removeUndefinedProperties<T extends object>(obj: T): T {
        const clone = _.clone(obj);
        return _.pickBy(clone, (v: any) => v !== undefined) as T;
    }

    protected static _assertRawCallResult(rawCallResult: string): void {
        BaseContract._throwIfCallResultIsRevertError(rawCallResult);
        BaseContract._throwIfUnexpectedEmptyCallResult(rawCallResult);
    }

    protected static async _assertCallResultAsync(
        callResult: string,
        functionAbi: MethodAbi,
        isOptional: boolean = false,
    ): Promise<void> {
        if (!isOptional) {
            BaseContract._assertRawCallResult(callResult);
        }
    }

    protected constructor(
        contractName: string,
        abi: ContractAbi,
        address: string,
        supportedProvider: ZeroExProvider,
        callAndTxnDefaults?: Partial<TxData>,
        logDecodeDependencies?: { [contractName: string]: ContractAbi },
        encoderOverrides?: Partial<EncoderOverrides>,
    ) {
        assert.isString('contractName', contractName);
        assert.isETHAddressHex('address', address);
        const provider = providerUtils.standardizeOrThrow(supportedProvider);
        if (callAndTxnDefaults !== undefined) {
            assert.doesConformToSchema('callAndTxnDefaults', callAndTxnDefaults, schemas.callDataSchema);
        }
        this.contractName = contractName;
        this._provider = new ethers.JsonRpcProvider(provider as any);
        this._contractDefaults = callAndTxnDefaults || {};
        this._abiDecoder = new AbiDecoder([]);
        this._encoderOverrides = encoderOverrides || {};
        this.abi = abi;
        this.address = address;
        const methodAbis = this.abi.filter(
            (abiDefinition: AbiDefinition) => abiDefinition.type === AbiType.Function,
        ) as MethodAbi[];
        this._abiEncoderByFunctionSignature = {};
        methodAbis.forEach(methodAbi => {
            const abiEncoder = new AbiEncoder.Method(methodAbi);
            const functionSignature = abiEncoder.getSignature();
            this._abiEncoderByFunctionSignature[functionSignature] = abiEncoder;
            this._abiDecoder.addABI(abi, contractName);
        });
        if (logDecodeDependencies) {
            Object.entries(logDecodeDependencies).forEach(([dependencyName, dependencyAbi]) =>
                this._abiDecoder.addABI(dependencyAbi, dependencyName),
            );
        }
    }

    protected _promiseWithTransactionHash(
        txHashPromise: Promise<string>,
        opts: TxOpts,
    ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs> {
        return new PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs>(
            txHashPromise,
            (async (): Promise<TransactionReceiptWithDecodedLogs> => {
                // When the transaction hash resolves, wait for it to be mined.
                const txHash = await txHashPromise;
                const receipt = await this._provider.waitForTransaction(txHash, 1, opts.timeoutMs);
                if (!receipt) {
                    throw new Error(`Transaction ${txHash} was not mined`);
                }
                
                // Convert receipt to expected format with decoded logs
                const receiptWithDecodedLogs = {
                    ...receipt,
                    transactionHash: receipt.hash,
                    transactionIndex: receipt.index,
                    logs: receipt.logs.map(log => ({
                        ...log,
                        logIndex: log.index,
                        transactionIndex: log.transactionIndex,
                        transactionHash: log.transactionHash,
                        blockHash: log.blockHash,
                        blockNumber: log.blockNumber,
                        address: log.address,
                        data: log.data,
                        topics: log.topics,
                    })) as unknown as LogWithDecodedArgs<any>[],
                } as unknown as TransactionReceiptWithDecodedLogs;
                
                return receiptWithDecodedLogs;
            })(),
        );
    }

    protected async _applyDefaultsToTxDataAsync<T extends Partial<TxData | TxDataPayable>>(
        txData: T,
        estimateGasAsync?: (txData: T) => Promise<number>,
    ): Promise<TxData> {
        // Gas amount sourced with the following priorities:
        // 1. Optional param passed in to public method call
        // 2. Global config passed in at library instantiation
        // 3. Gas estimate calculation + safety margin
        // tslint:disable-next-line:no-object-literal-type-assertion
        const txDataWithDefaults = {
            to: this.address,
            ...this._contractDefaults,
            ...BaseContract._removeUndefinedProperties(txData),
        } as TxData;

        if (txDataWithDefaults.gas === undefined) {
            if (estimateGasAsync !== undefined) {
                txDataWithDefaults.gas = await estimateGasAsync(txData);
            } else {
                txDataWithDefaults.gas = 90000;
            }
        }
        return txDataWithDefaults;
    }

    protected async _evmExecAsync(encodedData: string): Promise<string> {
        const encodedDataBytes = Buffer.from(encodedData.substr(2), 'hex');
        const toAddress = util.Address.fromString(this.address);

        // Set up VM if it doesn't exist
        if (this._evmIfExists === undefined) {
            const vm = await VM.create();
            
            // Set up account
            const accountAddress = util.Address.fromString('0x0000000000000000000000000000000000000001');
            const account = util.Account.fromAccountData({ balance: '0xde0b6b3a7640000' });
            await vm.stateManager.putAccount(accountAddress, account);

            // 'deploy' the contract
            if (this._deployedBytecodeIfExists === undefined) {
                const contractCode = await this._provider.getCode(this.address);
                this._deployedBytecodeIfExists = Buffer.from(contractCode.substr(2), 'hex');
            }
            await vm.stateManager.putContractCode(toAddress, this._deployedBytecodeIfExists);

            // save for later
            this._evmIfExists = vm;
            this._evmAccountIfExists = accountAddress;
        }
        let rawCallResult;
        try {
            const callOpts: RunCallOpts = {
                to: toAddress,
                caller: this._evmAccountIfExists,
                origin: this._evmAccountIfExists,
                data: encodedDataBytes,
            };
            const result = await this._evmIfExists.runCall(callOpts);
            rawCallResult = `0x${result.execResult.returnValue.toString('hex')}`;
        } catch (err) {
            BaseContract._throwIfThrownErrorIsRevertError(err instanceof Error ? err : new Error(String(err)));
            throw err;
        }

        BaseContract._throwIfCallResultIsRevertError(rawCallResult);
        return rawCallResult;
    }

    protected async _performCallAsync(callData: Partial<CallData>, defaultBlock?: BlockParam): Promise<string> {
        const callDataWithDefaults = await this._applyDefaultsToTxDataAsync(callData);
        let rawCallResult: string;
        try {
            rawCallResult = await this._provider.call({
                to: callDataWithDefaults.to,
                data: callDataWithDefaults.data,
                from: callDataWithDefaults.from,
                gasLimit: callDataWithDefaults.gas?.toString(),
                gasPrice: callDataWithDefaults.gasPrice?.toString(),
                value: callDataWithDefaults.value?.toString(),
            });
        } catch (err) {
            BaseContract._throwIfThrownErrorIsRevertError(err instanceof Error ? err : new Error(String(err)));
            throw err;
        }
        BaseContract._assertRawCallResult(rawCallResult);
        return rawCallResult;
    }

    protected _lookupAbiEncoder(functionSignature: string): AbiEncoder.Method {
        const abiEncoder = this._abiEncoderByFunctionSignature[functionSignature];
        if (abiEncoder === undefined) {
            throw new Error(`Failed to lookup method with function signature '${functionSignature}'`);
        }
        return abiEncoder;
    }

    protected _lookupEthersInterface(): ethers.Interface {
        return new ethers.Interface(this.abi);
    }

    protected _strictEncodeArguments(functionSignature: string, functionArguments: any): string {
        const abiEncoder = this._lookupAbiEncoder(functionSignature);
        const dataItem = abiEncoder.getDataItem();
        const inputAbi = (dataItem as any).components || [];
        if (inputAbi === undefined) {
            throw new Error(`Failed to get input ABI for function signature '${functionSignature}'`);
        }
        return abiEncoder.encode(functionArguments);
    }

    protected _evmExecIfPossible<T>(
        callDataWithDefaults: Partial<CallData>,
        defaultBlock: BlockParam | undefined,
        callAsync: () => Promise<string>,
        decodeCallResultAsync: (callResult: string) => T,
    ): T | Promise<T> {
        if (defaultBlock === undefined) {
            return this._evmExecAsync(callDataWithDefaults.data!).then(decodeCallResultAsync);
        } else {
            return callAsync().then(decodeCallResultAsync);
        }
    }

    protected _getEncoderOverrideForMethod(functionSignature: string): Partial<EncoderOverrides> | undefined {
        const methodOverrides = this._encoderOverrides;
        if (methodOverrides && (methodOverrides.encodeInput || methodOverrides.decodeOutput)) {
            return methodOverrides;
        }
        return undefined;
    }
}
