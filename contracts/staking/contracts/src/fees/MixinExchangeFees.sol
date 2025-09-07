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

import "@0x/contracts-exchange-libs/contracts/src/LibMath.sol";
import "@0x/contracts-utils/contracts/src/errors/LibRichErrors.sol";
// LibSafeMath removed in Solidity 0.8.28 - using built-in overflow checks
import "../libs/LibStakingRichErrors.sol";
import "../interfaces/IStructs.sol";
import "../sys/MixinFinalizer.sol";
import "../staking_pools/MixinStakingPool.sol";
import "./MixinExchangeManager.sol";


contract MixinExchangeFees is
    MixinExchangeManager,
    MixinStakingPool,
    MixinFinalizer
{
    // // using LibSafeMath for uint256; // Removed in Solidity 0.8.28 // Removed in Solidity 0.8.28

    /// @dev Pays a protocol fee in ETH or WETH.
    ///      Only a known 0x exchange can call this method. See
    ///      (MixinExchangeManager).
    /// @param makerAddress The address of the order's maker.
    /// @param payerAddress The address of the protocol fee payer.
    /// @param protocolFee The protocol fee amount. This is either passed as ETH or transferred as WETH.
    function payProtocolFee(
        address makerAddress,
        address payerAddress,
        uint256 protocolFee
    )
        external
        payable
        onlyExchange
        virtual
    {
        _assertValidProtocolFee(protocolFee);

        if (protocolFee == 0) {
            return;
        }

        // Transfer the protocol fee to this address if it should be paid in
        // WETH.
        if (msg.value == 0) {
            require(
                _getWethContract().transferFrom(
                    payerAddress,
                    address(this),
                    protocolFee
                ),
                "WETH_TRANSFER_FAILED"
            );
        }

        // Get the pool id of the maker address.
        bytes32 poolId = poolIdByMaker[makerAddress];

        // Only attribute the protocol fee payment to a pool if the maker is
        // registered to a pool.
        if (poolId == NIL_POOL_ID) {
            return;
        }

        uint256 poolStake = this.getTotalStakeDelegatedToPool(poolId).currentEpochBalance;
        // Ignore pools with dust stake.
        if (poolStake < minimumPoolStake) {
            return;
        }

        // Look up the pool stats and aggregated stats for this epoch.
        uint256 currentEpoch_ = currentEpoch;
        IStructs.PoolStats storage poolStatsPtr = poolStatsByEpoch[poolId][currentEpoch_];
        IStructs.AggregatedStats storage aggregatedStatsPtr = aggregatedStatsByEpoch[currentEpoch_];

        // Perform some initialization if this is the pool's first protocol fee in this epoch.
        uint256 feesCollectedByPool = poolStatsPtr.feesCollected;
        if (feesCollectedByPool == 0) {
            // Compute member and total weighted stake.
            (uint256 membersStakeInPool, uint256 weightedStakeInPool) = _computeMembersAndWeightedStake(poolId, poolStake);
            poolStatsPtr.membersStake = membersStakeInPool;
            poolStatsPtr.weightedStake = weightedStakeInPool;

            // Increase the total weighted stake.
            aggregatedStatsPtr.totalWeightedStake = aggregatedStatsPtr.totalWeightedStake + weightedStakeInPool;

            // Increase the number of pools to finalize.
            aggregatedStatsPtr.numPoolsToFinalize = aggregatedStatsPtr.numPoolsToFinalize + 1;

            // Emit an event so keepers know what pools earned rewards this epoch.
            emit StakingPoolEarnedRewardsInEpoch(currentEpoch_, poolId);
        }

        // Credit the fees to the pool.
        poolStatsPtr.feesCollected = feesCollectedByPool + protocolFee;

        // Increase the total fees collected this epoch.
        aggregatedStatsPtr.totalFeesCollected = aggregatedStatsPtr.totalFeesCollected + protocolFee;
    }

    /// @dev Get stats on a staking pool in this epoch.
    /// @param poolId Pool Id to query.
    /// @return PoolStats struct for pool id.
    function getStakingPoolStatsThisEpoch(bytes32 poolId)
        external
        view
        virtual
        returns (IStructs.PoolStats memory)
    {
        return poolStatsByEpoch[poolId][currentEpoch];
    }

    /// @dev Computes the members and weighted stake for a pool at the current
    ///      epoch.
    /// @param poolId ID of the pool.
    /// @param totalStake Total (unweighted) stake in the pool.
    /// @return membersStake Non-operator stake in the pool.
    /// @return weightedStake Weighted stake of the pool.
    function _computeMembersAndWeightedStake(
        bytes32 poolId,
        uint256 totalStake
    )
        private
        view
        returns (uint256 membersStake, uint256 weightedStake)
    {
        uint256 operatorStake = this.getStakeDelegatedToPoolByOwner(
            _poolById[poolId].operator,
            poolId
        ).currentEpochBalance;

        membersStake = totalStake - operatorStake;
        weightedStake = operatorStake + 
            LibMath.getPartialAmountFloor(
                rewardDelegatedStakeWeight,
                PPM_DENOMINATOR,
                membersStake
            );
        return (membersStake, weightedStake);
    }

    /// @dev Checks that the protocol fee passed into `payProtocolFee()` is
    ///      valid.
    /// @param protocolFee The `protocolFee` parameter to
    ///        `payProtocolFee.`
    function _assertValidProtocolFee(uint256 protocolFee)
        private
        view
    {
        // The protocol fee must equal the value passed to the contract; unless
        // the value is zero, in which case the fee is taken in WETH.
        if (msg.value != protocolFee && msg.value != 0) {
            LibRichErrors.rrevert(
                LibStakingRichErrors.InvalidProtocolFeePaymentError(
                    protocolFee,
                    msg.value
                )
            );
        }
    }
}
