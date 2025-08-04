import { expect } from 'chai';
import { ethers, ParamType } from 'ethers';
import {
    FillQuoteTransformerData,
    FillQuoteTransformerSide,
    WethTransformerData,
    PayTakerTransformerData,
    AffiliateFeeTransformerData,
    PositiveSlippageFeeTransformerData
} from '../src/transformer_utils';

describe('简化编码器等价性测试', () => {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    // ORDER_ABI_COMPONENTS 的定义（从源码复制）
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

    describe('直接 AbiCoder 编码验证', () => {
        it('FillQuoteTransformerData - 新旧编码方式对比', () => {
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

            // 方式 1：旧的硬编码字符串方式
            const orderTypeString = ORDER_ABI_COMPONENTS.map(c => c.type).join(',');
            const oldTypeString = `tuple(uint8,address,address,tuple(${orderTypeString})[],bytes[],uint256[],uint256,address,address)`;
            const oldEncoded = abiCoder.encode([oldTypeString], [testData]);
            console.log('旧方式编码:', oldEncoded);

            // 方式 2：新的 JSON ABI 方式（直接使用 AbiCoder）
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

            // 使用 ParamType 创建正确的类型
            const fillQuoteParamType = ParamType.from(FILL_QUOTE_ABI);
            const newEncoded = abiCoder.encode([fillQuoteParamType], [testData]);
            console.log('新方式编码:', newEncoded);

            // 验证编码结果一致
            expect(newEncoded).to.equal(oldEncoded);

            // 验证解码结果一致
            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);
            const newDecoded = abiCoder.decode([fillQuoteParamType], newEncoded);
            
            expect(JSON.stringify(newDecoded)).to.equal(JSON.stringify(oldDecoded));
        });

        it('WethTransformerData - 新旧编码方式对比', () => {
            const testData: WethTransformerData = {
                token: '0x1234567890123456789012345678901234567890',
                amount: 1000000000000000000n
            };

            // 旧方式
            const oldTypeString = 'tuple(address,uint256)';
            const oldEncoded = abiCoder.encode([oldTypeString], [testData]);
            console.log('WETH 旧方式编码:', oldEncoded);

            // 新方式
            const WETH_ABI = {
                type: 'tuple',
                components: [
                    { name: 'token', type: 'address' },
                    { name: 'amount', type: 'uint256' }
                ]
            };
            const wethParamType = ParamType.from(WETH_ABI);
            const newEncoded = abiCoder.encode([wethParamType], [testData]);
            console.log('WETH 新方式编码:', newEncoded);

            expect(newEncoded).to.equal(oldEncoded);

            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);
            const newDecoded = abiCoder.decode([wethParamType], newEncoded);
            expect(JSON.stringify(newDecoded)).to.equal(JSON.stringify(oldDecoded));
        });

        it('PayTakerTransformerData - 新旧编码方式对比', () => {
            const testData: PayTakerTransformerData = {
                tokens: [
                    '0x1234567890123456789012345678901234567890',
                    '0x0987654321098765432109876543210987654321'
                ],
                amounts: [1000n, 2000n]
            };

            // 旧方式
            const oldTypeString = 'tuple(address[],uint256[])';
            const oldEncoded = abiCoder.encode([oldTypeString], [testData]);
            console.log('PayTaker 旧方式编码:', oldEncoded);

            // 新方式
            const PAY_TAKER_ABI = {
                type: 'tuple',
                components: [
                    { name: 'tokens', type: 'address[]' },
                    { name: 'amounts', type: 'uint256[]' }
                ]
            };
            const payTakerParamType = ParamType.from(PAY_TAKER_ABI);
            const newEncoded = abiCoder.encode([payTakerParamType], [testData]);
            console.log('PayTaker 新方式编码:', newEncoded);

            expect(newEncoded).to.equal(oldEncoded);

            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);
            const newDecoded = abiCoder.decode([payTakerParamType], newEncoded);
            expect(JSON.stringify(newDecoded)).to.equal(JSON.stringify(oldDecoded));
        });

        it('AffiliateFeeTransformerData - 新旧编码方式对比', () => {
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

            // 旧方式 - 需要传递 fees 数组
            const oldTypeString = 'tuple(tuple(address,uint256,address)[])';
            const oldEncoded = abiCoder.encode([oldTypeString], [[testData.fees]]);
            console.log('AffiliateFee 旧方式编码:', oldEncoded);

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
            const affiliateFeeParamType = ParamType.from(AFFILIATE_FEE_ABI);
            const newEncoded = abiCoder.encode([affiliateFeeParamType], [testData]);
            console.log('AffiliateFee 新方式编码:', newEncoded);

            expect(newEncoded).to.equal(oldEncoded);

            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);
            const newDecoded = abiCoder.decode([affiliateFeeParamType], newEncoded);
            expect(JSON.stringify(newDecoded)).to.equal(JSON.stringify(oldDecoded));
        });

        it('PositiveSlippageFeeTransformerData - 新旧编码方式对比', () => {
            const testData: PositiveSlippageFeeTransformerData = {
                token: '0x1234567890123456789012345678901234567890',
                bestCaseAmount: 1500000000000000000n,
                recipient: '0x1111111111111111111111111111111111111111'
            };

            // 旧方式 - 需要传递属性值数组
            const oldTypeString = 'tuple(address,uint256,address)';
            const oldEncoded = abiCoder.encode([oldTypeString], [[testData.token, testData.bestCaseAmount, testData.recipient]]);
            console.log('PositiveSlippageFee 旧方式编码:', oldEncoded);

            // 新方式
            const POSITIVE_SLIPPAGE_ABI = {
                type: 'tuple',
                components: [
                    { name: 'token', type: 'address' },
                    { name: 'bestCaseAmount', type: 'uint256' },
                    { name: 'recipient', type: 'address' }
                ]
            };
            const positiveSlippageParamType = ParamType.from(POSITIVE_SLIPPAGE_ABI);
            const newEncoded = abiCoder.encode([positiveSlippageParamType], [testData]);
            console.log('PositiveSlippageFee 新方式编码:', newEncoded);

            expect(newEncoded).to.equal(oldEncoded);

            const oldDecoded = abiCoder.decode([oldTypeString], oldEncoded);
            const newDecoded = abiCoder.decode([positiveSlippageParamType], newEncoded);
            expect(JSON.stringify(newDecoded)).to.equal(JSON.stringify(oldDecoded));
        });
    });

    describe('字符串生成验证', () => {
        it('应该从 JSON ABI 生成正确的类型字符串', () => {
            const ORDER_ABI = {
                type: 'tuple',
                components: ORDER_ABI_COMPONENTS
            };

            // 手动构建的类型字符串
            const manualOrderType = ORDER_ABI_COMPONENTS.map(c => c.type).join(',');
            const manualFillQuoteType = `tuple(uint8,address,address,tuple(${manualOrderType})[],bytes[],uint256[],uint256,address,address)`;

            // 从 JSON ABI 生成的类型字符串（模拟）
            function generateTypeString(abi: any): string {
                if (abi.type === 'tuple') {
                    const componentTypes = abi.components.map((c: any) => 
                        c.type === 'tuple[]' ? `tuple(${c.components.map((sc: any) => sc.type).join(',')})[]` :
                        c.type === 'tuple' ? `tuple(${c.components.map((sc: any) => sc.type).join(',')})` :
                        c.type
                    ).join(',');
                    return `tuple(${componentTypes})`;
                }
                return abi.type;
            }

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

            const generatedType = generateTypeString(FILL_QUOTE_ABI);

            console.log('手动构建类型:', manualFillQuoteType);
            console.log('生成的类型:', generatedType);

            expect(generatedType).to.equal(manualFillQuoteType);
        });
    });
});