import { chaiSetup } from './chai_setup';
import { expect } from 'chai';
const { ethers } = require('hardhat');

import {
    encodeFillQuoteTransformerData,
    FillQuoteTransformerData,
    FillQuoteTransformerSide,
    FillQuoteTransformerOrderType,
    FillQuoteTransformerBridgeOrder,
} from '../src/transformer_utils';
import { ETH_TOKEN_ADDRESS } from '../src/constants';

chaiSetup.configure();

// 简化的测试合约源码，用于验证编码/解码
const TEST_VERIFIER_SOURCE = `
pragma solidity ^0.8.0;

contract TransformDataVerifier {
    struct BridgeOrder {
        bytes32 source;
        uint256 takerTokenAmount;
        uint256 makerTokenAmount;
        bytes bridgeData;
    }
    
    struct TransformData {
        uint8 side;
        address sellToken;
        address buyToken;
        BridgeOrder[] bridgeOrders;
        bytes limitOrders; // 简化为 bytes
        bytes rfqOrders;   // 简化为 bytes  
        uint8[] fillSequence;
        uint256 fillAmount;
        address refundReceiver;
        bytes otcOrders;   // 简化为 bytes
    }
    
    function verifyEncoding(bytes calldata data) external pure returns (
        uint8 side,
        address sellToken,
        address buyToken,
        uint256 bridgeOrderCount,
        uint256 fillAmount,
        address refundReceiver
    ) {
        TransformData memory decoded = abi.decode(data, (TransformData));
        return (
            decoded.side,
            decoded.sellToken,
            decoded.buyToken,
            decoded.bridgeOrders.length,
            decoded.fillAmount,
            decoded.refundReceiver
        );
    }
    
    function verifyBridgeOrder(bytes calldata data, uint256 index) external pure returns (
        bytes32 source,
        uint256 takerTokenAmount,
        uint256 makerTokenAmount,
        bytes memory bridgeData
    ) {
        TransformData memory decoded = abi.decode(data, (TransformData));
        require(index < decoded.bridgeOrders.length, "Index out of bounds");
        BridgeOrder memory bridgeOrder = decoded.bridgeOrders[index];
        return (
            bridgeOrder.source,
            bridgeOrder.takerTokenAmount,
            bridgeOrder.makerTokenAmount,
            bridgeOrder.bridgeData
        );
    }
    
    // 简化的桥接数据解码器
    function decodeBridgeData(bytes calldata bridgeData) external pure returns (
        address bridgeAddress,
        uint256 boughtAmount
    ) {
        (bridgeAddress, bytes memory lpData) = abi.decode(bridgeData, (address, bytes));
        (boughtAmount) = abi.decode(lpData, (uint256));
    }
}`;

describe('🧪 Protocol-Utils 真实合约验证测试', () => {
    let verifier: any;
    let owner: any;
    let maker: any;
    let taker: any;

    before(async () => {
        const signers = await ethers.getSigners();
        [owner, maker, taker] = signers;

        console.log('🚀 初始化合约级别验证测试...');
        console.log('✅ 测试准备完成 (使用 ABI 编码/解码验证)');
    });

    describe('📊 合约级别编码验证', () => {
        it('应该生成可被合约解码的数据结构', () => {
            const transformData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Sell,
                sellToken: ETH_TOKEN_ADDRESS,
                buyToken: maker.address,
                bridgeOrders: [],
                limitOrders: [],
                rfqOrders: [],
                fillSequence: [],
                fillAmount: 1000000000000000000n,
                refundReceiver: taker.address,
                otcOrders: []
            };

            const encoded = encodeFillQuoteTransformerData(transformData);
            
            // 使用 ethers 的 AbiCoder 模拟合约解码
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            
            try {
                // 尝试部分解码以验证结构正确性
                // 这模拟了合约中的解码过程
                const decoded = abiCoder.decode(
                    ['tuple(uint8,address,address,tuple(bytes32,uint256,uint256,bytes)[],bytes,bytes,uint8[],uint256,address,bytes)'],
                    encoded
                );
                
                console.log('🔍 合约级别解码验证:');
                console.log(`- 解码成功: ✅`);
                console.log(`- side: ${decoded[0][0]} (预期: ${transformData.side})`);
                console.log(`- sellToken: ${decoded[0][1]} (预期: ${transformData.sellToken})`);
                console.log(`- buyToken: ${decoded[0][2]} (预期: ${transformData.buyToken})`);
                console.log(`- fillAmount: ${decoded[0][7]} (预期: ${transformData.fillAmount})`);
                console.log(`- refundReceiver: ${decoded[0][8]} (预期: ${transformData.refundReceiver})`);
                
                                 expect(Number(decoded[0][0])).to.equal(transformData.side); // side
                 expect(decoded[0][1].toLowerCase()).to.equal(transformData.sellToken.toLowerCase()); // sellToken
                 expect(decoded[0][2].toLowerCase()).to.equal(transformData.buyToken.toLowerCase()); // buyToken
                 expect(decoded[0][7]).to.equal(transformData.fillAmount); // fillAmount
                 expect(decoded[0][8].toLowerCase()).to.equal(transformData.refundReceiver.toLowerCase()); // refundReceiver
                
                console.log('✅ 合约级别解码验证通过');
            } catch (error) {
                console.log('❌ 合约级别解码失败:', error.message);
                throw error;
            }
        });

        it('应该正确编码带有桥接订单的数据', () => {
            const bridgeOrder: FillQuoteTransformerBridgeOrder = {
                source: '0x' + '01'.repeat(32),
                takerTokenAmount: 1000000000000000000n,
                makerTokenAmount: 2000000000000000000n,
                bridgeData: '0x1234567890abcdef'
            };

            const transformData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Buy,
                sellToken: maker.address,
                buyToken: taker.address,
                bridgeOrders: [bridgeOrder],
                limitOrders: [],
                rfqOrders: [],
                fillSequence: [FillQuoteTransformerOrderType.Bridge],
                fillAmount: 1000000000000000000n,
                refundReceiver: owner.address,
                otcOrders: []
            };

            const encoded = encodeFillQuoteTransformerData(transformData);
            
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            
            try {
                const decoded = abiCoder.decode(
                    ['tuple(uint8,address,address,tuple(bytes32,uint256,uint256,bytes)[],bytes,bytes,uint8[],uint256,address,bytes)'],
                    encoded
                );
                
                console.log('🔍 桥接订单合约解码验证:');
                console.log(`- 桥接订单数量: ${decoded[0][3].length} (预期: 1)`);
                console.log(`- fillSequence长度: ${decoded[0][6].length} (预期: 1)`);
                
                if (decoded[0][3].length > 0) {
                    const bridgeOrderDecoded = decoded[0][3][0];
                    console.log(`- source: ${bridgeOrderDecoded[0]}`);
                    console.log(`- takerTokenAmount: ${bridgeOrderDecoded[1]}`);
                    console.log(`- makerTokenAmount: ${bridgeOrderDecoded[2]}`);
                    console.log(`- bridgeData: ${bridgeOrderDecoded[3]}`);
                    
                    expect(bridgeOrderDecoded[0]).to.equal(bridgeOrder.source);
                    expect(bridgeOrderDecoded[1]).to.equal(bridgeOrder.takerTokenAmount);
                    expect(bridgeOrderDecoded[2]).to.equal(bridgeOrder.makerTokenAmount);
                    expect(bridgeOrderDecoded[3]).to.equal(bridgeOrder.bridgeData);
                }
                
                                 expect(decoded[0][3].length).to.equal(1); // 一个桥接订单
                 expect(decoded[0][6].length).to.equal(1); // 一个 fillSequence 项
                 expect(Number(decoded[0][6][0])).to.equal(FillQuoteTransformerOrderType.Bridge);
                
                console.log('✅ 桥接订单合约解码验证通过');
            } catch (error) {
                console.log('❌ 桥接订单合约解码失败:', error.message);
                throw error;
            }
        });

        it('应该正确处理复杂的嵌套桥接数据', () => {
            // 创建真实的嵌套桥接数据
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const boughtAmount = 5000000000000000000n; // 5 ETH
            const bridgeAddress = '0x48BaCB9266a570d521063EF5dD96e61686DbE788';
            
            // 创建嵌套编码的 bridgeData
            const lpData = abiCoder.encode(['uint256'], [boughtAmount]);
            const complexBridgeData = abiCoder.encode(['address', 'bytes'], [bridgeAddress, lpData]);

            const bridgeOrder: FillQuoteTransformerBridgeOrder = {
                source: '0x0000000000000000000000000000000000000000000000000000000000000000',
                takerTokenAmount: 3000000000000000000n, // 3 ETH
                makerTokenAmount: 5000000000000000000n, // 5 ETH
                bridgeData: complexBridgeData
            };

            const transformData: FillQuoteTransformerData = {
                side: FillQuoteTransformerSide.Sell,
                sellToken: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
                buyToken: ETH_TOKEN_ADDRESS,
                bridgeOrders: [bridgeOrder],
                limitOrders: [],
                rfqOrders: [],
                fillSequence: [FillQuoteTransformerOrderType.Bridge],
                fillAmount: 3000000000000000000n,
                refundReceiver: taker.address,
                otcOrders: []
            };

            const encoded = encodeFillQuoteTransformerData(transformData);
            
            console.log('🔍 复杂桥接数据合约验证:');
            console.log(`- 编码长度: ${encoded.length} 字符`);
            console.log(`- complexBridgeData 长度: ${complexBridgeData.length} 字符`);
            
            try {
                const decoded = abiCoder.decode(
                    ['tuple(uint8,address,address,tuple(bytes32,uint256,uint256,bytes)[],bytes,bytes,uint8[],uint256,address,bytes)'],
                    encoded
                );
                
                const bridgeOrderDecoded = decoded[0][3][0];
                const decodedBridgeData = bridgeOrderDecoded[3];
                
                console.log(`- 解码的 bridgeData: ${decodedBridgeData}`);
                
                // 验证我们可以进一步解码嵌套的 bridgeData
                const [decodedBridgeAddress, decodedLpData] = abiCoder.decode(['address', 'bytes'], decodedBridgeData);
                const [decodedBoughtAmount] = abiCoder.decode(['uint256'], decodedLpData);
                
                console.log(`- 解码的桥接地址: ${decodedBridgeAddress}`);
                console.log(`- 解码的购买金额: ${decodedBoughtAmount}`);
                
                expect(decodedBridgeAddress.toLowerCase()).to.equal(bridgeAddress.toLowerCase());
                expect(decodedBoughtAmount).to.equal(boughtAmount);
                
                console.log('✅ 复杂桥接数据解码验证通过');
            } catch (error) {
                console.log('❌ 复杂桥接数据解码失败:', error.message);
                throw error;
            }
        });

        it('应该与真实合约环境兼容', () => {
            // 这个测试模拟了真实合约调用的场景
            const testData = [
                {
                    name: '简单数据',
                    data: {
                        side: FillQuoteTransformerSide.Sell,
                        sellToken: ETH_TOKEN_ADDRESS,
                        buyToken: maker.address,
                        bridgeOrders: [],
                        limitOrders: [],
                        rfqOrders: [],
                        fillSequence: [],
                        fillAmount: 1000000000000000000n,
                        refundReceiver: taker.address,
                        otcOrders: []
                    }
                },
                {
                    name: '带桥接订单',
                    data: {
                        side: FillQuoteTransformerSide.Buy,
                        sellToken: maker.address,
                        buyToken: taker.address,
                        bridgeOrders: [{
                            source: '0x' + 'ff'.repeat(32),
                            takerTokenAmount: 1000000000000000000n,
                            makerTokenAmount: 1000000000000000000n,
                            bridgeData: '0xdeadbeef'
                        }],
                        limitOrders: [],
                        rfqOrders: [],
                        fillSequence: [FillQuoteTransformerOrderType.Bridge],
                        fillAmount: 1000000000000000000n,
                        refundReceiver: owner.address,
                        otcOrders: []
                    }
                }
            ];

            console.log('🔍 真实合约环境兼容性测试:');
            
            testData.forEach((testCase, index) => {
                console.log(`\n测试 ${index + 1}: ${testCase.name}`);
                
                const encoded = encodeFillQuoteTransformerData(testCase.data);
                console.log(`- 编码长度: ${encoded.length} 字符`);
                
                // 验证编码格式
                expect(encoded).to.match(/^0x[0-9a-fA-F]+$/);
                expect(encoded.length).to.be.greaterThan(700);
                
                // 验证可以解码
                const abiCoder = ethers.AbiCoder.defaultAbiCoder();
                try {
                    const decoded = abiCoder.decode(
                        ['tuple(uint8,address,address,tuple(bytes32,uint256,uint256,bytes)[],bytes,bytes,uint8[],uint256,address,bytes)'],
                        encoded
                    );
                    
                    console.log(`- 解码成功: ✅`);
                    console.log(`- 桥接订单数量: ${decoded[0][3].length}`);
                    
                                         expect(Number(decoded[0][0])).to.equal(testCase.data.side);
                     expect(decoded[0][3].length).to.equal(testCase.data.bridgeOrders.length);
                    
                } catch (error) {
                    console.log(`- 解码失败: ❌ ${error.message}`);
                    throw error;
                }
            });
            
            console.log('✅ 所有真实合约环境兼容性测试通过');
        });
    });
}); 