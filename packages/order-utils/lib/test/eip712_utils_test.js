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
const utils_1 = require("@0x/utils");
const chai = __importStar(require("chai"));
require("mocha");
const constants_1 = require("../src/constants");
const eip712_utils_1 = require("../src/eip712_utils");
const chai_setup_1 = require("./utils/chai_setup");
chai_setup_1.chaiSetup.configure();
const expect = chai.expect;
describe('EIP712 Utils', () => {
    const CHAIN_ID = 1337;
    describe('createTypedData', () => {
        it('adds in the EIP712DomainSeparator with default values', () => {
            const primaryType = 'Test';
            const typedData = eip712_utils_1.eip712Utils.createTypedData(primaryType, { Test: [{ name: 'testValue', type: 'uint256' }] }, { testValue: '1' }, { chainId: CHAIN_ID, verifyingContract: constants_1.constants.NULL_ADDRESS });
            expect(typedData.domain).to.not.be.undefined();
            expect(typedData.types.EIP712Domain).to.not.be.undefined();
            const domainObject = typedData.domain;
            expect(domainObject.name).to.eq(constants_1.constants.EXCHANGE_DOMAIN_NAME);
            expect(domainObject.version).to.eq(constants_1.constants.EXCHANGE_DOMAIN_VERSION);
            expect(domainObject.verifyingContract).to.eq(constants_1.constants.NULL_ADDRESS);
            expect(typedData.primaryType).to.eq(primaryType);
        });
        it('adds in the EIP712DomainSeparator without default values', () => {
            const primaryType = 'Test';
            const domainName = 'testDomain';
            const domainVersion = 'testVersion';
            const typedData = eip712_utils_1.eip712Utils.createTypedData(primaryType, { Test: [{ name: 'testValue', type: 'uint256' }] }, { testValue: '1' }, {
                name: domainName,
                version: domainVersion,
                chainId: CHAIN_ID,
                verifyingContract: constants_1.constants.NULL_ADDRESS,
            });
            expect(typedData.domain).to.not.be.undefined();
            expect(typedData.types.EIP712Domain).to.not.be.undefined();
            const domainObject = typedData.domain;
            expect(domainObject.name).to.eq(domainName);
            expect(domainObject.version).to.eq(domainVersion);
            expect(domainObject.verifyingContract).to.eq(constants_1.constants.NULL_ADDRESS);
            expect(typedData.primaryType).to.eq(primaryType);
        });
    });
    describe('createZeroExTransactionTypedData', () => {
        it('adds in the EIP712DomainSeparator', () => {
            const typedData = eip712_utils_1.eip712Utils.createZeroExTransactionTypedData({
                salt: new utils_1.BigNumber(0),
                expirationTimeSeconds: new utils_1.BigNumber(0),
                gasPrice: new utils_1.BigNumber(0),
                data: constants_1.constants.NULL_BYTES,
                signerAddress: constants_1.constants.NULL_ADDRESS,
                domain: {
                    verifyingContract: constants_1.constants.NULL_ADDRESS,
                    chainId: CHAIN_ID,
                },
            });
            expect(typedData.primaryType).to.eq(constants_1.constants.EXCHANGE_ZEROEX_TRANSACTION_SCHEMA.name);
            expect(typedData.types.EIP712Domain).to.not.be.undefined();
            const domainObject = typedData.domain;
            expect(domainObject.name).to.eq(constants_1.constants.EXCHANGE_DOMAIN_NAME);
            expect(domainObject.version).to.eq(constants_1.constants.EXCHANGE_DOMAIN_VERSION);
            expect(domainObject.verifyingContract).to.eq(constants_1.constants.NULL_ADDRESS);
        });
    });
});
//# sourceMappingURL=eip712_utils_test.js.map