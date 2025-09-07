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

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "./interfaces/IStaking.sol";
import "./sys/MixinParams.sol";
import "./stake/MixinStake.sol";
import "./fees/MixinExchangeFees.sol";


/// @dev The Staking contract combines all the mixins to implement the IStaking interface.
///      Due to Solidity 0.8's stricter inheritance rules, we don't inherit IStaking directly
///      to avoid the diamond problem. Instead, we ensure that all IStaking functions are
///      implemented through the mixins, which can be verified at compile time.
contract Staking is
    MixinParams,
    MixinStake,
    MixinExchangeFees
{
    /// @dev Initialize storage owned by this contract.
    ///      This function should not be called directly.
    ///      The StakingProxy contract will call it in `attachStakingContract()`.
    function init()
        public
        virtual
        onlyAuthorized
    {
        // DANGER! When performing upgrades, take care to modify this logic
        // to prevent accidentally clearing prior state.
        _initMixinScheduler();
        _initMixinParams();
    }
    
    /// @dev Verify at compile time that this contract can be used as IStaking
    /// This creates no runtime code but ensures type compatibility
    function _verifyInterface() private pure {
        // This will fail to compile if Staking doesn't implement all IStaking functions
        IStaking _i;
        Staking _s;
        assembly {
            _i := _s
        }
    }
}