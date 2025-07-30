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

pragma solidity ^0.8.0;


abstract contract Token {

    /// @return supply total amount of tokens
    function totalSupply() public view virtual returns (uint256 supply);

    /// @param _owner The address from which the balance will be retrieved
    /// @return balance The balance
    function balanceOf(address _owner) public view virtual returns (uint256 balance);

    /// @notice send `_value` token to `_to` from `msg.sender`
    /// @param _to The address of the recipient
    /// @param _value The amount of token to be transferred
    /// @return success Whether the transfer was successful or not
    function transfer(address _to, uint256 _value) public virtual returns (bool success);

    /// @notice send `_value` token to `_to` from `_from` on the condition it is approved by `_from`
    /// @param _from The address of the sender
    /// @param _to The address of the recipient
    /// @param _value The amount of token to be transferred
    /// @return success Whether the transfer was successful or not
    function transferFrom(address _from, address _to, uint256 _value) public virtual returns (bool success);

    /// @notice `msg.sender` approves `_addr` to spend `_value` tokens
    /// @param _spender The address of the account able to transfer the tokens
    /// @param _value The amount of wei to be approved for transfer
    /// @return success Whether the approval was successful or not
    function approve(address _spender, uint256 _value) public virtual returns (bool success);

    /// @param _owner The address of the account owning tokens
    /// @param _spender The address of the account able to transfer the tokens
    /// @return remaining Amount of remaining tokens allowed to spent
    function allowance(address _owner, address _spender) public view virtual returns (uint256 remaining);

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
}


contract ERC20Token is Token {

    mapping (address => uint256) public balances;
    mapping (address => mapping (address => uint256)) public allowed;
    uint256 internal _totalSupply;

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function transfer(address _to, uint256 _value) public virtual override returns (bool) {
        require(balances[msg.sender] >= _value, "Insufficient balance");
        require(balances[_to] + _value >= balances[_to], "Overflow");
        
        balances[msg.sender] -= _value;
        balances[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public virtual override returns (bool) {
        require(balances[_from] >= _value, "Insufficient balance");
        require(allowed[_from][msg.sender] >= _value, "Insufficient allowance");
        require(balances[_to] + _value >= balances[_to], "Overflow");
        
        balances[_to] += _value;
        balances[_from] -= _value;
        allowed[_from][msg.sender] -= _value;
        emit Transfer(_from, _to, _value);
        return true;
    }

    function balanceOf(address _owner) public view override returns (uint256) {
        return balances[_owner];
    }

    function approve(address _spender, uint256 _value) public override returns (bool) {
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function allowance(address _owner, address _spender) public view override returns (uint256) {
        return allowed[_owner][_spender];
    }
}


contract UnlimitedAllowanceToken is ERC20Token {

    uint256 constant MAX_UINT = 2**256 - 1;

    /// @dev ERC20 transferFrom, modified such that an allowance of MAX_UINT represents an unlimited allowance.
    /// @param _from Address to transfer from.
    /// @param _to Address to transfer to.
    /// @param _value Amount to transfer.
    /// @return Success of transfer.
    function transferFrom(address _from, address _to, uint256 _value)
        public
        override
        returns (bool)
    {
        uint256 _allowance = allowed[_from][msg.sender];
        require(balances[_from] >= _value, "Insufficient balance");
        require(_allowance >= _value, "Insufficient allowance");
        require(balances[_to] + _value >= balances[_to], "Overflow");
        
        balances[_to] += _value;
        balances[_from] -= _value;
        if (_allowance < MAX_UINT) {
            allowed[_from][msg.sender] -= _value;
        }
        emit Transfer(_from, _to, _value);
        return true;
    }
}


contract ZRXToken is 
    UnlimitedAllowanceToken
{

    // solhint-disable const-name-snakecase
    uint8 public constant decimals = 18;
    string public constant name = "0x Protocol Token";
    string public constant symbol = "ZRX";
    // solhint-enable const-name-snakecase

    constructor() {
        _totalSupply = 10**27; // 1 billion tokens, 18 decimal places
        balances[msg.sender] = _totalSupply;
    }
}
