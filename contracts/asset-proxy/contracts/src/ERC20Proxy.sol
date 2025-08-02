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

import "./MixinAuthorizable.sol";



contract ERC20Proxy is
    MixinAuthorizable
{
    // Id of this proxy.
    bytes4 constant internal PROXY_ID = bytes4(keccak256("ERC20Token(address)"));

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

                // The `assetData` field is a dynamic array so we need to read the offset
                let assetDataOffset := add(calldataload(4), 4)
                let assetDataLength := calldataload(assetDataOffset)

                // Asset data must be at least 36 bytes (4 bytes for proxy ID + 32 bytes for token address)
                if lt(assetDataLength, 36) {
                    // Revert with `Error("INVALID_ASSET_DATA_LENGTH")`
                    mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                    mstore(32, 0x0000002000000000000000000000000000000000000000000000000000000000)
                    mstore(64, 0x0000001a494e56414c49445f41535345545f444154415f4c454e475448000000)
                    mstore(96, 0)
                    revert(0, 100)
                }

                // Check that first 4 bytes of asset data match the proxy ID
                let assetProxyId := and(calldataload(add(assetDataOffset, 32)), 0xffffffff00000000000000000000000000000000000000000000000000000000)
                if iszero(eq(assetProxyId, 0xf47261b000000000000000000000000000000000000000000000000000000000)) {
                    // Revert with `Error("ASSET_PROXY_MISMATCH")`
                    mstore(0, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                    mstore(32, 0x0000002000000000000000000000000000000000000000000000000000000000)
                    mstore(64, 0x000000144153534554205f50524f58595f4d49534d41544348000000000000000)
                    mstore(96, 0)
                    revert(0, 100)
                }

                // Get the token address from the asset data (offset by 4 bytes for proxy ID)
                let token := calldataload(add(assetDataOffset, 36))

                // Get from, to, and amount from calldata
                let from := calldataload(36)
                let to := calldataload(68)
                let amount := calldataload(100)

                // Setup the call to the token's transferFrom function
                let ptr := mload(0x40)
                mstore(ptr, 0x23b872dd00000000000000000000000000000000000000000000000000000000)
                mstore(add(ptr, 4), from)
                mstore(add(ptr, 36), to)
                mstore(add(ptr, 68), amount)

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

                // Return success
                return(0, 0)
            }

            // `getProxyId` will be called with the following parameters:
            // bytes4(keccak256("getProxyId()")) = 0xae25532e
            if eq(selector, 0xae25532e00000000000000000000000000000000000000000000000000000000) {
                mstore(0, 0xf47261b000000000000000000000000000000000000000000000000000000000)
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
}