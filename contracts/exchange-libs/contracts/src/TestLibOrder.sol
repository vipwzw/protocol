// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.28;

import "./LibOrder.sol";

contract TestLibOrder {
    function getTypedDataHash(
        LibOrder.Order memory order,
        bytes32 eip712ExchangeDomainHash
    ) public pure returns (bytes32) {
        return LibOrder.getTypedDataHash(order, eip712ExchangeDomainHash);
    }

    function getStructHash(
        LibOrder.Order memory order
    ) public pure returns (bytes32) {
        return LibOrder.getStructHash(order);
    }
}