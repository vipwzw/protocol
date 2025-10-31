# 快速开始指南

本指南将帮助你快速上手 OrderBook 合约系统。

## 🚀 5 分钟快速开始

### 1. 安装依赖

```bash
cd contracts/orderbook
yarn install
```

### 2. 编译合约

```bash
yarn build
```

### 3. 运行测试

```bash
# Hardhat 测试
yarn test

# Foundry 测试
yarn test:forge
```

### 4. 部署到本地网络

```bash
# 终端 1：启动本地节点
npx hardhat node

# 终端 2：部署合约和测试代币
npx hardhat run scripts/deploy_with_test_token.ts --network localhost
```

### 5. 运行示例

```bash
npx hardhat run scripts/example_usage.ts --network localhost
```

## 📖 基础概念

### 订单类型

- **买单（BUY）**：用 ETH 购买 ERC20 代币
- **卖单（SELL）**：用 ERC20 代币换取 ETH

### 价格表示

价格表示为 1 个 Token 需要多少 wei 的 ETH：

```typescript
// 1 Token = 0.001 ETH
const price = ethers.parseEther("0.001"); // 1000000000000000 wei
```

### 订单状态

- **ACTIVE (0)**：活跃，可以成交
- **FILLED (1)**：完全成交
- **CANCELLED (2)**：已取消
- **EXPIRED (3)**：已过期（预留）

## 💡 常见场景

### 场景 1：用户想用 1 ETH 购买 Token

```typescript
// 假设当前市场价格：1 Token = 0.001 ETH
const price = ethers.parseEther("0.001");
const amount = ethers.parseEther("1000"); // 想买 1000 tokens
const requiredETH = (price * amount) / ethers.parseEther("1"); // 1 ETH

// 创建买单
const tx = await orderBook.createBuyOrder(tokenAddress, price, amount, {
    value: requiredETH
});
await tx.wait();
```

### 场景 2：用户想卖出 500 Token 换取 ETH

```typescript
// 假设期望价格：1 Token = 0.002 ETH
const price = ethers.parseEther("0.002");
const amount = ethers.parseEther("500"); // 卖 500 tokens

// 先授权
await token.approve(orderBookAddress, amount);

// 创建卖单
const tx = await orderBook.createSellOrder(tokenAddress, price, amount);
await tx.wait();
```

### 场景 3：用户看到一个好价格的买单，想卖 Token

```typescript
// 查看买单列表
const buyOrders = await orderBook.getActiveBuyOrders(tokenAddress, 0, 10);

// 选择一个订单
const order = buyOrders[0];
console.log("价格:", ethers.formatEther(order.price), "ETH/Token");
console.log("数量:", ethers.formatEther(order.amount), "Tokens");

// 决定卖出 100 tokens
const fillAmount = ethers.parseEther("100");

// 授权
await token.approve(orderBookAddress, fillAmount);

// 成交
const tx = await orderBook.fillOrder(order.orderId, fillAmount);
await tx.wait();

// 用户会收到对应的 ETH
```

### 场景 4：用户看到一个好价格的卖单，想买 Token

```typescript
// 查看卖单列表
const sellOrders = await orderBook.getActiveSellOrders(tokenAddress, 0, 10);

// 选择一个订单
const order = sellOrders[0];
console.log("价格:", ethers.formatEther(order.price), "ETH/Token");
console.log("数量:", ethers.formatEther(order.amount), "Tokens");

// 决定买入 50 tokens
const fillAmount = ethers.parseEther("50");

// 计算所需 ETH
const requiredETH = await orderBook.calculateFillCost(order.orderId, fillAmount);

// 成交
const tx = await orderBook.fillOrder(order.orderId, fillAmount, {
    value: requiredETH
});
await tx.wait();

// 用户会收到对应的 Token
```

### 场景 5：用户想取消自己的订单

```typescript
// 获取用户的订单列表
const userOrders = await orderBook.getUserOrders(userAddress);

// 选择要取消的订单
const orderId = userOrders[0];

// 取消订单
const tx = await orderBook.cancelOrder(orderId);
await tx.wait();

// 未成交的资产会退还给用户
```

## 🎯 构建订单簿 UI

### 使用 LocalOrderBook

```typescript
import { OrderBookClient, LocalOrderBook } from "@0x/contracts-orderbook";

// 创建客户端
const client = new OrderBookClient(orderBookAddress, provider);

// 创建本地订单簿
const localOrderBook = new LocalOrderBook(client);

// 初始化（从区块 0 开始同步）
await localOrderBook.initialize(tokenAddress, 0);

// 实时获取订单簿数据
setInterval(() => {
    const buyOrders = localOrderBook.getBuyOrders(tokenAddress);
    const sellOrders = localOrderBook.getSellOrders(tokenAddress);
    
    // 更新 UI
    updateOrderBookUI(buyOrders, sellOrders);
}, 1000);
```

### 监听实时更新

```typescript
// 监听新订单
client.onOrderCreated((event) => {
    console.log("新订单:", event);
    // 更新 UI
});

// 监听成交
client.onOrderFilled((event) => {
    console.log("订单成交:", event);
    // 更新 UI
});

// 监听完全成交
client.onOrderFullyFilled((event) => {
    console.log("订单完全成交:", event);
    // 从订单簿移除
});

// 监听取消
client.onOrderCancelled((event) => {
    console.log("订单取消:", event);
    // 从订单簿移除
});
```

## 🔧 开发技巧

### 1. 价格精度

为了避免精度问题，建议使用固定的价格步长：

```typescript
// 价格步长：0.0001 ETH
const PRICE_STEP = ethers.parseEther("0.0001");

// 确保价格是步长的整数倍
const price = BigInt(Math.round(desiredPrice / PRICE_STEP)) * PRICE_STEP;
```

### 2. Gas 优化

批量查询订单时使用分页：

```typescript
// 每次查询 50 个订单
const PAGE_SIZE = 50n;

async function getAllOrders(token: string) {
    const orders = [];
    let offset = 0n;
    
    while (true) {
        const page = await orderBook.getActiveBuyOrders(token, offset, PAGE_SIZE);
        if (page.length === 0) break;
        
        orders.push(...page);
        offset += BigInt(page.length);
        
        if (page.length < PAGE_SIZE) break;
    }
    
    return orders;
}
```

### 3. 错误处理

```typescript
try {
    const tx = await orderBook.createBuyOrder(token, price, amount, { value });
    await tx.wait();
} catch (error: any) {
    if (error.message.includes("InsufficientETH")) {
        console.error("ETH 不足");
    } else if (error.message.includes("InvalidPrice")) {
        console.error("价格无效");
    } else {
        console.error("未知错误:", error);
    }
}
```

## 📊 测试数据

在本地测试时，可以使用以下测试数据：

```typescript
// 测试代币
const TEST_TOKEN = "0x..."; // 部署后的测试代币地址

// 测试价格（1 Token = 0.001 ETH）
const TEST_PRICE = ethers.parseEther("0.001");

// 测试数量
const TEST_AMOUNT = ethers.parseEther("100");

// 测试账户
const accounts = await ethers.getSigners();
const maker = accounts[1];
const taker = accounts[2];
```

## 🐛 常见问题

### Q: 为什么我的买单创建失败？

A: 检查以下几点：
1. 是否发送了足够的 ETH（`msg.value >= price * amount / 1e18`）
2. 价格和数量是否大于 0
3. Token 地址是否有效

### Q: 为什么我的卖单创建失败？

A: 检查以下几点：
1. 是否授权了足够的代币给合约
2. 账户是否有足够的代币余额
3. 价格和数量是否大于 0

### Q: 为什么我无法成交订单？

A: 检查以下几点：
1. 订单是否处于 ACTIVE 状态
2. 对于买单：是否授权了足够的代币
3. 对于卖单：是否发送了足够的 ETH
4. 成交数量是否大于 0

### Q: 如何计算我能获得多少 ETH/Token？

A: 使用 `calculateFillCost` 函数：

```typescript
const cost = await orderBook.calculateFillCost(orderId, fillAmount);
console.log("所需资产:", ethers.formatEther(cost));
```

## 📚 下一步

- 阅读[完整文档](README.md)
- 查看[设计文档](../../docs/design/eth-erc20-orderbook.md)
- 运行[示例代码](scripts/example_usage.ts)
- 编写自己的交易策略

## 🤝 获取帮助

如果遇到问题：

1. 查看[测试用例](test/orderbook.test.ts)了解正确用法
2. 在 GitHub 上提交 Issue
3. 加入 Discord 社区讨论

祝你使用愉快！🎉

