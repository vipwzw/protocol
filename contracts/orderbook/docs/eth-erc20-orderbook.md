# ETH-ERC20 限价订单簿系统设计文档

## 1. 概述

本文档描述了一个支持 ETH 和 ERC20 代币之间交易的去中心化限价订单簿（Limit Order Book）系统。

### 1.1 核心功能

1. **创建限价订单**：用户可以创建买单（用 ETH 购买 ERC20）或卖单（用 ERC20 换取 ETH）
2. **撮合交易**：用户可以选择现有订单进行部分或全部成交
3. **事件通知**：通过事件日志实时通知订单状态变化，便于客户端构建订单簿

### 1.2 设计目标

- **安全性**：使用 Solidity 0.8.28，自动溢出检查
- **Gas 优化**：高效的存储结构和批量操作支持
- **可扩展性**：支持多种 ERC20 代币
- **透明性**：完整的事件日志系统

## 2. 架构设计

### 2.1 核心组件

```
┌─────────────────────────────────────────┐
│         OrderBook Contract              │
├─────────────────────────────────────────┤
│  - Order Management                     │
│  - Trade Execution                      │
│  - Asset Management (ETH + ERC20)       │
│  - Event Emission                       │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────┐      ┌─────────────┐
│  ERC20      │      │  ETH        │
│  Tokens     │      │  Balance    │
└─────────────┘      └─────────────┘
```

### 2.2 订单类型

- **买单（Buy Order）**：用 ETH 购买 ERC20 代币
- **卖单（Sell Order）**：用 ERC20 代币换取 ETH

## 3. 数据结构

### 3.1 订单结构

```solidity
struct Order {
    uint256 orderId;           // 订单唯一 ID
    address maker;             // 订单创建者
    address token;             // ERC20 代币地址
    OrderType orderType;       // BUY 或 SELL
    uint256 price;             // 价格（以 wei 为单位的 ETH/Token 比率）
    uint256 amount;            // 代币数量（对于买单是想买的量，卖单是想卖的量）
    uint256 filledAmount;      // 已成交数量
    uint256 timestamp;         // 创建时间
    OrderStatus status;        // 订单状态
}

enum OrderType {
    BUY,   // 用 ETH 买 Token
    SELL   // 用 Token 卖出获得 ETH
}

enum OrderStatus {
    ACTIVE,      // 活跃
    FILLED,      // 完全成交
    CANCELLED,   // 已取消
    EXPIRED      // 已过期
}
```

### 3.2 价格表示

为了避免浮点数精度问题，价格使用以下方式表示：

- **价格单位**：1 个 Token 需要多少 wei 的 ETH
- **示例**：如果 1 Token = 0.001 ETH，则 price = 1e15 wei

## 4. 核心功能

### 4.1 创建限价买单

**函数签名**：
```solidity
function createBuyOrder(
    address token,
    uint256 price,
    uint256 amount
) external payable returns (uint256 orderId)
```

**功能说明**：
- 用户发送 ETH 创建买单
- 所需 ETH = `price * amount / 1e18`
- 多余的 ETH 会退还
- 发出 `OrderCreated` 事件

**验证**：
- `msg.value >= price * amount / 1e18`
- `amount > 0`
- `token` 是有效的 ERC20 合约

### 4.2 创建限价卖单

**函数签名**：
```solidity
function createSellOrder(
    address token,
    uint256 price,
    uint256 amount
) external returns (uint256 orderId)
```

**功能说明**：
- 用户授权合约转移 ERC20 代币
- 合约托管用户的代币
- 发出 `OrderCreated` 事件

**验证**：
- 用户已授权合约足够的代币额度
- 用户拥有足够的代币余额
- `amount > 0`

### 4.3 撮合交易（吃单）

**函数签名**：
```solidity
function fillOrder(
    uint256 orderId,
    uint256 fillAmount
) external payable returns (uint256 executedAmount)
```

**功能说明**：
- 可以部分或全部成交现有订单
- 自动计算所需资产并进行转账
- 更新订单状态
- 发出 `OrderFilled` 事件

**场景 1：吃买单（Taker 卖 Token 给 Maker）**
- Taker 提供 Token
- Taker 获得 ETH
- Maker 获得 Token

**场景 2：吃卖单（Taker 买 Token 从 Maker）**
- Taker 提供 ETH（通过 msg.value）
- Taker 获得 Token
- Maker 获得 ETH

### 4.4 取消订单

**函数签名**：
```solidity
function cancelOrder(uint256 orderId) external
```

**功能说明**：
- 只有订单创建者可以取消
- 退还未成交的资产
- 发出 `OrderCancelled` 事件

## 5. 事件系统

### 5.1 订单创建事件

```solidity
event OrderCreated(
    uint256 indexed orderId,
    address indexed maker,
    address indexed token,
    OrderType orderType,
    uint256 price,
    uint256 amount,
    uint256 timestamp
);
```

### 5.2 订单成交事件

```solidity
event OrderFilled(
    uint256 indexed orderId,
    address indexed taker,
    uint256 fillAmount,
    uint256 remainingAmount,
    uint256 timestamp
);
```

### 5.3 订单完全成交事件

```solidity
event OrderFullyFilled(
    uint256 indexed orderId,
    uint256 timestamp
);
```

### 5.4 订单取消事件

```solidity
event OrderCancelled(
    uint256 indexed orderId,
    address indexed maker,
    uint256 refundedAmount,
    uint256 timestamp
);
```

## 6. 查询接口

### 6.1 获取订单信息

```solidity
function getOrder(uint256 orderId) external view returns (Order memory);
```

### 6.2 获取用户订单列表

```solidity
function getUserOrders(address user) external view returns (uint256[] memory);
```

### 6.3 获取活跃买单列表

```solidity
function getActiveBuyOrders(
    address token,
    uint256 offset,
    uint256 limit
) external view returns (Order[] memory);
```

### 6.4 获取活跃卖单列表

```solidity
function getActiveSellOrders(
    address token,
    uint256 offset,
    uint256 limit
) external view returns (Order[] memory);
```

### 6.5 计算成交所需资产

```solidity
function calculateFillCost(
    uint256 orderId,
    uint256 fillAmount
) external view returns (uint256 requiredAsset);
```

## 7. 安全考虑

### 7.1 重入攻击防护

- 使用 OpenZeppelin 的 `ReentrancyGuard`
- 遵循 Checks-Effects-Interactions 模式

### 7.2 整数溢出

- 使用 Solidity 0.8.28 的自动溢出检查
- 关键计算使用 SafeMath 风格的验证

### 7.3 授权检查

- 只有订单创建者可以取消订单
- ERC20 转账前检查授权额度

### 7.4 价格操纵防护

- 订单创建时锁定价格
- 不依赖外部价格预言机

### 7.5 前置交易（Front-running）防护

- 订单匹配基于链上状态
- 可选：添加最小/最大价格滑点保护

## 8. Gas 优化

### 8.1 存储优化

- 使用紧凑的结构体打包
- 批量操作减少存储写入

### 8.2 事件优化

- 使用 indexed 参数便于过滤
- 避免在事件中存储冗余数据

### 8.3 循环优化

- 分页查询避免 gas 限制
- 使用映射代替数组遍历

## 9. 客户端集成

### 9.1 监听事件

客户端可以通过监听合约事件来构建本地订单簿：

```javascript
// 监听订单创建
contract.on("OrderCreated", (orderId, maker, token, orderType, price, amount) => {
    // 添加到本地订单簿
});

// 监听订单成交
contract.on("OrderFilled", (orderId, taker, fillAmount, remainingAmount) => {
    // 更新订单状态
});

// 监听订单完全成交
contract.on("OrderFullyFilled", (orderId) => {
    // 从活跃订单列表移除
});

// 监听订单取消
contract.on("OrderCancelled", (orderId, maker, refundedAmount) => {
    // 从活跃订单列表移除
});
```

### 9.2 构建订单簿

```javascript
class OrderBook {
    constructor(contract) {
        this.contract = contract;
        this.buyOrders = new Map();  // price -> orders
        this.sellOrders = new Map(); // price -> orders
    }

    async initialize() {
        // 1. 获取历史事件
        const events = await this.contract.queryFilter("OrderCreated", 0);
        
        // 2. 构建初始订单簿
        for (const event of events) {
            await this.handleOrderCreated(event);
        }
        
        // 3. 监听新事件
        this.contract.on("OrderCreated", this.handleOrderCreated.bind(this));
        this.contract.on("OrderFilled", this.handleOrderFilled.bind(this));
        this.contract.on("OrderFullyFilled", this.handleOrderFullyFilled.bind(this));
        this.contract.on("OrderCancelled", this.handleOrderCancelled.bind(this));
    }

    handleOrderCreated(event) {
        // 添加到相应的订单列表
    }

    handleOrderFilled(event) {
        // 更新订单的已成交数量
    }

    handleOrderFullyFilled(event) {
        // 移除订单
    }

    handleOrderCancelled(event) {
        // 移除订单
    }

    getBuyOrders(token) {
        // 返回按价格排序的买单列表（价格从高到低）
    }

    getSellOrders(token) {
        // 返回按价格排序的卖单列表（价格从低到高）
    }
}
```

## 10. 使用示例

### 10.1 创建买单

```solidity
// 用户想用 1 ETH 购买 Token，价格为 1 Token = 0.001 ETH
uint256 price = 1e15; // 0.001 ETH in wei
uint256 amount = 1000e18; // 1000 tokens
uint256 requiredETH = price * amount / 1e18; // 1 ETH

uint256 orderId = orderBook.createBuyOrder{value: requiredETH}(
    tokenAddress,
    price,
    amount
);
```

### 10.2 创建卖单

```solidity
// 用户想卖出 500 Token，价格为 1 Token = 0.002 ETH
uint256 price = 2e15; // 0.002 ETH in wei
uint256 amount = 500e18; // 500 tokens

// 先授权
token.approve(address(orderBook), amount);

// 创建卖单
uint256 orderId = orderBook.createSellOrder(
    tokenAddress,
    price,
    amount
);
```

### 10.3 吃买单（卖 Token）

```solidity
// Taker 想卖 100 Token 给现有买单
uint256 orderId = 1;
uint256 fillAmount = 100e18;

// 先授权
token.approve(address(orderBook), fillAmount);

// 执行交易
uint256 executed = orderBook.fillOrder(orderId, fillAmount);
// Taker 会收到对应的 ETH
```

### 10.4 吃卖单（买 Token）

```solidity
// Taker 想从卖单买入 200 Token
uint256 orderId = 2;
uint256 fillAmount = 200e18;

// 计算所需 ETH
uint256 requiredETH = orderBook.calculateFillCost(orderId, fillAmount);

// 执行交易
uint256 executed = orderBook.fillOrder{value: requiredETH}(orderId, fillAmount);
// Taker 会收到对应的 Token
```

## 11. 扩展功能（可选）

### 11.1 订单过期时间

添加 `expiry` 字段，允许订单在指定时间后自动失效。

### 11.2 最小成交量

添加 `minFillAmount` 字段，防止粉尘攻击。

### 11.3 手续费机制

- 协议手续费（给合约所有者）
- Maker/Taker 手续费差异化

### 11.4 批量操作

- 批量创建订单
- 批量取消订单
- 一次交易吃多个订单

### 11.5 高级订单类型

- 止损单（Stop-Loss）
- 止盈单（Take-Profit）
- 冰山订单（Iceberg Orders）

## 12. 测试策略

### 12.1 单元测试

- 订单创建测试
- 订单撮合测试
- 订单取消测试
- 边界条件测试

### 12.2 集成测试

- 多用户交互测试
- 并发订单测试
- Gas 消耗测试

### 12.3 安全测试

- 重入攻击测试
- 整数溢出测试
- 授权检查测试
- 前置交易模拟

## 13. 部署清单

### 13.1 部署前检查

- [ ] 合约审计完成
- [ ] 测试覆盖率 > 95%
- [ ] Gas 优化完成
- [ ] 文档完善

### 13.2 部署步骤

1. 部署到测试网（Sepolia/Goerli）
2. 进行压力测试
3. 修复发现的问题
4. 部署到主网
5. 验证合约代码

### 13.3 部署后监控

- 监控交易量
- 监控 Gas 消耗
- 监控异常事件
- 收集用户反馈

## 14. 总结

本设计提供了一个完整的 ETH-ERC20 限价订单簿系统，具有以下特点：

✅ **功能完整**：支持创建、撮合、取消订单
✅ **事件驱动**：完整的事件系统便于客户端集成
✅ **安全可靠**：多层安全防护机制
✅ **Gas 优化**：高效的存储和计算
✅ **易于扩展**：模块化设计便于添加新功能

下一步可以开始实现合约代码和测试用例。

