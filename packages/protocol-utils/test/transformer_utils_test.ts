import { chaiSetup } from './chai_setup';
import { expect } from 'chai';

import {
    encodeFillQuoteTransformerData,
    FillQuoteTransformerData,
    FillQuoteTransformerSide,
    FillQuoteTransformerOrderType,
    FillQuoteTransformerBridgeOrder,
} from '../src/transformer_utils';
import { ETH_TOKEN_ADDRESS } from '../src/constants';

chaiSetup.configure();

describe('Transformer Utils', () => {
    // 模拟测试地址
    const owner = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const maker = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const taker = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

    describe('encodeFillQuoteTransformerData', () => {
        it('should encode empty transform data correctly', () => {
            const transformData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Sell,
                sellToken: ETH_TOKEN_ADDRESS,
                buyToken: maker, // 使用一个地址作为代币地址
                bridgeOrders: [],
                limitOrders: [],
                rfqOrders: [],
                fillSequence: [],
                fillAmount: 0n,
                refundReceiver: taker,
                otcOrders: [],
            };

            const encoded = encodeFillQuoteTransformerData(transformData);

            // 验证编码结果
            expect(encoded).to.be.a('string');
            expect(encoded).to.match(/^0x[0-9a-fA-F]+$/);
            console.log(`🔍 Empty data encoded length: ${encoded.length}`);
            console.log(`🔍 Empty data encoded: ${encoded.substring(0, 100)}...`);
        });

        it('should encode transform data with bridge orders', () => {
            const bridgeOrder: FillQuoteTransformerBridgeOrder = {
                source: '0x' + '01'.repeat(32), // 32字节的source
                takerTokenAmount: 1000000000000000000n, // 1 ether
                makerTokenAmount: 1000000000000000000n, // 1 ether
                bridgeData: '0x1234567890abcdef', // 示例数据
            };

            const transformData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Sell,
                sellToken: ETH_TOKEN_ADDRESS,
                buyToken: maker,
                bridgeOrders: [bridgeOrder],
                limitOrders: [],
                rfqOrders: [],
                fillSequence: [FillQuoteTransformerOrderType.Bridge],
                fillAmount: 1000000000000000000n,
                refundReceiver: taker,
                otcOrders: [],
            };

            const encoded = encodeFillQuoteTransformerData(transformData);

            // 验证编码结果
            expect(encoded).to.be.a('string');
            expect(encoded).to.match(/^0x[0-9a-fA-F]+$/);
            console.log(`🔍 Bridge order data encoded length: ${encoded.length}`);
            console.log(`🔍 Bridge order data encoded: ${encoded.substring(0, 100)}...`);
        });

        it('should encode max uint256 fillAmount correctly', () => {
            const transformData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Sell,
                sellToken: ETH_TOKEN_ADDRESS,
                buyToken: maker,
                bridgeOrders: [],
                limitOrders: [],
                rfqOrders: [],
                fillSequence: [],
                fillAmount: 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn, // MAX_UINT256
                refundReceiver: taker,
                otcOrders: [],
            };

            const encoded = encodeFillQuoteTransformerData(transformData);

            // 验证编码结果
            expect(encoded).to.be.a('string');
            expect(encoded).to.match(/^0x[0-9a-fA-F]+$/);
            console.log(`🔍 Max fillAmount encoded length: ${encoded.length}`);
        });
    });

    describe('Advanced Encoding Tests', () => {
        it('should encode complex bridge order data', () => {
            // 创建复杂的桥接订单
            const bridgeOrder: FillQuoteTransformerBridgeOrder = {
                source: '0x' + '02'.repeat(16).padEnd(64, '0'), // 16字节source + 16字节padding
                takerTokenAmount: 1000000000000000000n, // 1 ether
                makerTokenAmount: 1000000000000000000n, // 1 ether
                bridgeData: '0x' + '1234567890abcdef'.repeat(8), // 更长的测试数据
            };

            const transformData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Sell,
                sellToken: maker, // 使用测试地址
                buyToken: taker,
                bridgeOrders: [bridgeOrder],
                limitOrders: [],
                rfqOrders: [],
                fillSequence: [FillQuoteTransformerOrderType.Bridge],
                fillAmount: 1000000000000000000n,
                refundReceiver: taker,
                otcOrders: [],
            };

            const encoded = encodeFillQuoteTransformerData(transformData);

            // 验证编码结果
            expect(encoded).to.be.a('string');
            expect(encoded).to.match(/^0x[0-9a-fA-F]+$/);
            console.log(`🎯 复杂桥接订单编码长度: ${encoded.length}`);

            // 验证编码数据包含预期的组件
            expect(encoded.length).to.be.greaterThan(100);
        });

        it('should encode multiple bridge orders', () => {
            const bridgeOrder1: FillQuoteTransformerBridgeOrder = {
                source: '0x' + '01'.repeat(16).padEnd(64, '0'),
                takerTokenAmount: 500000000000000000n, // 0.5 ether
                makerTokenAmount: 500000000000000000n,
                bridgeData: '0x1111',
            };

            const bridgeOrder2: FillQuoteTransformerBridgeOrder = {
                source: '0x' + '02'.repeat(16).padEnd(64, '0'),
                takerTokenAmount: 500000000000000000n, // 0.5 ether
                makerTokenAmount: 500000000000000000n,
                bridgeData: '0x2222',
            };

            const transformData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Buy,
                sellToken: maker,
                buyToken: taker,
                bridgeOrders: [bridgeOrder1, bridgeOrder2],
                limitOrders: [],
                rfqOrders: [],
                fillSequence: [FillQuoteTransformerOrderType.Bridge, FillQuoteTransformerOrderType.Bridge],
                fillAmount: 1000000000000000000n,
                refundReceiver: owner,
                otcOrders: [],
            };

            const encoded = encodeFillQuoteTransformerData(transformData);

            expect(encoded).to.be.a('string');
            expect(encoded).to.match(/^0x[0-9a-fA-F]+$/);
            console.log(`🎯 多个桥接订单编码长度: ${encoded.length}`);
        });
    });

    describe('Bigint Type Validation', () => {
        it('should handle bigint types correctly', () => {
            const transformData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Sell,
                sellToken: ETH_TOKEN_ADDRESS,
                buyToken: maker,
                bridgeOrders: [],
                limitOrders: [],
                rfqOrders: [],
                fillSequence: [],
                fillAmount: 1000000000000000000n, // bigint literal
                refundReceiver: taker,
                otcOrders: [],
            };

            // 验证我们的编码器能正确处理 bigint
            const encoding = encodeFillQuoteTransformerData(transformData);

            console.log(`📊 Bigint 编码结果:`);
            console.log(`  编码长度: ${encoding.length}`);
            console.log(`  编码数据: ${encoding.substring(0, 200)}...`);

            expect(encoding).to.be.a('string');
            expect(encoding.length).to.be.greaterThan(0);
            expect(encoding).to.match(/^0x[0-9a-fA-F]+$/);
        });

        it('should handle max uint256 values', () => {
            const maxUint256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;

            const transformData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Buy,
                sellToken: maker,
                buyToken: taker,
                bridgeOrders: [
                    {
                        source: '0x' + 'ff'.repeat(32),
                        takerTokenAmount: maxUint256,
                        makerTokenAmount: maxUint256,
                        bridgeData: '0x',
                    },
                ],
                limitOrders: [],
                rfqOrders: [],
                fillSequence: [FillQuoteTransformerOrderType.Bridge],
                fillAmount: maxUint256,
                refundReceiver: owner,
                otcOrders: [],
            };

            const encoding = encodeFillQuoteTransformerData(transformData);

            console.log(`📊 Max uint256 编码结果:`);
            console.log(`  编码长度: ${encoding.length}`);

            expect(encoding).to.be.a('string');
            expect(encoding).to.match(/^0x[0-9a-fA-F]+$/);
        });
    });
});
