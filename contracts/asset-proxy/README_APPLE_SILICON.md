# Asset Proxy Apple Silicon 兼容性指南

## 升级概述

Asset Proxy 模块已从 Solidity 0.5.9 升级到 0.8.28，实现了 Apple Silicon 原生支持和现代化架构。

## 主要变更

### 编译器升级

-   **旧版本**: Solidity ^0.5.9 + Truffle
-   **新版本**: Solidity ^0.8.28 + Foundry + Hardhat
-   **EVM 版本**: cancun
-   **优化器运行次数**: 1,000,000

### 代码现代化

-   ✅ 移除 `pragma experimental ABIEncoderV2` (内置于 0.8.0+)
-   ✅ 移除 SafeMath 依赖 (内置溢出检查)
-   ✅ 现代化构造函数语法
-   ✅ 更新 fallback 函数语法

### 工具链升级

-   ✅ Foundry 集成 (`forge build`, `forge test`)
-   ✅ Hardhat 集成 (TypeScript 配置)
-   ✅ 移除 Truffle 依赖
-   ✅ 现代化测试框架

## Apple Silicon 兼容性

### 问题解决

旧版本在 Apple Silicon 上会出现 `Bad CPU type in executable (os error 86)` 错误，因为：

-   Solidity < 0.8.0 编译器不支持 ARM64 架构
-   需要通过 Rosetta 2 模拟运行，性能较差

### 新版本优势

-   Solidity 0.8.28 原生支持 Apple Silicon
-   Foundry 原生 ARM64 支持
-   无需 Rosetta 2，编译速度显著提升

## 升级后的目录结构

```
contracts/asset-proxy/
├── src/                     # 现代化合约源码 (0.8.28)
├── test/                    # Hardhat 测试文件
├── foundry.toml            # Foundry 配置
├── hardhat.config.ts       # Hardhat 配置
└── README_APPLE_SILICON.md # 本文档
```

## 构建和测试

```bash
# 构建合约
yarn build

# 运行 Foundry 测试
yarn test:foundry

# 运行 Hardhat 测试
yarn test

# 仅编译 TypeScript
yarn build:ts
```

## 迁移指南

如果您在升级过程中遇到问题：

1. **清理旧的构建产物**:

    ```bash
    rm -rf node_modules cache out artifacts lib
    yarn install
    ```

2. **重新构建**:

    ```bash
    yarn build
    ```

3. **验证测试**:
    ```bash
    yarn test
    ```

## 兼容性说明

-   ✅ Apple Silicon (M1/M2/M3) 原生支持
-   ✅ Intel Mac 兼容
-   ✅ Linux x86_64 支持
-   ✅ Windows (通过 WSL2) 支持
