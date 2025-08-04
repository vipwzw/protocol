// Re-export Ethers v6 Contract as BaseContract for backward compatibility
import { Contract, ContractTransactionResponse, ContractRunner } from 'ethers';
import type { 
    Interface, 
    ContractTransaction,
    TransactionRequest,
    TransactionResponse
} from 'ethers';

// Re-export core Ethers classes and types
export { 
    Contract as BaseContract,
    Contract,
    ContractTransactionResponse,
    ContractRunner,
    Interface,
    ContractTransaction,
    TransactionRequest,
    TransactionResponse
} from 'ethers';

// Re-export legacy types for backward compatibility
export {
    AwaitTransactionSuccessOpts,
    ContractEvent,
    ContractFunctionObj,
    ContractTxFunctionObj,
    DecodedLogEvent,
    EventCallback,
    IndexedFilterValues,
    SendTransactionOpts,
    SubscriptionErrors,
    PromiseWithTransactionHash,
} from './types';

// Re-export PromiseWithTransactionHash from types
export { PromiseWithTransactionHash as IPromiseWithTransactionHash } from './types';

export { SubscriptionManager } from './subscription_manager';

// Legacy interface for TxOpts - now maps to Ethers v6 equivalent
export interface TxOpts {
    pollingIntervalMs?: number;
    timeoutMs?: number;
}

// Legacy utility functions that may still be needed
export class LegacyUtils {
    static removeUndefinedProperties<T extends object>(obj: T): T {
        const clone = { ...obj };
        return Object.fromEntries(
            Object.entries(clone).filter(([_, v]) => v !== undefined)
        ) as T;
    }

    static lowercaseAddress(type: string, value: string): string {
        return type === 'address' ? value.toLowerCase() : value;
    }

    static bigIntToString(_type: string, value: bigint): string {
        return value.toString();
    }
}
