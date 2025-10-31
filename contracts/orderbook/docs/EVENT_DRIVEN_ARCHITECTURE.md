# OrderBook 事件驱动架构

## 设计理念

合约采用**事件驱动架构**，所有状态变更都会发出事件。客户端通过监听事件来同步订单状态，避免在链上进行低效的遍历和过滤操作。

## 核心原则

1. **链上存储和验证** - 合约负责订单的创建、撮合、取消等核心逻辑
2. **事件通知** - 所有状态变更都发出事件
3. **链下索引** - 客户端监听事件，在本地数据库中维护订单状态
4. **批量查询** - 使用 `getOrders()` 批量获取订单详情

## 事件列表

### 1. OrderCreated - 订单创建
```solidity
event OrderCreated(
    uint256 indexed orderId,      // 订单 ID（索引）
    address indexed maker,         // 创建者地址（索引）
    address indexed token,         // 代币地址（索引）
    OrderType orderType,           // BUY 或 SELL
    uint256 price,                 // 价格
    uint256 amount,                // 数量
    uint256 timestamp              // 时间戳
);
```

**客户端处理**：
```typescript
// 监听订单创建事件
orderBook.on('OrderCreated', async (orderId, maker, token, orderType, price, amount, timestamp) => {
  // 在数据库中创建新订单
  await db.orders.create({
    orderId: orderId.toString(),
    maker,
    token,
    orderType: orderType === 0 ? 'BUY' : 'SELL',
    price: price.toString(),
    amount: amount.toString(),
    filledAmount: '0',
    status: 'ACTIVE',
    timestamp: timestamp.toNumber()
  });
  
  console.log(`新订单创建: ${orderId}`);
});
```

### 2. OrderFilled - 订单部分成交
```solidity
event OrderFilled(
    uint256 indexed orderId,      // 订单 ID（索引）
    address indexed taker,         // 吃单者地址（索引）
    uint256 fillAmount,            // 本次成交数量
    uint256 remainingAmount,       // 剩余数量
    uint256 timestamp              // 时间戳
);
```

**客户端处理**：
```typescript
// 监听订单成交事件
orderBook.on('OrderFilled', async (orderId, taker, fillAmount, remainingAmount, timestamp) => {
  // 更新订单的成交数量
  const order = await db.orders.findOne({ orderId: orderId.toString() });
  
  await db.orders.update(
    { orderId: orderId.toString() },
    {
      filledAmount: order.amount - remainingAmount.toString(),
      // 如果剩余数量为 0，状态会在 OrderFullyFilled 事件中更新
    }
  );
  
  // 记录成交历史
  await db.fills.create({
    orderId: orderId.toString(),
    taker,
    fillAmount: fillAmount.toString(),
    timestamp: timestamp.toNumber()
  });
  
  console.log(`订单 ${orderId} 部分成交: ${fillAmount}`);
});
```

### 3. OrderFullyFilled - 订单完全成交
```solidity
event OrderFullyFilled(
    uint256 indexed orderId,      // 订单 ID（索引）
    uint256 timestamp              // 时间戳
);
```

**客户端处理**：
```typescript
// 监听订单完全成交事件
orderBook.on('OrderFullyFilled', async (orderId, timestamp) => {
  // 标记订单为已完成
  await db.orders.update(
    { orderId: orderId.toString() },
    { 
      status: 'FILLED',
      completedAt: timestamp.toNumber()
    }
  );
  
  console.log(`订单 ${orderId} 完全成交`);
});
```

### 4. OrderCancelled - 订单取消
```solidity
event OrderCancelled(
    uint256 indexed orderId,      // 订单 ID（索引）
    address indexed maker,         // 创建者地址（索引）
    uint256 refundedAmount,        // 退款数量
    uint256 timestamp              // 时间戳
);
```

**客户端处理**：
```typescript
// 监听订单取消事件
orderBook.on('OrderCancelled', async (orderId, maker, refundedAmount, timestamp) => {
  // 标记订单为已取消
  await db.orders.update(
    { orderId: orderId.toString() },
    { 
      status: 'CANCELLED',
      cancelledAt: timestamp.toNumber()
    }
  );
  
  console.log(`订单 ${orderId} 已取消，退款: ${refundedAmount}`);
});
```

## 批量查询函数

### getOrders() - 批量获取订单详情

```solidity
function getOrders(uint256[] calldata orderIds) 
    external 
    view 
    returns (Order[] memory);
```

**使用场景**：
1. 初始化时同步历史订单
2. 验证本地数据库与链上状态一致性
3. 恢复丢失的订单数据

**示例**：
```typescript
// 批量查询订单详情
const orderIds = [1, 2, 3, 4, 5];
const orders = await orderBook.getOrders(orderIds);

// 批量插入数据库
for (const order of orders) {
  await db.orders.upsert({
    orderId: order.orderId.toString(),
    maker: order.maker,
    token: order.token,
    orderType: order.orderType === 0 ? 'BUY' : 'SELL',
    price: order.price.toString(),
    amount: order.amount.toString(),
    filledAmount: order.filledAmount.toString(),
    status: ['ACTIVE', 'FILLED', 'CANCELLED', 'EXPIRED'][order.status],
    timestamp: order.timestamp.toNumber()
  });
}
```

## 完整的客户端架构

```typescript
import { ethers } from 'ethers';
import { OrderBook__factory } from './typechain';

class OrderBookIndexer {
  private orderBook: OrderBook;
  private db: Database;
  
  constructor(provider: ethers.Provider, contractAddress: string, db: Database) {
    this.orderBook = OrderBook__factory.connect(contractAddress, provider);
    this.db = db;
  }
  
  // 启动事件监听
  async start(fromBlock: number = 0) {
    console.log('开始监听 OrderBook 事件...');
    
    // 1. 订单创建
    this.orderBook.on('OrderCreated', async (orderId, maker, token, orderType, price, amount, timestamp) => {
      await this.handleOrderCreated(orderId, maker, token, orderType, price, amount, timestamp);
    });
    
    // 2. 订单成交
    this.orderBook.on('OrderFilled', async (orderId, taker, fillAmount, remainingAmount, timestamp) => {
      await this.handleOrderFilled(orderId, taker, fillAmount, remainingAmount, timestamp);
    });
    
    // 3. 订单完全成交
    this.orderBook.on('OrderFullyFilled', async (orderId, timestamp) => {
      await this.handleOrderFullyFilled(orderId, timestamp);
    });
    
    // 4. 订单取消
    this.orderBook.on('OrderCancelled', async (orderId, maker, refundedAmount, timestamp) => {
      await this.handleOrderCancelled(orderId, maker, refundedAmount, timestamp);
    });
    
    // 同步历史事件
    if (fromBlock > 0) {
      await this.syncHistoricalEvents(fromBlock);
    }
  }
  
  // 同步历史事件
  async syncHistoricalEvents(fromBlock: number) {
    const currentBlock = await this.orderBook.runner.provider.getBlockNumber();
    console.log(`同步历史事件: ${fromBlock} -> ${currentBlock}`);
    
    // 分批查询事件（避免 RPC 限制）
    const batchSize = 10000;
    for (let start = fromBlock; start <= currentBlock; start += batchSize) {
      const end = Math.min(start + batchSize - 1, currentBlock);
      
      // 查询所有事件类型
      const events = await this.orderBook.queryFilter('*', start, end);
      
      for (const event of events) {
        await this.processEvent(event);
      }
      
      console.log(`已同步区块 ${start} - ${end}`);
    }
  }
  
  // 处理事件
  private async processEvent(event: ethers.EventLog) {
    switch (event.eventName) {
      case 'OrderCreated':
        const [orderId, maker, token, orderType, price, amount, timestamp] = event.args;
        await this.handleOrderCreated(orderId, maker, token, orderType, price, amount, timestamp);
        break;
      
      case 'OrderFilled':
        // ... 类似处理
        break;
      
      // ... 其他事件
    }
  }
  
  // 事件处理函数
  private async handleOrderCreated(
    orderId: bigint,
    maker: string,
    token: string,
    orderType: number,
    price: bigint,
    amount: bigint,
    timestamp: bigint
  ) {
    await this.db.orders.create({
      orderId: orderId.toString(),
      maker,
      token,
      orderType: orderType === 0 ? 'BUY' : 'SELL',
      price: price.toString(),
      amount: amount.toString(),
      filledAmount: '0',
      status: 'ACTIVE',
      timestamp: Number(timestamp)
    });
  }
  
  private async handleOrderFilled(
    orderId: bigint,
    taker: string,
    fillAmount: bigint,
    remainingAmount: bigint,
    timestamp: bigint
  ) {
    const order = await this.db.orders.findOne({ orderId: orderId.toString() });
    
    await this.db.orders.update(
      { orderId: orderId.toString() },
      { filledAmount: (BigInt(order.amount) - remainingAmount).toString() }
    );
    
    await this.db.fills.create({
      orderId: orderId.toString(),
      taker,
      fillAmount: fillAmount.toString(),
      timestamp: Number(timestamp)
    });
  }
  
  private async handleOrderFullyFilled(orderId: bigint, timestamp: bigint) {
    await this.db.orders.update(
      { orderId: orderId.toString() },
      { status: 'FILLED', completedAt: Number(timestamp) }
    );
  }
  
  private async handleOrderCancelled(
    orderId: bigint,
    maker: string,
    refundedAmount: bigint,
    timestamp: bigint
  ) {
    await this.db.orders.update(
      { orderId: orderId.toString() },
      { status: 'CANCELLED', cancelledAt: Number(timestamp) }
    );
  }
  
  // 查询活跃订单（从本地数据库）
  async getActiveOrders(token: string, orderType: 'BUY' | 'SELL', limit: number = 50) {
    return await this.db.orders.find({
      token,
      orderType,
      status: 'ACTIVE'
    })
    .sort({ price: orderType === 'BUY' ? -1 : 1 }) // 买单按价格降序，卖单按价格升序
    .limit(limit);
  }
  
  // 验证数据一致性
  async verifyOrder(orderId: string) {
    const localOrder = await this.db.orders.findOne({ orderId });
    const chainOrder = await this.orderBook.getOrder(BigInt(orderId));
    
    // 比较本地和链上数据
    const isConsistent = 
      localOrder.maker === chainOrder.maker &&
      localOrder.price === chainOrder.price.toString() &&
      localOrder.status === ['ACTIVE', 'FILLED', 'CANCELLED', 'EXPIRED'][chainOrder.status];
    
    if (!isConsistent) {
      console.warn(`订单 ${orderId} 数据不一致，需要重新同步`);
      // 更新本地数据
      await this.syncOrderFromChain(orderId);
    }
    
    return isConsistent;
  }
  
  // 从链上同步单个订单
  private async syncOrderFromChain(orderId: string) {
    const chainOrder = await this.orderBook.getOrder(BigInt(orderId));
    
    await this.db.orders.upsert({
      orderId,
      maker: chainOrder.maker,
      token: chainOrder.token,
      orderType: chainOrder.orderType === 0 ? 'BUY' : 'SELL',
      price: chainOrder.price.toString(),
      amount: chainOrder.amount.toString(),
      filledAmount: chainOrder.filledAmount.toString(),
      status: ['ACTIVE', 'FILLED', 'CANCELLED', 'EXPIRED'][chainOrder.status],
      timestamp: Number(chainOrder.timestamp)
    });
  }
}

// 使用示例
const provider = new ethers.JsonRpcProvider('http://localhost:8545');
const contractAddress = '0x...';
const db = new Database(); // 你的数据库实例

const indexer = new OrderBookIndexer(provider, contractAddress, db);
await indexer.start(0); // 从创世块开始同步

// 查询活跃买单
const activeBuyOrders = await indexer.getActiveOrders(
  '0xTokenAddress',
  'BUY',
  50
);

console.log('活跃买单:', activeBuyOrders);
```

## 性能优势

### 链上（合约）
- ✅ 不需要遍历和过滤订单
- ✅ 查询函数 gas 消耗低
- ✅ 支持批量查询（一次 RPC 调用获取多个订单）

### 链下（客户端）
- ✅ 实时监听事件，延迟低
- ✅ 本地数据库查询速度快
- ✅ 支持复杂的过滤、排序、分页
- ✅ 可以构建订单簿深度图、K线图等

## 数据库设计建议

```sql
-- 订单表
CREATE TABLE orders (
  order_id VARCHAR(78) PRIMARY KEY,
  maker VARCHAR(42) NOT NULL,
  token VARCHAR(42) NOT NULL,
  order_type ENUM('BUY', 'SELL') NOT NULL,
  price VARCHAR(78) NOT NULL,
  amount VARCHAR(78) NOT NULL,
  filled_amount VARCHAR(78) NOT NULL DEFAULT '0',
  status ENUM('ACTIVE', 'FILLED', 'CANCELLED', 'EXPIRED') NOT NULL,
  timestamp BIGINT NOT NULL,
  completed_at BIGINT,
  cancelled_at BIGINT,
  
  INDEX idx_token_type_status (token, order_type, status),
  INDEX idx_maker (maker),
  INDEX idx_status (status),
  INDEX idx_timestamp (timestamp)
);

-- 成交记录表
CREATE TABLE fills (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(78) NOT NULL,
  taker VARCHAR(42) NOT NULL,
  fill_amount VARCHAR(78) NOT NULL,
  timestamp BIGINT NOT NULL,
  
  INDEX idx_order_id (order_id),
  INDEX idx_taker (taker),
  INDEX idx_timestamp (timestamp),
  
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);
```

## 总结

这种**事件驱动 + 链下索引**的架构是 DeFi 应用的标准模式：

1. **合约简洁高效** - 只负责核心业务逻辑
2. **客户端功能强大** - 通过本地数据库实现复杂查询
3. **性能优秀** - 链上 gas 低，链下查询快
4. **可扩展性强** - 易于添加新功能（如订单簿深度、历史图表等）

这就是 Uniswap、0x Protocol 等主流 DeFi 协议采用的架构模式！

