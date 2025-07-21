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

pragma solidity 0.8.30;

import "@0x/contracts-erc20/src/LibERC20Token.sol";
import "@0x/contracts-erc20/src/IERC20Token.sol";
import "@0x/contracts-utils/contracts/src/errors/LibRichErrors.sol";

contract MixinBarter {
    using LibERC20Token for IERC20Token;
    using LibRichErrors for bytes;

    function _tradeBarter(
        IERC20Token sellToken,
        uint256 sellAmount,
        bytes memory bridgeData
    ) internal returns (uint256 boughtAmount) {
        (address barterRouter, bytes memory data) = abi.decode(bridgeData, (address, bytes));
        sellToken.approveIfBelow(barterRouter, sellAmount);

        (bool success, bytes memory resultData) = barterRouter.call(data);
        if (!success) {
            resultData.rrevert();
        }

        return abi.decode(resultData, (uint256));
    }
}
