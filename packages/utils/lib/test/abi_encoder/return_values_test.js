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
const src_1 = require("../../src/");
const chai_setup_1 = require("../utils/chai_setup");
const ReturnValueAbis = __importStar(require("./abi_samples/return_value_abis"));
chai_setup_1.chaiSetup.configure();
const expect = chai.expect;
describe('ABI Encoder: Return Value Encoding/Decoding', () => {
    const DECODE_BEYOND_CALL_DATA_ERROR = 'Tried to decode beyond the end of calldata';
    const encodingRules = { shouldOptimize: false }; // optimizer is tested separately.
    const nullEncodedReturnValue = '0x';
    describe('Standard encoding/decoding', () => {
        it('No Return Value', async () => {
            // Decode return value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.noReturnValues);
            const returnValue = '0x';
            const decodedReturnValue = method.decodeReturnValues(returnValue, { shouldConvertStructsToObjects: false });
            const expectedDecodedReturnValue = [];
            expect(decodedReturnValue).to.be.deep.equal(expectedDecodedReturnValue);
        });
        it('Single static return value', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.singleStaticReturnValue);
            const returnValue = ['0x01020304'];
            const encodedReturnValue = method.encodeReturnValues(returnValue, encodingRules);
            const decodedReturnValue = method.decodeReturnValues(encodedReturnValue, {
                shouldConvertStructsToObjects: false,
            });
            // Validate decoded return value
            expect(decodedReturnValue).to.be.deep.equal(returnValue);
        });
        it('Multiple static return values', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.multipleStaticReturnValues);
            const returnValue = ['0x01020304', '0x05060708'];
            const encodedReturnValue = method.encodeReturnValues(returnValue, encodingRules);
            const decodedReturnValue = method.decodeReturnValues(encodedReturnValue, {
                shouldConvertStructsToObjects: false,
            });
            // Validate decoded return value
            expect(decodedReturnValue).to.be.deep.equal(returnValue);
        });
        it('Single dynamic return value', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.singleDynamicReturnValue);
            const returnValue = ['0x01020304'];
            const encodedReturnValue = method.encodeReturnValues(returnValue, encodingRules);
            const decodedReturnValue = method.decodeReturnValues(encodedReturnValue, {
                shouldConvertStructsToObjects: false,
            });
            // Validate decoded return value
            expect(decodedReturnValue).to.be.deep.equal(returnValue);
        });
        it('Multiple dynamic return values', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.multipleDynamicReturnValues);
            const returnValue = ['0x01020304', '0x05060708'];
            const encodedReturnValue = method.encodeReturnValues(returnValue, encodingRules);
            const decodedReturnValue = method.decodeReturnValues(encodedReturnValue, {
                shouldConvertStructsToObjects: false,
            });
            // Validate decoded return value
            expect(decodedReturnValue).to.be.deep.equal(returnValue);
        });
        it('Mixed static/dynamic return values', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.mixedStaticAndDynamicReturnValues);
            const returnValue = ['0x01020304', '0x05060708'];
            const encodedReturnValue = method.encodeReturnValues(returnValue, encodingRules);
            const decodedReturnValue = method.decodeReturnValues(encodedReturnValue, {
                shouldConvertStructsToObjects: false,
            });
            // Validate decoded return value
            expect(decodedReturnValue).to.be.deep.equal(returnValue);
        });
        it('Should decode NULL as default value (single; static)', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.singleStaticReturnValue);
            const returnValue = ['0x00000000'];
            const decodedReturnValue = method.decodeReturnValues(nullEncodedReturnValue, {
                shouldConvertStructsToObjects: false,
            });
            // Validate decoded return value
            expect(decodedReturnValue).to.be.deep.equal(returnValue);
        });
        it('Should decode NULL as default value (multiple; static)', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.multipleStaticReturnValues);
            const returnValue = ['0x00000000', '0x00000000'];
            const decodedReturnValue = method.decodeReturnValues(nullEncodedReturnValue, {
                shouldConvertStructsToObjects: false,
            });
            // Validate decoded return value
            expect(decodedReturnValue).to.be.deep.equal(returnValue);
        });
        it('Should decode NULL as default value (single; dynamic)', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.singleDynamicReturnValue);
            const returnValue = ['0x'];
            const decodedReturnValue = method.decodeReturnValues(nullEncodedReturnValue, {
                shouldConvertStructsToObjects: false,
            });
            // Validate decoded return value
            expect(decodedReturnValue).to.be.deep.equal(returnValue);
        });
    });
    describe('Strict encoding/decoding', () => {
        it('No Return Value', async () => {
            // Decode return value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.noReturnValues);
            const returnValue = '0x';
            const decodedReturnValue = method.strictDecodeReturnValue(returnValue);
            const expectedDecodedReturnValue = undefined;
            expect(decodedReturnValue).to.be.deep.equal(expectedDecodedReturnValue);
        });
        it('Single static return value', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.singleStaticReturnValue);
            const returnValue = ['0x01020304'];
            const encodedReturnValue = method.encodeReturnValues(returnValue, encodingRules);
            const decodedReturnValue = method.strictDecodeReturnValue(encodedReturnValue);
            // Validate decoded return value
            expect(decodedReturnValue).to.be.deep.equal(returnValue[0]);
        });
        it('Multiple static return values', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.multipleStaticReturnValues);
            const returnValue = ['0x01020304', '0x05060708'];
            const encodedReturnValue = method.encodeReturnValues(returnValue, encodingRules);
            const decodedReturnValue = method.strictDecodeReturnValue(encodedReturnValue);
            // Validate decoded return value
            expect(decodedReturnValue).to.be.deep.equal(returnValue);
        });
        it('Single dynamic return value', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.singleDynamicReturnValue);
            const returnValue = ['0x01020304'];
            const encodedReturnValue = method.encodeReturnValues(returnValue, encodingRules);
            const decodedReturnValue = method.strictDecodeReturnValue(encodedReturnValue);
            // Validate decoded return value
            expect(decodedReturnValue).to.be.deep.equal(returnValue[0]);
        });
        it('Multiple dynamic return values', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.multipleDynamicReturnValues);
            const returnValue = ['0x01020304', '0x05060708'];
            const encodedReturnValue = method.encodeReturnValues(returnValue, encodingRules);
            const decodedReturnValue = method.strictDecodeReturnValue(encodedReturnValue);
            // Validate decoded return value
            expect(decodedReturnValue).to.be.deep.equal(returnValue);
        });
        it('Struct should include fields', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.structuredReturnValue);
            const returnValue = {
                fillResults: {
                    makerAssetFilledAmount: new src_1.BigNumber(50),
                    takerAssetFilledAmount: new src_1.BigNumber(40),
                },
            };
            const encodedReturnValue = method.encodeReturnValues(returnValue, encodingRules);
            const decodedReturnValue = method.strictDecodeReturnValue(encodedReturnValue);
            // Validate decoded return value
            // Note that only the contents of `fillResults`, not the key itself, is decoded.
            // This is by design, as only a struct's contents are encoded and returned by a funciton call.
            expect(decodedReturnValue).to.be.deep.equal(returnValue.fillResults);
        });
        it('Should fail to decode NULL (single; static)', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.singleStaticReturnValue);
            const encodedReturnValue = '0x';
            const decodeReturnValue = () => method.strictDecodeReturnValue(encodedReturnValue);
            // Validate decoded return value
            expect(decodeReturnValue).to.throws(DECODE_BEYOND_CALL_DATA_ERROR);
        });
        it('Should fail to decode NULL (multiple; static)', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.multipleStaticReturnValues);
            const encodedReturnValue = '0x';
            const decodeReturnValue = () => method.strictDecodeReturnValue(encodedReturnValue);
            // Validate decoded return value
            expect(decodeReturnValue).to.throws(DECODE_BEYOND_CALL_DATA_ERROR);
        });
        it('Should fail to decode NULL (single; dynamic)', async () => {
            // Generate Return Value
            const method = new src_1.AbiEncoder.Method(ReturnValueAbis.singleDynamicReturnValue);
            const encodedReturnValue = '0x';
            const decodeReturnValue = () => method.strictDecodeReturnValue(encodedReturnValue);
            // Validate decoded return value
            expect(decodeReturnValue).to.throws(DECODE_BEYOND_CALL_DATA_ERROR);
        });
    });
});
