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

import "@0x/contracts-erc20/contracts/src/LibERC20Token.sol";
import "@0x/contracts-erc20/contracts/src/interfaces/IERC20Token.sol";
import "../../../vendor/ILiquidityProvider.sol";

contract MixinZeroExBridge {
    using LibERC20Token for IERC20Token;

    function _tradeZeroExBridge(
        IERC20Token sellToken,
        IERC20Token buyToken,
        uint256 sellAmount,
        bytes memory bridgeData
    ) internal returns (uint256 boughtAmount) {
        (ILiquidityProvider provider, bytes memory lpData) = abi.decode(bridgeData, (ILiquidityProvider, bytes));
        // Trade the good old fashioned way
        sellToken.transfer(address(provider), sellAmount);
        boughtAmount = provider.sellTokenForToken(
            sellToken,
            buyToken,
            address(this), // recipient
            1, // minBuyAmount
            lpData
        );
    }
}
