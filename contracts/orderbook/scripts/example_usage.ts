import { ethers } from "hardhat";
import { OrderBookClient, LocalOrderBook, OrderType } from "../src/order_book_client";

/**
 * OrderBook 使用示例
 * 演示如何使用 OrderBookClient 和 LocalOrderBook
 */
async function main() {
    console.log("=== OrderBook 使用示例 ===\n");

    // 获取签名者
    const [deployer, maker1, maker2, taker1] = await ethers.getSigners();

    // 部署测试代币
    console.log("1. 部署测试代币...");
    const TestERC20TokenFactory = await ethers.getContractFactory("TestERC20Token");
    const token = await TestERC20TokenFactory.deploy("Test Token", "TEST", 18);
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log("   测试代币地址:", tokenAddress);

    // 铸造代币
    const mintAmount = ethers.parseEther("10000");
    await token.mint(maker1.address, mintAmount);
    await token.mint(maker2.address, mintAmount);
    await token.mint(taker1.address, mintAmount);
    console.log("   已铸造代币给用户\n");

    // 部署 OrderBook
    console.log("2. 部署 OrderBook...");
    const OrderBookFactory = await ethers.getContractFactory("OrderBook");
    const orderBook = await OrderBookFactory.deploy();
    await orderBook.waitForDeployment();
    const orderBookAddress = await orderBook.getAddress();
    console.log("   OrderBook 地址:", orderBookAddress, "\n");

    // 创建客户端
    console.log("3. 创建 OrderBookClient...");
    const client = new OrderBookClient(orderBookAddress, ethers.provider);
    console.log("   客户端创建成功\n");

    // 创建本地订单簿
    console.log("4. 创建 LocalOrderBook...");
    const localOrderBook = new LocalOrderBook(client);
    await localOrderBook.initialize(tokenAddress, 0);
    console.log("   本地订单簿初始化成功\n");

    // Maker1 创建买单
    console.log("5. Maker1 创建买单...");
    const buyPrice = ethers.parseEther("0.001"); // 1 token = 0.001 ETH
    const buyAmount = ethers.parseEther("100"); // 100 tokens
    const requiredETH = (buyPrice * buyAmount) / ethers.parseEther("1");

    const maker1Client = client.connect(maker1);
    const buyTx = await maker1Client.createBuyOrder(tokenAddress, buyPrice, buyAmount, requiredETH);
    await buyTx.wait();
    console.log("   买单创建成功");
    console.log("   价格:", ethers.formatEther(buyPrice), "ETH/Token");
    console.log("   数量:", ethers.formatEther(buyAmount), "Tokens\n");

    // Maker2 创建卖单
    console.log("6. Maker2 创建卖单...");
    const sellPrice = ethers.parseEther("0.002"); // 1 token = 0.002 ETH
    const sellAmount = ethers.parseEther("50"); // 50 tokens

    await token.connect(maker2).approve(orderBookAddress, sellAmount);
    const maker2Client = client.connect(maker2);
    const sellTx = await maker2Client.createSellOrder(tokenAddress, sellPrice, sellAmount);
    await sellTx.wait();
    console.log("   卖单创建成功");
    console.log("   价格:", ethers.formatEther(sellPrice), "ETH/Token");
    console.log("   数量:", ethers.formatEther(sellAmount), "Tokens\n");

    // 等待事件处理
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 查看订单簿
    console.log("7. 查看本地订单簿...");
    const buyOrders = localOrderBook.getBuyOrders(tokenAddress);
    const sellOrders = localOrderBook.getSellOrders(tokenAddress);

    console.log("\n   === 买单列表 ===");
    buyOrders.forEach((order, index) => {
        console.log(`   ${index + 1}. 订单 ID: ${order.orderId}`);
        console.log(`      Maker: ${order.maker}`);
        console.log(`      价格: ${ethers.formatEther(order.price)} ETH/Token`);
        console.log(`      数量: ${ethers.formatEther(order.amount)} Tokens`);
        console.log(`      已成交: ${ethers.formatEther(order.filledAmount)} Tokens`);
    });

    console.log("\n   === 卖单列表 ===");
    sellOrders.forEach((order, index) => {
        console.log(`   ${index + 1}. 订单 ID: ${order.orderId}`);
        console.log(`      Maker: ${order.maker}`);
        console.log(`      价格: ${ethers.formatEther(order.price)} ETH/Token`);
        console.log(`      数量: ${ethers.formatEther(order.amount)} Tokens`);
        console.log(`      已成交: ${ethers.formatEther(order.filledAmount)} Tokens`);
    });

    // Taker1 吃买单（卖 Token）
    console.log("\n8. Taker1 吃买单（卖 30 Tokens）...");
    const fillAmount = ethers.parseEther("30");

    await token.connect(taker1).approve(orderBookAddress, fillAmount);
    const taker1Client = client.connect(taker1);

    const taker1TokenBefore = await token.balanceOf(taker1.address);
    const taker1ETHBefore = await ethers.provider.getBalance(taker1.address);

    const fillTx = await taker1Client.fillOrder(1n, fillAmount);
    const receipt = await fillTx.wait();
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

    const taker1TokenAfter = await token.balanceOf(taker1.address);
    const taker1ETHAfter = await ethers.provider.getBalance(taker1.address);

    console.log("   成交成功");
    console.log("   Token 变化:", ethers.formatEther(taker1TokenBefore - taker1TokenAfter), "Tokens");
    console.log("   ETH 获得:", ethers.formatEther(taker1ETHAfter - taker1ETHBefore + gasUsed), "ETH\n");

    // 等待事件处理
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 查看更新后的订单
    console.log("9. 查看更新后的订单...");
    const order1 = await client.getOrder(1n);
    console.log("   订单 1:");
    console.log("   已成交:", ethers.formatEther(order1.filledAmount), "Tokens");
    console.log("   剩余:", ethers.formatEther(order1.amount - order1.filledAmount), "Tokens");
    console.log("   状态:", order1.status === 0 ? "ACTIVE" : "FILLED", "\n");

    // Maker1 取消剩余订单
    console.log("10. Maker1 取消剩余订单...");
    const maker1ETHBefore = await ethers.provider.getBalance(maker1.address);

    const cancelTx = await maker1Client.cancelOrder(1n);
    const cancelReceipt = await cancelTx.wait();
    const cancelGasUsed = cancelReceipt!.gasUsed * cancelReceipt!.gasPrice;

    const maker1ETHAfter = await ethers.provider.getBalance(maker1.address);
    const refundedETH = maker1ETHAfter - maker1ETHBefore + cancelGasUsed;

    console.log("   取消成功");
    console.log("   退还 ETH:", ethers.formatEther(refundedETH), "ETH\n");

    // 最终订单簿状态
    console.log("11. 最终订单簿状态...");
    await new Promise(resolve => setTimeout(resolve, 1000));

    const finalBuyOrders = localOrderBook.getBuyOrders(tokenAddress);
    const finalSellOrders = localOrderBook.getSellOrders(tokenAddress);

    console.log("   活跃买单数量:", finalBuyOrders.length);
    console.log("   活跃卖单数量:", finalSellOrders.length);

    // 清理
    localOrderBook.clear();

    console.log("\n=== 示例完成 ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

