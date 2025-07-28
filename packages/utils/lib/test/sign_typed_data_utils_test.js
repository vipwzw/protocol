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
const chai = __importStar(require("chai"));
require("mocha");
const sign_typed_data_utils_1 = require("../src/sign_typed_data_utils");
const expect = chai.expect;
describe('signTypedDataUtils', () => {
    describe('signTypedDataHash', () => {
        const simpleSignTypedDataHashHex = '0xb460d69ca60383293877cd765c0f97bd832d66bca720f7e32222ce1118832493';
        const simpleSignTypedData = {
            types: {
                EIP712Domain: [
                    {
                        name: 'name',
                        type: 'string',
                    },
                ],
                Test: [
                    {
                        name: 'testAddress',
                        type: 'address',
                    },
                    {
                        name: 'testNumber',
                        type: 'uint256',
                    },
                ],
            },
            domain: {
                name: 'Test',
            },
            message: {
                testAddress: '0x0000000000000000000000000000000000000000',
                testNumber: '12345',
            },
            primaryType: 'Test',
        };
        const orderSignTypedDataHashHex = '0x78772b297e1b0b31089589a6608930cceba855af9d3ccf7b92cf47fa881e21f7';
        const orderSignTypedData = {
            types: {
                EIP712Domain: [
                    {
                        name: 'name',
                        type: 'string',
                    },
                    {
                        name: 'version',
                        type: 'string',
                    },
                    {
                        name: 'chainId',
                        type: 'uint256',
                    },
                    {
                        name: 'verifyingContract',
                        type: 'address',
                    },
                ],
                Order: [
                    {
                        name: 'makerAddress',
                        type: 'address',
                    },
                    {
                        name: 'takerAddress',
                        type: 'address',
                    },
                    {
                        name: 'feeRecipientAddress',
                        type: 'address',
                    },
                    {
                        name: 'senderAddress',
                        type: 'address',
                    },
                    {
                        name: 'makerAssetAmount',
                        type: 'uint256',
                    },
                    {
                        name: 'takerAssetAmount',
                        type: 'uint256',
                    },
                    {
                        name: 'makerFee',
                        type: 'uint256',
                    },
                    {
                        name: 'takerFee',
                        type: 'uint256',
                    },
                    {
                        name: 'expirationTimeSeconds',
                        type: 'uint256',
                    },
                    {
                        name: 'salt',
                        type: 'uint256',
                    },
                    {
                        name: 'makerAssetData',
                        type: 'bytes',
                    },
                    {
                        name: 'takerAssetData',
                        type: 'bytes',
                    },
                ],
            },
            domain: {
                name: '0x Protocol',
                version: '2',
                chainId: 1337,
                verifyingContract: '0x0000000000000000000000000000000000000000',
            },
            message: {
                makerAddress: '0x0000000000000000000000000000000000000000',
                takerAddress: '0x0000000000000000000000000000000000000000',
                makerAssetAmount: '1000000000000000000',
                takerAssetAmount: '1000000000000000000',
                expirationTimeSeconds: '12345',
                makerFee: '0',
                takerFee: '0',
                feeRecipientAddress: '0x0000000000000000000000000000000000000000',
                senderAddress: '0x0000000000000000000000000000000000000000',
                salt: '12345',
                makerAssetData: '0x0000000000000000000000000000000000000000',
                takerAssetData: '0x0000000000000000000000000000000000000000',
            },
            primaryType: 'Order',
        };
        it('creates a hash of the test sign typed data', () => {
            const hash = sign_typed_data_utils_1.signTypedDataUtils.generateTypedDataHash(simpleSignTypedData).toString('hex');
            const hashHex = `0x${hash}`;
            expect(hashHex).to.be.eq(simpleSignTypedDataHashHex);
        });
        it('creates a hash of the order sign typed data', () => {
            const hash = sign_typed_data_utils_1.signTypedDataUtils.generateTypedDataHash(orderSignTypedData).toString('hex');
            const hashHex = `0x${hash}`;
            expect(hashHex).to.be.eq(orderSignTypedDataHashHex);
        });
        it('creates a hash of an uninitialized order', () => {
            const uninitializedOrder = {
                ...orderSignTypedData,
                message: {
                    makerAddress: '0x0000000000000000000000000000000000000000',
                    takerAddress: '0x0000000000000000000000000000000000000000',
                    makerAssetAmount: 0,
                    takerAssetAmount: 0,
                    expirationTimeSeconds: 0,
                    makerFee: 0,
                    takerFee: 0,
                    feeRecipientAddress: '0x0000000000000000000000000000000000000000',
                    senderAddress: '0x0000000000000000000000000000000000000000',
                    salt: 0,
                    makerAssetData: '0x0000000000000000000000000000000000000000',
                    takerAssetData: '0x0000000000000000000000000000000000000000',
                },
            };
            const hash = sign_typed_data_utils_1.signTypedDataUtils.generateTypedDataHash(uninitializedOrder).toString('hex');
            const hashHex = `0x${hash}`;
            expect(hashHex).to.be.eq('0x510449a190415c4770080d857a1c654b653a0c054c94a7a8e9f08f623f9e824f');
        });
    });
});
