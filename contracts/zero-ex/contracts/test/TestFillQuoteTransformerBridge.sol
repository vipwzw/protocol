// SPDX-License-Identifier: Apache-2.0
/*
  Copyright 2023 ZeroEx Intl.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

pragma solidity ^0.8.0;

import "@0x/contracts-utils/contracts/src/LibMath.sol";
import "../src/vendor/v3/IERC20Bridge.sol";
import "./tokens/TestMintableERC20Token.sol";

contract TestFillQuoteTransformerBridge {
    uint256 private constant REVERT_AMOUNT = 0xdeadbeef;
    
    event DebugBridgeCall(address takerToken, address makerToken, address recipient, uint256 boughtAmount);

    function sellTokenForToken(
        address takerToken,
        address makerToken,
        address recipient,
        uint256 /* minBuyAmount */,
        bytes calldata auxiliaryData
    ) external returns (uint256 boughtAmount) {
        boughtAmount = abi.decode(auxiliaryData, (uint256));
        
        if (REVERT_AMOUNT == boughtAmount) {
            revert("REVERT_AMOUNT");
        }
        
        // 🔍 调试：记录函数被调用
        emit DebugBridgeCall(takerToken, makerToken, recipient, boughtAmount);
        
        // Get the current balance of taker token to determine how much was sent
        uint256 takerTokenBalance = TestMintableERC20Token(takerToken).balanceOf(address(this));
        
        // 🎯 关键修复：消费收到的 taker tokens，模拟真实 bridge 行为
        if (takerTokenBalance > 0) {
            TestMintableERC20Token(takerToken).burn(address(this), takerTokenBalance);
        }
        
        // Mint the maker tokens to the recipient
        TestMintableERC20Token(makerToken).mint(recipient, boughtAmount);
    }
}
