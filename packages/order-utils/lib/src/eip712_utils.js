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
exports.eip712Utils = void 0;
const assert_1 = require("./assert");
const json_schemas_1 = require("@0x/json-schemas");
const utils_1 = require("./utils");
const _ = __importStar(require("lodash"));
const constants_1 = require("./constants");
exports.eip712Utils = {
    /**
     * Creates a EIP712TypedData object specific to the 0x protocol for use with signTypedData.
     * @param   primaryType The primary type found in message
     * @param   types The additional types for the data in message
     * @param   message The contents of the message
     * @param   domain Domain containing a name (optional), version (optional), and verifying contract address
     * @return  A typed data object
     */
    createTypedData: (primaryType, types, message, domain) => {
        assert_1.assert.isETHAddressHex('verifyingContract', domain.verifyingContract);
        assert_1.assert.isString('primaryType', primaryType);
        const typedData = {
            types: {
                EIP712Domain: constants_1.constants.DEFAULT_DOMAIN_SCHEMA.parameters,
                ...types,
            },
            domain: {
                name: domain.name === undefined ? constants_1.constants.EXCHANGE_DOMAIN_NAME : domain.name,
                version: domain.version === undefined ? constants_1.constants.EXCHANGE_DOMAIN_VERSION : domain.version,
                chainId: domain.chainId,
                verifyingContract: domain.verifyingContract,
            },
            message,
            primaryType,
        };
        assert_1.assert.doesConformToSchema('typedData', typedData, json_schemas_1.schemas.eip712TypedDataSchema);
        return typedData;
    },
    /**
     * Creates an Order EIP712TypedData object for use with signTypedData.
     * @param   Order the order
     * @return  A typed data object
     */
    createOrderTypedData: (order) => {
        assert_1.assert.doesConformToSchema('order', order, json_schemas_1.schemas.orderSchema, [json_schemas_1.schemas.hexSchema]);
        const normalizedOrder = _.mapValues(order, value => {
            return !_.isString(value) ? value.toString() : value;
        });
        const partialDomain = {
            chainId: order.chainId,
            verifyingContract: order.exchangeAddress,
        };
        // Since we are passing in the EXCHANGE_ORDER_SCHEMA
        // order paramaters that are not in there get ignored at hashing time
        const typedData = exports.eip712Utils.createTypedData(constants_1.constants.EXCHANGE_ORDER_SCHEMA.name, { Order: constants_1.constants.EXCHANGE_ORDER_SCHEMA.parameters }, normalizedOrder, partialDomain);
        return typedData;
    },
    /**
     * Creates an ExecuteTransaction EIP712TypedData object for use with signTypedData and
     * 0x Exchange executeTransaction.
     * @param   zeroExTransaction the 0x transaction
     * @return  A typed data object
     */
    createZeroExTransactionTypedData: (zeroExTransaction) => {
        assert_1.assert.isNumber('domain.chainId', zeroExTransaction.domain.chainId);
        assert_1.assert.isETHAddressHex('domain.verifyingContract', zeroExTransaction.domain.verifyingContract);
        assert_1.assert.doesConformToSchema('zeroExTransaction', zeroExTransaction, json_schemas_1.schemas.zeroExTransactionSchema);
        const normalizedTransaction = _.mapValues(zeroExTransaction, value => {
            return !_.isString(value) ? value.toString() : value;
        });
        const typedData = exports.eip712Utils.createTypedData(constants_1.constants.EXCHANGE_ZEROEX_TRANSACTION_SCHEMA.name, { ZeroExTransaction: constants_1.constants.EXCHANGE_ZEROEX_TRANSACTION_SCHEMA.parameters }, normalizedTransaction, zeroExTransaction.domain);
        return typedData;
    },
    /**
     * Creates an Coordinator typedData EIP712TypedData object for use with the Coordinator extension contract
     * @param   transaction A 0x transaction
     * @param   verifyingContract The coordinator extension contract address that will be verifying the typedData
     * @param   txOrigin The desired `tx.origin` that should be able to submit an Ethereum txn involving this 0x transaction
     * @return  A typed data object
     */
    createCoordinatorApprovalTypedData(transaction, verifyingContract, txOrigin) {
        const domain = {
            ...transaction.domain,
            name: constants_1.constants.COORDINATOR_DOMAIN_NAME,
            version: constants_1.constants.COORDINATOR_DOMAIN_VERSION,
            verifyingContract,
        };
        // TODO(dorothy-zbornak): Refactor these hash files so we can reuse
        // `transactionHashUtils` here without a circular dep.
        const transactionHash = utils_1.hexUtils.toHex(utils_1.signTypedDataUtils.generateTypedDataHash(exports.eip712Utils.createZeroExTransactionTypedData(transaction)));
        const approval = {
            txOrigin,
            transactionHash,
            transactionSignature: transaction.signature,
        };
        const typedData = exports.eip712Utils.createTypedData(constants_1.constants.COORDINATOR_APPROVAL_SCHEMA.name, {
            CoordinatorApproval: constants_1.constants.COORDINATOR_APPROVAL_SCHEMA.parameters,
        }, approval, domain);
        return typedData;
    },
    createExchangeProxyMetaTransactionTypedData(mtx) {
        return exports.eip712Utils.createTypedData(constants_1.constants.EXCHANGE_PROXY_MTX_SCEHMA.name, {
            MetaTransactionData: constants_1.constants.EXCHANGE_PROXY_MTX_SCEHMA.parameters,
        }, _.mapValues(_.omit(mtx, 'domain'), 
        // tslint:disable-next-line: custom-no-magic-numbers
        v => (BigNumber.isBigNumber(v) ? v.toString(10) : v)), // tslint:disable-line:no-unnecessary-type-assertion
        {
            ...constants_1.constants.MAINNET_EXCHANGE_PROXY_DOMAIN,
            ...mtx.domain,
        });
    },
};
