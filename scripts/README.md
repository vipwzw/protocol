# CI 测试脚本使用指南

此目录包含了用于本地CI测试的脚本，帮助在提交代码前进行全面的验证。

## 📋 脚本概览

| 脚本 | 用途 | 耗时 | 推荐场景 |
|------|------|------|----------|
| `ci-quick-check.sh` | 快速检查核心问题 | ~30秒 | 日常开发、提交前快速验证 |
| `ci-local-test.sh` | 完整CI测试套件 | ~5-15分钟 | 提交前最终验证、重要更改 |
| `compile-all.sh` | 编译所有Foundry+Hardhat包 | ~2-5分钟 | 全量编译验证 |
| `clean-all.sh` | 清理所有缓存和构建产物 | ~10秒 | 清理构建环境 |
| `compile-all-foundry.sh` | 编译所有Foundry包 | ~1-3分钟 | Foundry项目编译 |
| `compile-all-hardhat.sh` | 编译所有Hardhat包 | ~1-3分钟 | Hardhat项目编译 |
| `lint-contracts.sh` | Solidity代码检查 | ~10秒 | 合约代码修改后 |
| `lint-typescript.sh` | TypeScript代码检查 | ~20秒 | TS代码修改后 |
| `lint-prettier.sh` | 代码格式检查 | ~5秒 | 提交前格式验证 |

## 🚀 快速开始

### 日常开发工作流

```bash
# 1. 开发完成后，快速检查
./scripts/ci-quick-check.sh

# 2. 如果有格式问题，自动修复
./scripts/ci-quick-check.sh --fix

# 3. 提交前完整验证
./scripts/ci-local-test.sh
```

### 特定场景使用

```bash
# 只检查特定模块
./scripts/ci-local-test.sh --module=zero-ex

# 跳过耗时的Forge测试
./scripts/ci-local-test.sh --skip-forge

# 跳过覆盖率检查，节省时间
./scripts/ci-local-test.sh --skip-coverage

# 最快验证模式
./scripts/ci-local-test.sh --skip-forge --skip-coverage
```

### 编译和清理工作流

```bash
# 编译所有项目 (Foundry + Hardhat)
./scripts/compile-all.sh
# 或使用 npm/yarn 命令
yarn compile:all

# 单独编译 Foundry 项目
./scripts/compile-all-foundry.sh
yarn compile:foundry

# 单独编译 Hardhat 项目  
./scripts/compile-all-hardhat.sh
yarn compile:hardhat

# 清理所有缓存和构建产物
./scripts/clean-all.sh
yarn clean:all

# 清理后重新编译
yarn clean:all && yarn compile:all
```

## 📖 详细说明

### 🔥 ci-quick-check.sh - 快速检查

**用途**: 日常开发中的快速验证，检查最常见的问题。

**检查项目**:
- ✅ 基础环境 (node, yarn, forge)
- ✅ 依赖安装状态
- ✅ 代码格式 (prettier)
- ✅ TypeScript代码质量
- ✅ Solidity代码质量
- ✅ TypeScript构建
- ✅ Forge编译 (zero-ex模块)
- ✅ Git工作区状态

**参数**:
- `--fix`: 自动修复可修复的问题 (格式化、安装依赖等)
- `--help`: 显示帮助信息

**示例**:
```bash
# 快速检查
./scripts/ci-quick-check.sh

# 检查并自动修复问题
./scripts/ci-quick-check.sh --fix
```

### 🎯 ci-local-test.sh - 完整CI测试

**用途**: 提交前的完整验证，模拟CI环境的所有检查。

**测试流程**:
1. 🔧 环境检查
2. 📦 依赖检查和安装
3. 🏗️ 项目构建
4. 🧹 TypeScript Lint
5. 📝 Solidity Lint  
6. 💅 代码格式检查
7. 🔍 质量检查 (文档、链接等)
8. 🧪 合约测试
9. 📦 包测试
10. ⚡ Forge测试 (3个模块)
11. 📊 覆盖率检查

**参数**:
- `--skip-forge`: 跳过Forge测试 (节省5-10分钟)
- `--skip-coverage`: 跳过覆盖率检查
- `--module=<name>`: 只测试指定模块 (erc20, zero-ex, governance)
- `--help`: 显示帮助信息

**示例**:
```bash
# 完整测试
./scripts/ci-local-test.sh

# 快速模式 (跳过耗时操作)
./scripts/ci-local-test.sh --skip-forge --skip-coverage

# 只测试zero-ex模块
./scripts/ci-local-test.sh --module=zero-ex
```

### 🔧 单独的Lint脚本

这些脚本也可以单独使用：

```bash
# 检查Solidity代码
./scripts/lint-contracts.sh

# 检查TypeScript代码
./scripts/lint-typescript.sh

# 检查代码格式
./scripts/lint-prettier.sh
```

## 💡 最佳实践

### 开发工作流建议

1. **编码阶段**: 随时使用快速检查
   ```bash
   ./scripts/ci-quick-check.sh --fix
   ```

2. **提交前**: 运行完整测试
   ```bash
   ./scripts/ci-local-test.sh
   ```

3. **紧急修复**: 使用快速模式
   ```bash
   ./scripts/ci-local-test.sh --skip-forge
   ```

### 性能优化建议

- **💾 缓存**: 脚本会利用yarn和forge的缓存机制
- **🎯 精准测试**: 使用`--module`参数只测试相关模块
- **⚡ 快速模式**: 开发阶段使用`--skip-forge`节省时间
- **🔄 增量检查**: 快速检查适合频繁运行

### 故障排除

#### 常见问题

1. **依赖问题**:
   ```bash
   # 清理并重新安装
   yarn clean
   yarn install
   ```

2. **Forge编译失败**:
   ```bash
   # 清理forge缓存
   cd contracts/zero-ex
   forge clean
   forge build
   ```

3. **权限问题**:
   ```bash
   # 确保脚本有执行权限
   chmod +x scripts/*.sh
   ```

#### 获取详细错误信息

```bash
# 在脚本中添加详细输出
set -x  # 在脚本开头添加此行

# 或者查看具体步骤的输出
yarn lint:ts  # 查看TypeScript错误
yarn lint:contracts  # 查看Solidity错误
```

## 🎨 输出说明

### 状态图标

- ✅ **绿色对勾**: 检查通过
- ❌ **红色叉号**: 检查失败
- ⚠️ **黄色警告**: 警告或跳过
- ⏭️ **跳过**: 该步骤被跳过
- 🔨 **构建中**: 正在处理

### 最终报告

脚本会在最后显示：
- ✅ 通过的步骤数量
- ⏭️ 跳过的步骤 (如果有)
- ❌ 失败的步骤 (如果有)
- ⏱️ 总耗时

## 🚀 集成到开发工具

### VS Code集成

在`.vscode/tasks.json`中添加：

```json
{
    "label": "Quick CI Check",
    "type": "shell",
    "command": "./scripts/ci-quick-check.sh --fix",
    "group": "test",
    "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
    }
}
```

### Git Hooks

在`.git/hooks/pre-commit`中添加：

```bash
#!/bin/bash
./scripts/ci-quick-check.sh
```

### 快捷命令

在你的shell配置文件中添加别名：

```bash
# ~/.bashrc 或 ~/.zshrc
alias ciq="./scripts/ci-quick-check.sh"
alias cif="./scripts/ci-quick-check.sh --fix"
alias cit="./scripts/ci-local-test.sh"
```

## 📊 性能基准

在典型的开发机器上：

| 操作 | 时间 | 说明 |
|------|------|------|
| Quick Check | ~30秒 | 不包含测试 |
| Full CI (all) | ~15分钟 | 包含所有模块 |
| Full CI (single) | ~5分钟 | 单个模块 |
| Full CI (no forge) | ~3分钟 | 跳过Forge测试 |

## 🔄 更新和维护

这些脚本会随着项目的CI配置自动更新。如果CI流程有变化，请相应更新脚本。

---

**💡 提示**: 在重要提交前，建议至少运行一次完整的CI测试，以确保代码质量。 