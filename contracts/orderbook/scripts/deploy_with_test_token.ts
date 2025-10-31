import { ethers } from "hardhat";

/**
 * 部署 OrderBook 和测试代币
 */
async function main() {
    console.log("开始部署 OrderBook 和测试代币...");

    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    console.log("账户余额:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    // 部署测试代币
    console.log("\n部署测试代币...");
    const TestERC20TokenFactory = await ethers.getContractFactory("TestERC20Token");
    const testToken = await TestERC20TokenFactory.deploy("Test Token", "TEST", 18);
    await testToken.waitForDeployment();

    const testTokenAddress = await testToken.getAddress();
    console.log("测试代币部署成功:", testTokenAddress);

    // 铸造一些测试代币
    const mintAmount = ethers.parseEther("1000000"); // 1,000,000 tokens
    await testToken.mint(deployer.address, mintAmount);
    console.log("铸造代币:", ethers.formatEther(mintAmount), "TEST");

    // 部署 OrderBook
    console.log("\n部署 OrderBook...");
    const OrderBookFactory = await ethers.getContractFactory("OrderBook");
    const orderBook = await OrderBookFactory.deploy();
    await orderBook.waitForDeployment();

    const orderBookAddress = await orderBook.getAddress();
    console.log("OrderBook 部署成功:", orderBookAddress);

    // 创建示例订单
    console.log("\n创建示例订单...");

    // 创建买单
    const buyPrice = ethers.parseEther("0.001"); // 1 token = 0.001 ETH
    const buyAmount = ethers.parseEther("100"); // 100 tokens
    const requiredETH = (buyPrice * buyAmount) / ethers.parseEther("1");

    const buyTx = await orderBook.createBuyOrder(testTokenAddress, buyPrice, buyAmount, { value: requiredETH });
    await buyTx.wait();
    console.log("创建买单成功 - 订单 ID: 1");
    console.log("  价格:", ethers.formatEther(buyPrice), "ETH/Token");
    console.log("  数量:", ethers.formatEther(buyAmount), "Tokens");

    // 创建卖单
    const sellPrice = ethers.parseEther("0.002"); // 1 token = 0.002 ETH
    const sellAmount = ethers.parseEther("50"); // 50 tokens

    await testToken.approve(orderBookAddress, sellAmount);
    const sellTx = await orderBook.createSellOrder(testTokenAddress, sellPrice, sellAmount);
    await sellTx.wait();
    console.log("创建卖单成功 - 订单 ID: 2");
    console.log("  价格:", ethers.formatEther(sellPrice), "ETH/Token");
    console.log("  数量:", ethers.formatEther(sellAmount), "Tokens");

    // 输出部署信息
    console.log("\n=== 部署完成 ===");
    console.log("网络:", (await ethers.provider.getNetwork()).name);
    console.log("OrderBook 地址:", orderBookAddress);
    console.log("测试代币地址:", testTokenAddress);
    console.log("\n请保存以下信息用于后续使用:");
    console.log(JSON.stringify({
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId,
        orderBook: orderBookAddress,
        testToken: testTokenAddress,
        deployer: deployer.address,
        blockNumber: await ethers.provider.getBlockNumber(),
    }, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

