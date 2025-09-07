// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.28;

import "./LibMath.sol";

contract TestLibMath {
    function safeGetPartialAmountFloor(
        uint256 numerator,
        uint256 denominator,
        uint256 target
    ) public pure returns (uint256) {
        return LibMath.safeGetPartialAmountFloor(numerator, denominator, target);
    }

    function safeGetPartialAmountCeil(
        uint256 numerator,
        uint256 denominator,
        uint256 target
    ) public pure returns (uint256) {
        return LibMath.safeGetPartialAmountCeil(numerator, denominator, target);
    }

    function getPartialAmountFloor(
        uint256 numerator,
        uint256 denominator,
        uint256 target
    ) public pure returns (uint256) {
        return LibMath.getPartialAmountFloor(numerator, denominator, target);
    }

    function getPartialAmountCeil(
        uint256 numerator,
        uint256 denominator,
        uint256 target
    ) public pure returns (uint256) {
        return LibMath.getPartialAmountCeil(numerator, denominator, target);
    }

    function isRoundingErrorFloor(
        uint256 numerator,
        uint256 denominator,
        uint256 target
    ) public pure returns (bool) {
        return LibMath.isRoundingErrorFloor(numerator, denominator, target);
    }

    function isRoundingErrorCeil(
        uint256 numerator,
        uint256 denominator,
        uint256 target
    ) public pure returns (bool) {
        return LibMath.isRoundingErrorCeil(numerator, denominator, target);
    }
}