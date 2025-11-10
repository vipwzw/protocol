/**
 * OrderBook API 服务器
 * 提供 RESTful API 和 WebSocket 实时推送
 * 
 * 运行方式:
 * 1. 安装依赖: npm install express socket.io cors
 * 2. 启动服务器: ts-node examples/api_server.ts
 * 3. 访问 API: http://localhost:3000
 */

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { ethers } from 'ethers';
import { OrderBookClientFull } from '../src/orderbook_client_full';
import { MemoryDatabase } from '../src/memory_database';
import { OrderType, OrderStatus } from '../src/order_book_client';

// 配置
const PORT = process.env.PORT || 3000;
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const ORDERBOOK_ADDRESS = process.env.ORDERBOOK_ADDRESS || '';

// 创建 Express 应用
const app = express();
app.use(cors());
app.use(express.json());

// 创建 HTTP 服务器
const httpServer = createServer(app);

// 创建 Socket.IO 服务器
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// 全局客户端实例
let client: OrderBookClientFull;
const db = new MemoryDatabase();

/**
 * 初始化客户端
 */
async function initializeClient() {
    if (!ORDERBOOK_ADDRESS) {
        throw new Error('请设置 ORDERBOOK_ADDRESS 环境变量');
    }

    console.log('初始化 OrderBook 客户端...');
    console.log(`RPC URL: ${RPC_URL}`);
    console.log(`OrderBook 地址: ${ORDERBOOK_ADDRESS}`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    client = new OrderBookClientFull(ORDERBOOK_ADDRESS, provider, db);

    // 订阅订单更新，通过 WebSocket 推送
    client.onOrderUpdate((orders) => {
        if (orders.length > 0) {
            const token = orders[0].token;
            io.to(`orderbook:${token}`).emit('orderUpdate', {
                token,
                timestamp: Date.now(),
                orders: orders.map(formatOrder),
            });
        }
    });

    // 启动索引器
    await client.start({
        fromBlock: 0,
        syncInterval: 10000,  // 每 10 秒同步一次
    });

    console.log('客户端初始化完成');
}

/**
 * 格式化订单
 */
function formatOrder(order: any) {
    return {
        orderId: order.orderId,
        maker: order.maker,
        token: order.token,
        orderType: ['BUY', 'SELL'][order.orderType],
        price: ethers.formatEther(order.price),
        amount: ethers.formatEther(order.amount),
        filledAmount: ethers.formatEther(order.filledAmount),
        remainingAmount: ethers.formatEther(
            BigInt(order.amount) - BigInt(order.filledAmount)
        ),
        status: ['ACTIVE', 'FILLED', 'CANCELLED', 'EXPIRED'][order.status],
        timestamp: order.timestamp,
    };
}

// ==================== RESTful API ====================

/**
 * 健康检查
 */
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
    });
});

/**
 * 获取订单簿
 * GET /api/orderbook/:token?depth=10
 */
app.get('/api/orderbook/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const depth = parseInt(req.query.depth as string) || 10;

        const snapshot = await client.getOrderBookSnapshot(token, depth);

        res.json({
            token,
            bids: snapshot.bids.map(level => ({
                price: ethers.formatEther(level.price),
                amount: ethers.formatEther(level.amount),
                orderCount: level.orderCount,
            })),
            asks: snapshot.asks.map(level => ({
                price: ethers.formatEther(level.price),
                amount: ethers.formatEther(level.amount),
                orderCount: level.orderCount,
            })),
            timestamp: snapshot.timestamp,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 获取活跃买单
 * GET /api/orders/buy/:token?limit=50
 */
app.get('/api/orders/buy/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;

        const orders = await client.getActiveBuyOrders(token, limit);

        res.json({
            token,
            orderType: 'BUY',
            count: orders.length,
            orders: orders.map(formatOrder),
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 获取活跃卖单
 * GET /api/orders/sell/:token?limit=50
 */
app.get('/api/orders/sell/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;

        const orders = await client.getActiveSellOrders(token, limit);

        res.json({
            token,
            orderType: 'SELL',
            count: orders.length,
            orders: orders.map(formatOrder),
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 获取订单详情
 * GET /api/order/:orderId
 */
app.get('/api/order/:orderId', async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        const order = await client.getOrder(orderId);

        if (!order) {
            return res.status(404).json({ error: '订单不存在' });
        }

        res.json(formatOrder(order));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 获取用户订单
 * GET /api/user/:address/orders
 */
app.get('/api/user/:address/orders', async (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        const orders = await client.getUserOrders(address);

        res.json({
            user: address,
            count: orders.length,
            orders: orders.map(formatOrder),
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 搜索订单
 * POST /api/orders/search
 * Body: { token?, maker?, orderType?, status?, minPrice?, maxPrice?, limit? }
 */
app.post('/api/orders/search', async (req: Request, res: Response) => {
    try {
        const filters = req.body;

        // 转换价格为 wei
        if (filters.minPrice) {
            filters.minPrice = ethers.parseEther(filters.minPrice).toString();
        }
        if (filters.maxPrice) {
            filters.maxPrice = ethers.parseEther(filters.maxPrice).toString();
        }

        // 转换枚举
        if (filters.orderType) {
            filters.orderType = filters.orderType === 'BUY' ? OrderType.BUY : OrderType.SELL;
        }
        if (filters.status) {
            filters.status = OrderStatus[filters.status as keyof typeof OrderStatus];
        }

        const orders = await client.searchOrders(filters);

        res.json({
            count: orders.length,
            orders: orders.map(formatOrder),
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 获取统计信息
 * GET /api/stats
 */
app.get('/api/stats', async (req: Request, res: Response) => {
    try {
        const stats = await client.getStats();
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 验证订单一致性
 * GET /api/order/:orderId/verify
 */
app.get('/api/order/:orderId/verify', async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        const isConsistent = await client.verifyOrder(orderId);

        res.json({
            orderId,
            isConsistent,
            timestamp: Date.now(),
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== WebSocket ====================

io.on('connection', (socket) => {
    console.log(`客户端连接: ${socket.id}`);

    /**
     * 订阅订单簿更新
     * socket.emit('subscribe', { token: '0x...' })
     */
    socket.on('subscribe', ({ token }) => {
        console.log(`客户端 ${socket.id} 订阅代币: ${token}`);
        socket.join(`orderbook:${token}`);
        
        // 立即发送当前订单簿
        client.getActiveBuyOrders(token, 50).then(buyOrders => {
            client.getActiveSellOrders(token, 50).then(sellOrders => {
                socket.emit('orderbook', {
                    token,
                    bids: buyOrders.map(formatOrder),
                    asks: sellOrders.map(formatOrder),
                    timestamp: Date.now(),
                });
            });
        });
    });

    /**
     * 取消订阅
     * socket.emit('unsubscribe', { token: '0x...' })
     */
    socket.on('unsubscribe', ({ token }) => {
        console.log(`客户端 ${socket.id} 取消订阅代币: ${token}`);
        socket.leave(`orderbook:${token}`);
    });

    socket.on('disconnect', () => {
        console.log(`客户端断开: ${socket.id}`);
    });
});

// ==================== 启动服务器 ====================

async function startServer() {
    try {
        // 初始化客户端
        await initializeClient();

        // 启动 HTTP 服务器
        httpServer.listen(PORT, () => {
            console.log(`\n=== OrderBook API 服务器已启动 ===`);
            console.log(`HTTP API: http://localhost:${PORT}`);
            console.log(`WebSocket: ws://localhost:${PORT}`);
            console.log(`\nAPI 端点:`);
            console.log(`  GET  /health`);
            console.log(`  GET  /api/orderbook/:token`);
            console.log(`  GET  /api/orders/buy/:token`);
            console.log(`  GET  /api/orders/sell/:token`);
            console.log(`  GET  /api/order/:orderId`);
            console.log(`  GET  /api/user/:address/orders`);
            console.log(`  POST /api/orders/search`);
            console.log(`  GET  /api/stats`);
            console.log(`  GET  /api/order/:orderId/verify`);
            console.log(`\nWebSocket 事件:`);
            console.log(`  subscribe   - 订阅订单簿更新`);
            console.log(`  unsubscribe - 取消订阅`);
            console.log(`  orderUpdate - 订单更新通知`);
            console.log(`  orderbook   - 订单簿快照`);
            console.log(`\n按 Ctrl+C 停止服务器`);
        });
    } catch (error) {
        console.error('启动服务器失败:', error);
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n正在关闭服务器...');
    await client.stop();
    httpServer.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

// 启动
if (require.main === module) {
    startServer();
}

export { app, io, startServer };

