// 修复 @0x/base-contract 的类型约束问题
declare module '@0x/base-contract' {
    import { DecodedLogArgs, LogEntry, LogWithDecodedArgs, RawLog, ContractAbi, BlockRange } from 'ethereum-types';

    export interface IndexedFilterValues {
        [index: string]: any;
    }

    export type EventCallback<ArgsType extends DecodedLogArgs> = (
        err: null | Error,
        log?: LogWithDecodedArgs<ArgsType>,
    ) => void;

    export class SubscriptionManager<ContractEventArgs extends DecodedLogArgs, ContractEvents extends string> {
        subscribe<ArgsType extends ContractEventArgs>(
            address: string,
            eventName: ContractEvents,
            indexFilterValues: IndexedFilterValues,
            abi: ContractAbi,
            callback: EventCallback<ArgsType>,
            isVerbose?: boolean,
            blockPollingIntervalMs?: number,
        ): string;

        getLogsAsync<ArgsType extends ContractEventArgs>(
            address: string,
            eventName: ContractEvents,
            blockRange: BlockRange,
            indexFilterValues: IndexedFilterValues,
            abi: ContractAbi,
        ): Promise<Array<LogWithDecodedArgs<ArgsType>>>;

        protected _tryToDecodeLogOrNoop<ArgsType extends ContractEventArgs>(
            log: LogEntry,
        ): LogWithDecodedArgs<ArgsType> | RawLog;
    }
}
