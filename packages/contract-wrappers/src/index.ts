export {
    AwaitTransactionSuccessOpts,
    ContractEvent,
    ContractFunctionObj,
    ContractTxFunctionObj,
    EncoderOverrides,
    SendTransactionOpts,
    SubscriptionErrors,
} from '@0x/base-contract';
export { ContractAddresses } from '@0x/contract-addresses';
export {
    DecodedLogEvent,
    EventCallback,
    IndexedFilterValues,
    SimpleContractArtifact,
    SimpleEvmBytecodeOutput,
    SimpleEvmOutput,
    SimpleStandardContractOutput,
} from '@0x/types';
export { AbiDecoder, AbiEncoder, DecodedCalldata, EncodingRules } from '@0x/utils';
export {
    AbiDefinition,
    BlockParam,
    BlockParamLiteral,
    BlockRange,
    CallData,
    CompilerOpts,
    CompilerSettings,
    CompilerSettingsMetadata,
    ConstructorAbi,
    ConstructorStateMutability,
    ContractAbi,
    ContractArtifact,
    ContractChainData,
    ContractChains,
    ContractEventArg,
    DataItem,
    DecodedLogArgs,
    DecodedLogEntry,
    DecodedLogEntryEvent,
    DevdocOutput,
    EIP1193Event,
    EIP1193Provider,
    EventAbi,
    EventParameter,
    EvmBytecodeOutput,
    EvmBytecodeOutputLinkReferences,
    EvmOutput,
    FallbackAbi,
    FunctionAbi,
    JSONRPCRequestPayload,
    JSONRPCResponseError,
    JSONRPCResponsePayload,
    LogEntry,
    LogWithDecodedArgs,
    MethodAbi,
    ParamDescription,
    StateMutability,
    SupportedProvider,
    TraceParams,
    TransactionReceiptWithDecodedLogs,
    TxData,
    TxDataPayable,
    Web3JsProvider,
    Web3JsV1Provider,
    Web3JsV2Provider,
    Web3JsV3Provider,
    ZeroExProvider,
} from 'ethereum-types';

// TypeChain exports with native bigint support
export * from './typechain-types';

// Re-export commonly used TypeChain types for easier access
export type {
    IERC20Token, 
    IEtherToken,
    WETH9,
    IZeroEx,
    ZRXToken,
} from './typechain-types';

export type {
    IERC20Token__factory,
    IEtherToken__factory, 
    WETH9__factory,
    IZeroEx__factory,
    ZRXToken__factory,
} from './typechain-types/factories';

// Legacy types and configuration
export { ContractError, ContractWrappersConfig, ForwarderError, OrderInfo, OrderStatus, TraderInfo, OrderAndTraderInfo } from './types';
export { ContractWrappers } from './contract_wrappers';
