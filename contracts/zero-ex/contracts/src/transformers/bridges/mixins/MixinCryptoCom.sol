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
import "./MixinUniswapV2.sol";
import "../../../vendor/IUniswapV2Router02.sol";

contract MixinCryptoCom {
    using LibERC20Token for IERC20Token;

    function _tradeCryptoCom(
        IERC20Token buyToken,
        uint256 sellAmount,
        bytes memory bridgeData
    ) internal returns (uint256 boughtAmount) {
        IUniswapV2Router02 router;
        address[] memory path;
        (router, path) = abi.decode(bridgeData, (IUniswapV2Router02, address[]));

        require(path.length >= 2, "MixinCryptoCom/PATH_LENGTH_MUST_BE_AT_LEAST_TWO");
        require(path[path.length - 1] == address(buyToken), "MixinCryptoCom/LAST_ELEMENT_OF_PATH_MUST_MATCH_OUTPUT_TOKEN");
        // Grant the CryptoCom router an allowance to sell the first token.
        IERC20Token(path[0]).approve(address(router), sellAmount);

        uint256[] memory amounts = router.swapExactTokensForTokens(
            // Sell all tokens we hold.
            sellAmount,
            // Minimum buy amount.
            1,
            // Convert to `buyToken` along this path.
            path,
            // Recipient is `this`.
            address(this),
            // Expires after this block.
            block.timestamp
        );
        return amounts[amounts.length - 1];
    }
}
