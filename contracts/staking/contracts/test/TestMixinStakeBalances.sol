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

import "../src/interfaces/IStructs.sol";
import "./TestStakingNoWETH.sol";


// Mock ZrxVault contract for testing
contract MockZrxVault {
    mapping(address => uint256) public balances;
    uint256 public vaultBalance;
    
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
    
    function balanceOfZrxVault() external view returns (uint256) {
        return vaultBalance;
    }
}

contract TestMixinStakeBalances is
    TestStakingNoWETH
{
    uint256 private _balanceOfZrxVault;
    mapping (address => uint256) private _zrxBalanceOf;
    MockZrxVault private mockVault;

    function setBalanceOfZrxVault(uint256 balance)
        external
    {
        _balanceOfZrxVault = balance;
    }

    function setZrxBalanceOf(address staker, uint256 balance)
        external
    {
        _zrxBalanceOf[staker] = balance;
    }

    /// @dev `IZrxVault.balanceOfZrxVault`
    function balanceOfZrxVault()
        external
        view
        returns (uint256)
    {
        return _balanceOfZrxVault;
    }

    /// @dev `IZrxVault.balanceOf`
    function balanceOf(address staker)
        external
        view
        returns (uint256)
    {
        return _zrxBalanceOf[staker];
    }

    /// @dev Set `_ownerStakeByStatus`
    function setOwnerStakeByStatus(
        address owner,
        IStructs.StakeStatus status,
        IStructs.StoredBalance memory stake
    )
        public
    {
        _ownerStakeByStatus[uint8(status)][owner] = stake;
    }

    /// @dev Set `_delegatedStakeToPoolByOwner`
    function setDelegatedStakeToPoolByOwner(
        address owner,
        bytes32 poolId,
        IStructs.StoredBalance memory stake
    )
        public
    {
        _delegatedStakeToPoolByOwner[owner][poolId] = stake;
    }

    /// @dev Set `_delegatedStakeByPoolId`
    function setDelegatedStakeByPoolId(
        bytes32 poolId,
        IStructs.StoredBalance memory stake
    )
        public
    {
        _delegatedStakeByPoolId[poolId] = stake;
    }

    /// @dev Set `_globalStakeByStatus`
    function setGlobalStakeByStatus(
        IStructs.StakeStatus status,
        IStructs.StoredBalance memory stake
    )
        public
    {
        _globalStakeByStatus[uint8(status)] = stake;
    }
    
    /// @dev Get raw global stake by status (for debugging)
    function getRawGlobalStakeByStatus(IStructs.StakeStatus status)
        public
        view
        returns (IStructs.StoredBalance memory)
    {
        return _globalStakeByStatus[uint8(status)];
    }

    /// @dev Overridden to use this contract as the ZRX vault.
    function getZrxVault()
        public
        view
        override
        returns (IZrxVault zrxVault)
    {
        return IZrxVault(address(this));
    }

    /// @dev Overridden to just return the input with the epoch incremented.
    function _loadCurrentBalance(IStructs.StoredBalance storage balancePtr)
        internal
        view
        override
        returns (IStructs.StoredBalance memory balance)
    {
        // Use the base implementation logic
        balance = balancePtr;
        uint256 currentEpoch_ = currentEpoch;
        if (currentEpoch_ > balance.currentEpoch) {
            balance.currentEpoch = uint64(currentEpoch_);
            balance.currentEpochBalance = balance.nextEpochBalance;
        }
        return balance;
    }
    

}
