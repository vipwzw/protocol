// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

// Mock ERC20 contract for testing
contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    string public name = "Mock Token";
    string public symbol = "MOCK";
    uint8 public decimals = 18;
    
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}

// Simplified AssetProxy for testing
contract SimpleAssetProxy {
    mapping(address => bool) public authorized;
    address public owner;
    
    constructor() {
        owner = msg.sender;
        authorized[msg.sender] = true;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyAuthorized() {
        require(authorized[msg.sender], "Only authorized");
        _;
    }
    
    function addAuthorizedAddress(address target) external onlyOwner {
        authorized[target] = true;
    }
    
    function removeAuthorizedAddress(address target) external onlyOwner {
        authorized[target] = false;
    }
    
    function transferFrom(
        bytes calldata assetData,
        address from,
        address to,
        uint256 amount
    ) external onlyAuthorized {
        // Decode ERC20 token address from assetData
        // For simplicity, assume assetData contains just the token address
        address token;
        assembly {
            token := calldataload(add(assetData.offset, 0x00))
        }
        
        MockERC20(token).transferFrom(from, to, amount);
    }
}

contract AssetProxyTest is Test {
    SimpleAssetProxy public assetProxy;
    MockERC20 public mockToken;
    address public constant ALICE = address(0x1);
    address public constant BOB = address(0x2);
    address public constant EXCHANGE = address(0x3);
    
    function setUp() public {
        assetProxy = new SimpleAssetProxy();
        mockToken = new MockERC20();
        
        // Mint tokens to Alice
        mockToken.mint(ALICE, 1000 ether);
        
        // Alice approves asset proxy
        vm.startPrank(ALICE);
        mockToken.approve(address(assetProxy), type(uint256).max);
        vm.stopPrank();
        
        // Add exchange as authorized address
        assetProxy.addAuthorizedAddress(EXCHANGE);
    }
    
    function testOwnerCanAddAuthorized() public {
        address newAuthorized = address(0x4);
        
        assetProxy.addAuthorizedAddress(newAuthorized);
        
        assertTrue(assetProxy.authorized(newAuthorized));
    }
    
    function testOwnerCanRemoveAuthorized() public {
        assetProxy.removeAuthorizedAddress(EXCHANGE);
        
        assertFalse(assetProxy.authorized(EXCHANGE));
    }
    
    function testNonOwnerCannotAddAuthorized() public {
        address newAuthorized = address(0x4);
        
        vm.startPrank(ALICE);
        vm.expectRevert("Only owner");
        assetProxy.addAuthorizedAddress(newAuthorized);
        vm.stopPrank();
    }
    
    function testAuthorizedCanTransferFrom() public {
        uint256 transferAmount = 100 ether;
        bytes memory assetData = abi.encode(address(mockToken));
        
        uint256 aliceBalanceBefore = mockToken.balanceOf(ALICE);
        uint256 bobBalanceBefore = mockToken.balanceOf(BOB);
        
        vm.startPrank(EXCHANGE);
        assetProxy.transferFrom(assetData, ALICE, BOB, transferAmount);
        vm.stopPrank();
        
        assertEq(mockToken.balanceOf(ALICE), aliceBalanceBefore - transferAmount);
        assertEq(mockToken.balanceOf(BOB), bobBalanceBefore + transferAmount);
    }
    
    function testUnauthorizedCannotTransferFrom() public {
        uint256 transferAmount = 100 ether;
        bytes memory assetData = abi.encode(address(mockToken));
        
        vm.startPrank(ALICE);
        vm.expectRevert("Only authorized");
        assetProxy.transferFrom(assetData, ALICE, BOB, transferAmount);
        vm.stopPrank();
    }
    
    function testTransferFromFailsWithInsufficientAllowance() public {
        uint256 transferAmount = 100 ether;
        bytes memory assetData = abi.encode(address(mockToken));
        
        // Remove Alice's approval
        vm.startPrank(ALICE);
        mockToken.approve(address(assetProxy), 0);
        vm.stopPrank();
        
        vm.startPrank(EXCHANGE);
        vm.expectRevert("Insufficient allowance");
        assetProxy.transferFrom(assetData, ALICE, BOB, transferAmount);
        vm.stopPrank();
    }
    
    function testTransferFromFailsWithInsufficientBalance() public {
        uint256 transferAmount = 2000 ether; // More than Alice has
        bytes memory assetData = abi.encode(address(mockToken));
        
        vm.startPrank(EXCHANGE);
        vm.expectRevert();
        assetProxy.transferFrom(assetData, ALICE, BOB, transferAmount);
        vm.stopPrank();
    }
    
    function testInitialState() public {
        assertTrue(assetProxy.authorized(address(this))); // Deployer is authorized
        assertEq(assetProxy.owner(), address(this));
    }
    
    function testMultipleTransfers() public {
        uint256 transferAmount = 50 ether;
        bytes memory assetData = abi.encode(address(mockToken));
        
        vm.startPrank(EXCHANGE);
        assetProxy.transferFrom(assetData, ALICE, BOB, transferAmount);
        assetProxy.transferFrom(assetData, ALICE, BOB, transferAmount);
        vm.stopPrank();
        
        assertEq(mockToken.balanceOf(ALICE), 1000 ether - (2 * transferAmount));
        assertEq(mockToken.balanceOf(BOB), 2 * transferAmount);
    }
}