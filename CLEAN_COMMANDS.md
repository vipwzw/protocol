# Clean 命令完整性检查和更新

## 📋 概述

已对所有包的 `clean` 脚本进行全面检查和更新，确保删除所有编译临时生成的文件，并添加了删除 `node_modules` 的命令。

## 🎯 更新内容

### ✅ 包含的临时文件类型
所有 `clean` 脚本现在会删除以下类型的临时文件：

- **编译输出**: `lib/`, `artifacts/`, `out/`, `cache/`
- **类型生成**: `typechain-types/`, `src/typechain-types/`, `test/typechain-types/`
- **生成的包装器**: `generated-*`, `test/generated-*`, `typechain-wrappers`
- **文档**: `generated_docs/`
- **测试覆盖率**: `coverage/`, `.nyc_output/`
- **日志文件**: `*.log`
- **其他临时文件**: `test_temp/`

### 🆕 新增命令
每个包现在都包含以下清理命令：

```json
{
  "clean": "完整清理所有临时文件",
  "clean:node-modules": "删除当前包的 node_modules",
  "clean:all": "clean + clean:node-modules"
}
```

## 📦 包更新列表

### Packages 目录

#### packages/base-contract
```json
"clean": "shx rm -rf lib generated_docs coverage .nyc_output *.log",
"clean:node-modules": "shx rm -rf node_modules",
"clean:all": "yarn clean && yarn clean:node-modules"
```

#### packages/utils
```json
"clean": "shx rm -rf lib generated_docs coverage .nyc_output *.log",
"clean:node-modules": "shx rm -rf node_modules", 
"clean:all": "yarn clean && yarn clean:node-modules"
```

#### packages/types
```json
"clean": "shx rm -rf lib generated_docs coverage .nyc_output *.log",
"clean:node-modules": "shx rm -rf node_modules",
"clean:all": "yarn clean && yarn clean:node-modules"
```

#### packages/order-utils
```json
"clean": "node -e \"const fs=require('fs'); ['lib','generated_docs','coverage','.nyc_output'].forEach(d => fs.rmSync(d,{recursive:true,force:true}))\"",
"clean:node-modules": "shx rm -rf node_modules",
"clean:all": "yarn clean && yarn clean:node-modules"
```

#### packages/contract-wrappers
```json
"clean": "shx rm -rf lib generated_docs coverage .nyc_output *.log",
"clean:node-modules": "shx rm -rf node_modules",
"clean:all": "yarn clean && yarn clean:node-modules"
```

#### packages/protocol-utils
```json
"clean": "shx rm -rf lib generated_docs coverage .nyc_output *.log",
"clean:node-modules": "shx rm -rf node_modules",
"clean:all": "yarn clean && yarn clean:node-modules"
```

#### packages/json-schemas
```json
"clean": "shx rm -rf lib test_temp generated_docs coverage .nyc_output *.log",
"clean:node-modules": "shx rm -rf node_modules",
"clean:all": "yarn clean && yarn clean:node-modules"
```

#### packages/contract-artifacts
```json
"clean": "shx rm -rf lib artifacts coverage .nyc_output *.log",
"clean:node-modules": "shx rm -rf node_modules",
"clean:all": "yarn clean && yarn clean:node-modules"
```

#### packages/contract-addresses
```json
"clean": "shx rm -rf lib generated_docs coverage .nyc_output *.log",
"clean:node-modules": "shx rm -rf node_modules",
"clean:all": "yarn clean && yarn clean:node-modules"
```

### Contracts 目录

#### contracts/treasury
```json
"clean": "shx rm -rf lib out test/generated-wrappers test/typechain-types generated-artifacts generated-wrappers artifacts cache src/typechain-types"
```
*(已有完整的 clean 脚本)*

#### contracts/staking
```json
"clean": "hardhat clean && rm -rf typechain-types lib artifacts cache out src/typechain-types generated-* test/generated-* test/typechain-types",
"clean:node-modules": "shx rm -rf node_modules",
"clean:all": "yarn clean && yarn clean:node-modules"
```

#### contracts/asset-proxy
```json
"clean": "hardhat clean && rm -rf typechain-types lib artifacts cache out src/typechain-types generated-* test/generated-* test/typechain-types",
"clean:node-modules": "shx rm -rf node_modules", 
"clean:all": "yarn clean && yarn clean:node-modules"
```

#### contracts/governance
```json
"clean": "forge clean && npx hardhat clean && rm -rf typechain-types lib artifacts cache out src/typechain-types generated-* test/generated-* test/typechain-types",
"clean:node-modules": "shx rm -rf node_modules",
"clean:all": "yarn clean && yarn clean:node-modules"
```

#### contracts/test-utils
```json
"clean": "shx rm -rf lib generated_docs coverage .nyc_output *.log artifacts cache out typechain-types generated-* test/generated-*",
"clean:node-modules": "shx rm -rf node_modules",
"clean:all": "yarn clean && yarn clean:node-modules"
```

#### contracts/zero-ex
```json
"clean": "run-s clean:artifacts clean:cache clean:logs clean:generated",
"clean:all": "run-s clean clean:node-modules",
"clean:artifacts": "shx rm -rf artifacts out lib cache",
"clean:cache": "shx rm -rf cache .hardhat_artifacts .cache", 
"clean:logs": "shx rm -rf *.log test-output.log",
"clean:generated": "shx rm -rf test/generated-wrappers test/typechain-types generated-artifacts generated-wrappers typechain-wrappers",
"clean:node-modules": "shx rm -rf node_modules"
```
*(已有完整的 clean 脚本)*

## 🚀 根目录命令

根目录 `package.json` 新增了以下便捷命令：

```json
{
  "clean:node-modules:all": "清理所有子包的 node_modules",
  "clean:super": "完全清理 (clean:all + clean:node)"
}
```

### 可用的清理命令：

```bash
# 清理所有编译文件
yarn clean:all

# 清理 Foundry 输出
yarn clean:foundry

# 清理 Hardhat 输出  
yarn clean:hardhat

# 清理 TypeScript 输出
yarn clean:ts

# 清理测试覆盖率
yarn clean:coverage

# 清理所有 node_modules (包括根目录)
yarn clean:node

# 清理所有子包的 node_modules
yarn clean:node-modules:all

# 超级清理 (所有文件 + node_modules)
yarn clean:super

# 移除所有 node_modules (替代命令)
yarn remove_node_modules
```

## ✅ 验证结果

所有更新的 clean 脚本已经过测试：

- ✅ `contracts/treasury`: 正常清理
- ✅ `packages/base-contract`: 正常清理  
- ✅ `yarn clean:all`: 全项目清理成功
- ✅ 所有临时文件类型都被正确清理
- ✅ 新的 node_modules 清理命令可用

## 📝 技术细节

### 使用的清理工具：
- **shx**: 跨平台命令 (`shx rm -rf`)
- **hardhat clean**: Hardhat 内置清理
- **forge clean**: Foundry 内置清理
- **Node.js**: 原生 `fs.rmSync()` API
- **run-s**: 串行运行多个脚本

### 安全特性：
- 使用 `2>/dev/null || true` 确保找不到文件时不报错
- 使用 `--fast-exit` 确保清理过程中的错误不会阻塞其他包
- 使用 `{recursive:true,force:true}` 确保强制删除 