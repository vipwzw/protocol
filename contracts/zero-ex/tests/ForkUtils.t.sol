// SPDX-License-Identifier: Apache-2.0
/*
  Copyright 2023 ZeroEx Intl.
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

pragma solidity ^0.8.0;
import "./utils/ForkUtils.sol";
import "./utils/TestUtils.sol";
import "contracts/src/IZeroEx.sol";
import "@0x/contracts-erc20/contracts/src/interfaces/IEtherToken.sol";
import "contracts/src/features/TransformERC20Feature.sol";
import "contracts/src/external/TransformerDeployer.sol";
import "contracts/src/transformers/WethTransformer.sol";
import "contracts/src/transformers/FillQuoteTransformer.sol";
import "contracts/src/transformers/bridges/BridgeProtocols.sol";
import "contracts/src/transformers/bridges/EthereumBridgeAdapter.sol";
import "contracts/src/transformers/bridges/PolygonBridgeAdapter.sol";
import "contracts/src/transformers/bridges/ArbitrumBridgeAdapter.sol";
import "contracts/src/transformers/bridges/OptimismBridgeAdapter.sol";
import "contracts/src/transformers/bridges/AvalancheBridgeAdapter.sol";
import "contracts/src/transformers/bridges/FantomBridgeAdapter.sol";
import "contracts/src/transformers/bridges/CeloBridgeAdapter.sol";
import "contracts/src/features/OtcOrdersFeature.sol";

contract ForkUtilsTest is Test, ForkUtils, TestUtils {
    function setUp() public {
        _setup();
    }

    function test_addressesExist() public {}

    function logAddresses(string memory chainName, string memory chainId) public {
        bytes memory details = vm.parseJson(json, chainId);
        addresses = abi.decode(details, (ContractAddresses));
    }
}
