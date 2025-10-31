// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestERC20Token - 用于测试的 ERC20 代币
contract TestERC20Token is ERC20 {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /// @notice 铸造代币
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice 销毁代币
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

