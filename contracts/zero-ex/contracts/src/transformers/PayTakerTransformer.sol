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

import "@0x/contracts-utils/contracts/src/errors/LibRichErrors.sol";
import "@0x/contracts-erc20/src/IERC20Token.sol";
import "@0x/contracts-erc20/src/LibERC20Token.sol";
import "../errors/LibTransformERC20RichErrors.sol";
import "./Transformer.sol";
import "./LibERC20Transformer.sol";

/// @dev A transformer that transfers tokens to the taker.
contract PayTakerTransformer is Transformer {
    using LibRichErrors for bytes;
    using LibERC20Transformer for IERC20Token;

    /// @dev Transform data to ABI-encode and pass into `transform()`.
    struct TransformData {
        // The tokens to transfer to the taker.
        IERC20Token[] tokens;
        // Amount of each token in `tokens` to transfer to the taker.
        // `uint(-1)` will transfer the entire balance.
        uint256[] amounts;
    }

    /// @dev Maximum uint256 value.
    uint256 private constant MAX_UINT256 = type(uint256).max;

    /// @dev Create this contract.
    constructor() public Transformer() {}

    /// @dev Forwards tokens to the taker.
    /// @param context Context information.
    /// @return success The success bytes (`LibERC20Transformer.TRANSFORMER_SUCCESS`).
    function transform(TransformContext calldata context) external override returns (bytes4 success) {
        TransformData memory data = abi.decode(context.data, (TransformData));

        // Transfer tokens directly to the taker.
        for (uint256 i = 0; i < data.tokens.length; ++i) {
            // The `amounts` array can be shorter than the `tokens` array.
            // Missing elements are treated as `uint256(-1)`.
            uint256 amount = data.amounts.length > i ? data.amounts[i] : type(uint256).max;
            if (amount == MAX_UINT256) {
                amount = data.tokens[i].getTokenBalanceOf(address(this));
            }
            if (amount != 0) {
                data.tokens[i].unsafeTransformerTransfer(context.recipient, amount);
            }
        }
        return LibERC20Transformer.TRANSFORMER_SUCCESS;
    }
}
