import { expect } from "chai";
import { ethers } from "hardhat";
import { OrderBook, TestERC20Token } from "../src/types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("OrderBook", function () {
    let orderBook: OrderBook;
    let token: TestERC20Token;
    let owner: HardhatEthersSigner;
    let maker1: HardhatEthersSigner;
    let maker2: HardhatEthersSigner;
    let taker1: HardhatEthersSigner;
    let taker2: HardhatEthersSigner;

    // 常量
    const TOKEN_DECIMALS = 18;
    const INITIAL_SUPPLY = ethers.parseEther("10000");
    const ONE_ETH = ethers.parseEther("1");
    const ONE_TOKEN = ethers.parseEther("1");

    beforeEach(async function () {
        // 获取签名者
        [owner, maker1, maker2, taker1, taker2] = await ethers.getSigners();

        // 部署测试代币
        const TestERC20TokenFactory = await ethers.getContractFactory("TestERC20Token");
        token = await TestERC20TokenFactory.deploy("Test Token", "TEST", TOKEN_DECIMALS);
        await token.waitForDeployment();

        // 部署 OrderBook 合约
        const OrderBookFactory = await ethers.getContractFactory("OrderBook");
        orderBook = await OrderBookFactory.deploy();
        await orderBook.waitForDeployment();

        // 给用户铸造代币
        await token.mint(maker1.address, INITIAL_SUPPLY);
        await token.mint(maker2.address, INITIAL_SUPPLY);
        await token.mint(taker1.address, INITIAL_SUPPLY);
        await token.mint(taker2.address, INITIAL_SUPPLY);
    });

    describe("部署", function () {
        it("应该正确初始化", async function () {
            expect(await orderBook.orderCounter()).to.equal(0);
        });
    });

    describe("创建买单", function () {
        it("应该成功创建买单", async function () {
            const price = ethers.parseEther("0.001"); // 1 token = 0.001 ETH
            const amount = ethers.parseEther("100"); // 100 tokens
            const requiredETH = (price * amount) / ONE_TOKEN;

            const tx = await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price, amount, { value: requiredETH });

            await expect(tx)
                .to.emit(orderBook, "OrderCreated")
                .withArgs(1, maker1.address, await token.getAddress(), 0, price, amount, await getBlockTimestamp());

            const order = await orderBook.getOrder(1);
            expect(order.orderId).to.equal(1);
            expect(order.maker).to.equal(maker1.address);
            expect(order.token).to.equal(await token.getAddress());
            expect(order.orderType).to.equal(0); // BUY
            expect(order.price).to.equal(price);
            expect(order.amount).to.equal(amount);
            expect(order.filledAmount).to.equal(0);
            expect(order.status).to.equal(0); // ACTIVE
        });

        it("应该退还多余的 ETH", async function () {
            const price = ethers.parseEther("0.001");
            const amount = ethers.parseEther("100");
            const requiredETH = (price * amount) / ONE_TOKEN;
            const extraETH = ethers.parseEther("1");

            const balanceBefore = await ethers.provider.getBalance(maker1.address);

            const tx = await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price, amount, { value: requiredETH + extraETH });

            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const balanceAfter = await ethers.provider.getBalance(maker1.address);
            const expectedBalance = balanceBefore - requiredETH - gasUsed;

            expect(balanceAfter).to.be.closeTo(expectedBalance, ethers.parseEther("0.0001"));
        });

        it("应该拒绝无效的参数", async function () {
            const price = ethers.parseEther("0.001");
            const amount = ethers.parseEther("100");

            // 无效的 token 地址
            await expect(
                orderBook.connect(maker1).createBuyOrder(ethers.ZeroAddress, price, amount, { value: ONE_ETH })
            ).to.be.revertedWithCustomError(orderBook, "InvalidToken");

            // 无效的价格
            await expect(
                orderBook.connect(maker1).createBuyOrder(await token.getAddress(), 0, amount, { value: ONE_ETH })
            ).to.be.revertedWithCustomError(orderBook, "InvalidPrice");

            // 无效的数量
            await expect(
                orderBook.connect(maker1).createBuyOrder(await token.getAddress(), price, 0, { value: ONE_ETH })
            ).to.be.revertedWithCustomError(orderBook, "InvalidAmount");

            // ETH 不足
            await expect(
                orderBook.connect(maker1).createBuyOrder(await token.getAddress(), price, amount, { value: 0 })
            ).to.be.revertedWithCustomError(orderBook, "InsufficientETH");
        });

        it("应该记录用户订单", async function () {
            const price = ethers.parseEther("0.001");
            const amount = ethers.parseEther("100");
            const requiredETH = (price * amount) / ONE_TOKEN;

            const tx = await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price, amount, { value: requiredETH });

            // 验证事件包含正确的 maker 地址
            await expect(tx)
                .to.emit(orderBook, "OrderCreated")
                .withArgs(1, maker1.address, await token.getAddress(), 0, price, amount, await ethers.provider.getBlock('latest').then(b => b?.timestamp));
        });
    });

    describe("创建卖单", function () {
        it("应该成功创建卖单", async function () {
            const price = ethers.parseEther("0.002"); // 1 token = 0.002 ETH
            const amount = ethers.parseEther("50"); // 50 tokens

            // 授权
            await token.connect(maker1).approve(await orderBook.getAddress(), amount);

            const tx = await orderBook.connect(maker1).createSellOrder(await token.getAddress(), price, amount);

            await expect(tx)
                .to.emit(orderBook, "OrderCreated")
                .withArgs(1, maker1.address, await token.getAddress(), 1, price, amount, await getBlockTimestamp());

            const order = await orderBook.getOrder(1);
            expect(order.orderId).to.equal(1);
            expect(order.maker).to.equal(maker1.address);
            expect(order.orderType).to.equal(1); // SELL
            expect(order.price).to.equal(price);
            expect(order.amount).to.equal(amount);
        });

        it("应该转移代币到合约", async function () {
            const price = ethers.parseEther("0.002");
            const amount = ethers.parseEther("50");

            await token.connect(maker1).approve(await orderBook.getAddress(), amount);

            const balanceBefore = await token.balanceOf(maker1.address);

            await orderBook.connect(maker1).createSellOrder(await token.getAddress(), price, amount);

            const balanceAfter = await token.balanceOf(maker1.address);
            const contractBalance = await token.balanceOf(await orderBook.getAddress());

            expect(balanceBefore - balanceAfter).to.equal(amount);
            expect(contractBalance).to.equal(amount);
        });

        it("应该拒绝余额不足", async function () {
            const price = ethers.parseEther("0.002");
            const amount = INITIAL_SUPPLY + ONE_TOKEN;

            await token.connect(maker1).approve(await orderBook.getAddress(), amount);

            await expect(
                orderBook.connect(maker1).createSellOrder(await token.getAddress(), price, amount)
            ).to.be.revertedWithCustomError(orderBook, "InsufficientTokenBalance");
        });

        it("应该拒绝授权不足", async function () {
            const price = ethers.parseEther("0.002");
            const amount = ethers.parseEther("50");

            // 不授权或授权不足
            await expect(
                orderBook.connect(maker1).createSellOrder(await token.getAddress(), price, amount)
            ).to.be.revertedWithCustomError(orderBook, "InsufficientTokenAllowance");
        });
    });

    describe("撮合交易 - 吃买单", function () {
        let orderId: bigint;
        const price = ethers.parseEther("0.001");
        const amount = ethers.parseEther("100");

        beforeEach(async function () {
            // Maker 创建买单
            const requiredETH = (price * amount) / ONE_TOKEN;
            const tx = await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price, amount, { value: requiredETH });
            const receipt = await tx.wait();
            orderId = 1n;
        });

        it("应该成功完全成交买单", async function () {
            // Taker 卖 Token
            await token.connect(taker1).approve(await orderBook.getAddress(), amount);

            const takerTokenBalanceBefore = await token.balanceOf(taker1.address);
            const takerETHBalanceBefore = await ethers.provider.getBalance(taker1.address);
            const makerTokenBalanceBefore = await token.balanceOf(maker1.address);

            const tx = await orderBook.connect(taker1).fillOrder(orderId, amount);
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            await expect(tx).to.emit(orderBook, "OrderFilled").withArgs(orderId, taker1.address, amount, 0n, await getBlockTimestamp());

            await expect(tx).to.emit(orderBook, "OrderFullyFilled").withArgs(orderId, await getBlockTimestamp());

            // 验证余额变化
            const takerTokenBalanceAfter = await token.balanceOf(taker1.address);
            const takerETHBalanceAfter = await ethers.provider.getBalance(taker1.address);
            const makerTokenBalanceAfter = await token.balanceOf(maker1.address);

            const expectedETH = (price * amount) / ONE_TOKEN;

            expect(takerTokenBalanceBefore - takerTokenBalanceAfter).to.equal(amount);
            expect(makerTokenBalanceAfter - makerTokenBalanceBefore).to.equal(amount);
            expect(takerETHBalanceAfter - takerETHBalanceBefore + gasUsed).to.be.closeTo(
                expectedETH,
                ethers.parseEther("0.0001")
            );

            // 验证订单状态
            const order = await orderBook.getOrder(orderId);
            expect(order.filledAmount).to.equal(amount);
            expect(order.status).to.equal(1); // FILLED
        });

        it("应该成功部分成交买单", async function () {
            const fillAmount = ethers.parseEther("30");

            await token.connect(taker1).approve(await orderBook.getAddress(), fillAmount);

            const tx = await orderBook.connect(taker1).fillOrder(orderId, fillAmount);

            const remainingAmount = amount - fillAmount;
            await expect(tx)
                .to.emit(orderBook, "OrderFilled")
                .withArgs(orderId, taker1.address, fillAmount, remainingAmount, await getBlockTimestamp());

            // 验证订单状态
            const order = await orderBook.getOrder(orderId);
            expect(order.filledAmount).to.equal(fillAmount);
            expect(order.status).to.equal(0); // ACTIVE
        });

        it("应该支持多次部分成交", async function () {
            const fillAmount1 = ethers.parseEther("30");
            const fillAmount2 = ethers.parseEther("40");
            const fillAmount3 = ethers.parseEther("30");

            // 第一次成交
            await token.connect(taker1).approve(await orderBook.getAddress(), fillAmount1);
            await orderBook.connect(taker1).fillOrder(orderId, fillAmount1);

            let order = await orderBook.getOrder(orderId);
            expect(order.filledAmount).to.equal(fillAmount1);
            expect(order.status).to.equal(0); // ACTIVE

            // 第二次成交
            await token.connect(taker2).approve(await orderBook.getAddress(), fillAmount2);
            await orderBook.connect(taker2).fillOrder(orderId, fillAmount2);

            order = await orderBook.getOrder(orderId);
            expect(order.filledAmount).to.equal(fillAmount1 + fillAmount2);
            expect(order.status).to.equal(0); // ACTIVE

            // 第三次成交（完全成交）
            await token.connect(taker1).approve(await orderBook.getAddress(), fillAmount3);
            const tx = await orderBook.connect(taker1).fillOrder(orderId, fillAmount3);

            await expect(tx).to.emit(orderBook, "OrderFullyFilled");

            order = await orderBook.getOrder(orderId);
            expect(order.filledAmount).to.equal(amount);
            expect(order.status).to.equal(1); // FILLED
        });

        it("应该拒绝 Token 余额不足", async function () {
            // 销毁 Taker 的所有代币
            await token.connect(taker1).burn(taker1.address, INITIAL_SUPPLY);

            await expect(orderBook.connect(taker1).fillOrder(orderId, amount)).to.be.revertedWithCustomError(
                orderBook,
                "InsufficientTokenBalance"
            );
        });

        it("应该拒绝 Token 授权不足", async function () {
            await expect(orderBook.connect(taker1).fillOrder(orderId, amount)).to.be.revertedWithCustomError(
                orderBook,
                "InsufficientTokenAllowance"
            );
        });
    });

    describe("撮合交易 - 吃卖单", function () {
        let orderId: bigint;
        const price = ethers.parseEther("0.002");
        const amount = ethers.parseEther("50");

        beforeEach(async function () {
            // Maker 创建卖单
            await token.connect(maker1).approve(await orderBook.getAddress(), amount);
            await orderBook.connect(maker1).createSellOrder(await token.getAddress(), price, amount);
            orderId = 1n;
        });

        it("应该成功完全成交卖单", async function () {
            const requiredETH = (price * amount) / ONE_TOKEN;

            const takerTokenBalanceBefore = await token.balanceOf(taker1.address);
            const takerETHBalanceBefore = await ethers.provider.getBalance(taker1.address);
            const makerETHBalanceBefore = await ethers.provider.getBalance(maker1.address);

            const tx = await orderBook.connect(taker1).fillOrder(orderId, amount, { value: requiredETH });
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            await expect(tx).to.emit(orderBook, "OrderFilled").withArgs(orderId, taker1.address, amount, 0n, await getBlockTimestamp());

            await expect(tx).to.emit(orderBook, "OrderFullyFilled").withArgs(orderId, await getBlockTimestamp());

            // 验证余额变化
            const takerTokenBalanceAfter = await token.balanceOf(taker1.address);
            const takerETHBalanceAfter = await ethers.provider.getBalance(taker1.address);
            const makerETHBalanceAfter = await ethers.provider.getBalance(maker1.address);

            expect(takerTokenBalanceAfter - takerTokenBalanceBefore).to.equal(amount);
            expect(takerETHBalanceBefore - takerETHBalanceAfter - gasUsed).to.be.closeTo(
                requiredETH,
                ethers.parseEther("0.0001")
            );
            expect(makerETHBalanceAfter - makerETHBalanceBefore).to.equal(requiredETH);

            // 验证订单状态
            const order = await orderBook.getOrder(orderId);
            expect(order.filledAmount).to.equal(amount);
            expect(order.status).to.equal(1); // FILLED
        });

        it("应该成功部分成交卖单", async function () {
            const fillAmount = ethers.parseEther("20");
            const requiredETH = (price * fillAmount) / ONE_TOKEN;

            const tx = await orderBook.connect(taker1).fillOrder(orderId, fillAmount, { value: requiredETH });

            const remainingAmount = amount - fillAmount;
            await expect(tx)
                .to.emit(orderBook, "OrderFilled")
                .withArgs(orderId, taker1.address, fillAmount, remainingAmount, await getBlockTimestamp());

            // 验证订单状态
            const order = await orderBook.getOrder(orderId);
            expect(order.filledAmount).to.equal(fillAmount);
            expect(order.status).to.equal(0); // ACTIVE
        });

        it("应该退还多余的 ETH", async function () {
            const requiredETH = (price * amount) / ONE_TOKEN;
            const extraETH = ethers.parseEther("1");

            const balanceBefore = await ethers.provider.getBalance(taker1.address);

            const tx = await orderBook.connect(taker1).fillOrder(orderId, amount, { value: requiredETH + extraETH });
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const balanceAfter = await ethers.provider.getBalance(taker1.address);
            const expectedBalance = balanceBefore - requiredETH - gasUsed;

            expect(balanceAfter).to.be.closeTo(expectedBalance, ethers.parseEther("0.0001"));
        });

        it("应该拒绝 ETH 不足", async function () {
            const requiredETH = (price * amount) / ONE_TOKEN;
            const insufficientETH = requiredETH - ethers.parseEther("0.001");

            await expect(
                orderBook.connect(taker1).fillOrder(orderId, amount, { value: insufficientETH })
            ).to.be.revertedWithCustomError(orderBook, "InsufficientETH");
        });
    });

    describe("取消订单", function () {
        it("应该成功取消买单并退还 ETH", async function () {
            const price = ethers.parseEther("0.001");
            const amount = ethers.parseEther("100");
            const requiredETH = (price * amount) / ONE_TOKEN;

            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price, amount, { value: requiredETH });

            const balanceBefore = await ethers.provider.getBalance(maker1.address);

            const tx = await orderBook.connect(maker1).cancelOrder(1);
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            await expect(tx)
                .to.emit(orderBook, "OrderCancelled")
                .withArgs(1, maker1.address, requiredETH, await getBlockTimestamp());

            const balanceAfter = await ethers.provider.getBalance(maker1.address);
            expect(balanceAfter - balanceBefore + gasUsed).to.be.closeTo(requiredETH, ethers.parseEther("0.0001"));

            const order = await orderBook.getOrder(1);
            expect(order.status).to.equal(2); // CANCELLED
        });

        it("应该成功取消卖单并退还 Token", async function () {
            const price = ethers.parseEther("0.002");
            const amount = ethers.parseEther("50");

            await token.connect(maker1).approve(await orderBook.getAddress(), amount);
            await orderBook.connect(maker1).createSellOrder(await token.getAddress(), price, amount);

            const balanceBefore = await token.balanceOf(maker1.address);

            const tx = await orderBook.connect(maker1).cancelOrder(1);

            await expect(tx)
                .to.emit(orderBook, "OrderCancelled")
                .withArgs(1, maker1.address, amount, await getBlockTimestamp());

            const balanceAfter = await token.balanceOf(maker1.address);
            expect(balanceAfter - balanceBefore).to.equal(amount);

            const order = await orderBook.getOrder(1);
            expect(order.status).to.equal(2); // CANCELLED
        });

        it("应该成功取消部分成交的订单", async function () {
            const price = ethers.parseEther("0.001");
            const amount = ethers.parseEther("100");
            const fillAmount = ethers.parseEther("30");
            const requiredETH = (price * amount) / ONE_TOKEN;

            // 创建买单
            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price, amount, { value: requiredETH });

            // 部分成交
            await token.connect(taker1).approve(await orderBook.getAddress(), fillAmount);
            await orderBook.connect(taker1).fillOrder(1, fillAmount);

            // 取消订单
            const balanceBefore = await ethers.provider.getBalance(maker1.address);

            const tx = await orderBook.connect(maker1).cancelOrder(1);
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const remainingAmount = amount - fillAmount;
            const refundETH = (price * remainingAmount) / ONE_TOKEN;

            await expect(tx)
                .to.emit(orderBook, "OrderCancelled")
                .withArgs(1, maker1.address, refundETH, await getBlockTimestamp());

            const balanceAfter = await ethers.provider.getBalance(maker1.address);
            expect(balanceAfter - balanceBefore + gasUsed).to.be.closeTo(refundETH, ethers.parseEther("0.0001"));
        });

        it("应该拒绝非订单创建者取消", async function () {
            const price = ethers.parseEther("0.001");
            const amount = ethers.parseEther("100");
            const requiredETH = (price * amount) / ONE_TOKEN;

            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price, amount, { value: requiredETH });

            await expect(orderBook.connect(taker1).cancelOrder(1)).to.be.revertedWithCustomError(
                orderBook,
                "UnauthorizedCancellation"
            );
        });

        it("应该拒绝取消非活跃订单", async function () {
            const price = ethers.parseEther("0.001");
            const amount = ethers.parseEther("100");
            const requiredETH = (price * amount) / ONE_TOKEN;

            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price, amount, { value: requiredETH });

            // 先取消一次
            await orderBook.connect(maker1).cancelOrder(1);

            // 再次取消应该失败
            await expect(orderBook.connect(maker1).cancelOrder(1)).to.be.revertedWithCustomError(
                orderBook,
                "OrderNotActive"
            );
        });
    });

    describe("查询功能", function () {
        beforeEach(async function () {
            const price1 = ethers.parseEther("0.001");
            const price2 = ethers.parseEther("0.002");
            const amount = ethers.parseEther("100");

            // 创建买单
            const requiredETH1 = (price1 * amount) / ONE_TOKEN;
            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price1, amount, { value: requiredETH1 });

            // 创建卖单
            await token.connect(maker2).approve(await orderBook.getAddress(), amount);
            await orderBook.connect(maker2).createSellOrder(await token.getAddress(), price2, amount);

            // 创建另一个买单
            const requiredETH2 = (price2 * amount) / ONE_TOKEN;
            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price2, amount, { value: requiredETH2 });
        });

        it("应该正确获取用户订单", async function () {
            // 使用 getOrders 方法批量查询订单
            const orders = await orderBook.getOrders([1, 2, 3]);
            expect(orders.length).to.equal(3);
            
            // 验证 maker1 的订单
            expect(orders[0].maker).to.equal(maker1.address);
            expect(orders[0].orderId).to.equal(1);
            expect(orders[2].maker).to.equal(maker1.address);
            expect(orders[2].orderId).to.equal(3);

            // 验证 maker2 的订单
            expect(orders[1].maker).to.equal(maker2.address);
            expect(orders[1].orderId).to.equal(2);
        });

        it("应该正确获取活跃买单列表", async function () {
            // 使用 getOrders 查询买单并验证类型
            const orders = await orderBook.getOrders([1, 3]);
            expect(orders.length).to.equal(2);
            expect(orders[0].orderId).to.equal(1);
            expect(orders[0].orderType).to.equal(0); // BUY
            expect(orders[0].status).to.equal(0); // ACTIVE
            expect(orders[1].orderId).to.equal(3);
            expect(orders[1].orderType).to.equal(0); // BUY
        });

        it("应该正确获取活跃卖单列表", async function () {
            // 使用 getOrders 查询卖单并验证类型
            const orders = await orderBook.getOrders([2]);
            expect(orders.length).to.equal(1);
            expect(orders[0].orderId).to.equal(2);
            expect(orders[0].orderType).to.equal(1); // SELL
            expect(orders[0].status).to.equal(0); // ACTIVE
        });

        it("应该支持分页查询", async function () {
            // 创建更多订单
            const price = ethers.parseEther("0.001");
            const amount = ethers.parseEther("10");
            const requiredETH = (price * amount) / ONE_TOKEN;

            for (let i = 0; i < 5; i++) {
                await orderBook
                    .connect(maker1)
                    .createBuyOrder(await token.getAddress(), price, amount, { value: requiredETH });
            }

            // 测试批量查询 - 订单 ID 从 1 到 8 (之前有 3 个，新增 5 个)
            const page1 = await orderBook.getOrders([1, 3, 4]); // 第一页 3 个
            expect(page1.length).to.equal(3);

            const page2 = await orderBook.getOrders([5, 6, 7]); // 第二页 3 个
            expect(page2.length).to.equal(3);

            const page3 = await orderBook.getOrders([8]); // 第三页 1 个
            expect(page3.length).to.equal(1);
        });

        it("应该正确计算成交成本", async function () {
            const order = await orderBook.getOrder(1);
            const fillAmount = ethers.parseEther("50");
            const expectedCost = (order.price * fillAmount) / ONE_TOKEN;

            const cost = await orderBook.calculateFillCost(1, fillAmount);
            expect(cost).to.equal(expectedCost);
        });

        it("应该正确获取剩余数量", async function () {
            const amount = ethers.parseEther("100");
            let remaining = await orderBook.getRemainingAmount(1);
            expect(remaining).to.equal(amount);

            // 部分成交
            const fillAmount = ethers.parseEther("30");
            await token.connect(taker1).approve(await orderBook.getAddress(), fillAmount);
            await orderBook.connect(taker1).fillOrder(1, fillAmount);

            remaining = await orderBook.getRemainingAmount(1);
            expect(remaining).to.equal(amount - fillAmount);
        });
    });

    describe("边界条件", function () {
        it("应该拒绝查询不存在的订单", async function () {
            await expect(orderBook.getOrder(999)).to.be.revertedWithCustomError(orderBook, "OrderNotFound");
        });

        it("应该拒绝成交不存在的订单", async function () {
            await expect(orderBook.connect(taker1).fillOrder(999, ONE_TOKEN)).to.be.revertedWithCustomError(
                orderBook,
                "OrderNotFound"
            );
        });

        it("应该拒绝成交已完全成交的订单", async function () {
            const price = ethers.parseEther("0.001");
            const amount = ethers.parseEther("100");
            const requiredETH = (price * amount) / ONE_TOKEN;

            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price, amount, { value: requiredETH });

            // 完全成交
            await token.connect(taker1).approve(await orderBook.getAddress(), amount);
            await orderBook.connect(taker1).fillOrder(1, amount);

            // 再次成交应该失败
            await token.connect(taker1).approve(await orderBook.getAddress(), amount);
            await expect(orderBook.connect(taker1).fillOrder(1, amount)).to.be.revertedWithCustomError(
                orderBook,
                "OrderNotActive"
            );
        });

        it("应该处理超过剩余数量的成交请求", async function () {
            const price = ethers.parseEther("0.001");
            const amount = ethers.parseEther("100");
            const requiredETH = (price * amount) / ONE_TOKEN;

            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price, amount, { value: requiredETH });

            // 尝试成交超过订单数量
            const fillAmount = ethers.parseEther("150");
            await token.connect(taker1).approve(await orderBook.getAddress(), fillAmount);

            const tx = await orderBook.connect(taker1).fillOrder(1, fillAmount);

            // 应该只成交 100（订单的全部数量）
            await expect(tx).to.emit(orderBook, "OrderFilled").withArgs(1, taker1.address, amount, 0n, await getBlockTimestamp());

            const order = await orderBook.getOrder(1);
            expect(order.filledAmount).to.equal(amount);
            expect(order.status).to.equal(1); // FILLED
        });
    });

    describe("复杂场景", function () {
        it("应该支持多个用户同时交易", async function () {
            const price = ethers.parseEther("0.001");
            const amount = ethers.parseEther("1000");
            const requiredETH = (price * amount) / ONE_TOKEN;

            // Maker 创建大额买单
            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price, amount, { value: requiredETH });

            // 多个 Taker 同时成交
            const fillAmount1 = ethers.parseEther("300");
            const fillAmount2 = ethers.parseEther("400");
            const fillAmount3 = ethers.parseEther("300");

            // Taker1 需要授权总共 600 tokens (300 + 300)
            await token.connect(taker1).approve(await orderBook.getAddress(), fillAmount1 + fillAmount3);
            await token.connect(taker2).approve(await orderBook.getAddress(), fillAmount2);

            await orderBook.connect(taker1).fillOrder(1, fillAmount1);
            await orderBook.connect(taker2).fillOrder(1, fillAmount2);
            await orderBook.connect(taker1).fillOrder(1, fillAmount3);

            const order = await orderBook.getOrder(1);
            expect(order.filledAmount).to.equal(amount);
            expect(order.status).to.equal(1); // FILLED
        });

        it("应该支持同一用户创建多个订单", async function () {
            const price1 = ethers.parseEther("0.001");
            const price2 = ethers.parseEther("0.002");
            const price3 = ethers.parseEther("0.003");
            const amount = ethers.parseEther("100");

            // 创建多个买单
            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price1, amount, { value: (price1 * amount) / ONE_TOKEN });
            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price2, amount, { value: (price2 * amount) / ONE_TOKEN });
            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), price3, amount, { value: (price3 * amount) / ONE_TOKEN });

            // 批量查询订单 (假设这是第 1, 2, 3 个订单)
            const orders = await orderBook.getOrders([1, 2, 3]);
            expect(orders.length).to.equal(3);

            // 验证每个订单的 maker 和价格
            expect(orders[0].maker).to.equal(maker1.address);
            expect(orders[0].price).to.equal(price1);
            expect(orders[1].maker).to.equal(maker1.address);
            expect(orders[1].price).to.equal(price2);
            expect(orders[2].maker).to.equal(maker1.address);
            expect(orders[2].price).to.equal(price3);
        });

        it("应该正确处理买单和卖单混合场景", async function () {
            const buyPrice = ethers.parseEther("0.001");
            const sellPrice = ethers.parseEther("0.002");
            const amount = ethers.parseEther("100");

            // Maker1 创建买单
            await orderBook
                .connect(maker1)
                .createBuyOrder(await token.getAddress(), buyPrice, amount, { value: (buyPrice * amount) / ONE_TOKEN });

            // Maker2 创建卖单
            await token.connect(maker2).approve(await orderBook.getAddress(), amount);
            await orderBook.connect(maker2).createSellOrder(await token.getAddress(), sellPrice, amount);

            // Taker1 吃买单（卖 Token）
            await token.connect(taker1).approve(await orderBook.getAddress(), amount);
            await orderBook.connect(taker1).fillOrder(1, amount);

            // Taker2 吃卖单（买 Token）
            const requiredETH = (sellPrice * amount) / ONE_TOKEN;
            await orderBook.connect(taker2).fillOrder(2, amount, { value: requiredETH });

            // 验证两个订单都完全成交
            const order1 = await orderBook.getOrder(1);
            const order2 = await orderBook.getOrder(2);

            expect(order1.status).to.equal(1); // FILLED
            expect(order2.status).to.equal(1); // FILLED
        });
    });

    // 辅助函数
    async function getBlockTimestamp(): Promise<number> {
        const block = await ethers.provider.getBlock("latest");
        return block!.timestamp;
    }
});

