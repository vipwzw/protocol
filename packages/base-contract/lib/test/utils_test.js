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
const utils_2 = require("../src/utils");
const { expect } = chai;
describe('Utils tests', () => {
    describe('#formatABIDataItem', () => {
        it('correctly handles arrays', () => {
            const calls = [];
            const abi = {
                name: 'values',
                type: 'uint256[]',
            };
            const val = [1, 2, 3];
            const formatted = (0, utils_2.formatABIDataItem)(abi, val, (type, value) => {
                calls.push({ type, value });
                return value; // no-op
            });
            expect(formatted).to.be.deep.equal(val);
            expect(calls).to.be.deep.equal([
                { type: 'uint256', value: 1 },
                { type: 'uint256', value: 2 },
                { type: 'uint256', value: 3 },
            ]);
        });
        it('correctly handles tuples', () => {
            const calls = [];
            const abi = {
                components: [
                    {
                        name: 'to',
                        type: 'address',
                    },
                    {
                        name: 'amount',
                        type: 'uint256',
                    },
                ],
                name: 'data',
                type: 'tuple',
            };
            const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
            const val = { to: ZERO_ADDRESS, amount: new utils_1.BigNumber(1) };
            const formatted = (0, utils_2.formatABIDataItem)(abi, val, (type, value) => {
                calls.push({ type, value });
                return value; // no-op
            });
            expect(formatted).to.be.deep.equal(val);
            expect(calls).to.be.deep.equal([
                {
                    type: 'address',
                    value: val.to,
                },
                {
                    type: 'uint256',
                    value: val.amount,
                },
            ]);
        });
        it('correctly handles nested arrays of tuples', () => {
            const calls = [];
            const abi = {
                components: [
                    {
                        name: 'to',
                        type: 'address',
                    },
                    {
                        name: 'amount',
                        type: 'uint256',
                    },
                ],
                name: 'data',
                type: 'tuple[2][]',
            };
            const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
            const val = [
                [
                    { to: ZERO_ADDRESS, amount: new utils_1.BigNumber(1) },
                    { to: ZERO_ADDRESS, amount: new utils_1.BigNumber(2) },
                ],
            ];
            const formatted = (0, utils_2.formatABIDataItem)(abi, val, (type, value) => {
                calls.push({ type, value });
                return value; // no-op
            });
            expect(formatted).to.be.deep.equal(val);
            expect(calls).to.be.deep.equal([
                {
                    type: 'address',
                    value: val[0][0].to,
                },
                {
                    type: 'uint256',
                    value: val[0][0].amount,
                },
                {
                    type: 'address',
                    value: val[0][1].to,
                },
                {
                    type: 'uint256',
                    value: val[0][1].amount,
                },
            ]);
        });
    });
});
