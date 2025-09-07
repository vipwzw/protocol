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


library LibMathRichErrors {

    // bytes4(keccak256("DivisionByZeroError()"))
    bytes4 internal constant DIVISION_BY_ZERO_ERROR_SELECTOR = 0x63fb8aba;

    /// @dev Division by zero error
    function DivisionByZeroError() internal pure returns (bytes memory) {
        return abi.encodeWithSelector(DIVISION_BY_ZERO_ERROR_SELECTOR);
    }

    // bytes4(keccak256("RoundingError(uint256,uint256,uint256)"))
    bytes4 internal constant ROUNDING_ERROR_SELECTOR = 0x339f3de2;

    /// @dev Rounding error
    /// @param numerator Numerator
    /// @param denominator Denominator  
    /// @param target Target value
    function RoundingError(
        uint256 numerator,
        uint256 denominator,
        uint256 target
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(
            ROUNDING_ERROR_SELECTOR,
            numerator,
            denominator,
            target
        );
    }
}
