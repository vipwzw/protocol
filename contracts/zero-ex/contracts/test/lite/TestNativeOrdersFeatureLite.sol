// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../../src/migrations/LibMigrate.sol";
import "../../src/fixins/FixinCommon.sol";
import "../../src/features/interfaces/IFeature.sol";
import "../../src/features/interfaces/INativeOrdersFeature.sol";

/// @dev A lightweight NativeOrders feature that only registers function selectors.
contract TestNativeOrdersFeatureLite is IFeature, FixinCommon {
    string public constant override FEATURE_NAME = "LimitOrders";
    uint256 public immutable override FEATURE_VERSION = _encodeVersion(1, 3, 0);

    /// @dev Initialize and register this feature. Delegatecalled by Ownable.migrate().
    function migrate() external returns (bytes4 success) {
        _registerFeatureFunction(INativeOrdersFeature.transferProtocolFeesForPools.selector);
        _registerFeatureFunction(INativeOrdersFeature.fillLimitOrder.selector);
        _registerFeatureFunction(INativeOrdersFeature.fillRfqOrder.selector);
        _registerFeatureFunction(INativeOrdersFeature.fillOrKillLimitOrder.selector);
        _registerFeatureFunction(INativeOrdersFeature.fillOrKillRfqOrder.selector);
        _registerFeatureFunction(INativeOrdersFeature._fillLimitOrder.selector);
        _registerFeatureFunction(INativeOrdersFeature._fillRfqOrder.selector);
        _registerFeatureFunction(INativeOrdersFeature.cancelLimitOrder.selector);
        _registerFeatureFunction(INativeOrdersFeature.cancelRfqOrder.selector);
        _registerFeatureFunction(INativeOrdersFeature.batchCancelLimitOrders.selector);
        _registerFeatureFunction(INativeOrdersFeature.batchCancelRfqOrders.selector);
        _registerFeatureFunction(INativeOrdersFeature.cancelPairLimitOrders.selector);
        _registerFeatureFunction(INativeOrdersFeature.batchCancelPairLimitOrders.selector);
        _registerFeatureFunction(INativeOrdersFeature.cancelPairRfqOrders.selector);
        _registerFeatureFunction(INativeOrdersFeature.batchCancelPairRfqOrders.selector);
        _registerFeatureFunction(INativeOrdersFeature.getLimitOrderInfo.selector);
        _registerFeatureFunction(INativeOrdersFeature.getRfqOrderInfo.selector);
        _registerFeatureFunction(INativeOrdersFeature.getLimitOrderHash.selector);
        _registerFeatureFunction(INativeOrdersFeature.getRfqOrderHash.selector);
        _registerFeatureFunction(INativeOrdersFeature.getProtocolFeeMultiplier.selector);
        _registerFeatureFunction(INativeOrdersFeature.registerAllowedRfqOrigins.selector);
        _registerFeatureFunction(INativeOrdersFeature.getLimitOrderRelevantState.selector);
        _registerFeatureFunction(INativeOrdersFeature.getRfqOrderRelevantState.selector);
        _registerFeatureFunction(INativeOrdersFeature.batchGetLimitOrderRelevantStates.selector);
        _registerFeatureFunction(INativeOrdersFeature.batchGetRfqOrderRelevantStates.selector);
        return LibMigrate.MIGRATE_SUCCESS;
    }
}


