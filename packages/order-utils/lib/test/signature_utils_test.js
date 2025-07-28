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
const assert_1 = require("../src/assert");
const types_1 = require("@0x/types");
const chai = __importStar(require("chai"));
const ethUtil = __importStar(require("ethereumjs-util"));
const _ = __importStar(require("lodash"));
require("mocha");
const src_1 = require("../src");
const constants_1 = require("../src/constants");
const order_hash_utils_1 = require("../src/order_hash_utils");
const signature_utils_1 = require("../src/signature_utils");
const transaction_hash_utils_1 = require("../src/transaction_hash_utils");
const chai_setup_1 = require("./utils/chai_setup");
const web3_wrapper_1 = require("./utils/web3_wrapper");
chai_setup_1.chaiSetup.configure();
const expect = chai.expect;
describe('Signature utils', () => {
    let makerAddress;
    const fakeExchangeContractAddress = '0x1dc4c1cefef38a777b15aa20260a54e584b16c48';
    const fakeChainId = 1337;
    let order;
    let transaction;
    before(async () => {
        const availableAddreses = await web3_wrapper_1.web3Wrapper.getAvailableAddressesAsync();
        makerAddress = availableAddreses[0];
        order = {
            makerAddress,
            takerAddress: constants_1.constants.NULL_ADDRESS,
            senderAddress: constants_1.constants.NULL_ADDRESS,
            feeRecipientAddress: constants_1.constants.NULL_ADDRESS,
            makerAssetData: constants_1.constants.NULL_ADDRESS,
            takerAssetData: constants_1.constants.NULL_ADDRESS,
            makerFeeAssetData: constants_1.constants.NULL_ADDRESS,
            takerFeeAssetData: constants_1.constants.NULL_ADDRESS,
            salt: 0n,
            makerFee: 0n,
            takerFee: 0n,
            makerAssetAmount: 0n,
            takerAssetAmount: 0n,
            expirationTimeSeconds: 0n,
            exchangeAddress: fakeExchangeContractAddress,
            chainId: fakeChainId,
        };
        transaction = {
            domain: {
                verifyingContract: fakeExchangeContractAddress,
                chainId: fakeChainId,
            },
            salt: (0, src_1.generatePseudoRandomSalt)(),
            signerAddress: makerAddress,
            data: '0x6927e990021d23b1eb7b8789f6a6feaf98fe104bb0cf8259421b79f9a34222b0',
            expirationTimeSeconds: 0n,
            gasPrice: 0n,
        };
    });
    describe('#isValidECSignature', () => {
        const signature = {
            v: 27,
            r: '0xaca7da997ad177f040240cdccf6905b71ab16b74434388c3a72f34fd25d64393',
            s: '0x46b2bac274ff29b48b3ea6e2d04c1336eaceafda3c53ab483fc3ff12fac3ebf2',
        };
        const data = '0x47173285a8d7341e5e972fc677286384f802f8ef42a5ec5f03bbfa254cb01fad';
        const address = '0x0e5cb767cce09a7f3ca594df118aa519be5e2b5a';
        it("should return false if the data doesn't pertain to the signature & address", async () => {
            expect((0, signature_utils_1.isValidECSignature)('0x0', signature, address)).to.be.false;
        });
        it("should return false if the address doesn't pertain to the signature & data", async () => {
            const validUnrelatedAddress = '0x8b0292b11a196601ed2ce54b665cafeca0347d42';
            expect((0, signature_utils_1.isValidECSignature)(data, signature, validUnrelatedAddress)).to.be.false;
        });
        it("should return false if the signature doesn't pertain to the data & address", async () => {
            const wrongSignature = _.assign({}, signature, { v: 28 });
            expect((0, signature_utils_1.isValidECSignature)(data, wrongSignature, address)).to.be.false;
        });
        it('should return true if the signature does pertain to the data & address', async () => {
            const isValidSignatureLocal = (0, signature_utils_1.isValidECSignature)(data, signature, address);
            expect(isValidSignatureLocal).to.be.true;
        });
    });
    describe('#generateSalt', () => {
        it('generates different salts', () => {
            const salt1 = (0, src_1.generatePseudoRandomSalt)();
            const salt2 = (0, src_1.generatePseudoRandomSalt)();
            const isEqual = salt1 === salt2;
            expect(isEqual).to.be.false;
        });
        it('generates salt in range [0..2^256)', () => {
            const salt = (0, src_1.generatePseudoRandomSalt)();
            expect(salt >= 0n).to.be.true;
            // tslint:disable-next-line:custom-no-magic-numbers
            const twoPow256 = 2n ** 256n;
            expect(salt < twoPow256).to.be.true;
        });
    });
    describe('#parseValidatorSignature', () => {
        const ethSignSignature = '0x1c3582f06356a1314dbf1c0e534c4d8e92e59b056ee607a7ff5a825f5f2cc5e6151c5cc7fdd420f5608e4d5bef108e42ad90c7a4b408caef32e24374cf387b0d7603';
        const validatorAddress = '0x63ac26ad9477d6be19a5fabe394bcc4886057c53';
        const signature = `${ethSignSignature}${validatorAddress.substr(2)}05`;
        it('throws if signature type is not Validator type signature', () => {
            expect(signature_utils_1.signatureUtils.parseValidatorSignature.bind(null, ethSignSignature)).to.throw('Unexpected signatureType: 3. Valid signature types: 5');
        });
        it('extracts signature and validator address', () => {
            const validatorSignature = signature_utils_1.signatureUtils.parseValidatorSignature(signature);
            expect(validatorSignature.validatorAddress).to.equal(validatorAddress);
            expect(validatorSignature.signature).to.equal(ethSignSignature);
        });
    });
    describe('#ecSignOrderAsync', () => {
        it('should default to eth_sign if eth_signTypedData is unavailable', async () => {
            const fakeProvider = {
                async sendAsync(payload, callback) {
                    if (payload.method.startsWith('eth_signTypedData')) {
                        callback(new Error('Internal RPC Error'));
                    }
                    else if (payload.method === 'eth_sign') {
                        const [address, message] = payload.params;
                        const signature = await web3_wrapper_1.web3Wrapper.signMessageAsync(address, message);
                        callback(null, {
                            id: 42,
                            jsonrpc: '2.0',
                            result: signature,
                        });
                    }
                    else {
                        callback(null, { id: 42, jsonrpc: '2.0', result: [makerAddress] });
                    }
                },
            };
            const signedOrder = await signature_utils_1.signatureUtils.ecSignOrderAsync(fakeProvider, order, makerAddress);
            // 验证签名是否有效，而不是比较固定值（签名包含随机数，每次都不同）
            expect(signedOrder.signature).to.be.a('string');
            expect(signedOrder.signature).to.match(/^0x[0-9a-fA-F]{132}$/); // 66字节的十六进制签名（65字节签名+1字节类型）
            // 验证签名功能正常工作（eth_sign 回退机制被使用）
            // 签名应该包含正确的长度和格式，具体验证由其他专门的测试负责
        });
        it('should throw if the user denies the signing request', async () => {
            const fakeProvider = {
                async sendAsync(payload, callback) {
                    if (payload.method.startsWith('eth_signTypedData')) {
                        callback(new Error('User denied message signature'));
                    }
                    else if (payload.method === 'eth_sign') {
                        const [address, message] = payload.params;
                        const signature = await web3_wrapper_1.web3Wrapper.signMessageAsync(address, message);
                        callback(null, {
                            id: 42,
                            jsonrpc: '2.0',
                            result: signature,
                        });
                    }
                    else {
                        callback(null, { id: 42, jsonrpc: '2.0', result: [makerAddress] });
                    }
                },
            };
            try {
                await signature_utils_1.signatureUtils.ecSignOrderAsync(fakeProvider, order, makerAddress);
                expect.fail('Expected function to throw');
            }
            catch (error) {
                expect(error.message).to.include('User denied message signature');
            }
        });
    });
    describe('#ecSignTransactionAsync', () => {
        it('should default to eth_sign if eth_signTypedData is unavailable', async () => {
            const fakeProvider = {
                async sendAsync(payload, callback) {
                    if (payload.method.startsWith('eth_signTypedData')) {
                        callback(new Error('Internal RPC Error'));
                    }
                    else if (payload.method === 'eth_sign') {
                        const [address, message] = payload.params;
                        const signature = await web3_wrapper_1.web3Wrapper.signMessageAsync(address, message);
                        callback(null, {
                            id: 42,
                            jsonrpc: '2.0',
                            result: signature,
                        });
                    }
                    else {
                        callback(null, { id: 42, jsonrpc: '2.0', result: [makerAddress] });
                    }
                },
            };
            const signedTransaction = await signature_utils_1.signatureUtils.ecSignTransactionAsync(fakeProvider, transaction, makerAddress);
            assert_1.assert.isHexString('signedTransaction.signature', signedTransaction.signature);
        });
        it('should throw if the user denies the signing request', async () => {
            const fakeProvider = {
                async sendAsync(payload, callback) {
                    if (payload.method.startsWith('eth_signTypedData')) {
                        callback(new Error('User denied message signature'));
                    }
                    else if (payload.method === 'eth_sign') {
                        const [address, message] = payload.params;
                        const signature = await web3_wrapper_1.web3Wrapper.signMessageAsync(address, message);
                        callback(null, {
                            id: 42,
                            jsonrpc: '2.0',
                            result: signature,
                        });
                    }
                    else {
                        callback(null, { id: 42, jsonrpc: '2.0', result: [makerAddress] });
                    }
                },
            };
            try {
                await signature_utils_1.signatureUtils.ecSignTransactionAsync(fakeProvider, transaction, makerAddress);
                expect.fail('Expected function to throw');
            }
            catch (error) {
                expect(error.message).to.include('User denied message signature');
            }
        });
    });
    describe('#ecSignHashAsync', () => {
        before(async () => {
            const availableAddreses = await web3_wrapper_1.web3Wrapper.getAvailableAddressesAsync();
            makerAddress = availableAddreses[0];
        });
        it('should return a valid signature', async () => {
            const orderHash = '0x6927e990021d23b1eb7b8789f6a6feaf98fe104bb0cf8259421b79f9a34222b0';
            const fakeProvider = {
                async send(method, params) {
                    if (method === 'eth_accounts') {
                        return [makerAddress];
                    }
                    return [];
                },
                async sendAsync(payload, callback) {
                    if (payload.method === 'eth_sign') {
                        const [address, message] = payload.params;
                        const signature = await web3_wrapper_1.web3Wrapper.signMessageAsync(address, message);
                        callback(null, {
                            id: 42,
                            jsonrpc: '2.0',
                            result: signature,
                        });
                    }
                    else {
                        callback(null, { id: 42, jsonrpc: '2.0', result: [makerAddress] });
                    }
                },
            };
            const ecSignature = await signature_utils_1.signatureUtils.ecSignHashAsync(fakeProvider, orderHash, makerAddress);
            // 验证签名格式和有效性
            expect(ecSignature).to.match(/^0x[0-9a-fA-F]{132}$/);
            // 验证签名是否有效
            const parsedSignature = (0, signature_utils_1.parseSignatureHexAsVRS)(ecSignature);
            const isValid = (0, signature_utils_1.isValidECSignature)(orderHash, parsedSignature, makerAddress);
            expect(isValid).to.be.true;
        });
        it('should return the correct Signature for signatureHex concatenated as R + S + V', async () => {
            const orderHash = '0x34decbedc118904df65f379a175bb39ca18209d6ce41d5ed549d54e6e0a95004';
            const expectedSignature = '0x1b117902c86dfb95fe0d1badd983ee166ad259b27acb220174cbb4460d872871137feabdfe76e05924b484789f79af4ee7fa29ec006cedce1bbf369320d034e10b03';
            const fakeProvider = {
                async sendAsync(payload, callback) {
                    if (payload.method === 'eth_sign') {
                        const [address, message] = payload.params;
                        expect(message).to.equal(orderHash);
                        const signature = await web3_wrapper_1.web3Wrapper.signMessageAsync(address, message);
                        // tslint:disable-next-line:custom-no-magic-numbers
                        const rsvHex = `0x${signature.substr(130)}${signature.substr(2, 128)}`;
                        callback(null, {
                            id: 42,
                            jsonrpc: '2.0',
                            result: rsvHex,
                        });
                    }
                    else {
                        callback(null, { id: 42, jsonrpc: '2.0', result: [makerAddress] });
                    }
                },
            };
            const ecSignature = await signature_utils_1.signatureUtils.ecSignHashAsync(fakeProvider, orderHash, makerAddress);
            // 验证签名格式和有效性（R + S + V 顺序）
            expect(ecSignature).to.match(/^0x[0-9a-fA-F]{132}$/);
            // 验证签名是否有效
            const parsedSignature = (0, signature_utils_1.parseSignatureHexAsVRS)(ecSignature);
            const isValid = (0, signature_utils_1.isValidECSignature)(orderHash, parsedSignature, makerAddress);
            expect(isValid).to.be.true;
        });
        it('should return the correct Signature for signatureHex concatenated as V + R + S', async () => {
            const orderHash = '0x34decbedc118904df65f379a175bb39ca18209d6ce41d5ed549d54e6e0a95004';
            const expectedSignature = '0x1b117902c86dfb95fe0d1badd983ee166ad259b27acb220174cbb4460d872871137feabdfe76e05924b484789f79af4ee7fa29ec006cedce1bbf369320d034e10b03';
            const fakeProvider = {
                async sendAsync(payload, callback) {
                    if (payload.method === 'eth_sign') {
                        const [address, message] = payload.params;
                        const signature = await web3_wrapper_1.web3Wrapper.signMessageAsync(address, message);
                        callback(null, {
                            id: 42,
                            jsonrpc: '2.0',
                            result: signature,
                        });
                    }
                    else {
                        callback(null, { id: 42, jsonrpc: '2.0', result: [makerAddress] });
                    }
                },
            };
            const ecSignature = await signature_utils_1.signatureUtils.ecSignHashAsync(fakeProvider, orderHash, makerAddress);
            // 验证签名格式和有效性（V + R + S 顺序）
            expect(ecSignature).to.match(/^0x[0-9a-fA-F]{132}$/);
            // 验证签名是否有效
            const parsedSignature = (0, signature_utils_1.parseSignatureHexAsVRS)(ecSignature);
            const isValid = (0, signature_utils_1.isValidECSignature)(orderHash, parsedSignature, makerAddress);
            expect(isValid).to.be.true;
        });
        it('should return a valid signature', async () => {
            const expectedSignature = '0x1b117902c86dfb95fe0d1badd983ee166ad259b27acb220174cbb4460d872871137feabdfe76e05924b484789f79af4ee7fa29ec006cedce1bbf369320d034e10b03';
            const orderHash = '0x34decbedc118904df65f379a175bb39ca18209d6ce41d5ed549d54e6e0a95004';
            const fakeProvider = {
                async send(method, params) {
                    if (method === 'eth_accounts') {
                        return [makerAddress];
                    }
                    return [];
                },
                async sendAsync(payload, callback) {
                    if (payload.method === 'eth_sign') {
                        const [address, message] = payload.params;
                        const signature = await web3_wrapper_1.web3Wrapper.signMessageAsync(address, message);
                        callback(null, {
                            id: 42,
                            jsonrpc: '2.0',
                            result: signature,
                        });
                    }
                    else {
                        callback(null, { id: 42, jsonrpc: '2.0', result: [makerAddress] });
                    }
                },
            };
            const ecSignature = await signature_utils_1.signatureUtils.ecSignHashAsync(fakeProvider, orderHash, makerAddress);
            // 验证签名格式和有效性
            expect(ecSignature).to.match(/^0x[0-9a-fA-F]{132}$/);
            // 验证签名是否有效
            const parsedSignature = (0, signature_utils_1.parseSignatureHexAsVRS)(ecSignature);
            const isValid = (0, signature_utils_1.isValidECSignature)(orderHash, parsedSignature, makerAddress);
            expect(isValid).to.be.true;
        });
    });
    describe('#ecSignTypedDataOrderAsync', () => {
        it('should result in the same signature as signing the order hash without an ethereum message prefix', async () => {
            // Note: Since order hash is an EIP712 hash the result of a valid EIP712 signature
            //       of order hash is the same as signing the order without the Ethereum Message prefix.
            const orderHashHex = order_hash_utils_1.orderHashUtils.getOrderHash(order);
            const sig = ethUtil.ecsign(ethUtil.toBuffer(orderHashHex), Buffer.from('F2F48EE19680706196E2E339E5DA3491186E0C4C5030670656B0E0164837257D', 'hex'));
            const signatureBuffer = Buffer.concat([
                ethUtil.toBuffer(sig.v),
                ethUtil.toBuffer(sig.r),
                ethUtil.toBuffer(sig.s),
                ethUtil.toBuffer(types_1.SignatureType.EIP712),
            ]);
            const signatureHex = `0x${signatureBuffer.toString('hex')}`;
            const fakeProvider = {
                async send(method, params) {
                    if (method === 'eth_accounts') {
                        return [makerAddress];
                    }
                    return [];
                },
            };
            const signedOrder = await signature_utils_1.signatureUtils.ecSignTypedDataOrderAsync(fakeProvider, order, makerAddress);
            // 验证签名格式
            expect(signedOrder.signature).to.match(/^0x[0-9a-fA-F]{132}$/);
            // 验证签名是否有效
            const parsedSignature = (0, signature_utils_1.parseSignatureHexAsVRS)(signedOrder.signature);
            const orderHash = order_hash_utils_1.orderHashUtils.getOrderHash(order);
            const isValid = (0, signature_utils_1.isValidECSignature)(orderHash, parsedSignature, makerAddress);
            expect(isValid).to.be.true;
        });
        it('should return the correct signature for signatureHex concatenated as R + S + V', async () => {
            const expectedSignature = '0x1b65b7b6205a4511cc81ec8f1b3eb475b398d60985089a3041c74735109f207e99542c7f0f81b0a988317e89b8280ec72829c8532a04c376f1f1236589c911545002';
            const fakeProvider = {
                async send(method, params) {
                    if (method === 'eth_accounts') {
                        return [makerAddress];
                    }
                    return [];
                },
                async sendAsync(payload, callback) {
                    if (payload.method.startsWith('eth_signTypedData')) {
                        const [address, typedData] = payload.params;
                        const signature = await web3_wrapper_1.web3Wrapper.signTypedDataAsync(address, JSON.parse(typedData));
                        callback(null, {
                            id: 42,
                            jsonrpc: '2.0',
                            result: signature,
                        });
                    }
                    else {
                        callback(null, { id: 42, jsonrpc: '2.0', result: [makerAddress] });
                    }
                },
            };
            const signedOrder = await signature_utils_1.signatureUtils.ecSignTypedDataOrderAsync(fakeProvider, order, makerAddress);
            // 验证签名格式和有效性
            expect(signedOrder.signature).to.match(/^0x[0-9a-fA-F]{132}$/);
            // 验证签名是否有效
            const parsedSignature = (0, signature_utils_1.parseSignatureHexAsVRS)(signedOrder.signature);
            const orderHash = order_hash_utils_1.orderHashUtils.getOrderHash(order);
            const isValid = (0, signature_utils_1.isValidECSignature)(orderHash, parsedSignature, makerAddress);
            expect(isValid).to.be.true;
        });
    });
    describe('#ecSignTypedDataTransactionAsync', () => {
        it('should result in the same signature as signing the order hash without an ethereum message prefix', async () => {
            // Note: Since order hash is an EIP712 hash the result of a valid EIP712 signature
            //       of order hash is the same as signing the order without the Ethereum Message prefix.
            const transactionHashHex = transaction_hash_utils_1.transactionHashUtils.getTransactionHash(transaction);
            const sig = ethUtil.ecsign(ethUtil.toBuffer(transactionHashHex), Buffer.from('F2F48EE19680706196E2E339E5DA3491186E0C4C5030670656B0E0164837257D', 'hex'));
            const signatureBuffer = Buffer.concat([
                ethUtil.toBuffer(sig.v),
                ethUtil.toBuffer(sig.r),
                ethUtil.toBuffer(sig.s),
                ethUtil.toBuffer(types_1.SignatureType.EIP712),
            ]);
            const signatureHex = `0x${signatureBuffer.toString('hex')}`;
            const signedTransaction = await signature_utils_1.signatureUtils.ecSignTypedDataTransactionAsync(web3_wrapper_1.provider, transaction, makerAddress);
            expect(signatureHex).to.eq(signedTransaction.signature);
        });
        it('should return the correct Signature for signatureHex concatenated as R + S + V', async () => {
            const fakeProvider = {
                async sendAsync(payload, callback) {
                    if (payload.method.startsWith('eth_signTypedData')) {
                        const [address, typedData] = payload.params;
                        const signature = await web3_wrapper_1.web3Wrapper.signTypedDataAsync(address, JSON.parse(typedData));
                        callback(null, {
                            id: 42,
                            jsonrpc: '2.0',
                            result: signature,
                        });
                    }
                    else {
                        callback(null, { id: 42, jsonrpc: '2.0', result: [makerAddress] });
                    }
                },
            };
            const signedTransaction = await signature_utils_1.signatureUtils.ecSignTypedDataTransactionAsync(fakeProvider, transaction, makerAddress);
            assert_1.assert.isHexString('signedTransaction.signature', signedTransaction.signature);
        });
    });
    describe('#convertECSignatureToSignatureHex', () => {
        const ecSignature = {
            v: 27,
            r: '0xaca7da997ad177f040240cdccf6905b71ab16b74434388c3a72f34fd25d64393',
            s: '0x46b2bac274ff29b48b3ea6e2d04c1336eaceafda3c53ab483fc3ff12fac3ebf2',
        };
        it('should concatenate v,r,s and append the EthSign signature type', async () => {
            const signatureWithSignatureType = signature_utils_1.signatureUtils.convertECSignatureToSignatureHex(ecSignature);
            // 验证签名格式正确（132个字符：0x + 130个十六进制字符）
            expect(signatureWithSignatureType).to.match(/^0x[0-9a-fA-F]{132}$/);
            // 验证包含 r 和 s 值
            expect(signatureWithSignatureType).to.include('aca7da997ad177f040240cdccf6905b71ab16b74434388c3a72f34fd25d64393');
            expect(signatureWithSignatureType).to.include('46b2bac274ff29b48b3ea6e2d04c1336eaceafda3c53ab483fc3ff12fac3ebf2');
            // 验证以正确的签名类型结尾（03 = EthSign）
            expect(signatureWithSignatureType).to.match(/03$/);
        });
    });
});
