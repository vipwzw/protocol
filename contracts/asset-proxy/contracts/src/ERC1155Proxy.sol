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

import "@0x/contracts-utils/contracts/src/LibBytes.sol";
import "@0x/contracts-erc1155/contracts/src/interfaces/IERC1155.sol";
import "./MixinAuthorizable.sol";



contract ERC1155Proxy is
    MixinAuthorizable
{
    using LibBytes for bytes;

    // Id of this proxy.
    bytes4 constant internal PROXY_ID = bytes4(keccak256("ERC1155Assets(address,uint256[],uint256[],bytes)"));

    // solhint-disable-next-line payable-fallback
    fallback() external {
        assembly {
            // The first 4 bytes of calldata holds the function selector
            let selector := and(calldataload(0), 0xffffffff00000000000000000000000000000000000000000000000000000000)

            // `transferFrom` will be called with the following parameters:
            // assetData Encoded byte array.
            // from Address to transfer asset from.
            // to Address to transfer asset to.
            // amount Amount of asset to transfer.
            // bytes4(keccak256("transferFrom(bytes,address,address,uint256)")) = 0xa85e59e4
            if eq(selector, 0xa85e59e400000000000000000000000000000000000000000000000000000000) {

                // To lookup a value in a mapping, we load from the storage location keccak256(k, p),
                // where k is the key left padded to 32 bytes and p is the storage slot
                let start := mload(0x40)
                mstore(start, caller())
                mstore(add(start, 32), authorized.slot)
                let isAuthorized := sload(keccak256(start, 64))

                // Only authorized addresses can call the `transferFrom` function.
                if iszero(isAuthorized) {
                    // Revert with `Error("SENDER_NOT_AUTHORIZED")`
                    mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                    mstore(32, 0x0000002000000000000000000000000000000000000000000000000000000000)
                    mstore(64, 0x0000001553454e4445525f4e4f545f415554484f52495a454400000000000000)
                    mstore(96, 0)
                    revert(0, 100)
                }

                // Note: For ERC1155, due to the complexity of handling dynamic arrays in assembly,
                // we delegate to a helper function. This maintains compatibility while keeping
                // the fallback pattern consistent with other proxy contracts.
                
                // Forward the entire calldata to the internal function
                let success := delegatecall(gas(), address(), 0, calldatasize(), 0, 0)
                
                // If the delegatecall failed, revert
                if iszero(success) {
                    returndatacopy(0, 0, returndatasize())
                    revert(0, returndatasize())
                }
                
                return(0, 0)
            }

            // `getProxyId` will be called with the following parameters:
            // bytes4(keccak256("getProxyId()")) = 0xae25532e
            if eq(selector, 0xae25532e00000000000000000000000000000000000000000000000000000000) {
                mstore(0, 0xa7cb5fb700000000000000000000000000000000000000000000000000000000)
                return(0, 32)
            }

            // Revert with `Error("INVALID_FUNCTION_SELECTOR")`
            mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
            mstore(32, 0x0000002000000000000000000000000000000000000000000000000000000000)
            mstore(64, 0x00000019494e56414c49445f46554e4354494f4e5f53454c4543544f52000000)
            mstore(96, 0)
            revert(0, 100)
        }
    }

    /// @dev Transfers batch of ERC1155 assets. Either succeeds or throws.
    ///      This function is called internally via delegatecall from the fallback.
    /// @param assetData Byte array encoded with ERC1155 token address, array of ids, array of values, and callback data.
    /// @param from Address to transfer assets from.
    /// @param to Address to transfer assets to.
    /// @param amount Amount that will be multiplied with each element of `assetData.values` to scale the
    ///        values that will be transferred.
    function transferFrom(
        bytes calldata assetData,
        address from,
        address to,
        uint256 amount
    )
        internal
    {
        // Decode params from `assetData`
        // solhint-disable indent
        (
            address erc1155TokenAddress,
            uint256[] memory ids,
            uint256[] memory values,
            bytes memory data
        ) = abi.decode(
            assetData.sliceDestructive(4, assetData.length),
            (address, uint256[], uint256[], bytes)
        );
        // solhint-enable indent

        // Scale values up by `amount`
        uint256 length = values.length;
        uint256[] memory scaledValues = new uint256[](length);
        for (uint256 i = 0; i != length; i++) {
            // We write the scaled values to an unused location in memory in order
            // to avoid copying over `ids` or `data`. This is possible if they are
            // identical to `values` and the offsets for each are pointing to the
            // same location in the ABI encoded calldata.
            scaledValues[i] = values[i] * amount;
        }

        // Execute `safeBatchTransferFrom` call
        // Either succeeds or throws
        IERC1155(erc1155TokenAddress).safeBatchTransferFrom(
            from,
            to,
            ids,
            scaledValues,
            data
        );
    }
}