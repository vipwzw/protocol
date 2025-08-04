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
    PositiveSlippageFeeTransformerData,
    jsonUtils
} from '../src';

// 将对象按照 ABI 组件顺序转换为数组
function convertToArrayFormat(data: any, components: any[]): any[] {
    if (Array.isArray(data)) {
        return data;
    }
    return components.map(component => {
        const value = data[component.name];
        if (component.type.startsWith('tuple') && component.components) {
            // 递归处理嵌套的 tuple
            if (Array.isArray(value)) {
                return value.map(item => convertToArrayFormat(item, component.components));
            } else {
                return convertToArrayFormat(value, component.components);
            }
        }
        return value;
    });
}

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
                        takerAssetData: '0xefab',
                        makerFeeAssetData: '0x1234',
                        takerFeeAssetData: '0x5678'
                    }
                ],
                signatures: ['0x1234', '0x5678'],
                maxOrderFillAmounts: [500n, 1000n],
                fillAmount: 1500n,
                refundReceiver: '0x5555555555555555555555555555555555555555',
                rfqtTakerAddress: '0x6666666666666666666666666666666666666666'
            };

            // 定义组件结构
            const fillQuoteComponents = [
                { name: 'side', type: 'uint8' },
                { name: 'sellToken', type: 'address' },
                { name: 'buyToken', type: 'address' },
                { name: 'orders', type: 'tuple[]', components: [
                    { name: 'makerAddress', type: 'address' },
                    { name: 'takerAddress', type: 'address' },
                    { name: 'feeRecipientAddress', type: 'address' },
                    { name: 'senderAddress', type: 'address' },
                    { name: 'makerAssetAmount', type: 'uint256' },
                    { name: 'takerAssetAmount', type: 'uint256' },
                    { name: 'makerFee', type: 'uint256' },
                    { name: 'takerFee', type: 'uint256' },
                    { name: 'expirationTimeSeconds', type: 'uint256' },
                    { name: 'salt', type: 'uint256' },
                    { name: 'makerAssetData', type: 'bytes' },
                    { name: 'takerAssetData', type: 'bytes' },
                    { name: 'makerFeeAssetData', type: 'bytes' },
                    { name: 'takerFeeAssetData', type: 'bytes' }
                ]},
                { name: 'signatures', type: 'bytes[]' },
                { name: 'maxOrderFillAmounts', type: 'uint256[]' },
                { name: 'fillAmount', type: 'uint256' },
                { name: 'refundReceiver', type: 'address' },
                { name: 'rfqtTakerAddress', type: 'address' }
            ];

            // 新的 JSON ABI 方式 (当前实现) - 编码器接收对象格式
            const newEncoded = fillQuoteTransformerDataEncoder.encode([testData]);

            // 旧的硬编码字符串方式 - 转换为数组格式
            const oldTypeString = 'tuple(uint8,address,address,tuple(address,address,address,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes,bytes,bytes,bytes)[],bytes[],uint256[],uint256,address,address)';
            const arrayData = convertToArrayFormat(testData, fillQuoteComponents);
            const oldEncoded = abiCoder.encode([oldTypeString], [arrayData]);

            console.log('New encoding:', newEncoded);
            console.log('Old encoding:', oldEncoded);
            expect(newEncoded).to.equal(oldEncoded);

            // 验证解码结果也一致
            const newDecoded = fillQuoteTransformerDataEncoder.decode(newEncoded);
            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);

            // 使用 BigInt 安全的序列化方法
            expect(JSON.stringify(newDecoded, jsonUtils.bigIntReplacer)).to.equal(JSON.stringify([oldDecoded[0]], jsonUtils.bigIntReplacer));
        });
    });

    describe('WethTransformerDataEncoder', () => {
        it('should produce identical encoding results', () => {
            const testData: WethTransformerData = {
                token: '0x1234567890123456789012345678901234567890',
                amount: 1000000000000000000n // 1 ETH
            };

            // 定义组件结构
            const wethComponents = [
                { name: 'token', type: 'address' },
                { name: 'amount', type: 'uint256' }
            ];

            // 新的 JSON ABI 方式 - 编码器接收对象格式
            const newEncoded = wethTransformerDataEncoder.encode([testData]);

            // 旧的硬编码字符串方式 - 转换为数组格式
            const oldTypeString = 'tuple(address,uint256)';
            const arrayData = convertToArrayFormat(testData, wethComponents);
            const oldEncoded = abiCoder.encode([oldTypeString], [arrayData]);

            console.log('WETH New encoding:', newEncoded);
            console.log('WETH Old encoding:', oldEncoded);
            expect(newEncoded).to.equal(oldEncoded);

            // 验证解码结果也一致
            const newDecoded = wethTransformerDataEncoder.decode(newEncoded);
            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);

            // 使用 BigInt 安全的序列化方法
            expect(JSON.stringify(newDecoded.data, jsonUtils.bigIntReplacer)).to.equal(JSON.stringify(oldDecoded[0], jsonUtils.bigIntReplacer));
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

            // 定义组件结构
            const payTakerComponents = [
                { name: 'tokens', type: 'address[]' },
                { name: 'amounts', type: 'uint256[]' }
            ];

            // 新的 JSON ABI 方式 - 编码器接收对象格式
            const newEncoded = payTakerTransformerDataEncoder.encode([testData]);

            // 旧的硬编码字符串方式 - 转换为数组格式
            const oldTypeString = 'tuple(address[],uint256[])';
            const arrayData = convertToArrayFormat(testData, payTakerComponents);
            const oldEncoded = abiCoder.encode([oldTypeString], [arrayData]);

            console.log('PayTaker New encoding:', newEncoded);
            console.log('PayTaker Old encoding:', oldEncoded);
            expect(newEncoded).to.equal(oldEncoded);

            // 验证解码结果也一致
            const newDecoded = payTakerTransformerDataEncoder.decode(newEncoded);
            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);

            // 使用 BigInt 安全的序列化方法
            expect(JSON.stringify(newDecoded.data, jsonUtils.bigIntReplacer)).to.equal(JSON.stringify(oldDecoded[0], jsonUtils.bigIntReplacer));
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

            // 定义组件结构
            const affiliateFeeComponents = [
                { name: 'fees', type: 'tuple[]', components: [
                    { name: 'token', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                    { name: 'recipient', type: 'address' }
                ]}
            ];

            // 新的 JSON ABI 方式 - 编码器接收对象格式
            const newEncoded = affiliateFeeTransformerDataEncoder.encode(testData);

            // 旧的硬编码字符串方式 - 传递 fees 数组，转换每个 fee 对象为数组格式
            const oldTypeString = 'tuple(tuple(address,uint256,address)[])';
            const feeComponents = [
                { name: 'token', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'recipient', type: 'address' }
            ];
            const feesAsArrays = testData.fees.map(fee => convertToArrayFormat(fee, feeComponents));
            const oldEncoded = abiCoder.encode([oldTypeString], [[feesAsArrays]]);

            console.log('AffiliateFee New encoding:', newEncoded);
            console.log('AffiliateFee Old encoding:', oldEncoded);
            expect(newEncoded).to.equal(oldEncoded);

            // 验证解码结果也一致
            const newDecoded = affiliateFeeTransformerDataEncoder.decode(newEncoded);
            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);

            // 使用 BigInt 安全的序列化方法
            expect(JSON.stringify(newDecoded, jsonUtils.bigIntReplacer)).to.equal(JSON.stringify(oldDecoded[0], jsonUtils.bigIntReplacer));
        });
    });

    describe('PositiveSlippageFeeTransformerDataEncoder', () => {
        it('should produce identical encoding results', () => {
            const testData: PositiveSlippageFeeTransformerData = {
                token: '0x1234567890123456789012345678901234567890',
                bestCaseAmount: 1500000000000000000n, // 1.5 ETH
                recipient: '0x1111111111111111111111111111111111111111'
            };

            // 定义组件结构
            const positiveSlippageFeeComponents = [
                { name: 'token', type: 'address' },
                { name: 'bestCaseAmount', type: 'uint256' },
                { name: 'recipient', type: 'address' }
            ];

            // 新的 JSON ABI 方式 - 编码器接收对象格式
            const newEncoded = positiveSlippageFeeTransformerDataEncoder.encode(testData);

            // 旧的硬编码字符串方式 - 转换为数组格式
            const oldTypeString = 'tuple(address,uint256,address)';
            const arrayData = convertToArrayFormat(testData, positiveSlippageFeeComponents);
            const oldEncoded = abiCoder.encode([oldTypeString], [arrayData]);

            console.log('PositiveSlippageFee New encoding:', newEncoded);
            console.log('PositiveSlippageFee Old encoding:', oldEncoded);
            expect(newEncoded).to.equal(oldEncoded);

            // 验证解码结果也一致
            const newDecoded = positiveSlippageFeeTransformerDataEncoder.decode(newEncoded);
            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);

            // 使用 BigInt 安全的序列化方法
            expect(JSON.stringify(newDecoded, jsonUtils.bigIntReplacer)).to.equal(JSON.stringify(oldDecoded[0], jsonUtils.bigIntReplacer));
        });
    });

    describe('Round-trip Encoding/Decoding Tests', () => {
        it('should preserve data integrity through encode/decode cycles', () => {
            // Test FillQuoteTransformerData
            const fillQuoteData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Buy,
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
                refundReceiver: '0x5555555555555555555555555555555555555555',
                rfqtTakerAddress: '0x6666666666666666666666666666666666666666'
            };

            // 定义组件结构（与之前的测试保持一致）
            const roundTripFillQuoteComponents = [
                { name: 'side', type: 'uint8' },
                { name: 'sellToken', type: 'address' },
                { name: 'buyToken', type: 'address' },
                { name: 'orders', type: 'tuple[]', components: [
                    { name: 'makerAddress', type: 'address' },
                    { name: 'takerAddress', type: 'address' },
                    { name: 'feeRecipientAddress', type: 'address' },
                    { name: 'senderAddress', type: 'address' },
                    { name: 'makerAssetAmount', type: 'uint256' },
                    { name: 'takerAssetAmount', type: 'uint256' },
                    { name: 'makerFee', type: 'uint256' },
                    { name: 'takerFee', type: 'uint256' },
                    { name: 'expirationTimeSeconds', type: 'uint256' },
                    { name: 'salt', type: 'uint256' },
                    { name: 'makerAssetData', type: 'bytes' },
                    { name: 'takerAssetData', type: 'bytes' },
                    { name: 'makerFeeAssetData', type: 'bytes' },
                    { name: 'takerFeeAssetData', type: 'bytes' }
                ]},
                { name: 'signatures', type: 'bytes[]' },
                { name: 'maxOrderFillAmounts', type: 'uint256[]' },
                { name: 'fillAmount', type: 'uint256' },
                { name: 'refundReceiver', type: 'address' },
                { name: 'rfqtTakerAddress', type: 'address' }
            ];

            // 转换为数组格式并进行完整的 round-trip 测试
            const encoded = fillQuoteTransformerDataEncoder.encode([fillQuoteData]);
            const decoded = fillQuoteTransformerDataEncoder.decode(encoded);
            
            // 验证编码结果有效（非空且正确格式）
            expect(encoded).to.be.a('string');
            expect(encoded).to.match(/^0x[0-9a-fA-F]+$/);
            expect(encoded.length).to.be.greaterThan(2);
            
            // 验证解码后的数据完整性
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
            
            console.log('✅ Round-trip 编码解码测试通过');
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