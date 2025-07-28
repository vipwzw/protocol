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
// 只导入我们需要的静态方法，避免加载整个 BaseContract 类
// 这样可以绕过 Web3Wrapper 依赖问题
const { strictArgumentEncodingCheck } = require('../lib/src/index.js').BaseContract;
const { expect } = chai;
describe('BaseContract', () => {
    describe('strictArgumentEncodingCheck', () => {
        it('works for simple types', () => {
            strictArgumentEncodingCheck([{ name: 'to', type: 'address' }], ['0xe834ec434daba538cd1b9fe1582052b880bd7e63']);
        });
        it('works for array types', () => {
            const inputAbi = [
                {
                    name: 'takerAssetFillAmounts',
                    type: 'uint256[]',
                },
            ];
            const args = [
                ['9000000000000000000', '79000000000000000000', '979000000000000000000', '7979000000000000000000'],
            ];
            strictArgumentEncodingCheck(inputAbi, args);
        });
        it('works for tuple/struct types', () => {
            const inputAbi = [
                {
                    components: [
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
                    name: 'order',
                    type: 'tuple',
                },
            ];
            const args = [
                {
                    makerAddress: '0x6ecbe1db9ef729cbe972c83fb886247691fb6beb',
                    takerAddress: '0x0000000000000000000000000000000000000000',
                    feeRecipientAddress: '0xe834ec434daba538cd1b9fe1582052b880bd7e63',
                    senderAddress: '0x0000000000000000000000000000000000000000',
                    makerAssetAmount: '0',
                    takerAssetAmount: '200000000000000000000',
                    makerFee: '1000000000000000000',
                    takerFee: '1000000000000000000',
                    expirationTimeSeconds: '1532563026',
                    salt: '59342956082154660870994022243365949771115859664887449740907298019908621891376',
                    makerAssetData: '0xf47261b00000000000000000000000001dc4c1cefef38a777b15aa20260a54e584b16c48',
                    takerAssetData: '0xf47261b00000000000000000000000001d7022f5b17d2f8b695918fb48fa1089c9f85401',
                },
            ];
            strictArgumentEncodingCheck(inputAbi, args);
        });
        it('throws for integer overflows', () => {
            expect(() => strictArgumentEncodingCheck([{ name: 'amount', type: 'uint8' }], ['256'])).to.throw();
        });
        it('throws for fixed byte array overflows', () => {
            expect(() => strictArgumentEncodingCheck([{ name: 'hash', type: 'bytes8' }], ['0x001122334455667788'])).to.throw();
        });
    });
});
