// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

// Simplified interfaces for testing
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

// Mock ZRX Token for testing
contract MockZRXToken is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
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

// Simplified Staking contract for testing
contract SimpleStaking {
    enum StakeStatus {
        UNDELEGATED,
        DELEGATED
    }
    
    struct StoredBalance {
        uint64 currentEpoch;
        uint96 currentEpochBalance;
        uint96 nextEpochBalance;
    }
    
    struct Pool {
        address operator;
        uint32 operatorShare;
        uint256 operatorStake;
    }
    
    IERC20 public immutable stakingToken;
    uint256 public currentEpoch = 1;
    uint256 public epochDurationInSeconds = 7 days;
    uint256 public currentEpochStartTimeInSeconds;
    uint256 public nextPoolId = 1;
    
    mapping(address => mapping(StakeStatus => StoredBalance)) private _ownerStakeByStatus;
    mapping(bytes32 => Pool) private _poolByPoolId;
    mapping(bytes32 => StoredBalance) private _delegatedStakeToPoolByOwner;
    mapping(address => mapping(bytes32 => StoredBalance)) private _delegatedStakeByOwnerToPool;
    
    event Stake(address indexed staker, uint256 amount);
    event Unstake(address indexed staker, uint256 amount);
    event MoveStake(
        address indexed staker,
        uint256 amount,
        uint8 fromStatus,
        bytes32 indexed fromPool,
        uint8 toStatus,
        bytes32 indexed toPool
    );
    
    constructor(IERC20 _stakingToken) {
        stakingToken = _stakingToken;
        currentEpochStartTimeInSeconds = block.timestamp;
    }
    
    function stake(uint256 amount) external {
        stakingToken.transferFrom(msg.sender, address(this), amount);
        
        StoredBalance storage balance = _ownerStakeByStatus[msg.sender][StakeStatus.UNDELEGATED];
        if (balance.currentEpoch < currentEpoch) {
            balance.currentEpoch = uint64(currentEpoch);
            balance.currentEpochBalance = balance.nextEpochBalance;
        }
        balance.nextEpochBalance += uint96(amount);
        
        emit Stake(msg.sender, amount);
    }
    
    function unstake(uint256 amount) external {
        StoredBalance storage balance = _ownerStakeByStatus[msg.sender][StakeStatus.UNDELEGATED];
        if (balance.currentEpoch < currentEpoch) {
            balance.currentEpoch = uint64(currentEpoch);
            balance.currentEpochBalance = balance.nextEpochBalance;
        }
        
        require(balance.nextEpochBalance >= amount, "Insufficient stake");
        balance.nextEpochBalance -= uint96(amount);
        
        stakingToken.transfer(msg.sender, amount);
        
        emit Unstake(msg.sender, amount);
    }
    
    function createStakingPool(uint32 operatorShare, bool addOperatorAsMaker) 
        external 
        returns (bytes32 poolId) 
    {
        require(operatorShare <= 1000000, "Invalid operator share");
        
        poolId = bytes32(nextPoolId);
        nextPoolId++;
        
        Pool storage pool = _poolByPoolId[poolId];
        pool.operator = msg.sender;
        pool.operatorShare = operatorShare;
        
        return poolId;
    }
    
    function getStakeByOwner(address staker, StakeStatus status)
        external
        view
        returns (StoredBalance memory balance)
    {
        balance = _ownerStakeByStatus[staker][status];
        if (balance.currentEpoch < currentEpoch) {
            balance.currentEpochBalance = balance.nextEpochBalance;
            balance.currentEpoch = uint64(currentEpoch);
        }
        return balance;
    }
    
    function getTotalStake() external view returns (uint256) {
        return stakingToken.balanceOf(address(this));
    }
    
    function getPoolById(bytes32 poolId) external view returns (Pool memory) {
        return _poolByPoolId[poolId];
    }
}

contract StakingTest is Test {
    SimpleStaking public staking;
    MockZRXToken public zrxToken;
    address public constant ALICE = address(0x1);
    address public constant BOB = address(0x2);
    address public constant OPERATOR = address(0x3);
    
    function setUp() public {
        zrxToken = new MockZRXToken();
        staking = new SimpleStaking(IERC20(address(zrxToken)));
        
        // Mint tokens for testing
        zrxToken.mint(ALICE, 1000 ether);
        zrxToken.mint(BOB, 1000 ether);
        zrxToken.mint(OPERATOR, 1000 ether);
        
        // Approve staking contract
        vm.startPrank(ALICE);
        zrxToken.approve(address(staking), type(uint256).max);
        vm.stopPrank();
        
        vm.startPrank(BOB);
        zrxToken.approve(address(staking), type(uint256).max);
        vm.stopPrank();
        
        vm.startPrank(OPERATOR);
        zrxToken.approve(address(staking), type(uint256).max);
        vm.stopPrank();
    }
    
    function testInitialState() public {
        assertEq(staking.currentEpoch(), 1);
        assertEq(staking.epochDurationInSeconds(), 7 days);
        assertEq(address(staking.stakingToken()), address(zrxToken));
    }
    
    function testStakeTokens() public {
        uint256 stakeAmount = 100 ether;
        uint256 aliceBalanceBefore = zrxToken.balanceOf(ALICE);
        
        vm.startPrank(ALICE);
        staking.stake(stakeAmount);
        vm.stopPrank();
        
        assertEq(zrxToken.balanceOf(ALICE), aliceBalanceBefore - stakeAmount);
        assertEq(staking.getTotalStake(), stakeAmount);
        
        SimpleStaking.StoredBalance memory balance = staking.getStakeByOwner(
            ALICE, 
            SimpleStaking.StakeStatus.UNDELEGATED
        );
        assertEq(balance.nextEpochBalance, stakeAmount);
    }
    
    function testUnstakeTokens() public {
        uint256 stakeAmount = 100 ether;
        uint256 unstakeAmount = 50 ether;
        
        // Stake first
        vm.startPrank(ALICE);
        staking.stake(stakeAmount);
        
        // Then unstake
        uint256 aliceBalanceBefore = zrxToken.balanceOf(ALICE);
        staking.unstake(unstakeAmount);
        vm.stopPrank();
        
        assertEq(zrxToken.balanceOf(ALICE), aliceBalanceBefore + unstakeAmount);
        assertEq(staking.getTotalStake(), stakeAmount - unstakeAmount);
        
        SimpleStaking.StoredBalance memory balance = staking.getStakeByOwner(
            ALICE, 
            SimpleStaking.StakeStatus.UNDELEGATED
        );
        assertEq(balance.nextEpochBalance, stakeAmount - unstakeAmount);
    }
    
    function testCannotUnstakeMoreThanStaked() public {
        uint256 stakeAmount = 100 ether;
        uint256 unstakeAmount = 150 ether;
        
        vm.startPrank(ALICE);
        staking.stake(stakeAmount);
        
        vm.expectRevert("Insufficient stake");
        staking.unstake(unstakeAmount);
        vm.stopPrank();
    }
    
    function testCreateStakingPool() public {
        uint32 operatorShare = 500000; // 50%
        
        vm.startPrank(OPERATOR);
        bytes32 poolId = staking.createStakingPool(operatorShare, true);
        vm.stopPrank();
        
        assertTrue(poolId != bytes32(0));
        
        SimpleStaking.Pool memory pool = staking.getPoolById(poolId);
        assertEq(pool.operator, OPERATOR);
        assertEq(pool.operatorShare, operatorShare);
    }
    
    function testCannotCreatePoolWithInvalidShare() public {
        uint32 invalidShare = 1000001; // > 100%
        
        vm.startPrank(OPERATOR);
        vm.expectRevert("Invalid operator share");
        staking.createStakingPool(invalidShare, true);
        vm.stopPrank();
    }
    
    function testMultipleStakers() public {
        uint256 aliceStake = 100 ether;
        uint256 bobStake = 200 ether;
        
        vm.startPrank(ALICE);
        staking.stake(aliceStake);
        vm.stopPrank();
        
        vm.startPrank(BOB);
        staking.stake(bobStake);
        vm.stopPrank();
        
        assertEq(staking.getTotalStake(), aliceStake + bobStake);
        
        SimpleStaking.StoredBalance memory aliceBalance = staking.getStakeByOwner(
            ALICE, 
            SimpleStaking.StakeStatus.UNDELEGATED
        );
        SimpleStaking.StoredBalance memory bobBalance = staking.getStakeByOwner(
            BOB, 
            SimpleStaking.StakeStatus.UNDELEGATED
        );
        
        assertEq(aliceBalance.nextEpochBalance, aliceStake);
        assertEq(bobBalance.nextEpochBalance, bobStake);
    }
    
    function testStakeEvent() public {
        uint256 stakeAmount = 100 ether;
        
        vm.expectEmit(true, false, false, true);
        emit Stake(ALICE, stakeAmount);
        
        vm.startPrank(ALICE);
        staking.stake(stakeAmount);
        vm.stopPrank();
    }
    
    function testUnstakeEvent() public {
        uint256 stakeAmount = 100 ether;
        uint256 unstakeAmount = 50 ether;
        
        vm.startPrank(ALICE);
        staking.stake(stakeAmount);
        
        vm.expectEmit(true, false, false, true);
        emit Unstake(ALICE, unstakeAmount);
        
        staking.unstake(unstakeAmount);
        vm.stopPrank();
    }
}

// Events for testing
event Stake(address indexed staker, uint256 amount);
event Unstake(address indexed staker, uint256 amount);