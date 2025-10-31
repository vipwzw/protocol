import { ethers } from "hardhat";

/**
 * 部署 OrderBook 合约
 */
async function main() {
    console.log("开始部署 OrderBook 合约...");

    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    console.log("账户余额:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    // 部署 OrderBook
    console.log("\n部署 OrderBook...");
    const OrderBookFactory = await ethers.getContractFactory("OrderBook");
    const orderBook = await OrderBookFactory.deploy();
    await orderBook.waitForDeployment();

    const orderBookAddress = await orderBook.getAddress();
    console.log("OrderBook 部署成功:", orderBookAddress);

    // 验证部署
    console.log("\n验证部署...");
    const orderCounter = await orderBook.orderCounter();
    console.log("订单计数器:", orderCounter.toString());

    // 输出部署信息
    console.log("\n=== 部署完成 ===");
    console.log("网络:", (await ethers.provider.getNetwork()).name);
    console.log("OrderBook 地址:", orderBookAddress);
    console.log("\n请保存以下信息用于后续使用:");
    console.log({
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId,
        orderBook: orderBookAddress,
        deployer: deployer.address,
        blockNumber: await ethers.provider.getBlockNumber(),
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

