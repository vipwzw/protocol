/**
 * OrderBook 完整客户端使用示例
 * 展示如何使用事件驱动架构和数据库来构建实时订单簿应用
 */

import { ethers } from 'ethers';
import { OrderBookClientFull, OrderBookManager } from '../src/orderbook_client_full';
import { MemoryDatabase } from '../src/memory_database';
import { OrderType } from '../src/order_book_client';

async function main() {
    console.log('=== OrderBook 完整客户端示例 ===\n');

    // 1. 连接到区块链
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const [deployer, user1, user2] = await provider.listAccounts();
    
    // 部署合约和测试代币
    console.log('1. 部署合约...');
    const { orderBook, testToken } = await deployContracts(provider, deployer);
    console.log(`OrderBook 地址: ${await orderBook.getAddress()}`);
    console.log(`TestToken 地址: ${await testToken.getAddress()}\n`);

    // 2. 创建完整客户端（使用内存数据库）
    console.log('2. 创建完整客户端...');
    const db = new MemoryDatabase();
    const client = new OrderBookClientFull(
        await orderBook.getAddress(),
        provider,
        db
    );

    // 3. 启动索引器（从创世块开始同步）
    console.log('3. 启动索引器...');
    await client.start({
        fromBlock: 0,
        syncInterval: 5000,  // 每 5 秒同步一次
        tokens: [await testToken.getAddress()],
    });
    console.log('索引器已启动\n');

    // 4. 订阅订单更新
    console.log('4. 订阅订单更新...');
    const unsubscribe = client.onOrderUpdate((orders) => {
        console.log(`[订阅通知] 收到 ${orders.length} 个活跃订单更新`);
    });

    // 5. 准备测试账户
    console.log('\n5. 准备测试账户...');
    const signer1 = await provider.getSigner(user1.address);
    const signer2 = await provider.getSigner(user2.address);
    
    // 给用户铸造代币
    const tokenAddress = await testToken.getAddress();
    await testToken.mint(user1.address, ethers.parseEther('1000'));
    await testToken.mint(user2.address, ethers.parseEther('1000'));
    console.log(`用户1 (${user1.address}) 获得 1000 代币`);
    console.log(`用户2 (${user2.address}) 获得 1000 代币\n`);

    // 6. 创建订单
    console.log('6. 创建订单...\n');
    
    // 用户1 创建买单
    const client1 = client.connect(signer1);
    console.log('用户1 创建买单: 用 0.001 ETH 购买 100 代币');
    const buyPrice = ethers.parseEther('0.001');
    const buyAmount = ethers.parseEther('100');
    let tx = await client1.createBuyOrder(tokenAddress, buyPrice, buyAmount);
    await tx.wait();
    console.log(`交易哈希: ${tx.hash}\n`);

    // 用户2 创建卖单
    const client2 = client.connect(signer2);
    const token2 = testToken.connect(signer2);
    await token2.approve(await orderBook.getAddress(), ethers.parseEther('50'));
    
    console.log('用户2 创建卖单: 用 50 代币换取 0.002 ETH/代币');
    const sellPrice = ethers.parseEther('0.002');
    const sellAmount = ethers.parseEther('50');
    tx = await client2.createSellOrder(tokenAddress, sellPrice, sellAmount);
    await tx.wait();
    console.log(`交易哈希: ${tx.hash}\n`);

    // 等待事件处理
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 7. 查询订单簿
    console.log('7. 查询订单簿...\n');
    
    const buyOrders = await client.getActiveBuyOrders(tokenAddress);
    console.log(`活跃买单数量: ${buyOrders.length}`);
    buyOrders.forEach(order => {
        console.log(`  - 订单 #${order.orderId}: ${ethers.formatEther(order.price)} ETH/代币, ${ethers.formatEther(order.amount)} 代币`);
    });

    const sellOrders = await client.getActiveSellOrders(tokenAddress);
    console.log(`\n活跃卖单数量: ${sellOrders.length}`);
    sellOrders.forEach(order => {
        console.log(`  - 订单 #${order.orderId}: ${ethers.formatEther(order.price)} ETH/代币, ${ethers.formatEther(order.amount)} 代币`);
    });

    // 8. 使用 OrderBookManager
    console.log('\n8. 使用 OrderBookManager...\n');
    const manager = new OrderBookManager(client, tokenAddress);
    await manager.start(1000);  // 每秒刷新一次

    const bestBid = manager.getBestBid();
    const bestAsk = manager.getBestAsk();
    console.log(`最佳买价: ${bestBid ? ethers.formatEther(bestBid.price) : 'N/A'} ETH/代币`);
    console.log(`最佳卖价: ${bestAsk ? ethers.formatEther(bestAsk.price) : 'N/A'} ETH/代币`);

    const spread = manager.getSpread();
    console.log(`价差: ${spread ? ethers.formatEther(spread) : 'N/A'} ETH/代币`);

    const midPrice = manager.getMidPrice();
    console.log(`中间价: ${midPrice ? ethers.formatEther(midPrice) : 'N/A'} ETH/代币\n`);

    // 9. 获取订单簿深度
    console.log('9. 订单簿深度 (前 5 档)...\n');
    const depth = manager.getDepth(5);
    
    console.log('买单深度:');
    depth.bids.forEach((level, i) => {
        console.log(`  ${i + 1}. 价格: ${ethers.formatEther(level.price)}, 数量: ${ethers.formatEther(level.amount)}, 累计: ${ethers.formatEther(level.total)}`);
    });

    console.log('\n卖单深度:');
    depth.asks.forEach((level, i) => {
        console.log(`  ${i + 1}. 价格: ${ethers.formatEther(level.price)}, 数量: ${ethers.formatEther(level.amount)}, 累计: ${ethers.formatEther(level.total)}`);
    });

    // 10. 估算市价单
    console.log('\n10. 估算市价单...\n');
    const marketBuyAmount = ethers.parseEther('30');
    const estimate = manager.estimateMarketOrder(OrderType.BUY, marketBuyAmount);
    
    if (estimate) {
        console.log(`购买 ${ethers.formatEther(marketBuyAmount)} 代币需要:`);
        console.log(`  总成本: ${ethers.formatEther(estimate.totalCost)} ETH`);
        console.log(`  平均价格: ${ethers.formatEther(estimate.averagePrice)} ETH/代币`);
        console.log(`  需要吃单:`);
        estimate.orders.forEach((order, i) => {
            console.log(`    ${i + 1}. 订单 #${order.orderId}: ${ethers.formatEther(order.amount)} 代币 @ ${ethers.formatEther(order.price)} ETH/代币`);
        });
    } else {
        console.log('流动性不足');
    }

    // 11. 执行撮合交易
    console.log('\n11. 执行撮合交易...\n');
    if (sellOrders.length > 0) {
        const orderId = BigInt(sellOrders[0].orderId);
        const fillAmount = ethers.parseEther('20');
        const requiredETH = (BigInt(sellOrders[0].price) * fillAmount) / ethers.parseEther('1');
        
        console.log(`用户1 吃卖单 #${orderId}: 购买 ${ethers.formatEther(fillAmount)} 代币`);
        tx = await client1.fillOrder(orderId, fillAmount, requiredETH);
        await tx.wait();
        console.log(`交易哈希: ${tx.hash}\n`);

        // 等待事件处理
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 查看更新后的订单
        const updatedOrder = await client.getOrder(orderId.toString());
        if (updatedOrder) {
            console.log('订单更新后状态:');
            console.log(`  订单 ID: ${updatedOrder.orderId}`);
            console.log(`  总量: ${ethers.formatEther(updatedOrder.amount)} 代币`);
            console.log(`  已成交: ${ethers.formatEther(updatedOrder.filledAmount)} 代币`);
            console.log(`  剩余: ${ethers.formatEther(BigInt(updatedOrder.amount) - BigInt(updatedOrder.filledAmount))} 代币`);
            console.log(`  状态: ${['ACTIVE', 'FILLED', 'CANCELLED', 'EXPIRED'][updatedOrder.status]}\n`);
        }
    }

    // 12. 查询用户订单
    console.log('12. 查询用户订单...\n');
    const user1Orders = await client.getUserOrders(user1.address);
    console.log(`用户1 的订单 (${user1Orders.length} 个):`);
    user1Orders.forEach(order => {
        console.log(`  - 订单 #${order.orderId}: ${['BUY', 'SELL'][order.orderType]}, ${ethers.formatEther(order.price)} ETH/代币, 状态: ${['ACTIVE', 'FILLED', 'CANCELLED', 'EXPIRED'][order.status]}`);
    });

    const user2Orders = await client.getUserOrders(user2.address);
    console.log(`\n用户2 的订单 (${user2Orders.length} 个):`);
    user2Orders.forEach(order => {
        console.log(`  - 订单 #${order.orderId}: ${['BUY', 'SELL'][order.orderType]}, ${ethers.formatEther(order.price)} ETH/代币, 状态: ${['ACTIVE', 'FILLED', 'CANCELLED', 'EXPIRED'][order.status]}`);
    });

    // 13. 取消订单
    console.log('\n13. 取消订单...\n');
    if (buyOrders.length > 0) {
        const orderId = BigInt(buyOrders[0].orderId);
        console.log(`用户1 取消订单 #${orderId}`);
        tx = await client1.cancelOrder(orderId);
        await tx.wait();
        console.log(`交易哈希: ${tx.hash}\n`);

        // 等待事件处理
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 14. 获取统计信息
    console.log('14. 统计信息...\n');
    const stats = await client.getStats();
    console.log(`总订单数: ${stats.totalOrders}`);
    console.log(`活跃订单: ${stats.activeOrders}`);
    console.log(`已成交订单: ${stats.filledOrders}`);
    console.log(`已取消订单: ${stats.cancelledOrders}`);
    console.log(`总成交记录: ${stats.totalFills}\n`);

    // 15. 验证数据一致性
    console.log('15. 验证数据一致性...\n');
    for (const order of user1Orders) {
        const isConsistent = await client.verifyOrder(order.orderId);
        console.log(`订单 #${order.orderId}: ${isConsistent ? '✅ 一致' : '❌ 不一致'}`);
    }

    // 16. 搜索订单
    console.log('\n16. 搜索订单...\n');
    const searchResults = await client.searchOrders({
        token: tokenAddress,
        orderType: OrderType.SELL,
        status: undefined,  // 所有状态
        limit: 10,
    });
    console.log(`搜索结果 (卖单): ${searchResults.length} 个`);
    searchResults.forEach(order => {
        console.log(`  - 订单 #${order.orderId}: ${ethers.formatEther(order.price)} ETH/代币, 状态: ${['ACTIVE', 'FILLED', 'CANCELLED', 'EXPIRED'][order.status]}`);
    });

    // 清理
    console.log('\n=== 清理资源 ===\n');
    manager.stop();
    unsubscribe();
    await client.stop();
    console.log('完成！');
}

/**
 * 部署合约
 */
async function deployContracts(provider: ethers.Provider, deployer: ethers.HardhatEthersSigner) {
    // 部署 OrderBook
    const OrderBookFactory = await ethers.getContractFactory('OrderBook', deployer);
    const orderBook = await OrderBookFactory.deploy();
    await orderBook.waitForDeployment();

    // 部署测试代币
    const TestTokenFactory = await ethers.getContractFactory('TestERC20Token', deployer);
    const testToken = await TestTokenFactory.deploy('Test Token', 'TEST', 18);
    await testToken.waitForDeployment();

    return { orderBook, testToken };
}

// 运行示例
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export { main };

