import { expect } from 'chai';
import { ethers } from 'ethers';
import {
    fillQuoteTransformerDataEncoder,
    wethTransformerDataEncoder,
    payTakerTransformerDataEncoder,
    affiliateFeeTransformerDataEncoder,
    positiveSlippageFeeTransformerDataEncoder,
    FillQuoteTransformerData,
    FillQuoteTransformerSide,
    WethTransformerData,
    PayTakerTransformerData,
    AffiliateFeeTransformerData,
    PositiveSlippageFeeTransformerData
} from '../src/transformer_utils';

describe('Encoder Equivalence Tests', () => {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    describe('FillQuoteTransformerDataEncoder', () => {
        it('should produce identical encoding results', () => {
            const testData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Sell,
                sellToken: '0x1234567890123456789012345678901234567890',
                buyToken: '0x0987654321098765432109876543210987654321',
                orders: [
                    {
                        chainId: 1,
                        exchangeAddress: '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
                        makerAddress: '0x1111111111111111111111111111111111111111',
                        takerAddress: '0x2222222222222222222222222222222222222222',
                        feeRecipientAddress: '0x3333333333333333333333333333333333333333',
                        senderAddress: '0x4444444444444444444444444444444444444444',
                        makerAssetAmount: 1000n,
                        takerAssetAmount: 2000n,
                        makerFee: 10n,
                        takerFee: 20n,
                        expirationTimeSeconds: 1234567890n,
                        salt: 999999n,
                        makerAssetData: '0xabcd',
                        takerAssetData: '0xefgh',
                        makerFeeAssetData: '0x1234',
                        takerFeeAssetData: '0x5678'
                    }
                ],
                signatures: ['0xsig1', '0xsig2'],
                maxOrderFillAmounts: [500n, 1000n],
                fillAmount: 1500n,
                refundReceiver: '0x5555555555555555555555555555555555555555',
                rfqtTakerAddress: '0x6666666666666666666666666666666666666666'
            };

            // 新的 JSON ABI 方式 (当前实现)
            const newEncoded = fillQuoteTransformerDataEncoder.encode([testData]);

            // 旧的硬编码字符串方式 - 直接传递数据结构而不是数组包装
            const oldTypeString = 'tuple(uint8,address,address,tuple(address,address,address,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes,bytes,bytes,bytes)[],bytes[],uint256[],uint256,address,address)';
            const oldEncoded = abiCoder.encode([oldTypeString], [testData]);

            console.log('New encoding:', newEncoded);
            console.log('Old encoding:', oldEncoded);
            expect(newEncoded).to.equal(oldEncoded);

            // 验证解码结果也一致
            const newDecoded = fillQuoteTransformerDataEncoder.decode(newEncoded);
            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);

            expect(JSON.stringify(newDecoded)).to.equal(JSON.stringify([oldDecoded[0]]));
        });
    });

    describe('WethTransformerDataEncoder', () => {
        it('should produce identical encoding results', () => {
            const testData: WethTransformerData = {
                token: '0x1234567890123456789012345678901234567890',
                amount: 1000000000000000000n // 1 ETH
            };

            // 新的 JSON ABI 方式
            const newEncoded = wethTransformerDataEncoder.encode([testData]);

            // 旧的硬编码字符串方式
            const oldTypeString = 'tuple(address,uint256)';
            const oldEncoded = abiCoder.encode([oldTypeString], [testData]);

            console.log('WETH New encoding:', newEncoded);
            console.log('WETH Old encoding:', oldEncoded);
            expect(newEncoded).to.equal(oldEncoded);

            // 验证解码结果也一致
            const newDecoded = wethTransformerDataEncoder.decode(newEncoded);
            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);

            expect(JSON.stringify(newDecoded.data)).to.equal(JSON.stringify(oldDecoded[0]));
        });
    });

    describe('PayTakerTransformerDataEncoder', () => {
        it('should produce identical encoding results', () => {
            const testData: PayTakerTransformerData = {
                tokens: [
                    '0x1234567890123456789012345678901234567890',
                    '0x0987654321098765432109876543210987654321'
                ],
                amounts: [1000n, 2000n]
            };

            // 新的 JSON ABI 方式
            const newEncoded = payTakerTransformerDataEncoder.encode([testData]);

            // 旧的硬编码字符串方式
            const oldTypeString = 'tuple(address[],uint256[])';
            const oldEncoded = abiCoder.encode([oldTypeString], [testData]);

            console.log('PayTaker New encoding:', newEncoded);
            console.log('PayTaker Old encoding:', oldEncoded);
            expect(newEncoded).to.equal(oldEncoded);

            // 验证解码结果也一致
            const newDecoded = payTakerTransformerDataEncoder.decode(newEncoded);
            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);

            expect(JSON.stringify(newDecoded.data)).to.equal(JSON.stringify(oldDecoded[0]));
        });
    });

    describe('AffiliateFeeTransformerDataEncoder', () => {
        it('should produce identical encoding results', () => {
            const testData: AffiliateFeeTransformerData = {
                fees: [
                    {
                        token: '0x1234567890123456789012345678901234567890',
                        amount: 100n,
                        recipient: '0x1111111111111111111111111111111111111111'
                    },
                    {
                        token: '0x0987654321098765432109876543210987654321',
                        amount: 200n,
                        recipient: '0x2222222222222222222222222222222222222222'
                    }
                ]
            };

            // 新的 JSON ABI 方式
            const newEncoded = affiliateFeeTransformerDataEncoder.encode(testData);

            // 旧的硬编码字符串方式 - 传递 fees 数组而不是整个对象
            const oldTypeString = 'tuple(tuple(address,uint256,address)[])';
            const oldEncoded = abiCoder.encode([oldTypeString], [[testData.fees]]);

            console.log('AffiliateFee New encoding:', newEncoded);
            console.log('AffiliateFee Old encoding:', oldEncoded);
            expect(newEncoded).to.equal(oldEncoded);

            // 验证解码结果也一致
            const newDecoded = affiliateFeeTransformerDataEncoder.decode(newEncoded);
            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);

            expect(JSON.stringify(newDecoded)).to.equal(JSON.stringify(oldDecoded[0]));
        });
    });

    describe('PositiveSlippageFeeTransformerDataEncoder', () => {
        it('should produce identical encoding results', () => {
            const testData: PositiveSlippageFeeTransformerData = {
                token: '0x1234567890123456789012345678901234567890',
                bestCaseAmount: 1500000000000000000n, // 1.5 ETH
                recipient: '0x1111111111111111111111111111111111111111'
            };

            // 新的 JSON ABI 方式
            const newEncoded = positiveSlippageFeeTransformerDataEncoder.encode(testData);

            // 旧的硬编码字符串方式 - 传递属性值而不是整个对象
            const oldTypeString = 'tuple(address,uint256,address)';
            const oldEncoded = abiCoder.encode([oldTypeString], [[testData.token, testData.bestCaseAmount, testData.recipient]]);

            console.log('PositiveSlippageFee New encoding:', newEncoded);
            console.log('PositiveSlippageFee Old encoding:', oldEncoded);
            expect(newEncoded).to.equal(oldEncoded);

            // 验证解码结果也一致
            const newDecoded = positiveSlippageFeeTransformerDataEncoder.decode(newEncoded);
            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);

            expect(JSON.stringify(newDecoded)).to.equal(JSON.stringify(oldDecoded[0]));
        });
    });

    describe('Round-trip Encoding/Decoding Tests', () => {
        it('should preserve data integrity through encode/decode cycles', () => {
            // Test FillQuoteTransformerData
            const fillQuoteData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Buy,
                sellToken: '0xA0b86a33E6417c5e8d1c20f0C6d6C6B0AfB1a1c0',
                buyToken: '0xB1c86b33E6417c5e8d1c20f0C6d6C6B0AfB1b1c1',
                orders: [
                    {
                        chainId: 1,
                        exchangeAddress: '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
                        makerAddress: '0xC2d86c33E6417c5e8d1c20f0C6d6C6B0AfB1c2c2',
                        takerAddress: '0xD3e86d33E6417c5e8d1c20f0C6d6C6B0AfB1d3d3',
                        feeRecipientAddress: '0xE4f86e33E6417c5e8d1c20f0C6d6C6B0AfB1e4e4',
                        senderAddress: '0xF5086f33E6417c5e8d1c20f0C6d6C6B0AfB1f5f5',
                        makerAssetAmount: 123456789n,
                        takerAssetAmount: 987654321n,
                        makerFee: 1000n,
                        takerFee: 2000n,
                        expirationTimeSeconds: 9876543210n,
                        salt: 555666777n,
                        makerAssetData: '0xdeadbeef',
                        takerAssetData: '0xcafebabe',
                        makerFeeAssetData: '0x12345678',
                        takerFeeAssetData: '0x87654321'
                    }
                ],
                signatures: ['0xfeedface', '0xbaddcafe'],
                maxOrderFillAmounts: [111111n, 222222n],
                fillAmount: 333333n,
                refundReceiver: '0x0606060606060606060606060606060606060606',
                rfqtTakerAddress: '0x0707070707070707070707070707070707070707'
            };

            const encoded = fillQuoteTransformerDataEncoder.encode([fillQuoteData]);
            const decoded = fillQuoteTransformerDataEncoder.decode(encoded);

            expect(decoded[0].side).to.equal(fillQuoteData.side);
            expect(decoded[0].sellToken).to.equal(fillQuoteData.sellToken);
            expect(decoded[0].buyToken).to.equal(fillQuoteData.buyToken);
            expect(decoded[0].fillAmount).to.equal(fillQuoteData.fillAmount);
            expect(decoded[0].refundReceiver).to.equal(fillQuoteData.refundReceiver);
            expect(decoded[0].rfqtTakerAddress).to.equal(fillQuoteData.rfqtTakerAddress);

            // 深度比较 orders 数组
            expect(decoded[0].orders).to.have.lengthOf(fillQuoteData.orders.length);
            expect(decoded[0].orders[0].makerAddress).to.equal(fillQuoteData.orders[0].makerAddress);
            expect(decoded[0].orders[0].makerAssetAmount).to.equal(fillQuoteData.orders[0].makerAssetAmount);

            // 比较数组字段
            expect(decoded[0].signatures).to.deep.equal(fillQuoteData.signatures);
            expect(decoded[0].maxOrderFillAmounts).to.deep.equal(fillQuoteData.maxOrderFillAmounts);
        });
    });

    describe('Error Handling Tests', () => {
        it('should handle invalid data gracefully', () => {
            // Test with invalid hex data
            expect(() => {
                fillQuoteTransformerDataEncoder.decode('0xinvalid');
            }).to.throw();

            // Test with empty data
            expect(() => {
                fillQuoteTransformerDataEncoder.decode('0x');
            }).to.throw();
        });
    });
});