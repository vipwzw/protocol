// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.28;

import "./LibEIP712ExchangeDomain.sol";

contract TestLibEIP712ExchangeDomain is LibEIP712ExchangeDomain {
    constructor(
        uint256 chainId,
        address verifyingContractAddressIfExists
    ) LibEIP712ExchangeDomain(chainId, verifyingContractAddressIfExists) {}

    function getDomainHash() public view returns (bytes32) {
        return EIP712_EXCHANGE_DOMAIN_HASH;
    }
}