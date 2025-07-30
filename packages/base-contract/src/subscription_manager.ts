import { AbiDecoder, intervalUtils, logUtils 
} from '@0x/utils';
import { ethers } from 'ethers';
import {
    BlockParamLiteral,
    BlockRange,
    ContractAbi,
    DecodedLogArgs,
    FilterObject,
    LogEntry,
    LogWithDecodedArgs,
    RawLog,
    RawLogEntry,
} from 'ethereum-types';
import { Block, BlockAndLogStreamer, Log } from 'ethereumjs-blockstream';

import type { EventCallback, IndexedFilterValues } from '../../utils/lib/src/types';

import { SubscriptionErrors } from './types';
import { filterUtils } from './utils/filter_utils';

const DEFAULT_BLOCK_POLLING_INTERVAL = 1000;

export class SubscriptionManager<ContractEventArgs extends DecodedLogArgs, ContractEvents extends string> {
    public abi: ContractAbi;
    private _blockAndLogStreamerIfExists: BlockAndLogStreamer<Block, Log> | undefined;
    private _blockAndLogStreamIntervalIfExists?: NodeJS.Timeout;
    private readonly _provider: ethers.Provider;
    private readonly _filters: { [filterToken: string]: FilterObject };
    private readonly _filterCallbacks: {
        [filterToken: string]: EventCallback<ContractEventArgs>;
    };
    private _onLogAddedSubscriptionToken: string | undefined;
    private _onLogRemovedSubscriptionToken: string | undefined;
    private static _onBlockAndLogStreamerError(isVerbose: boolean, err: Error): void {
        // Since Blockstream errors are all recoverable, we simply log them if the verbose
        // config is passed in.
        if (isVerbose) {
            logUtils.warn(err);
        }
    }
    constructor(abi: ContractAbi, provider: ethers.Provider) {
        this.abi = abi;
        this._provider = provider;
        this._filters = {};
        this._filterCallbacks = {};
    }
    public subscribe<ArgsType extends ContractEventArgs>(
        eventName: ContractEvents,
        indexFilterValues: IndexedFilterValues,
        callback: EventCallback<ArgsType>,
        isVerbose: boolean = false,
        blockPollingIntervalMs?: number,
    ): string {
        const filterToken = filterUtils.generateUUID();
        const filter = filterUtils.getFilter(
            '',  // address - empty for now
            eventName,
            indexFilterValues,
            this.abi,
        );
        this._filters[filterToken] = filter;
        this._filterCallbacks[filterToken] = callback as EventCallback<ContractEventArgs>;
        if (this._blockAndLogStreamerIfExists === undefined) {
            this._startBlockAndLogStream(isVerbose, blockPollingIntervalMs);
        }
        return filterToken;
    }
    public unsubscribe(filterToken: string): void {
        if (this._filters[filterToken] === undefined) {
            throw new Error(SubscriptionErrors.SubscriptionNotFound);
        }
        delete this._filters[filterToken];
        delete this._filterCallbacks[filterToken];
        if (Object.keys(this._filters).length === 0 && this._blockAndLogStreamerIfExists !== undefined) {
            this._stopBlockAndLogStream();
        }
    }
    public unsubscribeAll(): void {
        const filterTokens = Object.keys(this._filters);
        filterTokens.forEach(filterToken => this.unsubscribe(filterToken));
    }
    private async _startBlockAndLogStream(isVerbose: boolean, blockPollingIntervalMs?: number): Promise<void> {
        if (this._blockAndLogStreamerIfExists !== undefined) {
            throw new Error(SubscriptionErrors.SubscriptionAlreadyPresent);
        }
        this._blockAndLogStreamerIfExists = new BlockAndLogStreamer(
            async (hash: string) => {
                const block = await this._provider.getBlock(hash);
                return block as any;
            },
            async (filter: any) => {
                const logs = await this._provider.getLogs(filter);
                return logs as any;
            },
            (error: Error) => {
                if (isVerbose) {
                    logUtils.warn(error);
                }
            },
            {} as any,
        );
        // Subscribe to new logs
        this._onLogAddedSubscriptionToken = this._blockAndLogStreamerIfExists.subscribeToOnLogsAdded(
            (blockHash: string, rawLogs: Log[]) => this._onLogStateChanged<ContractEventArgs>(rawLogs as any, false),
        );
        // Subscribe to removed logs
        this._onLogRemovedSubscriptionToken = this._blockAndLogStreamerIfExists.subscribeToOnLogsRemoved(
            (blockHash: string, rawLogs: Log[]) => this._onLogStateChanged<ContractEventArgs>(rawLogs as any, true),
        );
        // Start the block and log stream
        this._blockAndLogStreamerIfExists.reconcileNewBlock((
            this._blockAndLogStreamerIfExists as any
        )._latestBlock);
    }
    private _stopBlockAndLogStream(): void {
        if (this._blockAndLogStreamerIfExists === undefined) {
            throw new Error(SubscriptionErrors.SubscriptionNotFound);
        }
        this._blockAndLogStreamerIfExists.unsubscribeFromOnLogsAdded(this._onLogAddedSubscriptionToken as string);
        this._blockAndLogStreamerIfExists.unsubscribeFromOnLogsRemoved(this._onLogRemovedSubscriptionToken as string);
        delete this._blockAndLogStreamerIfExists;

        if (this._blockAndLogStreamIntervalIfExists !== undefined) {
            intervalUtils.clearAsyncExcludingInterval(this._blockAndLogStreamIntervalIfExists);
        }
    }
    private _onLogStateChanged<ArgsType extends ContractEventArgs>(
        rawLogs: RawLogEntry[],
        isRemoved: boolean,
    ): void {
        // Convert raw logs to LogEntry format - simple unmarshalling replacement
        const logs: LogEntry[] = rawLogs.map(rawLog => ({
            ...rawLog,
            logIndex: typeof rawLog.logIndex === 'string' ? parseInt(rawLog.logIndex) : (rawLog.logIndex || 0),
            transactionIndex: typeof rawLog.transactionIndex === 'string' ? parseInt(rawLog.transactionIndex) : (rawLog.transactionIndex || 0),
            transactionHash: rawLog.transactionHash || '',
            blockHash: rawLog.blockHash || '',
            blockNumber: typeof rawLog.blockNumber === 'string' ? parseInt(rawLog.blockNumber) : (rawLog.blockNumber || 0),
            address: rawLog.address || '',
            data: rawLog.data || '',
            topics: rawLog.topics || [],
        }));
        
        logs.forEach(log => {
            Object.entries(this._filters).forEach(([filterToken, filter]) => {
                if (filterUtils.matchesFilter(log, filter)) {
                    const decodedLog = this._tryToDecodeLogOrNoop(log) as LogWithDecodedArgs<ArgsType>;
                    const logEvent = {
                        log: decodedLog,
                        isRemoved,
                    };
                    const callback = this._filterCallbacks[filterToken];
                    callback(null, logEvent);
                }
            });
        });
    }
    private _tryToDecodeLogOrNoop(log: LogEntry): LogWithDecodedArgs<DecodedLogArgs> | RawLog {
        try {
            const abiDecoder = new AbiDecoder([]);
            abiDecoder.addABI(this.abi);
            const decodedLog = abiDecoder.tryToDecodeLogOrNoop(log);
            return decodedLog;
        } catch (error) {
            return log;
        }
    }
}
