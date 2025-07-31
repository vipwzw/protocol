# 📋 @0x/test-utils 使用指南

## 🚀 快速开始

```bash
# 安装依赖
yarn install

# 编译和测试（推荐）
yarn test

# 完整构建（包含清理）
yarn build:full
```

## 📜 可用脚本

### 🔨 构建脚本（纯构建，不包含测试）
- `yarn build` - 编译合约和 TypeScript
- `yarn build:contracts` - 只编译 Solidity 合约
- `yarn build:ts` - 只编译 TypeScript
- `yarn build:ci` - CI 环境构建（只构建）
- `yarn build:full` - 清理后完整构建
- `yarn compile` - 编译所有内容（别名）

### 🧪 测试脚本
- `yarn test` - 自动编译后运行测试（推荐）
- `yarn test:quick` - 跳过编译直接测试（快速）
- `yarn test:watch` - 监视模式测试
- `yarn test:coverage` - 测试覆盖率
- `yarn test:gas` - 显示 Gas 使用情况
- `yarn test:ci` - CI 环境测试（纯测试）

### 🧹 清理脚本
- `yarn clean` - 清理构建文件
- `yarn clean:all` - 清理所有文件包括 node_modules

### ✅ 验证脚本
- `yarn ci` - **完整 CI 流程**（构建+lint+测试）
- `yarn verify` - 运行 lint 和完整测试
- `yarn lint` - 代码风格检查

## 🎯 推荐工作流

### 开发时
```bash
yarn test:watch    # 监视模式，文件改变自动测试
```

### 提交前
```bash
yarn ci           # 完整 CI 流程：构建 + lint + 测试
```

### CI/CD 流水线
```bash
# 方式 1：一条命令完整流程
yarn ci           # 构建 + lint + 测试

# 方式 2：分步骤（推荐用于 CI）
yarn build:ci     # 只构建
yarn lint         # 代码检查  
yarn test:ci      # 只测试
```

## 📈 性能优化

- **首次运行**: `yarn test` (完整编译)
- **快速测试**: `yarn test:quick` (跳过编译)
- **开发模式**: `yarn test:watch` (监视变化)

## 🔧 自动化特性

✅ **自动编译** - 测试前自动编译 Solidity + TypeScript  
✅ **依赖检查** - 确保编译产物是最新的  
✅ **增量构建** - 只重新编译变更的文件  
✅ **错误处理** - 编译失败时停止测试  

## 💡 提示

- 使用 `yarn test` 作为主要开发命令
- `yarn test:quick` 适合重复运行相同测试
- `yarn build:full` 适合发布前清理构建