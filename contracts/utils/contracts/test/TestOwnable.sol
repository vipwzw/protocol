// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../src/Ownable.sol";

contract TestOwnable is Ownable {
    function externalOnlyOwner() external view onlyOwner returns (bool) {
        return true;
    }
}
