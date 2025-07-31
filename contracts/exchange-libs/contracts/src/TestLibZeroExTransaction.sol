// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.28;

import "./LibZeroExTransaction.sol";

contract TestLibZeroExTransaction {
    function getTypedDataHash(
        LibZeroExTransaction.ZeroExTransaction memory transaction,
        bytes32 eip712ExchangeDomainHash
    ) public pure returns (bytes32) {
        return LibZeroExTransaction.getTypedDataHash(transaction, eip712ExchangeDomainHash);
    }

    function getStructHash(
        LibZeroExTransaction.ZeroExTransaction memory transaction
    ) public pure returns (bytes32) {
        return LibZeroExTransaction.getStructHash(transaction);
    }
}