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

library LibEIP712 {

    // EIP712 domain type hash
    bytes32 private constant _EIP712_DOMAIN_TYPEHASH = keccak256(abi.encodePacked(
        "EIP712Domain(",
        "string name,",
        "string version,",
        "uint256 chainId,",
        "address verifyingContract",
        ")"
    ));

    /// @dev Calculates the EIP712 hash of a domain.
    /// @param name Domain name.
    /// @param version Domain version.
    /// @param chainId Chain ID.
    /// @param verifyingContract Address of verifying contract.
    /// @return EIP712 domain hash.
    function hashEIP712Domain(
        string memory name,
        string memory version,
        uint256 chainId,
        address verifyingContract
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(
            _EIP712_DOMAIN_TYPEHASH,
            keccak256(bytes(name)),
            keccak256(bytes(version)),
            chainId,
            verifyingContract
        ));
    }

    /// @dev Calculates the EIP712 hash of a struct.
    /// @param structHash Keccak256 hash of the struct.
    /// @param domainHash EIP712 domain hash.
    /// @return EIP712 hash.
    function hashEIP712Message(bytes32 structHash, bytes32 domainHash)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(
            hex"1901",
            domainHash,
            structHash
        ));
    }
} 