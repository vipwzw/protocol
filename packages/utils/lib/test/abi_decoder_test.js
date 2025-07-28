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
const src_1 = require("../src");
const chai_setup_1 = require("./utils/chai_setup");
chai_setup_1.chaiSetup.configure();
const expect = chai.expect;
describe('AbiDecoder', () => {
    it('should successfully add a new ABI and decode calldata for it', async () => {
        // Add new ABI
        const abi = {
            name: 'foobar',
            type: 'function',
            inputs: [
                {
                    name: 'testAddress',
                    type: 'address',
                },
            ],
            outputs: [
                {
                    name: 'butter',
                    type: 'string',
                },
            ],
            constant: false,
            payable: false,
            stateMutability: 'pure',
        };
        const contractName = 'newContract';
        const testAddress = '0x0001020304050607080900010203040506070809';
        const abiDecoder = new src_1.AbiDecoder([]);
        abiDecoder.addABI([abi], contractName);
        // Create some tx data
        const foobarEncoder = new src_1.AbiEncoder.Method(abi);
        const foobarSignature = foobarEncoder.getSignature();
        const foobarTxData = foobarEncoder.encode([testAddress]);
        // Decode tx data using contract name
        const decodedTxData = abiDecoder.decodeCalldataOrThrow(foobarTxData, contractName);
        const expectedFunctionName = abi.name;
        const expectedFunctionArguments = { testAddress };
        expect(decodedTxData.functionName).to.be.equal(expectedFunctionName);
        expect(decodedTxData.functionSignature).to.be.equal(foobarSignature);
        expect(decodedTxData.functionArguments).to.be.deep.equal(expectedFunctionArguments);
    });
});
