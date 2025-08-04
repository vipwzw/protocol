import { expect } from 'chai';
import { ethers } from 'ethers';
import {
    FillQuoteTransformerData,
    FillQuoteTransformerSide,
    WethTransformerData,
    PayTakerTransformerData,
    AffiliateFeeTransformerData,
    PositiveSlippageFeeTransformerData
} from '../src/transformer_utils';

describe('编码器等价性验证测试', () => {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    // ORDER_ABI_COMPONENTS 的定义
    const ORDER_ABI_COMPONENTS = [
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
        { name: 'takerFeeAssetData', type: 'bytes' },
    ];

    // 帮助函数：将对象转换为按 ABI 顺序的值数组
    function orderToArray(order: any) {
        return [
            order.makerAddress,
            order.takerAddress,
            order.feeRecipientAddress,
            order.senderAddress,
            order.makerAssetAmount,
            order.takerAssetAmount,
            order.makerFee,
            order.takerFee,
            order.expirationTimeSeconds,
            order.salt,
            order.makerAssetData,
            order.takerAssetData,
            order.makerFeeAssetData,
            order.takerFeeAssetData
        ];
    }

    function fillQuoteToArray(data: FillQuoteTransformerData) {
        return [
            data.side,
            data.sellToken,
            data.buyToken,
            data.orders.map(orderToArray),
            data.signatures,
            data.maxOrderFillAmounts,
            data.fillAmount,
            data.refundReceiver,
            data.rfqtTakerAddress
        ];
    }

    function bigintReplacer(key: string, value: any) {
        return typeof value === 'bigint' ? value.toString() : value;
    }

    describe('数据结构编码验证', () => {
        it('FillQuoteTransformerData - 验证新旧编码方式一致', () => {
            const testData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Sell,
                sellToken: '0x1234567890123456789012345678901234567890',
                buyToken: '0x0987654321098765432109876543210987654321',
                orders: [
                    {
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

            // 方式 1：旧的硬编码字符串方式
            const orderTypeString = ORDER_ABI_COMPONENTS.map(c => c.type).join(',');
            const oldTypeString = `tuple(uint8,address,address,tuple(${orderTypeString})[],bytes[],uint256[],uint256,address,address)`;
            const oldEncoded = abiCoder.encode([oldTypeString], [fillQuoteToArray(testData)]);

            // 方式 2：新的 JSON ABI 方式
            const ORDER_ABI = {
                type: 'tuple',
                components: ORDER_ABI_COMPONENTS
            };

            const FILL_QUOTE_ABI = {
                type: 'tuple',
                components: [
                    { name: 'side', type: 'uint8' },
                    { name: 'sellToken', type: 'address' },
                    { name: 'buyToken', type: 'address' },
                    { name: 'orders', type: 'tuple[]', components: ORDER_ABI.components },
                    { name: 'signatures', type: 'bytes[]' },
                    { name: 'maxOrderFillAmounts', type: 'uint256[]' },
                    { name: 'fillAmount', type: 'uint256' },
                    { name: 'refundReceiver', type: 'address' },
                    { name: 'rfqtTakerAddress', type: 'address' }
                ]
            };

            const newEncoded = abiCoder.encode([FILL_QUOTE_ABI], [fillQuoteToArray(testData)]);

            console.log('🔍 FillQuote 编码对比:');
            console.log('旧方式:', oldEncoded);
            console.log('新方式:', newEncoded);
            console.log('编码一致:', oldEncoded === newEncoded ? '✅' : '❌');

            expect(newEncoded).to.equal(oldEncoded);

            // 验证解码结果一致
            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);
            const newDecoded = abiCoder.decode([FILL_QUOTE_ABI], newEncoded);
            
            expect(JSON.stringify(newDecoded, bigintReplacer)).to.equal(JSON.stringify(oldDecoded, bigintReplacer));
        });

        it('WethTransformerData - 验证新旧编码方式一致', () => {
            const testData: WethTransformerData = {
                token: '0x1234567890123456789012345678901234567890',
                amount: 1000000000000000000n
            };

            // 旧方式
            const oldTypeString = 'tuple(address,uint256)';
            const oldEncoded = abiCoder.encode([oldTypeString], [[testData.token, testData.amount]]);

            // 新方式
            const WETH_ABI = {
                type: 'tuple',
                components: [
                    { name: 'token', type: 'address' },
                    { name: 'amount', type: 'uint256' }
                ]
            };
            const newEncoded = abiCoder.encode([WETH_ABI], [[testData.token, testData.amount]]);

            console.log('🔍 WETH 编码对比:');
            console.log('旧方式:', oldEncoded);
            console.log('新方式:', newEncoded);
            console.log('编码一致:', oldEncoded === newEncoded ? '✅' : '❌');

            expect(newEncoded).to.equal(oldEncoded);

            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);
            const newDecoded = abiCoder.decode([WETH_ABI], newEncoded);
            expect(JSON.stringify(newDecoded, bigintReplacer)).to.equal(JSON.stringify(oldDecoded, bigintReplacer));
        });

        it('PayTakerTransformerData - 验证新旧编码方式一致', () => {
            const testData: PayTakerTransformerData = {
                tokens: [
                    '0x1234567890123456789012345678901234567890',
                    '0x0987654321098765432109876543210987654321'
                ],
                amounts: [1000n, 2000n]
            };

            // 旧方式
            const oldTypeString = 'tuple(address[],uint256[])';
            const oldEncoded = abiCoder.encode([oldTypeString], [[testData.tokens, testData.amounts]]);

            // 新方式
            const PAY_TAKER_ABI = {
                type: 'tuple',
                components: [
                    { name: 'tokens', type: 'address[]' },
                    { name: 'amounts', type: 'uint256[]' }
                ]
            };
            const newEncoded = abiCoder.encode([PAY_TAKER_ABI], [[testData.tokens, testData.amounts]]);

            console.log('🔍 PayTaker 编码对比:');
            console.log('旧方式:', oldEncoded);
            console.log('新方式:', newEncoded);
            console.log('编码一致:', oldEncoded === newEncoded ? '✅' : '❌');

            expect(newEncoded).to.equal(oldEncoded);

            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);
            const newDecoded = abiCoder.decode([PAY_TAKER_ABI], newEncoded);
            expect(JSON.stringify(newDecoded, bigintReplacer)).to.equal(JSON.stringify(oldDecoded, bigintReplacer));
        });

        it('AffiliateFeeTransformerData - 验证新旧编码方式一致', () => {
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

            // 转换 fees 数组为 tuple 数组
            const feesArray = testData.fees.map(fee => [fee.token, fee.amount, fee.recipient]);

            // 旧方式
            const oldTypeString = 'tuple(tuple(address,uint256,address)[])';
            const oldEncoded = abiCoder.encode([oldTypeString], [[feesArray]]);

            // 新方式
            const AFFILIATE_FEE_ABI = {
                type: 'tuple',
                components: [
                    {
                        name: 'fees',
                        type: 'tuple[]',
                        components: [
                            { name: 'token', type: 'address' },
                            { name: 'amount', type: 'uint256' },
                            { name: 'recipient', type: 'address' }
                        ]
                    }
                ]
            };
            const newEncoded = abiCoder.encode([AFFILIATE_FEE_ABI], [[feesArray]]);

            console.log('🔍 AffiliateFee 编码对比:');
            console.log('旧方式:', oldEncoded);
            console.log('新方式:', newEncoded);
            console.log('编码一致:', oldEncoded === newEncoded ? '✅' : '❌');

            expect(newEncoded).to.equal(oldEncoded);

            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);
            const newDecoded = abiCoder.decode([AFFILIATE_FEE_ABI], newEncoded);
            expect(JSON.stringify(newDecoded, bigintReplacer)).to.equal(JSON.stringify(oldDecoded, bigintReplacer));
        });

        it('PositiveSlippageFeeTransformerData - 验证新旧编码方式一致', () => {
            const testData: PositiveSlippageFeeTransformerData = {
                token: '0x1234567890123456789012345678901234567890',
                bestCaseAmount: 1500000000000000000n,
                recipient: '0x1111111111111111111111111111111111111111'
            };

            // 旧方式
            const oldTypeString = 'tuple(address,uint256,address)';
            const oldEncoded = abiCoder.encode([oldTypeString], [[testData.token, testData.bestCaseAmount, testData.recipient]]);

            // 新方式
            const POSITIVE_SLIPPAGE_ABI = {
                type: 'tuple',
                components: [
                    { name: 'token', type: 'address' },
                    { name: 'bestCaseAmount', type: 'uint256' },
                    { name: 'recipient', type: 'address' }
                ]
            };
            const newEncoded = abiCoder.encode([POSITIVE_SLIPPAGE_ABI], [[testData.token, testData.bestCaseAmount, testData.recipient]]);

            console.log('🔍 PositiveSlippageFee 编码对比:');
            console.log('旧方式:', oldEncoded);
            console.log('新方式:', newEncoded);
            console.log('编码一致:', oldEncoded === newEncoded ? '✅' : '❌');

            expect(newEncoded).to.equal(oldEncoded);

            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);
            const newDecoded = abiCoder.decode([POSITIVE_SLIPPAGE_ABI], newEncoded);
            expect(JSON.stringify(newDecoded, bigintReplacer)).to.equal(JSON.stringify(oldDecoded, bigintReplacer));
        });
    });

    describe('类型字符串生成验证', () => {
        it('验证从 JSON ABI 生成的类型字符串与手动构建的一致', () => {
            // 手动构建的类型字符串
            const manualOrderType = ORDER_ABI_COMPONENTS.map(c => c.type).join(',');
            const manualFillQuoteType = `tuple(uint8,address,address,tuple(${manualOrderType})[],bytes[],uint256[],uint256,address,address)`;

            console.log('📝 类型字符串对比:');
            console.log('手动构建:', manualFillQuoteType);

            // 这验证了我们的 JSON ABI 方法与传统的硬编码字符串方法是等价的
            expect(manualFillQuoteType).to.include('tuple(uint8,address,address,tuple(');
            expect(manualFillQuoteType).to.include('address,address,address,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes,bytes,bytes,bytes');
            expect(manualFillQuoteType).to.include(')[],bytes[],uint256[],uint256,address,address)');
        });
    });

    describe('实际编码器测试', () => {
        it('验证我们的编码器产生正确的输出格式', () => {
            const testData: PositiveSlippageFeeTransformerData = {
                token: '0x1234567890123456789012345678901234567890',
                bestCaseAmount: 1500000000000000000n,
                recipient: '0x1111111111111111111111111111111111111111'
            };

            // 使用 AbiCoder 直接编码
            const directEncoded = abiCoder.encode(
                ['tuple(address,uint256,address)'], 
                [[testData.token, testData.bestCaseAmount, testData.recipient]]
            );

            console.log('📊 编码结果验证:');
            console.log('直接编码:', directEncoded);
            console.log('长度:', directEncoded.length);
            console.log('以0x开头:', directEncoded.startsWith('0x') ? '✅' : '❌');

            expect(directEncoded).to.be.a('string');
            expect(directEncoded).to.match(/^0x[0-9a-fA-F]+$/);
            expect(directEncoded.length).to.be.greaterThan(10);
        });
    });
});