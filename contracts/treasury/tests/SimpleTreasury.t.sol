// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

// Mock ERC20 Token for testing
contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}

// Simplified Treasury contract for testing
contract SimpleTreasury {
    MockERC20 public immutable token;
    address public owner;
    uint256 public totalFees;
    
    mapping(address => uint256) public balances;
    
    event FeeCollected(address indexed from, uint256 amount);
    event Withdrawal(address indexed to, uint256 amount);
    
    constructor(address _token) {
        token = MockERC20(_token);
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    function collectFee(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        totalFees += amount;
        balances[msg.sender] += amount;
        
        emit FeeCollected(msg.sender, amount);
    }
    
    function withdraw(uint256 amount) external onlyOwner {
        require(token.balanceOf(address(this)) >= amount, "Insufficient balance");
        token.transfer(msg.sender, amount);
        totalFees -= amount;
        
        emit Withdrawal(msg.sender, amount);
    }
    
    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
    
    function getUserBalance(address user) external view returns (uint256) {
        return balances[user];
    }
}

contract SimpleTreasuryTest is Test {
    SimpleTreasury public treasury;
    MockERC20 public token;
    address public constant ALICE = address(0x1);
    address public constant BOB = address(0x2);
    
    function setUp() public {
        token = new MockERC20();
        treasury = new SimpleTreasury(address(token));
        
        // Mint tokens for testing
        token.mint(ALICE, 1000 ether);
        token.mint(BOB, 1000 ether);
        token.mint(address(this), 1000 ether);
    }
    
    function testInitialState() public {
        assertEq(treasury.owner(), address(this));
        assertEq(treasury.totalFees(), 0);
        assertEq(treasury.getBalance(), 0);
    }
    
    function testCollectFee() public {
        uint256 feeAmount = 100 ether;
        
        treasury.collectFee(feeAmount);
        
        assertEq(treasury.totalFees(), feeAmount);
        assertEq(treasury.getBalance(), feeAmount);
        assertEq(treasury.getUserBalance(address(this)), feeAmount);
    }
    
    function testWithdraw() public {
        uint256 feeAmount = 100 ether;
        uint256 withdrawAmount = 50 ether;
        
        // First collect some fees
        treasury.collectFee(feeAmount);
        
        uint256 ownerBalanceBefore = token.balanceOf(address(this));
        
        // Withdraw
        treasury.withdraw(withdrawAmount);
        
        assertEq(token.balanceOf(address(this)), ownerBalanceBefore + withdrawAmount);
        assertEq(treasury.totalFees(), feeAmount - withdrawAmount);
        assertEq(treasury.getBalance(), feeAmount - withdrawAmount);
    }
    
    function testCannotWithdrawMoreThanBalance() public {
        uint256 feeAmount = 100 ether;
        uint256 withdrawAmount = 150 ether;
        
        treasury.collectFee(feeAmount);
        
        vm.expectRevert("Insufficient balance");
        treasury.withdraw(withdrawAmount);
    }
    
    function testOnlyOwnerCanWithdraw() public {
        uint256 feeAmount = 100 ether;
        
        treasury.collectFee(feeAmount);
        
        vm.startPrank(ALICE);
        vm.expectRevert("Only owner");
        treasury.withdraw(50 ether);
        vm.stopPrank();
    }
    
    function testMultipleUsers() public {
        uint256 feeAmount = 100 ether;
        
        // Alice collects fee
        vm.startPrank(ALICE);
        treasury.collectFee(feeAmount);
        vm.stopPrank();
        
        // Bob collects fee
        vm.startPrank(BOB);
        treasury.collectFee(feeAmount);
        vm.stopPrank();
        
        assertEq(treasury.totalFees(), feeAmount * 2);
        assertEq(treasury.getUserBalance(ALICE), feeAmount);
        assertEq(treasury.getUserBalance(BOB), feeAmount);
    }
    
    function testFeeCollectedEvent() public {
        uint256 feeAmount = 100 ether;
        
        vm.expectEmit(true, false, false, true, address(treasury));
        emit SimpleTreasury.FeeCollected(address(this), feeAmount);
        
        treasury.collectFee(feeAmount);
    }
    
    function testWithdrawalEvent() public {
        uint256 feeAmount = 100 ether;
        uint256 withdrawAmount = 50 ether;
        
        treasury.collectFee(feeAmount);
        
        vm.expectEmit(true, false, false, true, address(treasury));
        emit SimpleTreasury.Withdrawal(address(this), withdrawAmount);
        
        treasury.withdraw(withdrawAmount);
    }
}