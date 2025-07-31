// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

// Simplified ERC20 interface
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

// Mock ZRX Token for testing
contract MockZRXToken is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    uint256 public totalSupply = 10**27; // 1 billion tokens with 18 decimals
    string public name = "0x Protocol Token";
    string public symbol = "ZRX";
    uint8 public decimals = 18;
    
    constructor() {
        balanceOf[msg.sender] = totalSupply;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        
        if (allowance[from][msg.sender] != type(uint256).max) {
            allowance[from][msg.sender] -= amount;
        }
        
        emit Transfer(from, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract ZRXTokenTest is Test {
    MockZRXToken public zrxToken;
    address public constant ALICE = address(0x1);
    address public constant BOB = address(0x2);
    
    function setUp() public {
        zrxToken = new MockZRXToken();
    }
    
    function testInitialSupply() public {
        uint256 expectedSupply = 10**27; // 1 billion tokens with 18 decimals
        assertEq(zrxToken.totalSupply(), expectedSupply);
        assertEq(zrxToken.balanceOf(address(this)), expectedSupply);
    }
    
    function testTokenMetadata() public {
        assertEq(zrxToken.name(), "0x Protocol Token");
        assertEq(zrxToken.symbol(), "ZRX");
        assertEq(zrxToken.decimals(), 18);
    }
    
    function testTransfer() public {
        uint256 transferAmount = 1000 ether;
        
        bool success = zrxToken.transfer(ALICE, transferAmount);
        assertTrue(success);
        
        assertEq(zrxToken.balanceOf(ALICE), transferAmount);
        assertEq(zrxToken.balanceOf(address(this)), zrxToken.totalSupply() - transferAmount);
    }
    
    function testTransferFail() public {
        uint256 transferAmount = zrxToken.totalSupply() + 1;
        
        vm.expectRevert("Insufficient balance");
        zrxToken.transfer(ALICE, transferAmount);
    }
    
    function testApproveAndTransferFrom() public {
        uint256 approveAmount = 1000 ether;
        uint256 transferAmount = 500 ether;
        
        // Approve Alice to spend our tokens
        bool approveSuccess = zrxToken.approve(ALICE, approveAmount);
        assertTrue(approveSuccess);
        
        assertEq(zrxToken.allowance(address(this), ALICE), approveAmount);
        
        // Alice transfers tokens from us to Bob
        vm.startPrank(ALICE);
        bool transferSuccess = zrxToken.transferFrom(address(this), BOB, transferAmount);
        assertTrue(transferSuccess);
        vm.stopPrank();
        
        assertEq(zrxToken.balanceOf(BOB), transferAmount);
        assertEq(zrxToken.allowance(address(this), ALICE), approveAmount - transferAmount);
    }
    
    function testTransferFromFail() public {
        uint256 transferAmount = 1000 ether;
        
        // Try to transfer without approval
        vm.startPrank(ALICE);
        vm.expectRevert("Insufficient allowance");
        zrxToken.transferFrom(address(this), BOB, transferAmount);
        vm.stopPrank();
    }
    
    function testUnlimitedAllowance() public {
        uint256 maxUint = type(uint256).max;
        uint256 transferAmount = 1000 ether;
        
        // Set unlimited allowance
        zrxToken.approve(ALICE, maxUint);
        
        // Transfer some tokens
        vm.startPrank(ALICE);
        zrxToken.transferFrom(address(this), BOB, transferAmount);
        vm.stopPrank();
        
        // Allowance should remain unlimited
        assertEq(zrxToken.allowance(address(this), ALICE), maxUint);
    }
    
    function testTransferEvent() public {
        uint256 transferAmount = 1000 ether;
        
        // Test that transfer emits correct event
        vm.expectEmit(true, true, false, true, address(zrxToken));
        emit MockZRXToken.Transfer(address(this), ALICE, transferAmount);
        
        zrxToken.transfer(ALICE, transferAmount);
    }
    
    function testApprovalEvent() public {
        uint256 approveAmount = 1000 ether;
        
        // Test that approve emits correct event
        vm.expectEmit(true, true, false, true, address(zrxToken));
        emit MockZRXToken.Approval(address(this), ALICE, approveAmount);
        
        zrxToken.approve(ALICE, approveAmount);
    }
}