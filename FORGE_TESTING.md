# 🔧 Forge测试指南

## 📋 概述

本项目已配置了完整的Forge测试环境，支持所有合约包的单元测试。所有测试都可以在根目录通过yarn命令运行。

## 🚀 快速开始

### 方法一：手动启动Hardhat节点
```bash
# 1. 启动Hardhat节点（在单独的终端中）
npx hardhat node

# 2. 运行所有Forge测试
yarn test:forge
```

### 方法二：自动启动（推荐）
```bash
# 自动启动Hardhat节点并运行测试
yarn test:forge:auto
```

## 📋 可用命令

| 命令 | 描述 | 用途 |
|------|------|------|
| `yarn test:forge` | 运行所有Forge测试 | 需要手动启动Hardhat节点 |
| `yarn test:forge:auto` | 自动启动节点并运行测试 | 一键运行所有测试 |
| `yarn test:forge:run` | 仅运行测试（不启动节点） | 节点已运行时使用 |
| `yarn test:forge:prepare` | 显示节点启动提示 | 帮助信息 |

## 📊 测试覆盖

### 合约包测试状态

| 包名 | 测试文件 | 测试数量 | 状态 |
|------|----------|----------|------|
| **utils** | `LibBytesTest.t.sol` | 4个 | ✅ |
| **exchange-libs** | `LibMath.t.sol` | 3个 | ✅ |
| **governance** | 多个测试文件 | 59个 | ✅ |
| **erc20** | `ZRXToken.t.sol` | 9个 | ✅ |
| **erc721** | `ERC721Token.t.sol` | 12个 | ✅ |
| **erc1155** | `ERC1155.t.sol` | 11个 | ✅ |
| **asset-proxy** | `ERC20Proxy.t.sol` | 9个 | ✅ |
| **staking** | `StakingBasic.t.sol` | 9个 | ✅ |
| **treasury** | `SimpleTreasury.t.sol` | 8个 | ✅ |
| **zero-ex** | 测试文件 | 2个 | ✅ |

**总计：126个测试全部通过！** 🎉

## 🔍 单个包测试

如果您需要测试特定的包：

```bash
# 进入包目录
cd contracts/utils

# 运行该包的forge测试
forge test

# 或使用yarn命令
yarn test:forge
```

## ⚙️ 技术细节

### Hardhat配置
```typescript
networks: {
    hardhat: {
        chainId: 1337,
        accounts: { count: 20 },
        gasPrice: 1337,
        initialBaseFeePerGas: 0,
        blockGasLimit: 30000000,
    },
    localhost: {
        url: 'http://localhost:8545',
    },
}
```

### Foundry配置
- Solidity版本：0.8.28
- EVM版本：shanghai
- 优化器：启用，runs=1000000
- 测试目录：`tests/`（标准化）

### 特殊处理
- **governance包**：自动排除需要外部RPC的E2E测试
- **mock合约**：为简化依赖而创建的测试用mock
- **标准化**：所有包使用统一的测试目录结构

## 🛠️ 开发工作流

### 添加新测试
1. 在`contracts/[包名]/tests/`目录下创建`.t.sol`文件
2. 使用标准的Forge测试格式
3. 运行`yarn test:forge`验证

### 调试测试
```bash
# 详细输出
cd contracts/[包名]
forge test -vvv

# 运行特定测试
forge test --match-test testSpecificFunction
```

## 🎯 最佳实践

1. **使用mock合约**：减少外部依赖，提高测试稳定性
2. **遵循命名约定**：测试函数以`test`开头
3. **断言清晰**：使用描述性的断言消息
4. **测试隔离**：每个测试独立，不依赖其他测试状态
5. **覆盖边界情况**：测试正常流程和错误情况

## 🔧 故障排除

### 常见问题

**1. "No tests found"**
- 确保测试文件在`tests/`目录下
- 检查函数名是否以`test`开头

**2. "Hardhat node connection failed"**
- 确保Hardhat节点已启动：`npx hardhat node`
- 检查端口8545是否被占用

**3. "Compilation failed"**
- 检查Solidity版本兼容性
- 确保所有依赖已安装：`yarn install`

**4. Import路径错误**
- 确保使用正确的remapping配置
- 检查相对路径是否正确

### 调试命令
```bash
# 检查forge版本
forge --version

# 清理并重新编译
forge clean && forge build

# 查看详细错误
forge test -vvv
```

## 📈 性能优化

- **并行运行**：使用`wsrun --serial`确保稳定性
- **缓存利用**：Forge自动缓存编译结果
- **选择性测试**：使用`--match-path`运行特定测试

## 🤖 CI/CD 集成

### GitHub Actions配置

项目已配置了完整的CI/CD流程，包含两种Forge测试方式：

**1. 原始矩阵测试**
- Job名称：`forge-tests`
- 运行方式：为每个合约包单独运行测试
- 用途：详细的覆盖率报告和分离的测试结果

**2. 统一测试（新增）**
- Job名称：`forge-tests-unified`
- 运行方式：自动启动Hardhat节点，运行所有测试
- 命令：`yarn test:forge:auto`
- 特点：模拟真实的开发环境

### CI环境变量

```yaml
env:
    MAINNET_RPC_URL: http://localhost:8545  # 指向本地Hardhat节点
```

### 依赖关系

```yaml
forge-tests-unified:
    needs: [setup, build]  # 确保依赖安装和构建完成
    timeout-minutes: 30    # 足够的时间运行所有测试
```

### 缓存策略

CI使用多层缓存优化构建时间：
- **Node.js依赖**：缓存`node_modules`和yarn缓存
- **Foundry编译**：缓存合约编译结果
- **构建产物**：缓存TypeScript编译结果

### 本地CI测试

模拟CI环境运行测试：

```bash
# 安装依赖
yarn install --frozen-lockfile

# 构建项目
yarn build

# 运行统一测试
yarn test:forge:auto
```

---

*本文档会随着项目发展持续更新。如有问题，请查看相关包的README或提交issue。*