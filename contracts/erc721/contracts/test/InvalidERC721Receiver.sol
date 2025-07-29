/*

  Copyright 2019 ZeroEx Intl.

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

pragma solidity ^0.8.28;

import "../src/interfaces/IERC721Receiver.sol";


contract InvalidERC721Receiver is
    IERC721Receiver
{

    // Invalid function selector for ERC721Receiver.onERC721Received
    // 0x00000000
    bytes4 constant internal ERC721_RECEIVED = bytes4(0);

    /// @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
    /// by `operator` from `from`, this function is called.
    ///
    /// It must return its Solidity selector to confirm the token transfer.
    /// If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
    ///
    /// The selector can be obtained in Solidity with `IERC721.onERC721Received.selector`.
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    )
        external
        pure
        override
        returns (bytes4)
    {
        return ERC721_RECEIVED;
    }
}
