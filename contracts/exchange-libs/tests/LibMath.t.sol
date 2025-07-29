// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/src/LibMath.sol";

contract LibMathTest is Test {
    function testSafeGetPartialAmountFloor() public {
        uint256 numerator = 100;
        uint256 denominator = 200;
        uint256 target = 50;
        
        uint256 result = LibMath.safeGetPartialAmountFloor(numerator, denominator, target);
        
        // Expected: (100 * 50) / 200 = 25
        assertEq(result, 25);
    }
    
    function testSafeGetPartialAmountCeil() public {
        uint256 numerator = 100;
        uint256 denominator = 200;
        uint256 target = 51;
        
        uint256 result = LibMath.safeGetPartialAmountCeil(numerator, denominator, target);
        
        // Expected: (100 * 51 + 200 - 1) / 200 = 26
        assertEq(result, 26);
    }
    
    function testIsRoundingErrorFloor() public {
        uint256 numerator = 1;
        uint256 denominator = 1000;
        uint256 target = 1;
        
        bool result = LibMath.isRoundingErrorFloor(numerator, denominator, target);
        
        // This should be a rounding error
        assertTrue(result);
    }
} 