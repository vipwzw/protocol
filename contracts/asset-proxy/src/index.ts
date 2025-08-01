export { artifacts } from './artifacts';
export * from './wrappers';

// Export wrapper classes
export { ERC20Wrapper } from './erc20_wrapper';
export { ERC721Wrapper } from './erc721_wrapper';
// TODO: ERC1155ProxyWrapper 需要大量重构工作 - 44 个编译错误需要修复
// 主要问题：BigNumber -> bigint 转换，旧 API 方法更新，类型定义修复
// export { ERC1155ProxyWrapper } from './erc1155_proxy_wrapper';

// Re-export utility functions that don't depend on contracts
export * from './asset_data';
export * from './dex_forwarder_bridge';
export * from './dydx_bridge_encoder';

// Core ethereum-types that should be available
export {
    TransactionReceiptWithDecodedLogs,
    Provider,
    ZeroExProvider,
    JSONRPCRequestPayload,
    JSONRPCErrorCallback,
    TransactionReceiptStatus,
    JSONRPCResponsePayload,
    JSONRPCResponseError,
    ContractArtifact,
    ContractChains,
    CompilerOpts,
    StandardContractOutput,
    CompilerSettings,
    ContractChainData,
    ContractAbi,
    DevdocOutput,
    EvmOutput,
    CompilerSettingsMetadata,
    OptimizerSettings,
    OutputField,
    ParamDescription,
    EvmBytecodeOutput,
    EvmBytecodeOutputLinkReferences,
    AbiDefinition,
    FunctionAbi,
    EventAbi,
    RevertErrorAbi,
    EventParameter,
    DataItem,
    MethodAbi,
    ConstructorAbi,
    FallbackAbi,
    ConstructorStateMutability,
    TupleDataItem,
    StateMutability,
} from 'ethereum-types';
