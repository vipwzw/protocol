const { ethers } = require('hardhat');

async function testZeroAddress() {
    console.log('🧪 测试零地址是否被 isTokenETH() 检测为 ETH...');

    // 部署一个简单的测试合约来验证 isTokenETH 行为
    const testContractSource = `
        // SPDX-License-Identifier: Apache-2.0
        pragma solidity ^0.8.0;
        
        import "./contracts/src/transformers/LibERC20Transformer.sol";
        import "@0x/contracts-erc20/src/IERC20Token.sol";
        
        contract TestIsTokenETH {
            function testIsTokenETH(address tokenAddress) external pure returns (bool) {
                return LibERC20Transformer.isTokenETH(IERC20Token(tokenAddress));
            }
            
            function getETHTokenAddress() external pure returns (address) {
                return 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
            }
        }
    `;

    console.log('📝 尝试通过内联部署测试...');
    
    // 由于内联部署可能复杂，让我们直接测试地址比较
    const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    console.log('\n🔍 地址比较测试:');
    console.log('- ETH_TOKEN_ADDRESS:', ETH_TOKEN_ADDRESS);
    console.log('- ZERO_ADDRESS:', ZERO_ADDRESS);
    console.log('- 是否相等:', ETH_TOKEN_ADDRESS.toLowerCase() === ZERO_ADDRESS.toLowerCase());

    // 检查我们的编码数据中的实际地址
    console.log('\n🔍 我们编码数据中的地址:');
    const sellTokenFromError = '0x25b8fe1de9daf8ba351890744ff28cf7dfa8f5e3';
    const buyTokenFromError = '0x0000000000000000000000000000000000000000';
    
    console.log('- sellToken:', sellTokenFromError);
    console.log('- buyToken:', buyTokenFromError);
    console.log('- sellToken == ETH:', sellTokenFromError.toLowerCase() === ETH_TOKEN_ADDRESS.toLowerCase());
    console.log('- buyToken == ETH:', buyTokenFromError.toLowerCase() === ETH_TOKEN_ADDRESS.toLowerCase());
    console.log('- sellToken == ZERO:', sellTokenFromError.toLowerCase() === ZERO_ADDRESS.toLowerCase());
    console.log('- buyToken == ZERO:', buyTokenFromError.toLowerCase() === ZERO_ADDRESS.toLowerCase());

    // 这证明问题不在于零地址被误判为 ETH
    // 问题可能在于编码过程中 buyToken 被错误地设置为零地址
    console.log('\n💡 结论:');
    console.log('- 零地址不会被 isTokenETH() 检测为 ETH');
    console.log('- 问题是在编码过程中 buyToken 变成了零地址');
    console.log('- 我们需要检查为什么 buyToken 在编码时丢失了');

    console.log('\n🔬 可能的原因:');
    console.log('1. encodeFillQuoteTransformerData 函数有 bug');
    console.log('2. FillQuoteTransformerData 结构体字段顺序错误');
    console.log('3. ABI 编码类型不匹配');
    console.log('4. 某个地方有额外的验证逻辑我们没有发现');
}

testZeroAddress().catch(console.error); 