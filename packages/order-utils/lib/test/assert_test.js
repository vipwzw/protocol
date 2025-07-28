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
const assert_1 = require("../src/assert");
const chai_setup_1 = require("./utils/chai_setup");
const web3_wrapper_1 = require("./utils/web3_wrapper");
chai_setup_1.chaiSetup.configure();
const expect = chai.expect;
describe('Assertion library', () => {
    describe('#isSenderAddressHexAsync', () => {
        it('throws when address is invalid', async () => {
            const address = '0xdeadbeef';
            const varName = 'address';
            return expect(assert_1.assert.isSenderAddressAsync(varName, address, web3_wrapper_1.web3Wrapper)).to.be.rejectedWith(`Expected ${varName} to be of type ETHAddressHex, encountered: ${address}`);
        });
        it('throws when address is unavailable', async () => {
            const validUnrelatedAddress = '0x8b0292b11a196601eddce54b665cafeca0347d42';
            const varName = 'address';
            return expect(assert_1.assert.isSenderAddressAsync(varName, validUnrelatedAddress, web3_wrapper_1.web3Wrapper)).to.be.rejectedWith(`Specified ${varName} ${validUnrelatedAddress} isn't available through the supplied web3 provider`);
        });
        it("doesn't throw if address is available", async () => {
            const availableAddress = (await web3_wrapper_1.web3Wrapper.getAvailableAddressesAsync())[0];
            const varName = 'address';
            return expect(assert_1.assert.isSenderAddressAsync(varName, availableAddress, web3_wrapper_1.web3Wrapper)).to.become(undefined);
        });
    });
});
//# sourceMappingURL=assert_test.js.map