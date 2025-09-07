# 0x 协议改写版本

[0x][website-url] 是一个开放的协议，促进基于以太坊资产的无需信任、低摩擦交换。如需了解更多工作原理，请查看 [0x 协议规范](https://protocol.0x.org/)。

本仓库是一个包含 0x 协议智能合约和众多开发工具的 monorepo。每个公共子包都独立发布到 NPM。

[website-url]: https://0x.org

[![Coverage Status](https://codecov.io/gh/vipwzw/protocol/branch/main/graph/badge.svg)](https://codecov.io/gh/vipwzw/protocol)
[![CI Status](https://github.com/vipwzw/protocol/workflows/Continuous%20Integration/badge.svg)](https://github.com/vipwzw/protocol/actions)
[![Discord](https://img.shields.io/badge/chat-discord.chat-yellow.svg?style=flat)](https://discordapp.com/invite/d3FTX3M)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## 📊 测试覆盖率

本项目使用 Codecov 进行测试覆盖率跟踪，覆盖率数据会在每次 CI 运行后自动更新。

### 整体覆盖率
[![Coverage Graph](https://codecov.io/gh/vipwzw/protocol/branch/main/graphs/tree.svg)](https://codecov.io/gh/vipwzw/protocol)

### 主要模块覆盖率

| 模块 | 覆盖率 | 状态 |
|------|--------|------|
| **Contracts** | [![codecov](https://codecov.io/gh/vipwzw/protocol/branch/main/graph/badge.svg?flag=contracts)](https://codecov.io/gh/vipwzw/protocol?flag=contracts) | 🔄 自动更新 |
| **Packages** | [![codecov](https://codecov.io/gh/vipwzw/protocol/branch/main/graph/badge.svg?flag=packages)](https://codecov.io/gh/vipwzw/protocol?flag=packages) | 🔄 自动更新 |
| **Zero-Ex** | [![codecov](https://codecov.io/gh/vipwzw/protocol/branch/main/graph/badge.svg?flag=zero-ex)](https://codecov.io/gh/vipwzw/protocol?flag=zero-ex) | 🔄 自动更新 |
| **Governance** | [![codecov](https://codecov.io/gh/vipwzw/protocol/branch/main/graph/badge.svg?flag=governance)](https://codecov.io/gh/vipwzw/protocol?flag=governance) | 🔄 自动更新 |
| **Treasury** | [![codecov](https://codecov.io/gh/vipwzw/protocol/branch/main/graph/badge.svg?flag=treasury)](https://codecov.io/gh/vipwzw/protocol?flag=treasury) | 🔄 自动更新 |

### 覆盖率趋势
[![Coverage Trend](https://codecov.io/gh/vipwzw/protocol/branch/main/graphs/commits.svg)](https://codecov.io/gh/vipwzw/protocol)

> 💡 **提示**: 点击任何覆盖率徽章可查看详细的覆盖率报告，包括文件级别的覆盖率分析。

## 🏗️ 0x Protocol 合约结构总览

### 📁 主要合约模块

#### 1. **Zero-Ex (核心协议)** `/contracts/zero-ex/`

这是 0x 协议的核心，实现了代理模式和各种交易功能：

**核心合约：**

- `ZeroEx.sol` - 主入口合约，实现代理模式
- `IZeroEx.sol` - 主接口定义

**Features (功能模块)：**

- **交易类功能**：
    - `TransformERC20Feature` - ERC20代币转换
    - `UniswapFeature` / `UniswapV3Feature` - Uniswap集成
    - `PancakeSwapFeature` - PancakeSwap集成
    - `LiquidityProviderFeature` - 流动性提供者集成
- **订单类功能**：
    - `NativeOrdersFeature` - 原生订单处理
    - `OtcOrdersFeature` - OTC订单
    - `BatchFillNativeOrdersFeature` - 批量填充订单
    - NFT订单（ERC721/ERC1155）

- **元交易功能**：
    - `MetaTransactionsFeature` / `MetaTransactionsFeatureV2`
- **管理功能**：
    - `OwnableFeature` - 所有权管理
    - `SimpleFunctionRegistryFeature` - 函数注册管理

#### 2. **Governance (治理)** `/contracts/governance/`

实现了完全去中心化的治理机制：

**核心合约：**

- `ZRXWrappedToken.sol` - 封装的ZRX代币(wZRX)
- `ZeroExVotes.sol` - 投票权管理（可升级）
- `ZeroExProtocolGovernor.sol` - 协议治理者
- `ZeroExTreasuryGovernor.sol` - 国库治理者
- `ZeroExTimelock.sol` - 时间锁合约
- `SecurityCouncil.sol` - 安全委员会功能

#### 3. **Treasury (国库)** `/contracts/treasury/`

管理协议国库资金：

**核心合约：**

- `ZrxTreasury.sol` - 主要国库合约
- `DefaultPoolOperator.sol` - 默认池操作器
- `IStaking.sol` - Staking接口
- `IZrxTreasury.sol` - Treasury接口

#### 4. **ERC20 (代币)** `/contracts/erc20/`

ERC20代币实现和工具：

**核心合约：**

- `ZRXToken.sol` - ZRX代币合约
- `WETH9.sol` - Wrapped Ether实现
- `LibERC20Token.sol` - ERC20工具库
- `IERC20Token.sol` / `IEtherToken.sol` - 接口定义

#### 5. **Utils (工具库)** `/contracts/utils/`

为其他模块提供的基础工具库：

**核心合约：**

- `LibBytes.sol` - 字节操作库
- `LibMath.sol` - 数学库
- `Ownable.sol` - 所有权管理
- `Authorizable.sol` - 授权管理
- `ReentrancyGuard.sol` - 重入保护
- **errors/** - 错误定义
- **interfaces/** - 接口定义

### 🔧 技术特性

#### Solidity版本

项目已统一升级到：

- **Solidity**: 0.8.28
- **EVM版本**: cancun
- **优化器运行次数**: 200-1,000,000

#### 代理架构

Zero-Ex合约采用了独特的per-function代理模式：

- 每个功能可以有独立的实现合约
- 通过fallback机制路由调用
- 支持功能的注册、升级和回滚

#### 治理架构

采用Compound风格的治理设计：

- 两个独立的Governor（协议和国库）
- 时间锁机制
- 封装的ZRX代币用于投票
- 安全委员会机制

### 📊 依赖关系

```
zero-ex (核心)
  ├── utils (基础库)
  ├── erc20 (代币支持)
  └── governance (治理接口)

governance
  ├── treasury (国库管理)
  └── utils (基础库)

treasury
  └── utils (基础库)
```

### 🚀 开发工作流

1. **编译**：在各模块目录运行 `forge build`
2. **测试**：运行 `forge test`
3. **部署**：使用各模块的部署脚本

这个架构设计实现了高度的模块化和可扩展性，使0x Protocol能够不断演进并适应DeFi生态的变化。

## 包管理

访问我们的 [开发者门户](https://0x.org/docs/) 获取核心和社区维护包的完整列表。以下列出了本 monorepo 中维护的所有包。

### Solidity 包

这些包都在开发中。查看 [/contracts/README.md](/contracts/README.md) 获取已部署包的列表。

| 包名                                                | 版本                                                                                                                        | 描述                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| [`@0x/contracts-zero-ex`](/contracts/zero-ex)       | [![npm](https://img.shields.io/npm/v/@0x/contracts-zero-ex.svg)](https://www.npmjs.com/package/@0x/contracts-zero-ex)       | 用于在协议内结算交易的合约                    |
| [`@0x/contracts-erc20`](/contracts/erc20)           | [![npm](https://img.shields.io/npm/v/@0x/contracts-erc20.svg)](https://www.npmjs.com/package/@0x/contracts-erc20)           | 各种 ERC20 代币的实现                         |
| [`@0x/test-utils`](/packages/test-utils) | [![npm](https://img.shields.io/npm/v/@0x/test-utils.svg)](https://www.npmjs.com/package/@0x/test-utils) | 用于测试合约的 TypeScript/Javascript 共享工具 |
| [`@0x/contracts-utils`](/contracts/utils)           | [![npm](https://img.shields.io/npm/v/@0x/contracts-utils.svg)](https://www.npmjs.com/package/@0x/contracts-utils)           | 在所有合约中使用的通用库和工具                |

### TypeScript/Javascript 包

#### 0x 专用包

以下是本 monorepo 中维护的 TypeScript/JavaScript 包。查看 [/packages/README.md](/packages/README.md) 获取详细的包功能说明和使用指南。

| 包名                                                     | 版本                                                                                                                    | 描述                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [`@0x/protocol-utils`](/packages/protocol-utils)         | [![npm](https://img.shields.io/npm/v/@0x/protocol-utils.svg)](https://www.npmjs.com/package/@0x/protocol-utils)         | 用于生成、解析、签名和验证 0x 订单的工具集     |
| [`@0x/contract-addresses`](/packages/contract-addresses) | [![npm](https://img.shields.io/npm/v/@0x/contract-addresses.svg)](https://www.npmjs.com/package/@0x/contract-addresses) | 用于获取特定网络上已知部署合约地址的小型工具库 |
| [`@0x/contract-wrappers`](/packages/contract-wrappers)   | [![npm](https://img.shields.io/npm/v/@0x/contract-wrappers.svg)](https://www.npmjs.com/package/@0x/contract-wrappers)   | 用于与 0x 智能合约交互的 JS/TS 包装器          |
| [`@0x/contract-artifacts`](/packages/contract-artifacts) | [![npm](https://img.shields.io/npm/v/@0x/contract-artifacts.svg)](https://www.npmjs.com/package/@0x/contract-artifacts) | 0x 智能合约编译工件                            |

## 使用说明

需要 Node 版本 6.x 或 8.x。

大多数包需要外部依赖的额外类型定义。
您可以通过将 `@0x/typescript-typings` 包添加到您的 [`typeRoots`](http://www.typescriptlang.org/docs/handbook/tsconfig-json.html) 配置中来包含这些定义。

```json
"typeRoots": ["node_modules/@0x/typescript-typings/types", "node_modules/@types"],
```

## 贡献

我们强烈建议社区帮助我们改进并确定协议的未来方向。要报告此包中的错误，请在此仓库中创建一个 issue。

#### 阅读我们的 [贡献指南](.github/CONTRIBUTING.md)。

### 安装依赖

确保您使用的是 Yarn v1.9.4。使用 brew 安装：

```bash
brew install yarn@1.9.4
```

然后安装依赖：

```bash
yarn install
```

### 构建

构建所有包：

```bash
yarn build
```

构建特定包：

```bash
PKG=@0x/protocol-utils yarn build
```

构建所有合约包：

```bash
yarn build:contracts
```

### 监视模式

在更改时重新构建所有包：

```bash
yarn watch
```

监视特定包及其所有依赖包：

```bash
PKG=[NPM_PACKAGE_NAME] yarn watch

例如
PKG=@0x/protocol-utils yarn watch
```

### 清理

清理所有包：

```bash
yarn clean
```

清理特定包：

```bash
PKG=@0x/protocol-utils yarn clean
```

### 重建

重新构建（清理并构建）所有包：

```bash
yarn rebuild
```

重新构建（清理并构建）特定包及其依赖：

```bash
PKG=@0x/protocol-utils yarn rebuild
```

### 代码检查

检查所有包的代码规范：

```bash
yarn lint
```

检查特定包的代码规范：

```bash
PKG=@0x/protocol-utils yarn lint
```

### 运行测试

运行所有测试：

```bash
yarn test
```

运行特定包的测试：

```bash
PKG=@0x/protocol-utils yarn test
```

运行所有合约包的测试：

```bash
yarn test:contracts
```

### 测试覆盖率

生成测试覆盖率报告：

```bash
yarn test:coverage
```

查看覆盖率报告：

```bash
# 生成 HTML 报告
yarn coverage:report

# 查看 LCOV 报告
yarn coverage:report:lcov
```

运行特定包的覆盖率测试：

```bash
PKG=@0x/protocol-utils yarn test:coverage
```

> 📊 **覆盖率数据**: 所有测试覆盖率数据会自动上传到 [Codecov](https://codecov.io/gh/vipwzw/protocol)，并在每次 CI 运行后更新。
