// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./IStaking.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title TreasuryStaking - Real Staking Contract for Treasury Governance
 * @dev Complete implementation of IStaking interface for real Treasury governance testing
 */
contract TreasuryStaking is IStaking {
    // Events
    event Stake(address indexed staker, uint256 amount);
    event Unstake(address indexed staker, uint256 amount);
    event StakingPoolCreated(bytes32 indexed poolId, address indexed operator, uint32 operatorShare);
    event StakeDelegated(address indexed staker, bytes32 indexed poolId, uint256 amount);
    event StakeUndelegated(address indexed staker, bytes32 indexed poolId, uint256 amount);
    event EpochAdvanced(uint256 indexed newEpoch, uint256 startTime);

    // Constants
    uint256 public constant DEFAULT_EPOCH_DURATION = 7 days; // 1 week
    uint256 public constant PPM_DENOMINATOR = 1000000; // Parts per million
    
    // State variables
    IERC20 public immutable zrxToken;
    uint256 public override currentEpoch;
    uint256 public currentEpochStartTime;
    uint256 public override epochDurationInSeconds;
    uint256 public nextPoolId;
    
    // Storage mappings
    mapping(bytes32 => Pool) private _pools;
    mapping(address => mapping(StakeStatus => StoredBalance)) private _ownerStakeByStatus;
    mapping(StakeStatus => StoredBalance) private _globalStakeByStatus;
    mapping(bytes32 => StoredBalance) private _totalStakeDelegatedToPool;
    mapping(address => mapping(bytes32 => StoredBalance)) private _stakeDelegatedToPoolByOwner;
    
    // Additional mappings for tracking
    mapping(address => uint256) public totalStakedByOwner;
    mapping(address => bytes32[]) public poolsOwnedByOperator;
    mapping(bytes32 => address[]) public stakersByPool;
    
    constructor(address _zrxToken) {
        require(_zrxToken != address(0), "Invalid ZRX token address");
        zrxToken = IERC20(_zrxToken);
        epochDurationInSeconds = DEFAULT_EPOCH_DURATION;
        currentEpoch = 1;
        currentEpochStartTime = block.timestamp;
        nextPoolId = 1;
    }
    
    // ============ Epoch Management ============
    
    function advanceEpoch() external {
        require(
            block.timestamp >= currentEpochStartTime + epochDurationInSeconds,
            "Epoch duration not elapsed"
        );
        
        currentEpoch++;
        currentEpochStartTime = block.timestamp;
        
        // Update all stored balances to current epoch
        _updateAllBalancesToCurrentEpoch();
        
        emit EpochAdvanced(currentEpoch, currentEpochStartTime);
    }
    
    function currentEpochStartTimeInSeconds() external view override returns (uint256) {
        return currentEpochStartTime;
    }
    
    // ============ Staking Pool Management ============
    
    function createStakingPool(uint32 operatorShare, bool addOperatorAsMaker)
        external
        override
        returns (bytes32 poolId)
    {
        require(operatorShare <= PPM_DENOMINATOR, "Invalid operator share");
        
        poolId = bytes32(nextPoolId++);
        
        _pools[poolId] = Pool({
            operator: msg.sender,
            operatorShare: operatorShare
        });
        
        poolsOwnedByOperator[msg.sender].push(poolId);
        
        if (addOperatorAsMaker) {
            // Delegate operator's existing stake to this pool
            _moveStakeToPool(msg.sender, poolId, _getAvailableStakeForDelegation(msg.sender));
        }
        
        emit StakingPoolCreated(poolId, msg.sender, operatorShare);
    }
    
    function getStakingPool(bytes32 poolId) external view override returns (Pool memory) {
        return _pools[poolId];
    }
    
    // ============ Staking Functions ============
    
    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        require(zrxToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        totalStakedByOwner[msg.sender] += amount;
        
        // Add to undelegated stake
        _increaseOwnerStakeByStatus(msg.sender, StakeStatus.UNDELEGATED, amount);
        _increaseGlobalStakeByStatus(StakeStatus.UNDELEGATED, amount);
        
        emit Stake(msg.sender, amount);
    }
    
    function unstake(uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        require(totalStakedByOwner[msg.sender] >= amount, "Insufficient staked balance");
        
        // Can only unstake undelegated tokens
        StoredBalance storage undelegatedBalance = _ownerStakeByStatus[msg.sender][StakeStatus.UNDELEGATED];
        _updateBalanceToCurrentEpoch(undelegatedBalance);
        require(undelegatedBalance.currentEpochBalance >= amount, "Insufficient undelegated balance");
        
        totalStakedByOwner[msg.sender] -= amount;
        
        // Remove from undelegated stake
        _decreaseOwnerStakeByStatus(msg.sender, StakeStatus.UNDELEGATED, amount);
        _decreaseGlobalStakeByStatus(StakeStatus.UNDELEGATED, amount);
        
        require(zrxToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit Unstake(msg.sender, amount);
    }
    
    function moveStakeToPool(bytes32 poolId, uint256 amount) external {
        require(_pools[poolId].operator != address(0), "Pool does not exist");
        require(amount > 0, "Amount must be positive");
        
        // Check undelegated stake availability
        StoredBalance storage undelegatedBalance = _ownerStakeByStatus[msg.sender][StakeStatus.UNDELEGATED];
        _updateBalanceToCurrentEpoch(undelegatedBalance);
        require(undelegatedBalance.currentEpochBalance >= amount, "Insufficient undelegated balance");
        
        // Move stake from undelegated to delegated
        _moveStakeToPool(msg.sender, poolId, amount);
    }
    
    function moveStakeFromPool(bytes32 poolId, uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        
        // Move stake from delegated to undelegated
        _moveStakeFromPool(msg.sender, poolId, amount);
    }
    
    // ============ View Functions ============
    
    function getGlobalStakeByStatus(StakeStatus stakeStatus) 
        external 
        view 
        override 
        returns (StoredBalance memory balance) 
    {
        balance = _globalStakeByStatus[stakeStatus];
        _updateBalanceToCurrentEpochView(balance);
    }
    
    function getOwnerStakeByStatus(address staker, StakeStatus stakeStatus)
        external
        view
        override
        returns (StoredBalance memory balance)
    {
        balance = _ownerStakeByStatus[staker][stakeStatus];
        _updateBalanceToCurrentEpochView(balance);
    }
    
    function getTotalStakeDelegatedToPool(bytes32 poolId)
        external
        view
        override
        returns (StoredBalance memory balance)
    {
        balance = _totalStakeDelegatedToPool[poolId];
        _updateBalanceToCurrentEpochView(balance);
    }
    
    function getStakeDelegatedToPoolByOwner(address staker, bytes32 poolId)
        external
        view
        override
        returns (StoredBalance memory balance)
    {
        balance = _stakeDelegatedToPoolByOwner[staker][poolId];
        _updateBalanceToCurrentEpochView(balance);
    }
    
    // ============ Internal Helper Functions ============
    
    function _moveStakeToPool(address staker, bytes32 poolId, uint256 amount) internal {
        require(amount > 0, "Amount must be positive");
        
        // Check and update undelegated stake
        StoredBalance storage undelegatedBalance = _ownerStakeByStatus[staker][StakeStatus.UNDELEGATED];
        _updateBalanceToCurrentEpoch(undelegatedBalance);
        require(undelegatedBalance.currentEpochBalance >= amount, "Insufficient undelegated balance");
        
        // Move from undelegated to delegated
        _decreaseOwnerStakeByStatus(staker, StakeStatus.UNDELEGATED, amount);
        _increaseOwnerStakeByStatus(staker, StakeStatus.DELEGATED, amount);
        
        // Update global stakes
        _decreaseGlobalStakeByStatus(StakeStatus.UNDELEGATED, amount);
        _increaseGlobalStakeByStatus(StakeStatus.DELEGATED, amount);
        
        // Update pool delegation
        _increaseStakeDelegatedToPool(poolId, amount);
        _increaseStakeDelegatedToPoolByOwner(staker, poolId, amount);
        
        // Track staker in pool
        stakersByPool[poolId].push(staker);
        
        emit StakeDelegated(staker, poolId, amount);
    }
    
    function _moveStakeFromPool(address staker, bytes32 poolId, uint256 amount) internal {
        require(amount > 0, "Amount must be positive");
        
        // Check delegated stake in pool
        StoredBalance storage delegatedBalance = _stakeDelegatedToPoolByOwner[staker][poolId];
        _updateBalanceToCurrentEpoch(delegatedBalance);
        require(delegatedBalance.currentEpochBalance >= amount, "Insufficient delegated balance");
        
        // Move from delegated to undelegated
        _decreaseOwnerStakeByStatus(staker, StakeStatus.DELEGATED, amount);
        _increaseOwnerStakeByStatus(staker, StakeStatus.UNDELEGATED, amount);
        
        // Update global stakes
        _decreaseGlobalStakeByStatus(StakeStatus.DELEGATED, amount);
        _increaseGlobalStakeByStatus(StakeStatus.UNDELEGATED, amount);
        
        // Update pool delegation
        _decreaseStakeDelegatedToPool(poolId, amount);
        _decreaseStakeDelegatedToPoolByOwner(staker, poolId, amount);
        
        emit StakeUndelegated(staker, poolId, amount);
    }
    
    function _getAvailableStakeForDelegation(address staker) internal view returns (uint256) {
        StoredBalance memory undelegatedBalance = _ownerStakeByStatus[staker][StakeStatus.UNDELEGATED];
        _updateBalanceToCurrentEpochView(undelegatedBalance);
        return undelegatedBalance.currentEpochBalance;
    }
    
    // ============ Balance Update Functions ============
    
    function _updateBalanceToCurrentEpoch(StoredBalance storage balance) internal {
        if (balance.currentEpoch < currentEpoch) {
            balance.currentEpochBalance = balance.nextEpochBalance;
            balance.currentEpoch = uint64(currentEpoch);
        }
    }
    
    function _updateBalanceToCurrentEpochView(StoredBalance memory balance) internal view {
        if (balance.currentEpoch < currentEpoch) {
            balance.currentEpochBalance = balance.nextEpochBalance;
            balance.currentEpoch = uint64(currentEpoch);
        }
    }
    
    function _updateAllBalancesToCurrentEpoch() internal {
        // This is a simplified version - in production, you'd need to iterate through active balances
        // For testing purposes, balances are updated lazily when accessed
    }
    
    function _increaseOwnerStakeByStatus(address staker, StakeStatus status, uint256 amount) internal {
        StoredBalance storage balance = _ownerStakeByStatus[staker][status];
        _updateBalanceToCurrentEpoch(balance);
        balance.currentEpochBalance += uint96(amount);
        balance.nextEpochBalance += uint96(amount);
    }
    
    function _decreaseOwnerStakeByStatus(address staker, StakeStatus status, uint256 amount) internal {
        StoredBalance storage balance = _ownerStakeByStatus[staker][status];
        _updateBalanceToCurrentEpoch(balance);
        require(balance.currentEpochBalance >= amount, "Insufficient balance");
        balance.currentEpochBalance -= uint96(amount);
        balance.nextEpochBalance -= uint96(amount);
    }
    
    function _increaseGlobalStakeByStatus(StakeStatus status, uint256 amount) internal {
        StoredBalance storage balance = _globalStakeByStatus[status];
        _updateBalanceToCurrentEpoch(balance);
        balance.currentEpochBalance += uint96(amount);
        balance.nextEpochBalance += uint96(amount);
    }
    
    function _decreaseGlobalStakeByStatus(StakeStatus status, uint256 amount) internal {
        StoredBalance storage balance = _globalStakeByStatus[status];
        _updateBalanceToCurrentEpoch(balance);
        require(balance.currentEpochBalance >= amount, "Insufficient global balance");
        balance.currentEpochBalance -= uint96(amount);
        balance.nextEpochBalance -= uint96(amount);
    }
    
    function _increaseStakeDelegatedToPool(bytes32 poolId, uint256 amount) internal {
        StoredBalance storage balance = _totalStakeDelegatedToPool[poolId];
        _updateBalanceToCurrentEpoch(balance);
        balance.currentEpochBalance += uint96(amount);
        balance.nextEpochBalance += uint96(amount);
    }
    
    function _decreaseStakeDelegatedToPool(bytes32 poolId, uint256 amount) internal {
        StoredBalance storage balance = _totalStakeDelegatedToPool[poolId];
        _updateBalanceToCurrentEpoch(balance);
        require(balance.currentEpochBalance >= amount, "Insufficient pool balance");
        balance.currentEpochBalance -= uint96(amount);
        balance.nextEpochBalance -= uint96(amount);
    }
    
    function _increaseStakeDelegatedToPoolByOwner(address staker, bytes32 poolId, uint256 amount) internal {
        StoredBalance storage balance = _stakeDelegatedToPoolByOwner[staker][poolId];
        _updateBalanceToCurrentEpoch(balance);
        balance.currentEpochBalance += uint96(amount);
        balance.nextEpochBalance += uint96(amount);
    }
    
    function _decreaseStakeDelegatedToPoolByOwner(address staker, bytes32 poolId, uint256 amount) internal {
        StoredBalance storage balance = _stakeDelegatedToPoolByOwner[staker][poolId];
        _updateBalanceToCurrentEpoch(balance);
        require(balance.currentEpochBalance >= amount, "Insufficient staker pool balance");
        balance.currentEpochBalance -= uint96(amount);
        balance.nextEpochBalance -= uint96(amount);
    }
    
    // ============ Admin Functions (for testing) ============
    
    function setEpochDuration(uint256 _epochDurationInSeconds) external {
        require(_epochDurationInSeconds > 0, "Invalid epoch duration");
        epochDurationInSeconds = _epochDurationInSeconds;
    }
    
    function forceAdvanceEpoch() external {
        currentEpoch++;
        currentEpochStartTime = block.timestamp;
        _updateAllBalancesToCurrentEpoch();
        emit EpochAdvanced(currentEpoch, currentEpochStartTime);
    }
    
    // ============ View Helper Functions ============
    
    function getPoolsByOperator(address operator) external view returns (bytes32[] memory) {
        return poolsOwnedByOperator[operator];
    }
    
    function getStakersByPool(bytes32 poolId) external view returns (address[] memory) {
        return stakersByPool[poolId];
    }
    
    function getTotalStakedByOwner(address staker) external view returns (uint256) {
        return totalStakedByOwner[staker];
    }
} 