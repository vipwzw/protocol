// SPDX-License-Identifier: Apache-2.0
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
// pragma experimental ABIEncoderV2; // Not needed in Solidity 0.8+

import "./Staking.sol";

contract StakingPatch is Staking {
    /// @dev Initialize storage owned by this contract.
    ///      This function should not be called directly.
    ///      The StakingProxy contract will call it in `attachStakingContract()`.
    ///      This is a patched version that fixes corrupted state.
    function init()
        public
        virtual
        override
        onlyAuthorized
    {
        uint256 currentEpoch_ = currentEpoch;
        uint256 prevEpoch = currentEpoch_ - 1; // safeSub removed in 0.8+

        // Patch corrupted state
        aggregatedStatsByEpoch[prevEpoch].numPoolsToFinalize = 0;
        this.endEpoch();

        uint256 lastPoolId_ = 57;
        for (uint256 i = 1; i <= lastPoolId_; i++) {
            this.finalizePool(bytes32(i));
        }
        // Ensure that current epoch's state is not corrupted
        aggregatedStatsByEpoch[currentEpoch_].numPoolsToFinalize = 0;
    }
}
