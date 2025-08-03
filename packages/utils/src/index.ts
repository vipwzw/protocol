export { promisify } from './promisify';
export { addressUtils } from './address_utils';
export { classUtils } from './class_utils';
export { deleteNestedProperty } from './delete_nested_property';
export { intervalUtils } from './interval_utils';
export { providerUtils } from './provider_utils';
// Legacy BigNumber export - DEPRECATED: Use native bigint instead
// This provides a compatibility shim for existing code
export { BigNumber } from './bignum_compat';

// Export all bigint utilities
export * from './configured_bigint';
export { AbiDecoder } from './abi_decoder';
export { logUtils } from './log_utils';
export { abiUtils } from './abi_utils';
export { NULL_BYTES, NULL_ADDRESS } from './constants';
export { constants as AbiEncoderConstants } from './abi_encoder/utils/constants';
export { errorUtils } from './error_utils';
export { fetchAsync } from './fetch_async';
export { signTypedDataUtils } from './sign_typed_data_utils';
export { hexUtils } from './hex_utils';
export import AbiEncoder = require('./abi_encoder');
export { EncodingRules, DecodingRules } from './abi_encoder';
export * from './types';

// 显式导出类型定义（interface 和 type 在运行时不存在，需要显式导出）
export type {
    // 核心类型 (仅接口和类型别名，枚举已通过 export * 导出)
    Order,
    SignedOrder,
    ZeroExTransaction,
    SignedZeroExTransaction,
    ExchangeProxyMetaTransaction,
    SignedExchangeProxyMetaTransaction,
    ECSignature,
    ValidatorSignature,
    ArtifactContractName,
    Artifact,
    DoneCallback,
    ObjectMap,
    OrderRelevantState,
    OrderStateValid,
    OrderStateInvalid,
    OrderState,
    Token,
    // 资产数据类型
    ERC20AssetData,
    ERC20BridgeAssetData,
    ERC721AssetData,
    ERC1155AssetData,
    StaticCallAssetData,
    ERC1155AssetDataNoProxyId,
    SingleAssetData,
    MultiAssetData,
    MultiAssetDataWithRecursiveDecoding,
    DutchAuctionData,
    AssetData,
    // EIP712 类型
    EIP712DomainWithDefaultSchema,
    EIP712Parameter,
    EIP712Types,
    EIP712ObjectValue,
    EIP712Object,
    EIP712TypedData,
    // 核心功能类型
    IndexedFilterValues,
    EventCallback,
    DecodedLogEvent,
    // 交易和订单类型
    FillResults,
    MatchedFillResults,
    BatchMatchedFillResults,
    OrderInfo,
    // API 和通信类型
    OrdersChannelSubscriptionOpts,
    OrdersChannelMessage,
    UpdateOrdersChannelMessage,
    UnknownOrdersChannelMessage,
    OrdersResponse,
    APIOrder,
    AssetPairsRequestOpts,
    AssetPairsResponse,
    AssetPairsItem,
    Asset,
    OrdersRequestOpts,
    OrderbookRequest,
    OrderbookResponse,
    PaginatedCollection,
    OrderConfigRequest,
    OrderConfigResponse,
    FeeRecipientsResponse,
    RequestOpts,
    PagedRequestOpts,
    Stats,
    DutchAuctionDetails,
    PackageJSONConfig,
    PackageJSON,
    SimpleContractArtifact,
    SimpleStandardContractOutput,
    SimpleEvmOutput,
    SimpleEvmBytecodeOutput,
} from './types';
export { generatePseudoRandom256BitNumber } from './random';
export {
    decodeBytesAsRevertError,
    decodeThrownErrorAsRevertError,
    coerceThrownErrorAsRevertError,
    RawRevertError,
    registerRevertErrorType,
    RevertError,
    StringRevertError,
    AnyRevertError,
} from './revert_error';
export { fromTokenUnitAmount, toTokenUnitAmount } from './token_utils';

export import BrokerRevertErrors = require('./revert_errors/broker/revert_errors');
export import CoordinatorRevertErrors = require('./revert_errors/coordinator/revert_errors');
export import ExchangeForwarderRevertErrors = require('./revert_errors/exchange-forwarder/revert_errors');
export import LibMathRevertErrors = require('./revert_errors/exchange-libs/lib_math_revert_errors');
export import ExchangeRevertErrors = require('./revert_errors/exchange/revert_errors');
export import LibAssetDataTransferRevertErrors = require('./revert_errors/extensions/lib_asset_data_transfer_revert_errors');
export import MixinWethUtilsRevertErrors = require('./revert_errors/extensions/mixin_weth_utils_revert_errors');
export import FixedMathRevertErrors = require('./revert_errors/staking/fixed_math_revert_errors');
export import StakingRevertErrors = require('./revert_errors/staking/staking_revert_errors');
export import AuthorizableRevertErrors = require('./revert_errors/utils/authorizable_revert_errors');
export import LibAddressArrayRevertErrors = require('./revert_errors/utils/lib_address_array_revert_errors');
export import LibBytesRevertErrors = require('./revert_errors/utils/lib_bytes_revert_errors');
export import OwnableRevertErrors = require('./revert_errors/utils/ownable_revert_errors');
export import ReentrancyGuardRevertErrors = require('./revert_errors/utils/reentrancy_guard_revert_errors');
export import SafeMathRevertErrors = require('./revert_errors/utils/safe_math_revert_errors');

export const ZeroExRevertErrors = {
    Common: require('./revert_errors/zero-ex/common_revert_errors'),
    Proxy: require('./revert_errors/zero-ex/proxy_revert_errors'),
    SimpleFunctionRegistry: require('./revert_errors/zero-ex/simple_function_registry_revert_errors'),
    Ownable: require('./revert_errors/zero-ex/ownable_revert_errors'),
    Spender: require('./revert_errors/zero-ex/spender_revert_errors'),
    TransformERC20: require('./revert_errors/zero-ex/transform_erc20_revert_errors'),
    Wallet: require('./revert_errors/zero-ex/wallet_revert_errors'),
    MetaTransactions: require('./revert_errors/zero-ex/meta_transaction_revert_errors'),
    SignatureValidator: require('./revert_errors/zero-ex/signature_validator_revert_errors'),
    LiquidityProvider: require('./revert_errors/zero-ex/liquidity_provider_revert_errors'),
};
