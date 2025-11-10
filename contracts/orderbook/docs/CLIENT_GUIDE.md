# OrderBook 客户端完整指南

本指南介绍如何使用 OrderBook 客户端构建实时订单簿应用，包括数据库集成、API 服务器和前端界面。

## 目录

1. [快速开始](#快速开始)
2. [核心概念](#核心概念)
3. [客户端使用](#客户端使用)
4. [数据库集成](#数据库集成)
5. [API 服务器](#api-服务器)
6. [前端集成](#前端集成)
7. [生产环境部署](#生产环境部署)

## 快速开始

### 安装依赖

```bash
cd contracts/orderbook
yarn install
```

### 基础使用

```typescript
import { ethers } from 'ethers';
import { OrderBookClientFull, MemoryDatabase } from '@0x/contracts-orderbook';

// 1. 创建客户端
const provider = new ethers.JsonRpcProvider('http://localhost:8545');
const db = new MemoryDatabase();
const client = new OrderBookClientFull(orderBookAddress, provider, db);

// 2. 启动索引器
await client.start({
    fromBlock: 0,           // 从哪个区块开始同步
    syncInterval: 10000,    // 定期同步间隔（毫秒）
    tokens: [tokenAddress], // 只监听特定代币
});

// 3. 查询订单簿
const buyOrders = await client.getActiveBuyOrders(tokenAddress);
const sellOrders = await client.getActiveSellOrders(tokenAddress);

console.log('买单:', buyOrders);
console.log('卖单:', sellOrders);
```

## 核心概念

### 架构概览

```
┌─────────────────────────────────────────┐
│         区块链（链上）                    │
│  ┌────────────────────────────────────┐ │
│  │   OrderBook 智能合约                │ │
│  │   - 订单创建、撮合、取消             │ │
│  │   - 发出事件通知                    │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                  ↓ 事件
┌─────────────────────────────────────────┐
│         应用层（链下）                    │
│  ┌────────────────────────────────────┐ │
│  │   OrderBookIndexer                 │ │
│  │   - 监听合约事件                    │ │
│  │   - 同步历史数据                    │ │
│  │   - 更新本地数据库                  │ │
│  └────────────────────────────────────┘ │
│                  ↓                       │
│  ┌────────────────────────────────────┐ │
│  │   数据库（PostgreSQL/MongoDB）      │ │
│  │   - 存储订单状态                    │ │
│  │   - 支持复杂查询                    │ │
│  └────────────────────────────────────┘ │
│                  ↓                       │
│  ┌────────────────────────────────────┐ │
│  │   API 服务器                        │ │
│  │   - RESTful API                    │ │
│  │   - WebSocket 实时推送              │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 核心组件

1. **OrderBookClient**：基础客户端，提供合约交互方法
2. **OrderBookIndexer**：事件监听器，同步链上数据到数据库
3. **IDatabase**：数据库接口，可以使用任何数据库实现
4. **OrderBookClientFull**：完整客户端，集成了上述所有组件
5. **OrderBookManager**：订单簿管理器，提供实时订单簿数据

## 客户端使用

### 1. 创建和启动客户端

```typescript
import { OrderBookClientFull, MemoryDatabase } from '@0x/contracts-orderbook';

// 创建客户端
const client = new OrderBookClientFull(
    orderBookAddress,
    provider,
    new MemoryDatabase()  // 或使用自定义数据库
);

// 启动索引器
await client.start({
    fromBlock: 0,           // 从创世块开始同步
    syncInterval: 10000,    // 每 10 秒同步一次
    tokens: [tokenAddress], // 只监听特定代币（可选）
});
```

### 2. 订阅订单更新

```typescript
// 订阅所有订单更新
const unsubscribe = client.onOrderUpdate((orders) => {
    console.log('订单更新:', orders);
    
    // 更新 UI 或触发其他逻辑
    updateUI(orders);
});

// 取消订阅
unsubscribe();
```

### 3. 创建订单

```typescript
// 连接签名者
const signer = await provider.getSigner();
const clientWithSigner = client.connect(signer);

// 创建买单
const buyPrice = ethers.parseEther('0.001');  // 1 token = 0.001 ETH
const buyAmount = ethers.parseEther('100');   // 100 tokens
const tx = await clientWithSigner.createBuyOrder(tokenAddress, buyPrice, buyAmount);
await tx.wait();

// 创建卖单（需要先授权）
const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
await token.approve(orderBookAddress, sellAmount);

const sellPrice = ethers.parseEther('0.002');
const sellAmount = ethers.parseEther('50');
const tx2 = await clientWithSigner.createSellOrder(tokenAddress, sellPrice, sellAmount);
await tx2.wait();
```

### 4. 查询订单

```typescript
// 获取活跃买单（按价格降序）
const buyOrders = await client.getActiveBuyOrders(tokenAddress, 50);

// 获取活跃卖单（按价格升序）
const sellOrders = await client.getActiveSellOrders(tokenAddress, 50);

// 获取订单簿快照
const snapshot = await client.getOrderBookSnapshot(tokenAddress, 10);
console.log('买单:', snapshot.bids);
console.log('卖单:', snapshot.asks);

// 获取单个订单
const order = await client.getOrder('1');

// 获取用户订单
const userOrders = await client.getUserOrders(userAddress);

// 搜索订单
const results = await client.searchOrders({
    token: tokenAddress,
    orderType: OrderType.BUY,
    status: OrderStatus.ACTIVE,
    minPrice: ethers.parseEther('0.001').toString(),
    maxPrice: ethers.parseEther('0.01').toString(),
    limit: 100,
});
```

### 5. 使用 OrderBookManager

```typescript
import { OrderBookManager } from '@0x/contracts-orderbook';

// 创建管理器
const manager = new OrderBookManager(client, tokenAddress);

// 启动管理器（每秒刷新一次）
await manager.start(1000);

// 获取最佳买卖价
const bestBid = manager.getBestBid();
const bestAsk = manager.getBestAsk();
console.log('最佳买价:', ethers.formatEther(bestBid.price));
console.log('最佳卖价:', ethers.formatEther(bestAsk.price));

// 获取价差和中间价
const spread = manager.getSpread();
const midPrice = manager.getMidPrice();
console.log('价差:', ethers.formatEther(spread));
console.log('中间价:', ethers.formatEther(midPrice));

// 获取订单簿深度
const depth = manager.getDepth(10);
console.log('买单深度:', depth.bids);
console.log('卖单深度:', depth.asks);

// 估算市价单成本
const estimate = manager.estimateMarketOrder(OrderType.BUY, ethers.parseEther('100'));
if (estimate) {
    console.log('总成本:', ethers.formatEther(estimate.totalCost));
    console.log('平均价格:', ethers.formatEther(estimate.averagePrice));
    console.log('需要吃单:', estimate.orders);
}

// 停止管理器
manager.stop();
```

## 数据库集成

### 使用内存数据库（测试）

```typescript
import { MemoryDatabase } from '@0x/contracts-orderbook';

const db = new MemoryDatabase();
const client = new OrderBookClientFull(orderBookAddress, provider, db);
```

### 实现自定义数据库

```typescript
import { IDatabase, DatabaseOrder, DatabaseFill } from '@0x/contracts-orderbook';

class PostgreSQLDatabase implements IDatabase {
    private pool: Pool;

    constructor(connectionString: string) {
        this.pool = new Pool({ connectionString });
    }

    async createOrder(order: DatabaseOrder): Promise<void> {
        await this.pool.query(
            `INSERT INTO orders (order_id, maker, token, order_type, price, amount, filled_amount, status, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                order.orderId,
                order.maker,
                order.token,
                order.orderType,
                order.price,
                order.amount,
                order.filledAmount,
                order.status,
                order.timestamp,
            ]
        );
    }

    async updateOrder(orderId: string, updates: Partial<DatabaseOrder>): Promise<void> {
        const fields = Object.keys(updates)
            .map((key, i) => `${key} = $${i + 2}`)
            .join(', ');
        
        await this.pool.query(
            `UPDATE orders SET ${fields}, updated_at = NOW() WHERE order_id = $1`,
            [orderId, ...Object.values(updates)]
        );
    }

    async getOrder(orderId: string): Promise<DatabaseOrder | null> {
        const result = await this.pool.query(
            'SELECT * FROM orders WHERE order_id = $1',
            [orderId]
        );
        return result.rows[0] || null;
    }

    async getActiveOrders(token: string, orderType: OrderType, limit: number = 50): Promise<DatabaseOrder[]> {
        const sortOrder = orderType === OrderType.BUY ? 'DESC' : 'ASC';
        const result = await this.pool.query(
            `SELECT * FROM orders
             WHERE token = $1 AND order_type = $2 AND status = $3
             ORDER BY price ${sortOrder}
             LIMIT $4`,
            [token, orderType, OrderStatus.ACTIVE, limit]
        );
        return result.rows;
    }

    // ... 实现其他方法
}
```

### 数据库表结构

```sql
-- 订单表
CREATE TABLE orders (
    order_id VARCHAR(78) PRIMARY KEY,
    maker VARCHAR(42) NOT NULL,
    token VARCHAR(42) NOT NULL,
    order_type SMALLINT NOT NULL,  -- 0: BUY, 1: SELL
    price NUMERIC(78, 0) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    filled_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL,      -- 0: ACTIVE, 1: FILLED, 2: CANCELLED, 3: EXPIRED
    timestamp BIGINT NOT NULL,
    tx_hash VARCHAR(66),
    block_number BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_token_type_status (token, order_type, status),
    INDEX idx_maker (maker),
    INDEX idx_price (price),
    INDEX idx_timestamp (timestamp)
);

-- 成交记录表
CREATE TABLE fills (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(78) NOT NULL,
    taker VARCHAR(42) NOT NULL,
    fill_amount NUMERIC(78, 0) NOT NULL,
    timestamp BIGINT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    
    INDEX idx_order_id (order_id),
    INDEX idx_taker (taker),
    INDEX idx_timestamp (timestamp),
    
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- 同步状态表
CREATE TABLE sync_state (
    id SERIAL PRIMARY KEY,
    last_synced_block BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## API 服务器

### 启动 API 服务器

```bash
# 设置环境变量
export ORDERBOOK_ADDRESS="0x..."
export RPC_URL="http://localhost:8545"
export PORT=3000

# 启动服务器
ts-node examples/api_server.ts
```

### RESTful API 端点

#### 1. 获取订单簿

```bash
GET /api/orderbook/:token?depth=10
```

响应：
```json
{
  "token": "0x...",
  "bids": [
    { "price": "0.001", "amount": "100", "orderCount": 1 }
  ],
  "asks": [
    { "price": "0.002", "amount": "50", "orderCount": 1 }
  ],
  "timestamp": 1699999999999
}
```

#### 2. 获取活跃买单

```bash
GET /api/orders/buy/:token?limit=50
```

#### 3. 获取活跃卖单

```bash
GET /api/orders/sell/:token?limit=50
```

#### 4. 获取订单详情

```bash
GET /api/order/:orderId
```

#### 5. 获取用户订单

```bash
GET /api/user/:address/orders
```

#### 6. 搜索订单

```bash
POST /api/orders/search
Content-Type: application/json

{
  "token": "0x...",
  "orderType": "BUY",
  "status": "ACTIVE",
  "minPrice": "0.001",
  "maxPrice": "0.01",
  "limit": 100
}
```

#### 7. 获取统计信息

```bash
GET /api/stats
```

### WebSocket 实时推送

```javascript
const socket = io('http://localhost:3000');

// 订阅订单簿更新
socket.emit('subscribe', { token: '0x...' });

// 接收订单簿快照
socket.on('orderbook', (data) => {
    console.log('订单簿快照:', data);
    updateUI(data);
});

// 接收订单更新
socket.on('orderUpdate', (data) => {
    console.log('订单更新:', data);
    updateUI(data);
});

// 取消订阅
socket.emit('unsubscribe', { token: '0x...' });
```

## 前端集成

### HTML + JavaScript

参考 `examples/frontend_example.html`，这是一个完整的实时订单簿界面。

### React 示例

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Order {
    orderId: string;
    price: string;
    amount: string;
    filledAmount: string;
}

function OrderBook({ token }: { token: string }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [bids, setBids] = useState<Order[]>([]);
    const [asks, setAsks] = useState<Order[]>([]);

    useEffect(() => {
        // 连接 WebSocket
        const newSocket = io('http://localhost:3000');
        setSocket(newSocket);

        // 订阅订单簿
        newSocket.emit('subscribe', { token });

        // 监听订单簿更新
        newSocket.on('orderbook', (data) => {
            setBids(data.bids);
            setAsks(data.asks);
        });

        newSocket.on('orderUpdate', (data) => {
            setBids(data.bids);
            setAsks(data.asks);
        });

        // 清理
        return () => {
            newSocket.emit('unsubscribe', { token });
            newSocket.close();
        };
    }, [token]);

    return (
        <div className="orderbook">
            <div className="bids">
                <h3>买单</h3>
                {bids.map(order => (
                    <div key={order.orderId} className="order-item">
                        <span>{order.price}</span>
                        <span>{order.amount}</span>
                    </div>
                ))}
            </div>
            <div className="asks">
                <h3>卖单</h3>
                {asks.map(order => (
                    <div key={order.orderId} className="order-item">
                        <span>{order.price}</span>
                        <span>{order.amount}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
```

## 生产环境部署

### 1. 数据库选择

推荐使用 PostgreSQL 或 MongoDB：

- **PostgreSQL**：适合复杂查询和事务
- **MongoDB**：适合高写入吞吐量

### 2. 缓存层

使用 Redis 缓存热点数据：

```typescript
import Redis from 'ioredis';

const redis = new Redis();

// 缓存订单簿
async function getOrderBookWithCache(token: string) {
    const cacheKey = `orderbook:${token}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
        return JSON.parse(cached);
    }
    
    const orderbook = await client.getOrderBookSnapshot(token);
    await redis.setex(cacheKey, 60, JSON.stringify(orderbook));
    
    return orderbook;
}
```

### 3. 负载均衡

使用 Nginx 进行负载均衡：

```nginx
upstream api_servers {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    listen 80;
    
    location /api {
        proxy_pass http://api_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. 监控和告警

使用 Prometheus + Grafana：

```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

// 定义指标
const eventProcessed = new Counter({
    name: 'orderbook_events_processed_total',
    help: 'Total number of events processed',
    labelNames: ['event_type'],
});

const queryDuration = new Histogram({
    name: 'orderbook_query_duration_seconds',
    help: 'Query duration in seconds',
    labelNames: ['query_type'],
});

const activeOrders = new Gauge({
    name: 'orderbook_active_orders',
    help: 'Number of active orders',
    labelNames: ['token', 'order_type'],
});

// 使用指标
eventProcessed.inc({ event_type: 'OrderCreated' });
queryDuration.observe({ query_type: 'getActiveOrders' }, duration);
activeOrders.set({ token, order_type: 'BUY' }, count);
```

### 5. 容器化部署

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/examples/api_server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ORDERBOOK_ADDRESS=${ORDERBOOK_ADDRESS}
      - RPC_URL=${RPC_URL}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=orderbook
      - POSTGRES_USER=orderbook
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## 总结

本指南涵盖了 OrderBook 客户端的完整使用流程，从基础使用到生产环境部署。主要特点：

✅ **事件驱动架构**：实时同步链上数据
✅ **数据库集成**：支持任何数据库
✅ **RESTful API**：标准的 HTTP 接口
✅ **WebSocket 推送**：实时订单更新
✅ **生产就绪**：完整的监控和部署方案

更多示例请参考：
- `examples/full_client_example.ts` - 完整客户端示例
- `examples/api_server.ts` - API 服务器示例
- `examples/frontend_example.html` - 前端界面示例

---

**文档版本**：1.0.0  
**最后更新**：2025-11-10

