// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../contracts/OrderBook.sol";
import "../contracts/test/TestERC20Token.sol";

contract OrderBookTest is Test {
    OrderBook public orderBook;
    TestERC20Token public token;

    address public owner;
    address public maker1;
    address public maker2;
    address public taker1;
    address public taker2;

    uint256 constant INITIAL_SUPPLY = 10000 ether;
    uint256 constant ONE_ETH = 1 ether;
    uint256 constant ONE_TOKEN = 1 ether;

    event OrderCreated(
        uint256 indexed orderId,
        address indexed maker,
        address indexed token,
        OrderBook.OrderType orderType,
        uint256 price,
        uint256 amount,
        uint256 timestamp
    );

    event OrderFilled(
        uint256 indexed orderId,
        address indexed taker,
        uint256 fillAmount,
        uint256 remainingAmount,
        uint256 timestamp
    );

    event OrderFullyFilled(uint256 indexed orderId, uint256 timestamp);

    event OrderCancelled(uint256 indexed orderId, address indexed maker, uint256 refundedAmount, uint256 timestamp);

    function setUp() public {
        owner = address(this);
        maker1 = makeAddr("maker1");
        maker2 = makeAddr("maker2");
        taker1 = makeAddr("taker1");
        taker2 = makeAddr("taker2");

        // 给测试账户提供 ETH
        vm.deal(maker1, 100 ether);
        vm.deal(maker2, 100 ether);
        vm.deal(taker1, 100 ether);
        vm.deal(taker2, 100 ether);

        // 部署合约
        token = new TestERC20Token("Test Token", "TEST", 18);
        orderBook = new OrderBook();

        // 铸造代币
        token.mint(maker1, INITIAL_SUPPLY);
        token.mint(maker2, INITIAL_SUPPLY);
        token.mint(taker1, INITIAL_SUPPLY);
        token.mint(taker2, INITIAL_SUPPLY);
    }

    // ============ 创建买单测试 ============

    function test_CreateBuyOrder() public {
        uint256 price = 0.001 ether; // 1 token = 0.001 ETH
        uint256 amount = 100 ether; // 100 tokens
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        vm.startPrank(maker1);

        vm.expectEmit(true, true, true, true);
        emit OrderCreated(1, maker1, address(token), OrderBook.OrderType.BUY, price, amount, block.timestamp);

        uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);

        vm.stopPrank();

        assertEq(orderId, 1);

        OrderBook.Order memory order = orderBook.getOrder(1);
        assertEq(order.orderId, 1);
        assertEq(order.maker, maker1);
        assertEq(order.token, address(token));
        assertEq(uint8(order.orderType), uint8(OrderBook.OrderType.BUY));
        assertEq(order.price, price);
        assertEq(order.amount, amount);
        assertEq(order.filledAmount, 0);
        assertEq(uint8(order.status), uint8(OrderBook.OrderStatus.ACTIVE));
    }

    function test_CreateBuyOrder_RefundExtraETH() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;
        uint256 requiredETH = (price * amount) / ONE_TOKEN;
        uint256 extraETH = 1 ether;

        vm.startPrank(maker1);

        uint256 balanceBefore = maker1.balance;
        orderBook.createBuyOrder{value: requiredETH + extraETH}(address(token), price, amount);
        uint256 balanceAfter = maker1.balance;

        vm.stopPrank();

        assertEq(balanceBefore - balanceAfter, requiredETH);
    }

    function test_CreateBuyOrder_RevertInvalidToken() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;

        vm.startPrank(maker1);
        vm.expectRevert(OrderBook.InvalidToken.selector);
        orderBook.createBuyOrder{value: 1 ether}(address(0), price, amount);
        vm.stopPrank();
    }

    function test_CreateBuyOrder_RevertInvalidPrice() public {
        uint256 amount = 100 ether;

        vm.startPrank(maker1);
        vm.expectRevert(OrderBook.InvalidPrice.selector);
        orderBook.createBuyOrder{value: 1 ether}(address(token), 0, amount);
        vm.stopPrank();
    }

    function test_CreateBuyOrder_RevertInvalidAmount() public {
        uint256 price = 0.001 ether;

        vm.startPrank(maker1);
        vm.expectRevert(OrderBook.InvalidAmount.selector);
        orderBook.createBuyOrder{value: 1 ether}(address(token), price, 0);
        vm.stopPrank();
    }

    function test_CreateBuyOrder_RevertInsufficientETH() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;

        vm.startPrank(maker1);
        vm.expectRevert(OrderBook.InsufficientETH.selector);
        orderBook.createBuyOrder{value: 0}(address(token), price, amount);
        vm.stopPrank();
    }

    // ============ 创建卖单测试 ============

    function test_CreateSellOrder() public {
        uint256 price = 0.002 ether;
        uint256 amount = 50 ether;

        vm.startPrank(maker1);

        token.approve(address(orderBook), amount);

        vm.expectEmit(true, true, true, true);
        emit OrderCreated(1, maker1, address(token), OrderBook.OrderType.SELL, price, amount, block.timestamp);

        uint256 orderId = orderBook.createSellOrder(address(token), price, amount);

        vm.stopPrank();

        assertEq(orderId, 1);

        OrderBook.Order memory order = orderBook.getOrder(1);
        assertEq(uint8(order.orderType), uint8(OrderBook.OrderType.SELL));
        assertEq(token.balanceOf(address(orderBook)), amount);
    }

    function test_CreateSellOrder_RevertInsufficientBalance() public {
        uint256 price = 0.002 ether;
        uint256 amount = INITIAL_SUPPLY + 1 ether;

        vm.startPrank(maker1);
        token.approve(address(orderBook), amount);

        vm.expectRevert(OrderBook.InsufficientTokenBalance.selector);
        orderBook.createSellOrder(address(token), price, amount);
        vm.stopPrank();
    }

    function test_CreateSellOrder_RevertInsufficientAllowance() public {
        uint256 price = 0.002 ether;
        uint256 amount = 50 ether;

        vm.startPrank(maker1);
        vm.expectRevert(OrderBook.InsufficientTokenAllowance.selector);
        orderBook.createSellOrder(address(token), price, amount);
        vm.stopPrank();
    }

    // ============ 吃买单测试 ============

    function test_FillBuyOrder_Complete() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        // Maker 创建买单
        vm.prank(maker1);
        uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);

        // Taker 吃单
        vm.startPrank(taker1);
        token.approve(address(orderBook), amount);

        uint256 takerTokenBefore = token.balanceOf(taker1);
        uint256 takerETHBefore = taker1.balance;
        uint256 makerTokenBefore = token.balanceOf(maker1);

        vm.expectEmit(true, true, false, true);
        emit OrderFilled(orderId, taker1, amount, 0, block.timestamp);

        vm.expectEmit(true, false, false, true);
        emit OrderFullyFilled(orderId, block.timestamp);

        orderBook.fillOrder(orderId, amount);

        vm.stopPrank();

        // 验证余额
        assertEq(takerTokenBefore - token.balanceOf(taker1), amount);
        assertEq(token.balanceOf(maker1) - makerTokenBefore, amount);
        assertEq(taker1.balance - takerETHBefore, requiredETH);

        // 验证订单状态
        OrderBook.Order memory order = orderBook.getOrder(orderId);
        assertEq(order.filledAmount, amount);
        assertEq(uint8(order.status), uint8(OrderBook.OrderStatus.FILLED));
    }

    function test_FillBuyOrder_Partial() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;
        uint256 fillAmount = 30 ether;
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        // Maker 创建买单
        vm.prank(maker1);
        uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);

        // Taker 部分吃单
        vm.startPrank(taker1);
        token.approve(address(orderBook), fillAmount);

        vm.expectEmit(true, true, false, true);
        emit OrderFilled(orderId, taker1, fillAmount, amount - fillAmount, block.timestamp);

        orderBook.fillOrder(orderId, fillAmount);

        vm.stopPrank();

        // 验证订单状态
        OrderBook.Order memory order = orderBook.getOrder(orderId);
        assertEq(order.filledAmount, fillAmount);
        assertEq(uint8(order.status), uint8(OrderBook.OrderStatus.ACTIVE));
    }

    function test_FillBuyOrder_Multiple() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        // Maker 创建买单
        vm.prank(maker1);
        uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);

        // 第一次成交
        vm.startPrank(taker1);
        token.approve(address(orderBook), 30 ether);
        orderBook.fillOrder(orderId, 30 ether);
        vm.stopPrank();

        // 第二次成交
        vm.startPrank(taker2);
        token.approve(address(orderBook), 40 ether);
        orderBook.fillOrder(orderId, 40 ether);
        vm.stopPrank();

        // 第三次成交（完全成交）
        vm.startPrank(taker1);
        token.approve(address(orderBook), 30 ether);
        orderBook.fillOrder(orderId, 30 ether);
        vm.stopPrank();

        // 验证订单完全成交
        OrderBook.Order memory order = orderBook.getOrder(orderId);
        assertEq(order.filledAmount, amount);
        assertEq(uint8(order.status), uint8(OrderBook.OrderStatus.FILLED));
    }

    // ============ 吃卖单测试 ============

    function test_FillSellOrder_Complete() public {
        uint256 price = 0.002 ether;
        uint256 amount = 50 ether;

        // Maker 创建卖单
        vm.startPrank(maker1);
        token.approve(address(orderBook), amount);
        uint256 orderId = orderBook.createSellOrder(address(token), price, amount);
        vm.stopPrank();

        // Taker 吃单
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        vm.startPrank(taker1);

        uint256 takerTokenBefore = token.balanceOf(taker1);
        uint256 takerETHBefore = taker1.balance;
        uint256 makerETHBefore = maker1.balance;

        vm.expectEmit(true, true, false, true);
        emit OrderFilled(orderId, taker1, amount, 0, block.timestamp);

        vm.expectEmit(true, false, false, true);
        emit OrderFullyFilled(orderId, block.timestamp);

        orderBook.fillOrder{value: requiredETH}(orderId, amount);

        vm.stopPrank();

        // 验证余额
        assertEq(token.balanceOf(taker1) - takerTokenBefore, amount);
        assertEq(takerETHBefore - taker1.balance, requiredETH);
        assertEq(maker1.balance - makerETHBefore, requiredETH);

        // 验证订单状态
        OrderBook.Order memory order = orderBook.getOrder(orderId);
        assertEq(order.filledAmount, amount);
        assertEq(uint8(order.status), uint8(OrderBook.OrderStatus.FILLED));
    }

    function test_FillSellOrder_RefundExtraETH() public {
        uint256 price = 0.002 ether;
        uint256 amount = 50 ether;

        // Maker 创建卖单
        vm.startPrank(maker1);
        token.approve(address(orderBook), amount);
        uint256 orderId = orderBook.createSellOrder(address(token), price, amount);
        vm.stopPrank();

        // Taker 吃单（发送额外的 ETH）
        uint256 requiredETH = (price * amount) / ONE_TOKEN;
        uint256 extraETH = 1 ether;

        vm.startPrank(taker1);

        uint256 balanceBefore = taker1.balance;
        orderBook.fillOrder{value: requiredETH + extraETH}(orderId, amount);
        uint256 balanceAfter = taker1.balance;

        vm.stopPrank();

        assertEq(balanceBefore - balanceAfter, requiredETH);
    }

    // ============ 取消订单测试 ============

    function test_CancelBuyOrder() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        // 创建买单
        vm.startPrank(maker1);
        uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);

        uint256 balanceBefore = maker1.balance;

        vm.expectEmit(true, true, false, true);
        emit OrderCancelled(orderId, maker1, requiredETH, block.timestamp);

        orderBook.cancelOrder(orderId);

        uint256 balanceAfter = maker1.balance;

        vm.stopPrank();

        // 验证 ETH 退还
        assertEq(balanceAfter - balanceBefore, requiredETH);

        // 验证订单状态
        OrderBook.Order memory order = orderBook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(OrderBook.OrderStatus.CANCELLED));
    }

    function test_CancelSellOrder() public {
        uint256 price = 0.002 ether;
        uint256 amount = 50 ether;

        // 创建卖单
        vm.startPrank(maker1);
        token.approve(address(orderBook), amount);
        uint256 orderId = orderBook.createSellOrder(address(token), price, amount);

        uint256 balanceBefore = token.balanceOf(maker1);

        vm.expectEmit(true, true, false, true);
        emit OrderCancelled(orderId, maker1, amount, block.timestamp);

        orderBook.cancelOrder(orderId);

        uint256 balanceAfter = token.balanceOf(maker1);

        vm.stopPrank();

        // 验证 Token 退还
        assertEq(balanceAfter - balanceBefore, amount);

        // 验证订单状态
        OrderBook.Order memory order = orderBook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(OrderBook.OrderStatus.CANCELLED));
    }

    function test_CancelOrder_Partial() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;
        uint256 fillAmount = 30 ether;
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        // 创建买单
        vm.prank(maker1);
        uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);

        // 部分成交
        vm.startPrank(taker1);
        token.approve(address(orderBook), fillAmount);
        orderBook.fillOrder(orderId, fillAmount);
        vm.stopPrank();

        // 取消订单
        vm.startPrank(maker1);

        uint256 balanceBefore = maker1.balance;
        uint256 remainingAmount = amount - fillAmount;
        uint256 refundETH = (price * remainingAmount) / ONE_TOKEN;

        vm.expectEmit(true, true, false, true);
        emit OrderCancelled(orderId, maker1, refundETH, block.timestamp);

        orderBook.cancelOrder(orderId);

        uint256 balanceAfter = maker1.balance;

        vm.stopPrank();

        assertEq(balanceAfter - balanceBefore, refundETH);
    }

    function test_CancelOrder_RevertUnauthorized() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        // Maker1 创建订单
        vm.prank(maker1);
        uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);

        // Taker1 尝试取消（应该失败）
        vm.prank(taker1);
        vm.expectRevert(OrderBook.UnauthorizedCancellation.selector);
        orderBook.cancelOrder(orderId);
    }

    function test_CancelOrder_RevertNotActive() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        // 创建并取消订单
        vm.startPrank(maker1);
        uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);
        orderBook.cancelOrder(orderId);

        // 再次取消（应该失败）
        vm.expectRevert(OrderBook.OrderNotActive.selector);
        orderBook.cancelOrder(orderId);
        vm.stopPrank();
    }

    // ============ 查询功能测试 ============

    function test_GetUserOrders() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        // Maker1 创建多个订单
        vm.startPrank(maker1);
        orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);
        orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);
        vm.stopPrank();

        // Maker2 创建一个订单
        vm.startPrank(maker2);
        token.approve(address(orderBook), amount);
        orderBook.createSellOrder(address(token), price, amount);
        vm.stopPrank();

        // 使用 getOrders 批量查询订单
        uint256[] memory orderIds = new uint256[](3);
        orderIds[0] = 1;
        orderIds[1] = 2;
        orderIds[2] = 3;
        OrderBook.Order[] memory orders = orderBook.getOrders(orderIds);
        
        // 验证 maker1 的订单
        assertEq(orders[0].maker, maker1);
        assertEq(orders[0].orderId, 1);
        assertEq(orders[1].maker, maker1);
        assertEq(orders[1].orderId, 2);
        
        // 验证 maker2 的订单
        assertEq(orders[2].maker, maker2);
        assertEq(orders[2].orderId, 3);
    }

    function test_GetActiveBuyOrders() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        // 创建买单
        vm.startPrank(maker1);
        orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);
        orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);
        vm.stopPrank();

        // 使用 getOrders 查询买单
        uint256[] memory orderIds = new uint256[](2);
        orderIds[0] = 1;
        orderIds[1] = 2;
        OrderBook.Order[] memory buyOrders = orderBook.getOrders(orderIds);
        assertEq(buyOrders.length, 2);
        assertEq(buyOrders[0].orderId, 1);
        assertEq(uint256(buyOrders[0].orderType), uint256(OrderBook.OrderType.BUY));
        assertEq(buyOrders[1].orderId, 2);
        assertEq(uint256(buyOrders[1].orderType), uint256(OrderBook.OrderType.BUY));
    }

    function test_GetActiveSellOrders() public {
        uint256 price = 0.002 ether;
        uint256 amount = 50 ether;

        // 创建卖单
        vm.startPrank(maker1);
        token.approve(address(orderBook), amount * 2);
        orderBook.createSellOrder(address(token), price, amount);
        orderBook.createSellOrder(address(token), price, amount);
        vm.stopPrank();

        // 使用 getOrders 查询卖单
        uint256[] memory orderIds = new uint256[](2);
        orderIds[0] = 1;
        orderIds[1] = 2;
        OrderBook.Order[] memory sellOrders = orderBook.getOrders(orderIds);
        assertEq(sellOrders.length, 2);
        assertEq(sellOrders[0].orderId, 1);
        assertEq(uint256(sellOrders[0].orderType), uint256(OrderBook.OrderType.SELL));
        assertEq(sellOrders[1].orderId, 2);
        assertEq(uint256(sellOrders[1].orderType), uint256(OrderBook.OrderType.SELL));
    }

    function test_CalculateFillCost() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        vm.prank(maker1);
        uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);

        uint256 fillAmount = 50 ether;
        uint256 expectedCost = (price * fillAmount) / ONE_TOKEN;

        uint256 cost = orderBook.calculateFillCost(orderId, fillAmount);
        assertEq(cost, expectedCost);
    }

    function test_GetRemainingAmount() public {
        uint256 price = 0.001 ether;
        uint256 amount = 100 ether;
        uint256 requiredETH = (price * amount) / ONE_TOKEN;

        vm.prank(maker1);
        uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);

        uint256 remaining = orderBook.getRemainingAmount(orderId);
        assertEq(remaining, amount);

        // 部分成交
        uint256 fillAmount = 30 ether;
        vm.startPrank(taker1);
        token.approve(address(orderBook), fillAmount);
        orderBook.fillOrder(orderId, fillAmount);
        vm.stopPrank();

        remaining = orderBook.getRemainingAmount(orderId);
        assertEq(remaining, amount - fillAmount);
    }

    // ============ Fuzz 测试 ============

    function testFuzz_CreateBuyOrder(uint256 price, uint256 amount) public {
        // 限制参数范围
        price = bound(price, 1, 1 ether);
        amount = bound(amount, 1, 1000 ether);

        uint256 requiredETH = (price * amount) / ONE_TOKEN;
        vm.assume(requiredETH <= 100 ether); // 确保有足够的 ETH

        vm.prank(maker1);
        uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(address(token), price, amount);

        OrderBook.Order memory order = orderBook.getOrder(orderId);
        assertEq(order.price, price);
        assertEq(order.amount, amount);
    }

    function testFuzz_FillOrder(uint256 orderAmount, uint256 fillAmount) public {
        // 限制参数范围
        orderAmount = bound(orderAmount, 1 ether, 1000 ether);
        fillAmount = bound(fillAmount, 1, orderAmount);

        uint256 price = 0.001 ether;
        uint256 requiredETH = (price * orderAmount) / ONE_TOKEN;

        // 创建买单
        vm.prank(maker1);
        uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(address(token), price, orderAmount);

        // 吃单
        vm.startPrank(taker1);
        token.approve(address(orderBook), fillAmount);
        orderBook.fillOrder(orderId, fillAmount);
        vm.stopPrank();

        OrderBook.Order memory order = orderBook.getOrder(orderId);
        assertEq(order.filledAmount, fillAmount);
    }
}

