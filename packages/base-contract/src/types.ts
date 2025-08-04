import type {
    ContractTransactionResponse,
    TransactionResponse,
    TransactionRequest,
    ContractRunner,
    Provider
} from 'ethers';

// Legacy type mappings for backward compatibility
import {
    BlockParam,
    CallData,
    ContractEventArg,
    DecodedLogArgs,
    LogEntryEvent,
    LogWithDecodedArgs,
    TransactionReceiptWithDecodedLogs,
    TxAccessListWithGas,
    TxData,
} from 'ethereum-types';

// Define PromiseWithTransactionHash type here to avoid circular dependency
export interface PromiseWithTransactionHash<T> extends Promise<T> {
    readonly txHashPromise: Promise<string>;
}

export type LogEvent = LogEntryEvent;

export interface ContractEvent<ContractEventArgs> {
    logIndex: number;
    transactionIndex: number;
    transactionHash: string;
    blockHash: string;
    blockNumber: number;
    address: string;
    type: string;
    event: string;
    args: ContractEventArgs;
}

export enum SubscriptionErrors {
    SubscriptionNotFound = 'SUBSCRIPTION_NOT_FOUND',
    SubscriptionAlreadyPresent = 'SUBSCRIPTION_ALREADY_PRESENT',
}

/**
 * Used with `sendTransactionAsync`
 * * shouldValidate: Flag indicating whether the library should make attempts to validate a transaction before
 * broadcasting it. For example, order has a valid signature, maker has sufficient funds, etc. Default=true.
 */
export interface SendTransactionOpts {
    shouldValidate?: boolean;
}

/**
 * Used with `awaitTransactionSuccessAsync`
 * * pollingIntervalMs: Determine polling intervals in milliseconds
 * * timeoutMs: Determines timeout in milliseconds
 */
export interface AwaitTransactionSuccessOpts extends SendTransactionOpts {
    pollingIntervalMs?: number;
    timeoutMs?: number;
}

// Updated contract function interfaces for Ethers v6 compatibility
export interface ContractFunctionObj<T> {
    selector: string;
    callAsync(callData?: Partial<CallData>, defaultBlock?: BlockParam): Promise<T>;
    getABIEncodedTransactionData(): string;
    // Ethers v6 compatibility methods
    staticCall?(...args: any[]): Promise<T>;
    staticCallResult?(...args: any[]): Promise<any>;
}

export interface ContractTxFunctionObj<T> extends ContractFunctionObj<T> {
    sendTransactionAsync(txData?: Partial<TxData>, opts?: SendTransactionOpts): Promise<string>;
    awaitTransactionSuccessAsync(
        txData?: Partial<TxData>,
        opts?: AwaitTransactionSuccessOpts,
    ): PromiseWithTransactionHash<TransactionReceiptWithDecodedLogs>;
    estimateGasAsync(txData?: Partial<TxData>): Promise<number>;
    createAccessListAsync(
        txData?: Partial<TxData>,
        defaultBlock?: BlockParam,
        shouldOptimize?: boolean,
    ): Promise<TxAccessListWithGas>;
    // Ethers v6 compatibility methods
    send?(...args: any[]): Promise<ContractTransactionResponse>;
    estimateGas?(...args: any[]): Promise<bigint>;
    populateTransaction?(...args: any[]): Promise<TransactionRequest>;
}

// Additional types needed for subscription manager
export interface IndexedFilterValues {
    [index: string]: ContractEventArg;
}

export interface DecodedLogEvent<ArgsType extends DecodedLogArgs> {
    isRemoved: boolean;
    log: LogWithDecodedArgs<ArgsType>;
}

export type EventCallback<ArgsType extends DecodedLogArgs> = (
    err: null | Error,
    log?: DecodedLogEvent<ArgsType>,
) => void;
