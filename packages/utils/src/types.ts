import {
    ContractAbi,
    ContractChains,
    ContractEventArg,
    DecodedLogArgs,
    DevdocOutput,
    LogWithDecodedArgs,
} from 'ethereum-types';
import * as AbiEncoder from './abi_encoder';
import { BigNumber } from './configured_bignumber';

// 从原 @0x/utils 迁移的类型定义
export interface Order {
    chainId: number;
    exchangeAddress: string;
    makerAddress: string;
    takerAddress: string;
    feeRecipientAddress: string;
    senderAddress: string;
    makerAssetAmount: bigint;
    takerAssetAmount: bigint;
    makerFee: bigint;
    takerFee: bigint;
    expirationTimeSeconds: bigint;
    salt: bigint;
    makerAssetData: string;
    takerAssetData: string;
    makerFeeAssetData: string;
    takerFeeAssetData: string;
}

export interface SignedOrder extends Order {
    signature: string;
}

export enum MarketOperation {
    Sell = 'Sell',
    Buy = 'Buy',
}

export interface ZeroExTransaction {
    salt: bigint;
    expirationTimeSeconds: bigint;
    gasPrice: bigint;
    signerAddress: string;
    data: string;
    domain: EIP712DomainWithDefaultSchema;
}

export interface SignedZeroExTransaction extends ZeroExTransaction {
    signature: string;
}

export interface ExchangeProxyMetaTransaction {
    signer: string;
    sender: string;
    minGasPrice: bigint;
    maxGasPrice: bigint;
    expirationTimeSeconds: bigint;
    salt: bigint;
    callData: string;
    value: bigint;
    feeToken: string;
    feeAmount: bigint;
    domain: EIP712DomainWithDefaultSchema;
}

export interface SignedExchangeProxyMetaTransaction extends ExchangeProxyMetaTransaction {
    signature: string;
}

export interface ECSignature {
    v: number;
    r: string;
    s: string;
}

export interface ValidatorSignature {
    validatorAddress: string;
    signature: string;
}

export enum ExchangeContractErrs {
    OrderFillExpired = 'ORDER_FILL_EXPIRED',
    OrderCancelExpired = 'ORDER_CANCEL_EXPIRED',
    OrderCancelled = 'ORDER_CANCELLED',
    OrderFillAmountZero = 'ORDER_FILL_AMOUNT_ZERO',
    OrderRemainingFillAmountZero = 'ORDER_REMAINING_FILL_AMOUNT_ZERO',
    OrderFillRoundingError = 'ORDER_FILL_ROUNDING_ERROR',
    FillBalanceAllowanceError = 'FILL_BALANCE_ALLOWANCE_ERROR',
    InsufficientTakerBalance = 'INSUFFICIENT_TAKER_BALANCE',
    InsufficientTakerAllowance = 'INSUFFICIENT_TAKER_ALLOWANCE',
    InsufficientMakerBalance = 'INSUFFICIENT_MAKER_BALANCE',
    InsufficientMakerAllowance = 'INSUFFICIENT_MAKER_ALLOWANCE',
    InsufficientTakerFeeBalance = 'INSUFFICIENT_TAKER_FEE_BALANCE',
    InsufficientTakerFeeAllowance = 'INSUFFICIENT_TAKER_FEE_ALLOWANCE',
    InsufficientMakerFeeBalance = 'INSUFFICIENT_MAKER_FEE_BALANCE',
    InsufficientMakerFeeAllowance = 'INSUFFICIENT_MAKER_FEE_ALLOWANCE',
    TransactionSenderIsNotFillOrderTaker = 'TRANSACTION_SENDER_IS_NOT_FILL_ORDER_TAKER',
    MultipleMakersInSingleCancelBatchDisallowed = 'MULTIPLE_MAKERS_IN_SINGLE_CANCEL_BATCH_DISALLOWED',
    InsufficientRemainingFillAmount = 'INSUFFICIENT_REMAINING_FILL_AMOUNT',
    MultipleTakerTokensInFillUpToDisallowed = 'MULTIPLE_TAKER_TOKENS_IN_FILL_UP_TO_DISALLOWED',
    BatchOrdersMustHaveSameExchangeAddress = 'BATCH_ORDERS_MUST_HAVE_SAME_EXCHANGE_ADDRESS',
    BatchOrdersMustHaveAtLeastOneItem = 'BATCH_ORDERS_MUST_HAVE_AT_LEAST_ONE_ITEM',
}

export type ArtifactContractName = 'ZRX' | 'TokenTransferProxy' | 'TokenRegistry' | 'Token' | 'Exchange' | 'EtherToken';

export interface Artifact {
    contract_name: ArtifactContractName;
    abi: ContractAbi;
    chains: {
        [chainId: number]: {
            address: string;
        };
    };
}

export type DoneCallback = (err?: Error) => void;

export interface ObjectMap<T> {
    [key: string]: T;
}

export interface OrderRelevantState {
    makerBalance: bigint;
    makerIndividualBalances: ObjectMap<bigint>;
    makerProxyAllowance: bigint;
    makerIndividualProxyAllowances: ObjectMap<bigint>;
    makerFeeBalance: bigint;
    makerFeeProxyAllowance: bigint;
    filledTakerAssetAmount: bigint;
    remainingFillableMakerAssetAmount: bigint;
    remainingFillableTakerAssetAmount: bigint;
}

export interface OrderStateValid {
    isValid: true;
    orderHash: string;
    orderRelevantState: OrderRelevantState;
    transactionHash?: string;
}

export interface OrderStateInvalid {
    isValid: false;
    orderHash: string;
    error: ExchangeContractErrs;
    transactionHash?: string;
}

export type OrderState = OrderStateValid | OrderStateInvalid;

export interface Token {
    name: string;
    address: string;
    symbol: string;
    decimals: number;
}

export enum SignatureType {
    Illegal,
    Invalid,
    EIP712,
    EthSign,
    Wallet,
    Validator,
    PreSigned,
    EIP1271Wallet,
    NSignatureTypes,
}

export enum AssetProxyId {
    ERC20 = '0xf47261b0',
    ERC721 = '0x02571792',
    MultiAsset = '0x94cfcdd7',
    ERC1155 = '0xa7cb5fb7',
    StaticCall = '0xc339d10a',
    ERC20Bridge = '0xdc1600f3',
}

export interface ERC20AssetData {
    assetProxyId: string;
    tokenAddress: string;
}

export interface ERC20BridgeAssetData {
    assetProxyId: string;
    tokenAddress: string;
    bridgeAddress: string;
    bridgeData: string;
}

export interface ERC721AssetData {
    assetProxyId: string;
    tokenAddress: string;
    tokenId: bigint;
}

export interface ERC1155AssetData {
    assetProxyId: string;
    tokenAddress: string;
    tokenIds: bigint[];
    tokenValues: bigint[];
    callbackData: string;
}

export interface StaticCallAssetData {
    assetProxyId: string;
    callTarget: string;
    staticCallData: string;
    callResultHash: string;
}

export interface ERC1155AssetDataNoProxyId {
    tokenAddress: string;
    tokenValues: bigint[];
    tokenIds: bigint[];
    callbackData: string;
}

export type SingleAssetData =
    | ERC20AssetData
    | ERC20BridgeAssetData
    | ERC721AssetData
    | ERC1155AssetData
    | StaticCallAssetData;

export interface MultiAssetData {
    assetProxyId: string;
    amounts: bigint[];
    nestedAssetData: string[];
}

export interface MultiAssetDataWithRecursiveDecoding {
    assetProxyId: string;
    amounts: bigint[];
    nestedAssetData: SingleAssetData[];
}

export interface DutchAuctionData {
    assetData: AssetData;
    beginTimeSeconds: bigint;
    beginAmount: bigint;
}

export type AssetData = SingleAssetData | MultiAssetData | MultiAssetDataWithRecursiveDecoding;

export interface EIP712DomainWithDefaultSchema {
    name?: string;
    version?: string;
    chainId: number;
    verifyingContract: string;
}

export interface EIP712Parameter {
    name: string;
    type: string;
}

export interface EIP712Types {
    [key: string]: EIP712Parameter[];
}

export type EIP712ObjectValue = string | number | EIP712Object;

export interface EIP712Object {
    [key: string]: EIP712ObjectValue;
}

export interface EIP712TypedData {
    types: EIP712Types;
    domain: EIP712Object;
    message: EIP712Object;
    primaryType: string;
}

export interface IndexedFilterValues {
    [index: string]: ContractEventArg;
}

export interface FillResults {
    makerAssetFilledAmount: bigint;
    takerAssetFilledAmount: bigint;
    makerFeePaid: bigint;
    takerFeePaid: bigint;
    protocolFeePaid: bigint;
}

export interface MatchedFillResults {
    left: FillResults;
    right: FillResults;
    profitInLeftMakerAsset: bigint;
    profitInRightMakerAsset: bigint;
}

export interface BatchMatchedFillResults {
    left: FillResults[];
    right: FillResults[];
    profitInLeftMakerAsset: bigint;
    profitInRightMakerAsset: bigint;
}

export interface OrderInfo {
    orderStatus: number;
    orderHash: string;
    orderTakerAssetFilledAmount: bigint;
}

export enum OrderStatus {
    Invalid,
    InvalidMakerAssetAmount,
    InvalidTakerAssetAmount,
    Fillable,
    Expired,
    FullyFilled,
    Cancelled,
}

export enum OrderTransferResults {
    TakerAssetDataFailed,
    MakerAssetDataFailed,
    TakerFeeAssetDataFailed,
    MakerFeeAssetDataFailed,
    TransfersSuccessful,
}

// 原 utils 包类型
export interface FunctionInfo {
    functionSignature: string;
    contractName?: string;
    contractAddress?: string;
    chainId?: number;
    abiEncoder?: AbiEncoder.Method;
}

export interface SelectorToFunctionInfo {
    [index: string]: FunctionInfo[];
}

export interface DecodedCalldata {
    functionName: string;
    functionSignature: string;
    functionArguments: any;
}

export type Numberish = BigNumber | string | number;

// RevertReason 大型枚举
export enum RevertReason {
    OrderUnfillable = 'ORDER_UNFILLABLE',
    InvalidMaker = 'INVALID_MAKER',
    InvalidTaker = 'INVALID_TAKER',
    InvalidSender = 'INVALID_SENDER',
    InvalidOrderSignature = 'INVALID_ORDER_SIGNATURE',
    InvalidTakerAmount = 'INVALID_TAKER_AMOUNT',
    DivisionByZero = 'DIVISION_BY_ZERO',
    RoundingError = 'ROUNDING_ERROR',
    InvalidSignature = 'INVALID_SIGNATURE',
    SignatureIllegal = 'SIGNATURE_ILLEGAL',
    SignatureInvalid = 'SIGNATURE_INVALID',
    SignatureUnsupported = 'SIGNATURE_UNSUPPORTED',
    TakerOverpay = 'TAKER_OVERPAY',
    OrderOverfill = 'ORDER_OVERFILL',
    InvalidFillPrice = 'INVALID_FILL_PRICE',
    InvalidNewOrderEpoch = 'INVALID_NEW_ORDER_EPOCH',
    CompleteFillFailed = 'COMPLETE_FILL_FAILED',
    NegativeSpreadRequired = 'NEGATIVE_SPREAD_REQUIRED',
    ReentrancyIllegal = 'REENTRANCY_ILLEGAL',
    InvalidTxHash = 'INVALID_TX_HASH',
    InvalidTxSignature = 'INVALID_TX_SIGNATURE',
    FailedExecution = 'FAILED_EXECUTION',
    AssetProxyAlreadyExists = 'ASSET_PROXY_ALREADY_EXISTS',
    LengthGreaterThan0Required = 'LENGTH_GREATER_THAN_0_REQUIRED',
    LengthGreaterThan3Required = 'LENGTH_GREATER_THAN_3_REQUIRED',
    LengthGreaterThan131Required = 'LENGTH_GREATER_THAN_131_REQUIRED',
    Length0Required = 'LENGTH_0_REQUIRED',
    Length65Required = 'LENGTH_65_REQUIRED',
    InvalidAmount = 'INVALID_AMOUNT',
    TransferFailed = 'TRANSFER_FAILED',
    SenderNotAuthorized = 'SENDER_NOT_AUTHORIZED',
    TargetNotAuthorized = 'TARGET_NOT_AUTHORIZED',
    TargetAlreadyAuthorized = 'TARGET_ALREADY_AUTHORIZED',
    IndexOutOfBounds = 'INDEX_OUT_OF_BOUNDS',
    AuthorizedAddressMismatch = 'AUTHORIZED_ADDRESS_MISMATCH',
    OnlyContractOwner = 'ONLY_CONTRACT_OWNER',
    MakerNotWhitelisted = 'MAKER_NOT_WHITELISTED',
    TakerNotWhitelisted = 'TAKER_NOT_WHITELISTED',
    AssetProxyDoesNotExist = 'ASSET_PROXY_DOES_NOT_EXIST',
    LengthMismatch = 'LENGTH_MISMATCH',
    LibBytesGreaterThanZeroLengthRequired = 'GREATER_THAN_ZERO_LENGTH_REQUIRED',
    LibBytesGreaterOrEqualTo4LengthRequired = 'GREATER_OR_EQUAL_TO_4_LENGTH_REQUIRED',
    LibBytesGreaterOrEqualTo20LengthRequired = 'GREATER_OR_EQUAL_TO_20_LENGTH_REQUIRED',
    LibBytesGreaterOrEqualTo32LengthRequired = 'GREATER_OR_EQUAL_TO_32_LENGTH_REQUIRED',
    LibBytesGreaterOrEqualToNestedBytesLengthRequired = 'GREATER_OR_EQUAL_TO_NESTED_BYTES_LENGTH_REQUIRED',
    LibBytesGreaterOrEqualToSourceBytesLengthRequired = 'GREATER_OR_EQUAL_TO_SOURCE_BYTES_LENGTH_REQUIRED',
    Erc20InsufficientBalance = 'ERC20_INSUFFICIENT_BALANCE',
    Erc20InsufficientAllowance = 'ERC20_INSUFFICIENT_ALLOWANCE',
    FeePercentageTooLarge = 'FEE_PERCENTAGE_TOO_LARGE',
    ValueGreaterThanZero = 'VALUE_GREATER_THAN_ZERO',
    InvalidMsgValue = 'INVALID_MSG_VALUE',
    InsufficientEthRemaining = 'INSUFFICIENT_ETH_REMAINING',
    Uint256Overflow = 'UINT256_OVERFLOW',
    Erc721ZeroToAddress = 'ERC721_ZERO_TO_ADDRESS',
    Erc721OwnerMismatch = 'ERC721_OWNER_MISMATCH',
    Erc721InvalidSpender = 'ERC721_INVALID_SPENDER',
    Erc721ZeroOwner = 'ERC721_ZERO_OWNER',
    Erc721InvalidSelector = 'ERC721_INVALID_SELECTOR',
    WalletError = 'WALLET_ERROR',
    ValidatorError = 'VALIDATOR_ERROR',
    InvalidFunctionSelector = 'INVALID_FUNCTION_SELECTOR',
    InvalidAssetData = 'INVALID_ASSET_DATA',
    InvalidAssetProxy = 'INVALID_ASSET_PROXY',
    UnregisteredAssetProxy = 'UNREGISTERED_ASSET_PROXY',
    TxFullyConfirmed = 'TX_FULLY_CONFIRMED',
    TxNotFullyConfirmed = 'TX_NOT_FULLY_CONFIRMED',
    TimeLockIncomplete = 'TIME_LOCK_INCOMPLETE',
    InvalidFreeMemoryPtr = 'INVALID_FREE_MEMORY_PTR',
    AuctionInvalidAmount = 'INVALID_AMOUNT',
    AuctionExpired = 'AUCTION_EXPIRED',
    AuctionNotStarted = 'AUCTION_NOT_STARTED',
    AuctionInvalidBeginTime = 'INVALID_BEGIN_TIME',
    InvalidAssetDataEnd = 'INVALID_ASSET_DATA_END',
    InvalidOrBlockedExchangeSelector = 'INVALID_OR_BLOCKED_EXCHANGE_SELECTOR',
    BalanceQueryFailed = 'BALANCE_QUERY_FAILED',
    AtLeastOneAddressDoesNotMeetBalanceThreshold = 'AT_LEAST_ONE_ADDRESS_DOES_NOT_MEET_BALANCE_THRESHOLD',
    FromLessThanToRequired = 'FROM_LESS_THAN_TO_REQUIRED',
    ToLessThanLengthRequired = 'TO_LESS_THAN_LENGTH_REQUIRED',
    InvalidApprovalSignature = 'INVALID_APPROVAL_SIGNATURE',
    ApprovalExpired = 'APPROVAL_EXPIRED',
    InvalidOrigin = 'INVALID_ORIGIN',
    AmountEqualToOneRequired = 'AMOUNT_EQUAL_TO_ONE_REQUIRED',
    BadReceiverReturnValue = 'BAD_RECEIVER_RETURN_VALUE',
    CannotTransferToAddressZero = 'CANNOT_TRANSFER_TO_ADDRESS_ZERO',
    InsufficientAllowance = 'INSUFFICIENT_ALLOWANCE',
    NFTNotOwnedByFromAddress = 'NFT_NOT_OWNED_BY_FROM_ADDRESS',
    OwnersAndIdsMustHaveSameLength = 'OWNERS_AND_IDS_MUST_HAVE_SAME_LENGTH',
    TokenAndValuesLengthMismatch = 'TOKEN_AND_VALUES_LENGTH_MISMATCH',
    TriedToMintFungibleForNonFungibleToken = 'TRIED_TO_MINT_FUNGIBLE_FOR_NON_FUNGIBLE_TOKEN',
    TriedToMintNonFungibleForFungibleToken = 'TRIED_TO_MINT_NON_FUNGIBLE_FOR_FUNGIBLE_TOKEN',
    TransferRejected = 'TRANSFER_REJECTED',
    Uint256Underflow = 'UINT256_UNDERFLOW',
    InvalidIdsOffset = 'INVALID_IDS_OFFSET',
    InvalidValuesOffset = 'INVALID_VALUES_OFFSET',
    InvalidDataOffset = 'INVALID_DATA_OFFSET',
    InvalidAssetDataLength = 'INVALID_ASSET_DATA_LENGTH',
    InvalidStaticCallDataOffset = 'INVALID_STATIC_CALL_DATA_OFFSET',
    TargetNotEven = 'TARGET_NOT_EVEN',
    UnexpectedStaticCallResult = 'UNEXPECTED_STATIC_CALL_RESULT',
    TransfersSuccessful = 'TRANSFERS_SUCCESSFUL',
    InsufficientFunds = 'INSUFFICIENT_FUNDS',
    TxAlreadyExecuted = 'TX_ALREADY_EXECUTED',
    DefaultTimeLockIncomplete = 'DEFAULT_TIME_LOCK_INCOMPLETE',
    CustomTimeLockIncomplete = 'CUSTOM_TIME_LOCK_INCOMPLETE',
    EqualLengthsRequired = 'EQUAL_LENGTHS_REQUIRED',
    OnlyCallableByWallet = 'ONLY_CALLABLE_BY_WALLET',
    ChaiBridgeOnlyCallableByErc20BridgeProxy = 'ChaiBridge/ONLY_CALLABLE_BY_ERC20_BRIDGE_PROXY',
    ChaiBridgeDrawDaiFailed = 'ChaiBridge/DRAW_DAI_FAILED',
    DydxBridgeOnlyCallableByErc20BridgeProxy = 'DydxBridge/ONLY_CALLABLE_BY_ERC20_BRIDGE_PROXY',
    DydxBridgeUnrecognizedBridgeAction = 'DydxBridge/UNRECOGNIZED_BRIDGE_ACTION',
}

export enum StatusCodes {
    Success = 200,
    NotFound = 404,
    InternalError = 500,
    MethodNotAllowed = 405,
    GatewayTimeout = 504,
}

// API 相关类型
export interface OrdersChannelSubscriptionOpts {
    makerAssetData?: string;
    takerAssetData?: string;
    traderAssetData?: string;
    makerAssetProxyId?: string;
    takerAssetProxyId?: string;
    makerAssetAddress?: string;
    takerAssetAddress?: string;
}

export type OrdersChannelMessage = UpdateOrdersChannelMessage | UnknownOrdersChannelMessage;

export enum OrdersChannelMessageTypes {
    Update = 'update',
    Unknown = 'unknown',
}

export interface UpdateOrdersChannelMessage {
    type: OrdersChannelMessageTypes.Update;
    requestId: string;
    payload: APIOrder[];
}

export interface UnknownOrdersChannelMessage {
    type: OrdersChannelMessageTypes.Unknown;
    requestId: string;
    payload: undefined;
}

export enum WebsocketConnectionEventType {
    Close = 'close',
    Error = 'error',
    Message = 'message',
}

export enum WebsocketClientEventType {
    Connect = 'connect',
    ConnectFailed = 'connectFailed',
}

export type OrdersResponse = PaginatedCollection<APIOrder>;

export interface APIOrder {
    order: SignedOrder;
    metaData: object;
}

export interface AssetPairsRequestOpts {
    assetDataA?: string;
    assetDataB?: string;
}

export type AssetPairsResponse = PaginatedCollection<AssetPairsItem>;

export interface AssetPairsItem {
    assetDataA: Asset;
    assetDataB: Asset;
}

export interface Asset {
    assetData: string;
    minAmount: bigint;
    maxAmount: bigint;
    precision: number;
}

export interface OrdersRequestOpts {
    makerAssetProxyId?: string;
    takerAssetProxyId?: string;
    makerAssetAddress?: string;
    takerAssetAddress?: string;
    exchangeAddress?: string;
    senderAddress?: string;
    makerAssetData?: string;
    takerAssetData?: string;
    makerFeeAssetData?: string;
    takerFeeAssetData?: string;
    makerAddress?: string;
    takerAddress?: string;
    traderAddress?: string;
    feeRecipientAddress?: string;
    unfillable?: boolean;
}

export interface OrderbookRequest {
    baseAssetData: string;
    quoteAssetData: string;
}

export interface OrderbookResponse {
    bids: PaginatedCollection<APIOrder>;
    asks: PaginatedCollection<APIOrder>;
}

export interface PaginatedCollection<T> {
    total: number;
    page: number;
    perPage: number;
    records: T[];
}

export interface OrderConfigRequest {
    makerAddress: string;
    takerAddress: string;
    makerAssetAmount: bigint;
    takerAssetAmount: bigint;
    makerAssetData: string;
    takerAssetData: string;
    exchangeAddress: string;
    expirationTimeSeconds: bigint;
}

export interface OrderConfigResponse {
    makerFee: bigint;
    takerFee: bigint;
    feeRecipientAddress: string;
    senderAddress: string;
    makerFeeAssetData: string;
    takerFeeAssetData: string;
}

export type FeeRecipientsResponse = PaginatedCollection<string>;

export interface RequestOpts {
    chainId?: number;
}

export interface PagedRequestOpts {
    page?: number;
    perPage?: number;
}

// 文档生成相关类型
export interface Stats {
    orderCount: number;
}

export interface DutchAuctionDetails {
    beginTimeSeconds: bigint;
    endTimeSeconds: bigint;
    beginAmount: bigint;
    endAmount: bigint;
    currentAmount: bigint;
    currentTimeSeconds: bigint;
}

export interface PackageJSONConfig {
    postpublish?: {
        assets?: string[];
        docOmitExports?: string[];
        dockerHubRepo?: string;
    };
    'abis:comment'?: string;
    abis?: string;
    ignoreDependencyVersions?: string;
    ignoreDependencyVersionsForPackage?: string;
}

export interface PackageJSON {
    private?: boolean;
    version: string;
    name: string;
    main?: string;
    scripts?: { [command: string]: string };
    config?: PackageJSONConfig;
    dependencies?: { [dependencyName: string]: string };
    devDependencies?: { [dependencyName: string]: string };
    workspaces?: string[];
}

export interface DecodedLogEvent<ArgsType extends DecodedLogArgs> {
    isRemoved: boolean;
    log: LogWithDecodedArgs<ArgsType>;
}

export type EventCallback<ArgsType extends DecodedLogArgs> = (
    err: null | Error,
    log?: DecodedLogEvent<ArgsType>,
) => void;

export interface SimpleContractArtifact {
    schemaVersion: string;
    contractName: string;
    compilerOutput: SimpleStandardContractOutput;
    chains: ContractChains;
}

export interface SimpleStandardContractOutput {
    abi: ContractAbi;
    evm: SimpleEvmOutput;
    devdoc?: DevdocOutput;
}

export interface SimpleEvmOutput {
    bytecode: SimpleEvmBytecodeOutput;
}

export interface SimpleEvmBytecodeOutput {
    object: string;
}

// 常量 - 从原 @0x/types 包迁移而来，现在作为 @0x/utils 的一部分
export const TYPES_PACKAGE_VERSION = '8.0.0';
export const TYPES_PACKAGE_NAME = '@0x/utils';
export const TYPES_NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
export const TYPES_NULL_BYTES = '0x';
export const TYPES_BYTES_IN_ADDRESS = 20;
export const TYPES_BYTES32_LENGTH = 32;
export const TYPES_HEX_PREFIX = '0x';

// 实用函数
export function isValidAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
        return false;
    }
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidOrder(obj: any): obj is Order {
    return obj && 
           typeof obj.chainId === 'number' &&
           typeof obj.exchangeAddress === 'string' &&
           typeof obj.makerAddress === 'string' &&
           typeof obj.takerAddress === 'string' &&
           isValidAddress(obj.exchangeAddress) &&
           isValidAddress(obj.makerAddress) &&
           isValidAddress(obj.takerAddress);
}

export function isSignedOrder(obj: any): obj is SignedOrder {
    return isValidOrder(obj) && 
           typeof (obj as SignedOrder).signature === 'string' &&
           (obj as SignedOrder).signature.length > 0;
}

export function createEmptyIndexedFilterValues(): IndexedFilterValues {
    return {};
}

export function getSupportedAssetProxyIds(): string[] {
    return Object.values(AssetProxyId);
}

export function getSupportedSignatureTypes(): SignatureType[] {
    return Object.values(SignatureType).filter(v => typeof v === 'number') as SignatureType[];
}

export function createEmptyOrder(): Order {
    return {
        chainId: 1,
        exchangeAddress: TYPES_NULL_ADDRESS,
        makerAddress: TYPES_NULL_ADDRESS,
        takerAddress: TYPES_NULL_ADDRESS,
        feeRecipientAddress: TYPES_NULL_ADDRESS,
        senderAddress: TYPES_NULL_ADDRESS,
        makerAssetAmount: 0n,
        takerAssetAmount: 0n,
        makerFee: 0n,
        takerFee: 0n,
        expirationTimeSeconds: 0n,
        salt: 0n,
        makerAssetData: TYPES_NULL_BYTES,
        takerAssetData: TYPES_NULL_BYTES,
        makerFeeAssetData: TYPES_NULL_BYTES,
        takerFeeAssetData: TYPES_NULL_BYTES,
    };
}

export function isValidHex(value: string): boolean {
    if (!value || typeof value !== 'string') {
        return false;
    }
    return /^0x[a-fA-F0-9]*$/.test(value);
}

export function normalizeAddress(address: string): string {
    if (!address || typeof address !== 'string') {
        return TYPES_NULL_ADDRESS;
    }
    
    const cleanAddress = address.toLowerCase().replace(/^0x/, '');
    if (cleanAddress.length !== 40) {
        return TYPES_NULL_ADDRESS;
    }
    
    return `0x${cleanAddress}`;
}

export function addressesEqual(a: string, b: string): boolean {
    return normalizeAddress(a) === normalizeAddress(b);
}

export function generateRandomSalt(): bigint {
    const randomBytes = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(randomBytes);
    } else {
        for (let i = 0; i < randomBytes.length; i++) {
            randomBytes[i] = Math.floor(Math.random() * 256);
        }
    }
    
    let result = 0n;
    for (let i = 0; i < randomBytes.length; i++) {
        result = (result << 8n) | BigInt(randomBytes[i]);
    }
    return result;
}

export function bigIntToHex(value: bigint, padToBytes?: number): string {
    let hex = value.toString(16);
    
    if (padToBytes) {
        const targetLength = padToBytes * 2;
        hex = hex.padStart(targetLength, '0');
    }
    
    return `0x${hex}`;
}

export function hexToBigInt(hex: string): bigint {
    if (!isValidHex(hex)) {
        throw new Error(`Invalid hex string: ${hex}`);
    }
    return BigInt(hex);
}