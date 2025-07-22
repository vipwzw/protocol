pragma solidity ^0.8.30;

import "../contracts/src/LibBytes.sol";

contract LibBytesTest {
    using LibBytes for bytes;

    function testReadAddress() public {
        address testAddr = address(0x1234567890123456789012345678901234567890);
        bytes memory data = abi.encodePacked(testAddr);
        address result = data.readAddress(0);
        require(result == testAddr, "Address read failed");
    }

    function testReadBytes32() public {
        bytes32 testBytes = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
        bytes memory data = abi.encodePacked(testBytes);
        bytes32 result = data.readBytes32(0);
        require(result == testBytes, "Bytes32 read failed");
    }

    function testEquals() public {
        bytes memory data1 = hex"deadbeef";
        bytes memory data2 = hex"deadbeef";
        bytes memory data3 = hex"cafebabe";

        require(data1.equals(data2), "Equal bytes comparison failed");
        require(!data1.equals(data3), "Unequal bytes comparison failed");
    }

    function testSlice() public view {
        bytes memory data = hex"deadbeefcafebabe";
        bytes memory result = data.slice(2, 6);
        bytes memory expected = hex"adbeefca";
        require(result.equals(expected), "Slice test failed");
    }
}
