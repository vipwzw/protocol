// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.28;

import "../src/LibFillResults.sol";
import "../src/LibOrder.sol";

contract TestLibFillResults {
    using LibFillResults for LibFillResults.FillResults;

    function addFillResults(
        LibFillResults.FillResults memory a,
        LibFillResults.FillResults memory b
    ) public pure returns (LibFillResults.FillResults memory) {
        return LibFillResults.addFillResults(a, b);
    }

    function calculateFillResults(
        LibOrder.Order memory order,
        uint256 takerAssetFilledAmount,
        uint256 protocolFeeMultiplier,
        uint256 gasPrice
    ) public pure returns (LibFillResults.FillResults memory) {
        return LibFillResults.calculateFillResults(
            order,
            takerAssetFilledAmount,
            protocolFeeMultiplier,
            gasPrice
        );
    }
}