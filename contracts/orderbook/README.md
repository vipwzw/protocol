# @0x/contracts-orderbook

ETH-ERC20 限价订单簿智能合约系统

## 📋 概述

这是一个去中心化的限价订单簿（Limit Order Book）系统，支持 ETH 和 ERC20 代币之间的交易。用户可以创建买单/卖单、撮合交易，并通过事件系统实时获取订单状态更新。

## ✨ 核心功能

- ✅ **创建限价订单**：支持创建买单（用 ETH 购买 Token）和卖单（用 Token 换取 ETH）
- ✅ **撮合交易**：支持部分或全部成交现有订单
- ✅ **订单管理**：支持取消未成交的订单
- ✅ **事件通知**：完整的事件系统，便于客户端构建订单簿
- ✅ **查询接口**：丰富的查询功能，支持分页
- ✅ **安全保障**：重入攻击防护、整数溢出保护、授权检查

## 🏗️ 架构

```
OrderBook Contract
├── 订单管理
│   ├── 创建买单
│   ├── 创建卖单
│   └── 取消订单
├── 交易撮合
│   ├── 完全成交
│   └── 部分成交
├── 查询接口
│   ├── 获取订单信息
│   ├── 获取用户订单
│   ├── 获取活跃买单/卖单
│   └── 计算成交成本
└── 事件系统
    ├── OrderCreated
    ├── OrderFilled
    ├── OrderFullyFilled
    └── OrderCancelled
```

## 📦 安装

```bash
# 安装依赖
yarn install

# 编译合约
yarn build

# 生成 TypeScript 类型
yarn generate_contract_wrappers:force
```

## 🧪 测试

```bash
# 运行 Hardhat 测试
yarn test

# 运行 Foundry 测试
yarn test:forge

# 测试覆盖率
yarn test:coverage
```

## 🚀 部署

### 部署到本地网络

```bash
# 启动本地节点
npx hardhat node

# 部署合约
npx hardhat run scripts/deploy.ts --network localhost

# 部署合约和测试代币
npx hardhat run scripts/deploy_with_test_token.ts --network localhost
```

### 部署到测试网

```bash
# 配置环境变量
export PRIVATE_KEY="your-private-key"
export INFURA_API_KEY="your-infura-key"

# 部署到 Sepolia
npx hardhat run scripts/deploy.ts --network sepolia
```

## 💻 使用示例

### 基础使用

```typescript
import { ethers } from "ethers";
import { OrderBookClient } from "@0x/contracts-orderbook";

// 连接到合约
const provider = new ethers.JsonRpcProvider("http://localhost:8545");
const signer = new ethers.Wallet(privateKey, provider);
const client = new OrderBookClient(orderBookAddress, provider).connect(signer);

// 创建买单（用 ETH 购买 Token）
const buyPrice = ethers.parseEther("0.001"); // 1 token = 0.001 ETH
const buyAmount = ethers.parseEther("100"); // 100 tokens
const requiredETH = (buyPrice * buyAmount) / ethers.parseEther("1");

const buyTx = await client.createBuyOrder(
    tokenAddress,
    buyPrice,
    buyAmount,
    requiredETH
);
await buyTx.wait();

// 创建卖单（用 Token 换取 ETH）
const sellPrice = ethers.parseEther("0.002"); // 1 token = 0.002 ETH
const sellAmount = ethers.parseEther("50"); // 50 tokens

// 先授权
const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
await token.approve(orderBookAddress, sellAmount);

const sellTx = await client.createSellOrder(
    tokenAddress,
    sellPrice,
    sellAmount
);
await sellTx.wait();

// 撮合交易（吃买单）
const orderId = 1n;
const fillAmount = ethers.parseEther("30");

await token.approve(orderBookAddress, fillAmount);
const fillTx = await client.fillOrder(orderId, fillAmount);
await fillTx.wait();

// 取消订单
const cancelTx = await client.cancelOrder(orderId);
await cancelTx.wait();
```

### 查询订单

```typescript
// 获取单个订单信息
const order = await client.getOrder(orderId);
console.log("订单信息:", order);

// 批量获取订单信息（推荐使用）
const orderIds = [1n, 2n, 3n, 4n, 5n];
const orders = await client.getOrders(orderIds);
console.log("批量订单:", orders);

// 计算成交成本
const cost = await client.calculateFillCost(orderId, fillAmount);
console.log("成交成本:", ethers.formatEther(cost), "ETH");

// 获取剩余数量
const remaining = await client.getRemainingAmount(orderId);
console.log("剩余数量:", ethers.formatEther(remaining), "Tokens");
```

> **注意**：为了性能优化，合约不再提供链上的活跃订单过滤功能。请使用事件驱动架构在链下维护订单状态。详见 [事件驱动架构文档](./docs/EVENT_DRIVEN_ARCHITECTURE.md)。

### 监听事件

```typescript
// 监听订单创建
client.onOrderCreated((event) => {
    console.log("新订单创建:", {
        orderId: event.orderId,
        maker: event.maker,
        orderType: event.orderType === 0 ? "BUY" : "SELL",
        price: ethers.formatEther(event.price),
        amount: ethers.formatEther(event.amount),
    });
});

// 监听订单成交
client.onOrderFilled((event) => {
    console.log("订单成交:", {
        orderId: event.orderId,
        taker: event.taker,
        fillAmount: ethers.formatEther(event.fillAmount),
        remainingAmount: ethers.formatEther(event.remainingAmount),
    });
});

// 监听订单完全成交
client.onOrderFullyFilled((event) => {
    console.log("订单完全成交:", event.orderId);
});

// 监听订单取消
client.onOrderCancelled((event) => {
    console.log("订单取消:", {
        orderId: event.orderId,
        maker: event.maker,
        refundedAmount: ethers.formatEther(event.refundedAmount),
    });
});
```

### 事件驱动架构

推荐使用事件驱动架构来构建高性能的订单簿应用。通过监听合约事件，在本地数据库中维护订单状态，实现快速查询和复杂过滤。

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
    status: 'ACTIVE',
    timestamp: timestamp.toNumber()
  });
});

// 监听订单完全成交事件
orderBook.on('OrderFullyFilled', async (orderId, timestamp) => {
  // 更新订单状态
  await db.orders.update(
    { orderId: orderId.toString() },
    { status: 'FILLED' }
  );
});

// 从本地数据库查询活跃订单（零 gas 消耗，毫秒级响应）
const activeOrders = await db.orders.find({
  token: tokenAddress,
  orderType: 'BUY',
  status: 'ACTIVE'
}).sort({ price: -1 }).limit(50);
```

完整的实现指南请参考：[事件驱动架构文档](./docs/EVENT_DRIVEN_ARCHITECTURE.md)

## 📚 API 文档

### 合约接口

#### 创建买单

```solidity
function createBuyOrder(
    address token,
    uint256 price,
    uint256 amount
) external payable returns (uint256 orderId)
```

#### 创建卖单

```solidity
function createSellOrder(
    address token,
    uint256 price,
    uint256 amount
) external returns (uint256 orderId)
```

#### 撮合交易

```solidity
function fillOrder(
    uint256 orderId,
    uint256 fillAmount
) external payable returns (uint256 executedAmount)
```

#### 取消订单

```solidity
function cancelOrder(uint256 orderId) external
```

#### 查询接口

```solidity
// 批量查询订单（推荐）
function getOrders(uint256[] calldata orderIds) external view returns (Order[] memory)

// 单个订单查询
function getOrder(uint256 orderId) external view returns (Order memory)

// 计算成交成本
function calculateFillCost(uint256 orderId, uint256 fillAmount) external view returns (uint256 requiredAsset)

// 获取剩余数量
function getRemainingAmount(uint256 orderId) external view returns (uint256)
```

### TypeScript 客户端

详细的 TypeScript API 文档请参考 [src/order_book_client.ts](src/order_book_client.ts)。

## 🔐 安全考虑

- ✅ 使用 OpenZeppelin 的 `ReentrancyGuard` 防止重入攻击
- ✅ 使用 Solidity 0.8.28 的自动溢出检查
- ✅ 使用 `SafeERC20` 安全转账代币
- ✅ 严格的权限检查（只有订单创建者可以取消订单）
- ✅ 完整的参数验证

## 📊 Gas 优化

- 使用紧凑的结构体打包
- 分页查询避免 gas 限制
- 使用映射代替数组遍历
- 批量操作支持

## 🧩 扩展功能

未来可以添加的功能：

- [ ] 订单过期时间
- [ ] 最小成交量
- [ ] 手续费机制
- [ ] 批量操作
- [ ] 高级订单类型（止损单、止盈单等）
- [ ] 价格滑点保护

## 📝 许可证

Apache-2.0

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系方式

- GitHub: https://github.com/0xProject/protocol
- Discord: https://discord.gg/0xProject
- Twitter: https://twitter.com/0xProject

## 📖 文档

- **[完整文档目录](./docs/README.md)** - 所有文档的索引
- **[设计文档](./docs/eth-erc20-orderbook.md)** - 完整的技术规格和设计方案
- **[事件驱动架构](./docs/EVENT_DRIVEN_ARCHITECTURE.md)** - 客户端集成指南

## 🔗 相关链接

- [0x Protocol 文档](https://docs.0x.org)
- [Hardhat 文档](https://hardhat.org/docs)
- [Foundry 文档](https://book.getfoundry.sh)

