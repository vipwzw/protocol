"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemas = void 0;
const addressSchema = __importStar(require("../schemas/address_schema.json"));
const assetPairsRequestOptsSchema = __importStar(require("../schemas/asset_pairs_request_opts_schema.json"));
const blockParamSchema = __importStar(require("../schemas/block_param_schema.json"));
const blockRangeSchema = __importStar(require("../schemas/block_range_schema.json"));
const callDataSchema = __importStar(require("../schemas/call_data_schema.json"));
const ecSignatureParameterSchema = __importStar(require("../schemas/ec_signature_parameter_schema.json"));
const ecSignatureSchema = __importStar(require("../schemas/ec_signature_schema.json"));
const eip712DomainSchema = __importStar(require("../schemas/eip712_domain_schema.json"));
const eip712TypedDataSchema = __importStar(require("../schemas/eip712_typed_data_schema.json"));
const exchangeProxyMetaTransactionSchema = __importStar(require("../schemas/exchange_proxy_meta_transaction_schema.json"));
const hexSchema = __importStar(require("../schemas/hex_schema.json"));
const indexFilterValuesSchema = __importStar(require("../schemas/index_filter_values_schema.json"));
const jsNumber = __importStar(require("../schemas/js_number_schema.json"));
const numberSchema = __importStar(require("../schemas/number_schema.json"));
const orderCancellationRequestsSchema = __importStar(require("../schemas/order_cancel_schema.json"));
const orderConfigRequestSchema = __importStar(require("../schemas/order_config_request_schema.json"));
const orderFillOrKillRequestsSchema = __importStar(require("../schemas/order_fill_or_kill_requests_schema.json"));
const orderFillRequestsSchema = __importStar(require("../schemas/order_fill_requests_schema.json"));
const orderHashSchema = __importStar(require("../schemas/order_hash_schema.json"));
const orderSchema = __importStar(require("../schemas/order_schema.json"));
const orderBookRequestSchema = __importStar(require("../schemas/orderbook_request_schema.json"));
const ordersRequestOptsSchema = __importStar(require("../schemas/orders_request_opts_schema.json"));
const ordersSchema = __importStar(require("../schemas/orders_schema.json"));
const pagedRequestOptsSchema = __importStar(require("../schemas/paged_request_opts_schema.json"));
const paginatedCollectionSchema = __importStar(require("../schemas/paginated_collection_schema.json"));
const signedOrderSchema = __importStar(require("../schemas/signed_order_schema.json"));
const signedOrdersSchema = __importStar(require("../schemas/signed_orders_schema.json"));
const tokenSchema = __importStar(require("../schemas/token_schema.json"));
const txDataSchema = __importStar(require("../schemas/tx_data_schema.json"));
const v4OtcOrderSchema = __importStar(require("../schemas/v4_otc_order_schema.json"));
const v4RfqOrderSchema = __importStar(require("../schemas/v4_rfq_order_schema.json"));
const v4RfqSignedOrderSchema = __importStar(require("../schemas/v4_rfq_signed_order_schema.json"));
const v4SignatureSchema = __importStar(require("../schemas/v4_signature_schema.json"));
const wholeNumberSchema = __importStar(require("../schemas/whole_number_schema.json"));
const zeroExTransactionSchema = __importStar(require("../schemas/zero_ex_transaction_schema.json"));
exports.schemas = {
    addressSchema,
    assetPairsRequestOptsSchema,
    blockParamSchema,
    blockRangeSchema,
    callDataSchema,
    ecSignatureParameterSchema,
    ecSignatureSchema,
    eip712DomainSchema,
    eip712TypedDataSchema,
    exchangeProxyMetaTransactionSchema,
    hexSchema,
    indexFilterValuesSchema,
    jsNumber,
    numberSchema,
    orderBookRequestSchema,
    orderCancellationRequestsSchema,
    orderConfigRequestSchema,
    orderFillOrKillRequestsSchema,
    orderFillRequestsSchema,
    orderHashSchema,
    orderSchema,
    ordersRequestOptsSchema,
    ordersSchema,
    pagedRequestOptsSchema,
    paginatedCollectionSchema,
    signedOrderSchema,
    signedOrdersSchema,
    tokenSchema,
    txDataSchema,
    v4OtcOrderSchema,
    v4RfqOrderSchema,
    v4RfqSignedOrderSchema,
    v4SignatureSchema,
    wholeNumberSchema,
    zeroExTransactionSchema,
};
