// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../../src/migrations/LibMigrate.sol";
import "../../src/fixins/FixinCommon.sol";
import "../../src/features/interfaces/IFeature.sol";
import "../../src/features/interfaces/IOtcOrdersFeature.sol";

/// @dev A lightweight OtcOrders feature that only registers function selectors.
contract TestOtcOrdersFeatureLite is IFeature, FixinCommon {
    string public constant override FEATURE_NAME = "OtcOrders";
    uint256 public immutable override FEATURE_VERSION = _encodeVersion(1, 0, 0);

    /// @dev Initialize and register this feature. Delegatecalled by Ownable.migrate().
    function migrate() external returns (bytes4 success) {
        _registerFeatureFunction(IOtcOrdersFeature.fillOtcOrder.selector);
        _registerFeatureFunction(IOtcOrdersFeature.fillOtcOrderForEth.selector);
        _registerFeatureFunction(IOtcOrdersFeature.fillOtcOrderWithEth.selector);
        _registerFeatureFunction(IOtcOrdersFeature.fillTakerSignedOtcOrderForEth.selector);
        _registerFeatureFunction(IOtcOrdersFeature.fillTakerSignedOtcOrder.selector);
        _registerFeatureFunction(IOtcOrdersFeature.batchFillTakerSignedOtcOrders.selector);
        _registerFeatureFunction(IOtcOrdersFeature._fillOtcOrder.selector);
        _registerFeatureFunction(IOtcOrdersFeature.getOtcOrderInfo.selector);
        _registerFeatureFunction(IOtcOrdersFeature.getOtcOrderHash.selector);
        _registerFeatureFunction(IOtcOrdersFeature.lastOtcTxOriginNonce.selector);
        return LibMigrate.MIGRATE_SUCCESS;
    }
}


