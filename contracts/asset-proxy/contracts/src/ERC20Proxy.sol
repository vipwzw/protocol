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

pragma solidity ^0.8.0;

import "@0x/contracts-utils/contracts/src/Authorizable.sol";
import "./interfaces/IAssetProxy.sol";


contract ERC20Proxy is
    IAssetProxy,
    Authorizable
{
    // Id of this proxy.
    bytes4 constant internal PROXY_ID = bytes4(keccak256("ERC20Token(address)"));

    /// @dev Transfers `amount` of an ERC20 `tokenAddress` from `from` to `to`.
    /// @param assetData Byte array encoded with `tokenAddress`.
    /// @param from Address to transfer asset from.
    /// @param to Address to transfer asset to.
    /// @param amount Amount of asset to transfer.
    function transferFrom(
        bytes calldata assetData,
        address from,
        address to,
        uint256 amount
    )
        external
        override
        onlyAuthorized
    {
        // Decode the asset data to get the token address
        bytes4 proxyId = getAssetProxyId(assetData);
        require(
            proxyId == PROXY_ID,
            "ASSET_PROXY_MISMATCH"
        );
        
        // Extract token address from asset data
        address tokenAddress = decodeERC20AssetData(assetData);
        
        // Transfer tokens using the existing fallback logic
        assembly {
            // Check that the asset data contains only a token address (36 bytes)
            if iszero(eq(calldatasize(), 164)) {
                // Revert with `Error("INVALID_ASSET_DATA_LENGTH")`
                mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                mstore(32, 0x0000002000000000000000000000000000000000000000000000000000000000)
                mstore(64, 0x0000001a494e56414c49445f41535345545f444154415f4c454e475448000000)
                mstore(96, 0)
                revert(0, 100)
            }

            // Get the token address from the asset data
            let token := calldataload(132)

            // Get the call data for a transferFrom call
            let ptr := mload(0x40)
            mstore(ptr, 0x23b872dd00000000000000000000000000000000000000000000000000000000)
            calldatacopy(add(ptr, 4), 36, 96)

            // Call the token contract
            let success := call(
                gas(),          // Forward all gas
                token,          // Call the token contract
                0,              // Don't send any ETH
                ptr,            // Input data
                100,            // Input size
                0,              // Don't copy output
                0               // Don't copy output
            )

            // Check that the call was successful
            if iszero(success) {
                // Revert with `Error("TRANSFER_FAILED")`
                mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                mstore(32, 0x0000002000000000000000000000000000000000000000000000000000000000)
                mstore(64, 0x0000000f5452414e534645525f4641494c4544000000000000000000000000000)
                mstore(96, 0)
                revert(0, 100)
            }

            // Check the return value of the transferFrom call
            if returndatasize() {
                // Copy the return data
                returndatacopy(0, 0, returndatasize())
                
                // Check that the return data is a boolean true
                if iszero(eq(mload(0), 1)) {
                    // Revert with `Error("TRANSFER_FAILED")`
                    mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                    mstore(32, 0x0000002000000000000000000000000000000000000000000000000000000000)
                    mstore(64, 0x0000000f5452414e534645525f4641494c4544000000000000000000000000000)
                    mstore(96, 0)
                    revert(0, 100)
                }
            }
        }
    }

    /// @dev Gets the asset proxy id associated with this proxy.
    /// @return proxyId Proxy id.
    function getAssetProxyId(bytes memory assetData)
        internal
        pure
        returns (bytes4 proxyId)
    {
        require(
            assetData.length >= 4,
            "INVALID_ASSET_DATA_LENGTH"
        );
        assembly {
            proxyId := and(mload(add(assetData, 32)), 0xFFFFFFFF00000000000000000000000000000000000000000000000000000000)
        }
    }

    /// @dev Decodes ERC20 asset data.
    /// @param assetData Encoded asset data.
    /// @return tokenAddress The token address.
    function decodeERC20AssetData(bytes memory assetData)
        internal
        pure
        returns (address tokenAddress)
    {
        require(
            assetData.length == 36,
            "INVALID_ASSET_DATA_LENGTH"
        );
        assembly {
            tokenAddress := mload(add(assetData, 36))
        }
    }

    /// @dev Gets the proxy id associated with the proxy address.
    /// @return Proxy id.
    function getProxyId()
        external
        pure
        override
        returns (bytes4)
    {
        return PROXY_ID;
    }
}
