// 导出所有功能，保持与原 @0x/test-utils 完全兼容的接口

// 核心模块
export { constants } from './constants';
export { chaiSetup, expect } from './chai_setup';
export { provider, txDefaults, web3Wrapper, providerUtils } from './web3_wrapper';
export { BlockchainLifecycle } from './blockchain_lifecycle';

// 测试环境
export { 
    blockchainTests, 
    BlockchainTestsEnvironment, 
    describe,
    getCurrentTestEnvironment
} from './mocha_blockchain';

// 断言和异常处理
export {
    expectContractCallFailedAsync,
    expectContractCallFailedWithoutReasonAsync,
    expectContractCreationFailedAsync,
    expectContractCreationFailedWithoutReasonAsync,
    expectInsufficientFundsAsync,
    expectTransactionFailedAsync,
    sendTransactionResult,
    expectTransactionFailedWithoutReasonAsync,
    getInvalidOpcodeErrorMessageForCallAsync,
    getRevertReasonOrErrorMessageForSendTransactionAsync,
    awaitTransactionAsync,
    isExpectedError
} from './assertions';

// 时间和区块管理
export { 
    getLatestBlockTimestampAsync, 
    increaseTimeAndMineBlockAsync,
    setNextBlockTimestampAsync,
    mineBlocksAsync,
    getBlockTimestampAsync,
    waitAsync,
    jumpToTimestampAsync,
    TIME_CONSTANTS
} from './block_timestamp';

// 事件处理和验证
export {
    parseEventFromReceipt,
    parseAllEventsFromReceipt,
    expectEventInReceipt,
    verifyTransferEvent,
    verifyApprovalEvent,
    verifyERC721TransferEvent,
    verifyERC721ApprovalEvent,
    verifyERC721ApprovalForAllEvent,
    verifyERC1155TransferSingleEvent,
    verifyERC1155TransferBatchEvent,
    verifyERC1155ApprovalForAllEvent,
    filterLogs,
    filterLogsToArguments,
    verifyEvents,
    verifyEventsFromLogs,
    // 类型导出
    EventArgs,
    ParsedEvent,
    TransferEventArgs,
    ApprovalEventArgs,
    ERC721TransferEventArgs,
    ERC721ApprovalEventArgs,
    ERC721ApprovalForAllEventArgs,
    ERC1155TransferSingleEventArgs,
    ERC1155TransferBatchEventArgs,
    ERC1155ApprovalForAllEventArgs,
} from './event_utils';

// 地址工具
export { 
    randomAddress,
    isValidAddress,
    normalizeAddress,
    deterministicAddress,
    isNullAddress,
    randomAddresses,
    addressFromPrivateKey,
    randomWallet
} from './address_utils';

// 数值工具
export {
    Numberish,
    getRandomInteger,
    getRandomPortion,
    getRandomFloat,
    toBaseUnitAmount,
    fromBaseUnitAmount,
    toFixed,
    fromFixed,
    toDecimal,
    getPercentageOfValue,
    assertIntegerRoughlyEquals,
    assertRoughlyEquals,
    getNumericalDivergence,
    FIXED_POINT_BASE
} from './number_utils';

// 语言工具
export { 
    replaceKeysDeep, 
    shortZip,
    deepClone,
    deepMerge,
    safeGet,
    safeSet,
    isEmpty,
    uniq,
    uniqBy,
    delay,
    retry,
    throttle,
    debounce
} from './lang_utils';

// 代码大小检查
export { 
    getCodesizeFromArtifact,
    checkCodesize,
    getCodesizeString,
    CONTRACT_SIZE_LIMITS
} from './codesize';

// 其他工具
export {
    bytes32Values,
    uint256Values,
    testCombinatoriallyWithReferenceFunc,
    ReferenceFunction,
    AbstractAssetWrapper,
    LogDecoder,
    signingUtils,
    typeEncodingUtils,
    orderUtils,
    transactionHashUtils,
    orderHashUtils
} from './other_utils';

// 向后兼容性别名已经通过上面的导出提供

// 类型定义（保持与原版兼容）
export interface ContractName {
    [key: string]: string;
}

export interface ERC20BalancesByOwner {
    [ownerAddress: string]: {
        [tokenAddress: string]: bigint;
    };
}

export interface EthBalancesByOwner {
    [ownerAddress: string]: bigint;
}

export interface Token {
    address: string;
    decimals: number;
    symbol: string;
    name: string;
}

export interface TokenBalances {
    [tokenAddress: string]: bigint;
}

export interface FillEventArgs {
    makerAddress: string;
    takerAddress: string;
    makerAssetFilledAmount: bigint;
    takerAssetFilledAmount: bigint;
    makerFeePaid: bigint;
    takerFeePaid: bigint;
    orderHash: string;
}

export interface MarketBuyOrders {
    orders: any[];
    signatures: string[];
}

export interface MarketSellOrders {
    orders: any[];
    signatures: string[];
}

export interface TransactionDataParams {
    data: string;
    from: string;
    gas?: number;
    gasPrice?: bigint;
    value?: bigint;
}

export interface BatchMatchOrder {
    leftOrders: any[];
    rightOrders: any[];
    leftSignatures: string[];
    rightSignatures: string[];
}

export enum OrderStatus {
    Invalid = 0,
    InvalidMakerAssetAmount = 1,
    InvalidTakerAssetAmount = 2,
    Fillable = 3,
    Expired = 4,
    FullyFilled = 5,
    Cancelled = 6,
}

export enum ExchangeFunctionName {
    BatchCancelOrders = 'batchCancelOrders',
    BatchFillOrders = 'batchFillOrders',
    BatchFillOrdersNoThrow = 'batchFillOrdersNoThrow',
    BatchMatchOrders = 'batchMatchOrders',
    CancelOrder = 'cancelOrder',
    FillOrder = 'fillOrder',
    FillOrderNoThrow = 'fillOrderNoThrow',
    MarketBuyOrders = 'marketBuyOrders',
    MarketBuyOrdersNoThrow = 'marketBuyOrdersNoThrow',
    MarketSellOrders = 'marketSellOrders',
    MarketSellOrdersNoThrow = 'marketSellOrdersNoThrow',
    MatchOrders = 'matchOrders',
    PreSign = 'preSign',
    SetSignatureValidatorApproval = 'setSignatureValidatorApproval',
}

// 工厂类（简化实现）
export class OrderFactory {
    constructor(private _defaults: any = {}) {}
    
    public newSignedOrder(params: any = {}): any {
        return { ...this._defaults, ...params };
    }
}

export class TransactionFactory {
    constructor(private _defaults: any = {}) {}
    
    public newSignedTransaction(params: any = {}): any {
        return { ...this._defaults, ...params };
    }
}

// 异步测试引用函数（简化版本）
export async function testWithReferenceFuncAsync<T>(
    testFunc: (...args: any[]) => Promise<T>,
    referenceFunc: (...args: any[]) => T,
    args: any[]
): Promise<void> {
    const expected = referenceFunc(...args);
    const actual = await testFunc(...args);
    
    if (expected !== actual) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
    }
}