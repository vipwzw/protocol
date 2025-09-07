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


contract TestLibERC20TokenTarget {

    event ApproveCalled(
        address spender,
        uint256 allowance
    );

    event TransferCalled(
        address to,
        uint256 amount
    );

    event TransferFromCalled(
        address from,
        address to,
        uint256 amount
    );

    bool private _shouldRevert;
    bytes private _revertData;
    bytes private _returnData;

    function setBehavior(
        bool shouldRevert,
        bytes calldata revertData,
        bytes calldata returnData
    )
        external
    {
        _shouldRevert = shouldRevert;
        _revertData = revertData;
        _returnData = returnData;
    }

    function approve(
        address spender,
        uint256 allowance
    )
        external
        returns (bool)
    {
        emit ApproveCalled(spender, allowance);
        if (_shouldRevert) {
            if (_revertData.length > 0) {
                bytes memory revertData = _revertData;
                assembly { revert(add(revertData, 0x20), mload(revertData)) }
            } else {
                revert("TestLibERC20TokenTarget: approve revert");
            }
        }
        
        if (_returnData.length == 0) {
            return true;
        } else if (_returnData.length == 32) {
            return abi.decode(_returnData, (bool));
        } else {
            // Custom return data handling
            bytes memory returnData = _returnData;
            assembly { return(add(returnData, 0x20), mload(returnData)) }
        }
    }

    function transfer(
        address to,
        uint256 amount
    )
        external
        returns (bool)
    {
        emit TransferCalled(to, amount);
        if (_shouldRevert) {
            if (_revertData.length > 0) {
                bytes memory revertData = _revertData;
                assembly { revert(add(revertData, 0x20), mload(revertData)) }
            } else {
                revert("TestLibERC20TokenTarget: transfer revert");
            }
        }
        
        if (_returnData.length == 0) {
            return true;
        } else if (_returnData.length == 32) {
            return abi.decode(_returnData, (bool));
        } else {
            // Custom return data handling
            bytes memory returnData = _returnData;
            assembly { return(add(returnData, 0x20), mload(returnData)) }
        }
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    )
        external
        returns (bool)
    {
        emit TransferFromCalled(from, to, amount);
        if (_shouldRevert) {
            if (_revertData.length > 0) {
                bytes memory revertData = _revertData;
                assembly { revert(add(revertData, 0x20), mload(revertData)) }
            } else {
                revert("TestLibERC20TokenTarget: transferFrom revert");
            }
        }
        
        if (_returnData.length == 0) {
            return true;
        } else if (_returnData.length == 32) {
            return abi.decode(_returnData, (bool));
        } else {
            // Custom return data handling
            bytes memory returnData = _returnData;
            assembly { return(add(returnData, 0x20), mload(returnData)) }
        }
    }

    function decimals()
        external
        view
        returns (uint8)
    {
        if (_shouldRevert) {
            if (_revertData.length > 0) {
                bytes memory revertData = _revertData;
                assembly { revert(add(revertData, 0x20), mload(revertData)) }
            } else {
                revert("TestLibERC20TokenTarget: decimals revert");
            }
        }
        
        if (_returnData.length == 0) {
            return 18; // Default ERC20 decimals
        } else if (_returnData.length == 32) {
            return abi.decode(_returnData, (uint8));
        } else {
            // Custom return data handling
            bytes memory returnData = _returnData;
            assembly { return(add(returnData, 0x20), mload(returnData)) }
        }
    }
}
