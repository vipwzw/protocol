# 0x Protocol TypeScript/JavaScript 包

本目录包含了 0x Protocol 的 TypeScript/JavaScript 工具包，这些包为开发者提供了与 0x 协议交互的必要工具和接口。

## 📦 包列表

### 1. @0x/protocol-utils

**版本**: 11.24.1  
**描述**: 0x 协议工具集

这是一个综合性的工具包，提供了与 0x 协议交互所需的核心功能。

#### 主要功能：
- **订单管理**：生成、解析、签名和验证 0x 订单
- **EIP-712 工具**：处理类型化数据签名
- **元交易**：支持 MetaTransactions v1 和 v2
- **NFT 订单**：处理 ERC721 和 ERC1155 订单
- **签名工具**：各种签名类型的处理
- **Transformer 工具**：处理代币转换相关功能
- **Treasury 投票**：国库相关的投票功能
- **错误处理**：自定义错误类型和处理

#### 导出内容：
```typescript
- RevertErrors - 错误处理相关
- ERC1155Order, ERC721Order - NFT 订单类型
- OrderStatus, TradeDirection - 订单状态和交易方向
- eip712_utils - EIP-712 签名工具
- orders - 订单相关功能
- meta_transactions - 元交易 v1
- meta_transactions_v2 - 元交易 v2
- signature_utils - 签名工具
- transformer_utils - 转换器工具
- constants - 常量定义
- vip_utils - VIP 相关工具
- treasury_votes - 国库投票功能
```

#### 依赖：
- `@0x/contract-addresses` - 合约地址
- `@0x/contract-wrappers` - 合约包装器
- `ethers` ~4.0.4 - 以太坊 JavaScript 库
- `ethereumjs-util` - 以太坊工具库

---

### 2. @0x/contract-addresses

**版本**: 8.12.0  
**描述**: 获取已部署的 0x 合约地址

这个轻量级包用于获取不同网络上已部署的 0x 合约地址。

#### 主要功能：
- 提供各链上 0x 合约的已知地址
- 支持多链查询
- 类型安全的地址访问

#### 支持的网络：
```typescript
enum ChainId {
    Mainnet = 1,          // 以太坊主网
    Goerli = 5,           // Goerli 测试网
    Hardhat = 1337,       // 本地 Hardhat 网络
    BSC = 56,             // 币安智能链
    Polygon = 137,        // Polygon（原 Matic）
    PolygonMumbai = 80001,// Polygon Mumbai 测试网
    Avalanche = 43114,    // Avalanche C-Chain
    Fantom = 250,         // Fantom Opera
    Celo = 42220,         // Celo
    Optimism = 10,        // Optimism
    Arbitrum = 42161,     // Arbitrum One
    Base = 8453,          // Base
}
```

#### 合约地址结构：
```typescript
interface ContractAddresses {
    zrxToken: string;                      // ZRX 代币地址
    etherToken: string;                    // WETH 地址
    zeroExGovernor: string;                // 治理合约
    zrxVault: string;                      // ZRX 金库
    staking: string;                       // 质押合约
    stakingProxy: string;                  // 质押代理
    erc20BridgeProxy: string;              // ERC20 桥接代理
    erc20BridgeSampler: string;            // ERC20 桥接采样器
    exchangeProxyGovernor: string;         // 交易所代理治理
    exchangeProxy: string;                 // 交易所代理（主入口）
    exchangeProxyTransformerDeployer: string; // 转换器部署器
    exchangeProxyFlashWallet: string;      // 闪电钱包
    exchangeProxyLiquidityProviderSandbox: string; // 流动性提供者沙箱
    zrxTreasury: string;                   // ZRX 国库
    transformers: {
        wethTransformer: string;           // WETH 转换器
        payTakerTransformer: string;       // 支付接收方转换器
        fillQuoteTransformer: string;      // 填充报价转换器
        affiliateFeeTransformer: string;   // 联盟费用转换器
        positiveSlippageFeeTransformer: string; // 正滑点费用转换器
    };
}
```

#### 使用示例：
```typescript
import { getContractAddressesForChainOrThrow, ChainId } from '@0x/contract-addresses';

// 获取主网合约地址
const mainnetAddresses = getContractAddressesForChainOrThrow(ChainId.Mainnet);
console.log(mainnetAddresses.exchangeProxy); // 0x 交易代理地址
```

---

### 3. @0x/contract-wrappers

**版本**: 13.23.7  
**描述**: 0x 智能合约的 JavaScript/TypeScript 包装器

这个包提供了与 0x 智能合约交互的高级接口，封装了底层的合约调用细节。

#### 主要功能：
- 提供类型安全的合约交互接口
- 自动处理 ABI 编码/解码
- 事件监听和过滤
- 交易发送和确认

#### 包含的合约包装器：
- **DevUtils** - 开发工具合约
- **ERC20Token** - ERC20 代币接口
- **ERC721Token** - ERC721 NFT 接口
- **Exchange** - 交易所合约（v3）
- **Forwarder** - 转发器合约
- **WETH9** - Wrapped Ether
- **Coordinator** - 协调器合约
- **Staking** - 质押合约
- **StakingProxy** - 质押代理
- **GodsUnchainedValidator** - Gods Unchained 验证器
- **Broker** - 经纪人合约
- **ILiquidityProvider** - 流动性提供者接口
- **ITransformERC20** - ERC20 转换接口
- **IZeroEx** - 0x 协议主接口

#### 导出的工具类型：
```typescript
- ContractEvent - 合约事件类型
- SendTransactionOpts - 发送交易选项
- AwaitTransactionSuccessOpts - 等待交易成功选项
- DecodedLogEvent - 解码的日志事件
- EventCallback - 事件回调
- AbiDecoder/AbiEncoder - ABI 编解码器
```

#### 自动生成：
包装器通过 `@0x/abi-gen` 工具自动生成，确保与合约 ABI 保持同步。

---

### 4. @0x/contract-artifacts

**版本**: 3.19.0  
**描述**: 0x 智能合约编译工件

这个包包含了所有 0x 协议相关合约的编译工件（ABI 和字节码）。

#### 包含的合约工件（34个）：

##### 核心合约：
- **IZeroEx.json** - 0x 协议主接口（279KB）
- **Exchange.json** - 交易所合约 v3（192KB）
- **ZRXToken.json** - ZRX 代币合约
- **WETH9.json** - Wrapped Ether 合约

##### 代理合约：
- **ERC20Proxy.json** - ERC20 代币代理
- **ERC721Proxy.json** - ERC721 NFT 代理
- **ERC1155Proxy.json** - ERC1155 多代币代理
- **MultiAssetProxy.json** - 多资产代理
- **StaticCallProxy.json** - 静态调用代理
- **ERC20BridgeProxy.json** - ERC20 桥接代理

##### 质押系统：
- **Staking.json** - 质押合约（131KB）
- **StakingProxy.json** - 质押代理合约
- **ZrxVault.json** - ZRX 金库

##### 辅助合约：
- **Forwarder.json** - 转发器合约（81KB）
- **Coordinator.json** - 协调器合约
- **CoordinatorRegistry.json** - 协调器注册表
- **OrderValidator.json** - 订单验证器
- **DevUtils.json** - 开发工具（135KB）
- **AssetProxyOwner.json** - 资产代理所有者
- **Broker.json** - 经纪人合约

##### 测试合约：
- **DummyERC20Token.json** - 测试用 ERC20
- **DummyERC721Token.json** - 测试用 ERC721
- **ERC20Token.json** - 标准 ERC20 实现
- **ERC721Token.json** - 标准 ERC721 实现
- **ERC1155Mintable.json** - 可铸造的 ERC1155

##### 特殊功能：
- **DutchAuction.json** - 荷兰拍卖合约
- **MaximumGasPrice.json** - 最大 Gas 价格限制
- **GodsUnchainedValidator.json** - Gods Unchained 验证器
- **ITransformERC20.json** - ERC20 转换接口

#### 工件更新流程：
1. 合约编译后生成原始工件
2. 运行 `yarn artifacts_copy` 复制工件
3. 运行 `yarn artifacts_transform` 转换格式
4. 运行 `yarn build` 构建 TypeScript 文件

---

## 🔧 开发指南

### 安装
```bash
# 在根目录安装所有依赖
yarn install

# 构建所有包
yarn build

# 构建特定包
PKG=@0x/protocol-utils yarn build
```

### 包的相互依赖关系
```
protocol-utils
  ├── contract-addresses
  └── contract-wrappers
       └── contract-artifacts
```

### 版本管理
- 所有包使用独立版本号
- 遵循语义化版本（Semantic Versioning）
- 通过 lerna 管理发布流程

### 发布
```bash
# 发布到 NPM（需要权限）
yarn publish:all

# 私有发布（用于测试）
yarn publish:private
```

---

## 📚 使用示例

### 基础使用
```typescript
import { 
    getContractAddressesForChainOrThrow, 
    ChainId 
} from '@0x/contract-addresses';
import { 
    ContractWrappers 
} from '@0x/contract-wrappers';
import { 
    signatureUtils,
    orderUtils 
} from '@0x/protocol-utils';

// 获取合约地址
const addresses = getContractAddressesForChainOrThrow(ChainId.Mainnet);

// 初始化合约包装器
const contractWrappers = new ContractWrappers(provider, {
    chainId: ChainId.Mainnet,
});

// 创建并签名订单
const order = orderUtils.createOrder({...});
const signature = await signatureUtils.signOrder(order, signerAddress);
```

### 高级功能
- 元交易（无 Gas 交易）
- 批量订单处理
- 流动性聚合
- NFT 交易

---

## 🔗 相关链接

- [0x 文档](https://0x.org/docs/)
- [NPM 包页面](https://www.npmjs.com/org/0x)
- [GitHub 仓库](https://github.com/0xProject/protocol)

---

## ⚠️ 注意事项

1. **版本兼容性**：确保各包版本之间的兼容性
2. **网络支持**：不同功能在不同网络的支持情况可能不同
3. **Gas 优化**：使用批量操作功能以优化 Gas 消耗
4. **安全性**：始终验证签名和订单的有效性 