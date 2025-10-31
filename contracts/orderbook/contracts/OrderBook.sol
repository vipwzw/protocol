// SPDX-License-Identifier: Apache-2.0
/*

  Copyright 2025 ZeroEx Intl.

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

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title OrderBook - ETH 和 ERC20 代币之间的限价订单簿
/// @notice 支持创建买单/卖单、撮合交易、订单管理
contract OrderBook is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ 枚举 ============

    /// @notice 订单类型
    enum OrderType {
        BUY,  // 用 ETH 买 Token
        SELL  // 用 Token 卖出获得 ETH
    }

    /// @notice 订单状态
    enum OrderStatus {
        ACTIVE,      // 活跃
        FILLED,      // 完全成交
        CANCELLED,   // 已取消
        EXPIRED      // 已过期
    }

    // ============ 结构体 ============

    /// @notice 订单结构
    struct Order {
        uint256 orderId;           // 订单唯一 ID
        address maker;             // 订单创建者
        address token;             // ERC20 代币地址
        OrderType orderType;       // BUY 或 SELL
        uint256 price;             // 价格（1 token 需要多少 wei 的 ETH）
        uint256 amount;            // 代币数量
        uint256 filledAmount;      // 已成交数量
        uint256 timestamp;         // 创建时间
        OrderStatus status;        // 订单状态
    }

    // ============ 状态变量 ============

    /// @notice 订单计数器
    uint256 public orderCounter;

    /// @notice 订单 ID => 订单信息
    mapping(uint256 => Order) public orders;

    /// @notice 用户地址 => 订单 ID 列表
    mapping(address => uint256[]) public userOrders;

    /// @notice Token 地址 => 买单 ID 列表
    mapping(address => uint256[]) public buyOrderIds;

    /// @notice Token 地址 => 卖单 ID 列表
    mapping(address => uint256[]) public sellOrderIds;

    // ============ 事件 ============

    /// @notice 订单创建事件
    event OrderCreated(
        uint256 indexed orderId,
        address indexed maker,
        address indexed token,
        OrderType orderType,
        uint256 price,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice 订单成交事件
    event OrderFilled(
        uint256 indexed orderId,
        address indexed taker,
        uint256 fillAmount,
        uint256 remainingAmount,
        uint256 timestamp
    );

    /// @notice 订单完全成交事件
    event OrderFullyFilled(
        uint256 indexed orderId,
        uint256 timestamp
    );

    /// @notice 订单取消事件
    event OrderCancelled(
        uint256 indexed orderId,
        address indexed maker,
        uint256 refundedAmount,
        uint256 timestamp
    );

    // ============ 错误 ============

    error InvalidAmount();
    error InvalidPrice();
    error InvalidToken();
    error InsufficientETH();
    error InsufficientTokenBalance();
    error InsufficientTokenAllowance();
    error OrderNotFound();
    error OrderNotActive();
    error UnauthorizedCancellation();
    error InvalidFillAmount();
    error OrderAlreadyFilled();

    // ============ 修饰符 ============

    modifier validOrder(uint256 orderId) {
        if (orderId == 0 || orderId > orderCounter) {
            revert OrderNotFound();
        }
        _;
    }

    // ============ 外部函数 ============

    /// @notice 创建买单（用 ETH 购买 Token）
    /// @param token ERC20 代币地址
    /// @param price 价格（1 token 需要多少 wei 的 ETH）
    /// @param amount 想要购买的代币数量
    /// @return orderId 订单 ID
    function createBuyOrder(
        address token,
        uint256 price,
        uint256 amount
    ) external payable nonReentrant returns (uint256 orderId) {
        // 验证参数
        if (token == address(0)) revert InvalidToken();
        if (price == 0) revert InvalidPrice();
        if (amount == 0) revert InvalidAmount();

        // 计算所需 ETH
        uint256 requiredETH = (price * amount) / 1e18;
        if (msg.value < requiredETH) revert InsufficientETH();

        // 创建订单
        orderId = ++orderCounter;
        orders[orderId] = Order({
            orderId: orderId,
            maker: msg.sender,
            token: token,
            orderType: OrderType.BUY,
            price: price,
            amount: amount,
            filledAmount: 0,
            timestamp: block.timestamp,
            status: OrderStatus.ACTIVE
        });

        // 记录订单
        userOrders[msg.sender].push(orderId);
        buyOrderIds[token].push(orderId);

        // 退还多余的 ETH
        if (msg.value > requiredETH) {
            (bool success, ) = msg.sender.call{value: msg.value - requiredETH}("");
            require(success, "ETH refund failed");
        }

        emit OrderCreated(
            orderId,
            msg.sender,
            token,
            OrderType.BUY,
            price,
            amount,
            block.timestamp
        );
    }

    /// @notice 创建卖单（用 Token 换取 ETH）
    /// @param token ERC20 代币地址
    /// @param price 价格（1 token 需要多少 wei 的 ETH）
    /// @param amount 想要卖出的代币数量
    /// @return orderId 订单 ID
    function createSellOrder(
        address token,
        uint256 price,
        uint256 amount
    ) external nonReentrant returns (uint256 orderId) {
        // 验证参数
        if (token == address(0)) revert InvalidToken();
        if (price == 0) revert InvalidPrice();
        if (amount == 0) revert InvalidAmount();

        IERC20 tokenContract = IERC20(token);

        // 检查余额和授权
        if (tokenContract.balanceOf(msg.sender) < amount) {
            revert InsufficientTokenBalance();
        }
        if (tokenContract.allowance(msg.sender, address(this)) < amount) {
            revert InsufficientTokenAllowance();
        }

        // 转移代币到合约托管
        tokenContract.safeTransferFrom(msg.sender, address(this), amount);

        // 创建订单
        orderId = ++orderCounter;
        orders[orderId] = Order({
            orderId: orderId,
            maker: msg.sender,
            token: token,
            orderType: OrderType.SELL,
            price: price,
            amount: amount,
            filledAmount: 0,
            timestamp: block.timestamp,
            status: OrderStatus.ACTIVE
        });

        // 记录订单
        userOrders[msg.sender].push(orderId);
        sellOrderIds[token].push(orderId);

        emit OrderCreated(
            orderId,
            msg.sender,
            token,
            OrderType.SELL,
            price,
            amount,
            block.timestamp
        );
    }

    /// @notice 撮合交易（吃单）
    /// @param orderId 订单 ID
    /// @param fillAmount 成交数量
    /// @return executedAmount 实际成交数量
    function fillOrder(
        uint256 orderId,
        uint256 fillAmount
    ) external payable nonReentrant validOrder(orderId) returns (uint256 executedAmount) {
        Order storage order = orders[orderId];

        // 验证订单状态
        if (order.status != OrderStatus.ACTIVE) revert OrderNotActive();
        if (fillAmount == 0) revert InvalidFillAmount();

        // 计算可成交数量
        uint256 remainingAmount = order.amount - order.filledAmount;
        executedAmount = fillAmount > remainingAmount ? remainingAmount : fillAmount;

        if (executedAmount == 0) revert OrderAlreadyFilled();

        // 计算所需资产
        uint256 requiredAsset = (order.price * executedAmount) / 1e18;

        if (order.orderType == OrderType.BUY) {
            // 吃买单：Taker 卖 Token 给 Maker
            // Taker 提供 Token，获得 ETH
            IERC20 tokenContract = IERC20(order.token);

            // 检查 Taker 的余额和授权
            if (tokenContract.balanceOf(msg.sender) < executedAmount) {
                revert InsufficientTokenBalance();
            }
            if (tokenContract.allowance(msg.sender, address(this)) < executedAmount) {
                revert InsufficientTokenAllowance();
            }

            // 转移 Token 从 Taker 到 Maker
            tokenContract.safeTransferFrom(msg.sender, order.maker, executedAmount);

            // 转移 ETH 从合约到 Taker
            (bool success, ) = msg.sender.call{value: requiredAsset}("");
            require(success, "ETH transfer to taker failed");

        } else {
            // 吃卖单：Taker 买 Token 从 Maker
            // Taker 提供 ETH，获得 Token
            if (msg.value < requiredAsset) revert InsufficientETH();

            IERC20 tokenContract = IERC20(order.token);

            // 转移 Token 从合约到 Taker
            tokenContract.safeTransfer(msg.sender, executedAmount);

            // 转移 ETH 从 Taker 到 Maker
            (bool success, ) = order.maker.call{value: requiredAsset}("");
            require(success, "ETH transfer to maker failed");

            // 退还多余的 ETH
            if (msg.value > requiredAsset) {
                (bool refundSuccess, ) = msg.sender.call{value: msg.value - requiredAsset}("");
                require(refundSuccess, "ETH refund failed");
            }
        }

        // 更新订单状态
        order.filledAmount += executedAmount;
        remainingAmount = order.amount - order.filledAmount;

        emit OrderFilled(
            orderId,
            msg.sender,
            executedAmount,
            remainingAmount,
            block.timestamp
        );

        // 如果完全成交，更新状态
        if (remainingAmount == 0) {
            order.status = OrderStatus.FILLED;
            emit OrderFullyFilled(orderId, block.timestamp);
        }
    }

    /// @notice 取消订单
    /// @param orderId 订单 ID
    function cancelOrder(uint256 orderId) external nonReentrant validOrder(orderId) {
        Order storage order = orders[orderId];

        // 验证权限
        if (order.maker != msg.sender) revert UnauthorizedCancellation();
        if (order.status != OrderStatus.ACTIVE) revert OrderNotActive();

        // 计算未成交数量
        uint256 remainingAmount = order.amount - order.filledAmount;
        uint256 refundedAmount = 0;

        if (order.orderType == OrderType.BUY) {
            // 退还 ETH
            refundedAmount = (order.price * remainingAmount) / 1e18;
            (bool success, ) = order.maker.call{value: refundedAmount}("");
            require(success, "ETH refund failed");
        } else {
            // 退还 Token
            refundedAmount = remainingAmount;
            IERC20(order.token).safeTransfer(order.maker, remainingAmount);
        }

        // 更新状态
        order.status = OrderStatus.CANCELLED;

        emit OrderCancelled(orderId, order.maker, refundedAmount, block.timestamp);
    }

    // ============ 查询函数 ============

    /// @notice 批量获取订单信息（核心查询函数）
    /// @param orderIds 订单 ID 列表
    /// @return 订单信息列表
    /// @dev 客户端通过事件获取订单 ID，然后批量查询订单详情
    function getOrders(uint256[] calldata orderIds) external view returns (Order[] memory) {
        Order[] memory result = new Order[](orderIds.length);
        for (uint256 i = 0; i < orderIds.length; i++) {
            result[i] = orders[orderIds[i]];
        }
        return result;
    }

    /// @notice 获取单个订单信息
    /// @param orderId 订单 ID
    /// @return 订单信息
    function getOrder(uint256 orderId) external view validOrder(orderId) returns (Order memory) {
        return orders[orderId];
    }

    /// @notice 计算成交所需资产
    /// @param orderId 订单 ID
    /// @param fillAmount 成交数量
    /// @return requiredAsset 所需资产数量（ETH 为 wei，Token 为最小单位）
    function calculateFillCost(
        uint256 orderId,
        uint256 fillAmount
    ) external view validOrder(orderId) returns (uint256 requiredAsset) {
        Order memory order = orders[orderId];
        uint256 remainingAmount = order.amount - order.filledAmount;
        uint256 executedAmount = fillAmount > remainingAmount ? remainingAmount : fillAmount;
        requiredAsset = (order.price * executedAmount) / 1e18;
    }

    /// @notice 获取订单剩余数量
    /// @param orderId 订单 ID
    /// @return 剩余数量
    function getRemainingAmount(uint256 orderId) external view validOrder(orderId) returns (uint256) {
        Order memory order = orders[orderId];
        return order.amount - order.filledAmount;
    }

    // ============ 接收 ETH ============

    /// @notice 接收 ETH
    receive() external payable {}
}

