/**
 * OrderBook 快速开始示例
 * 
 * 这个示例展示了如何快速启动一个实时订单簿应用
 * 
 * 运行步骤：
 * 1. 启动本地节点: npx hardhat node
 * 2. 部署合约: npx hardhat run scripts/deploy_with_test_token.ts --network localhost
 * 3. 运行示例: ts-node examples/quickstart.ts
 */

import { ethers } from 'ethers';
import { OrderBookClientFull, OrderBookManager, MemoryDatabase } from '../src';

async function main() {
    console.log('=== OrderBook 快速开始 ===\n');

    // 配置（请根据实际情况修改）
    const RPC_URL = 'http://localhost:8545';
    const ORDERBOOK_ADDRESS = process.env.ORDERBOOK_ADDRESS || '';
    const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || '';

    if (!ORDERBOOK_ADDRESS || !TOKEN_ADDRESS) {
        console.error('错误：请设置环境变量');
        console.log('export ORDERBOOK_ADDRESS="0x..."');
        console.log('export TOKEN_ADDRESS="0x..."');
        process.exit(1);
    }

    // 1. 连接到区块链
    console.log('1. 连接到区块链...');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log(`已连接到: ${RPC_URL}\n`);

    // 2. 创建客户端
    console.log('2. 创建 OrderBook 客户端...');
    const db = new MemoryDatabase();
    const client = new OrderBookClientFull(ORDERBOOK_ADDRESS, provider, db);
    console.log(`OrderBook 地址: ${ORDERBOOK_ADDRESS}`);
    console.log(`Token 地址: ${TOKEN_ADDRESS}\n`);

    // 3. 启动索引器
    console.log('3. 启动索引器（同步历史数据）...');
    await client.start({
        fromBlock: 0,
        syncInterval: 10000,  // 每 10 秒同步一次
        tokens: [TOKEN_ADDRESS],
    });
    console.log('索引器已启动\n');

    // 4. 订阅订单更新
    console.log('4. 订阅订单更新...');
    client.onOrderUpdate((orders) => {
        console.log(`\n[实时更新] 收到 ${orders.length} 个活跃订单更新`);
        displayOrderBook();
    });
    console.log('已订阅订单更新\n');

    // 5. 创建订单簿管理器
    console.log('5. 创建订单簿管理器...');
    const manager = new OrderBookManager(client, TOKEN_ADDRESS);
    await manager.start(5000);  // 每 5 秒刷新一次
    console.log('订单簿管理器已启动\n');

    // 6. 显示订单簿
    async function displayOrderBook() {
        console.log('\n=== 实时订单簿 ===');
        console.log(`代币: ${TOKEN_ADDRESS}`);
        console.log(`时间: ${new Date().toLocaleString()}\n`);

        // 统计信息
        const stats = await client.getStats();
        console.log('📊 统计信息:');
        console.log(`  总订单数: ${stats.totalOrders}`);
        console.log(`  活跃订单: ${stats.activeOrders}`);
        console.log(`  已成交订单: ${stats.filledOrders}`);
        console.log(`  已取消订单: ${stats.cancelledOrders}\n`);

        // 最佳价格
        const bestBid = manager.getBestBid();
        const bestAsk = manager.getBestAsk();
        const spread = manager.getSpread();
        const midPrice = manager.getMidPrice();

        console.log('💰 市场价格:');
        console.log(`  最佳买价: ${bestBid ? ethers.formatEther(bestBid.price) : 'N/A'} ETH/Token`);
        console.log(`  最佳卖价: ${bestAsk ? ethers.formatEther(bestAsk.price) : 'N/A'} ETH/Token`);
        console.log(`  价差: ${spread ? ethers.formatEther(spread) : 'N/A'} ETH`);
        console.log(`  中间价: ${midPrice ? ethers.formatEther(midPrice) : 'N/A'} ETH/Token\n`);

        // 订单簿深度
        const depth = manager.getDepth(5);

        console.log('📈 买单深度 (前 5 档):');
        if (depth.bids.length > 0) {
            console.log('  价格 (ETH)      数量 (Token)    累计 (Token)');
            console.log('  ─────────────────────────────────────────────');
            depth.bids.forEach((level, i) => {
                const price = ethers.formatEther(level.price).padEnd(15);
                const amount = ethers.formatEther(level.amount).padEnd(15);
                const total = ethers.formatEther(level.total);
                console.log(`  ${price} ${amount} ${total}`);
            });
        } else {
            console.log('  暂无买单');
        }

        console.log('\n📉 卖单深度 (前 5 档):');
        if (depth.asks.length > 0) {
            console.log('  价格 (ETH)      数量 (Token)    累计 (Token)');
            console.log('  ─────────────────────────────────────────────');
            depth.asks.forEach((level, i) => {
                const price = ethers.formatEther(level.price).padEnd(15);
                const amount = ethers.formatEther(level.amount).padEnd(15);
                const total = ethers.formatEther(level.total);
                console.log(`  ${price} ${amount} ${total}`);
            });
        } else {
            console.log('  暂无卖单');
        }

        console.log('\n' + '='.repeat(50));
    }

    // 初始显示
    await displayOrderBook();

    // 7. 定期显示订单簿
    setInterval(async () => {
        await displayOrderBook();
    }, 30000);  // 每 30 秒显示一次

    // 8. 保持运行
    console.log('\n✅ OrderBook 客户端正在运行...');
    console.log('按 Ctrl+C 停止\n');

    // 优雅关闭
    process.on('SIGINT', async () => {
        console.log('\n\n正在关闭...');
        manager.stop();
        await client.stop();
        console.log('已关闭');
        process.exit(0);
    });
}

// 运行
if (require.main === module) {
    main().catch((error) => {
        console.error('错误:', error);
        process.exit(1);
    });
}

export { main };

