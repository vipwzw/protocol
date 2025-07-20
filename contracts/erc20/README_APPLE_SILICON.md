# Apple Silicon 兼容性解决方案

## 问题描述

在 macOS Apple Silicon (ARM64) 架构上，低版本的 Solidity 编译器不兼容，导致编译失败：
- `Bad CPU type in executable (os error 86)`

## 解决方案

### 1. 现代化合约 (src/)
以下合约已升级到 Solidity 0.8.19，完全兼容 Apple Silicon：
- `IERC20Token.sol` - 接口合约（已兼容 >=0.6.5 <0.9）
- `IEtherToken.sol` - 升级到 ^0.8.19
- `v08/` 目录 - 现代化的库和工具

### 2. 遗留合约 (legacy_contracts/)
以下合约使用较老版本，已移至独立目录：
- `ZRXToken.sol` - Solidity 0.4.11
- `WETH9.sol` - Solidity 0.5.9  
- `v06/` - Solidity 0.6.x 版本库
- `WETH9V06Test.t.sol` - 相关测试

## 使用方法

### 标准开发
```bash
# 正常编译现代化合约
forge build

# 所有兼容 0.8.19 的合约都会成功编译
```

### 使用遗留合约
如果需要使用遗留合约（如 ZRXToken），有几个选择：

1. **直接使用编译后的字节码**（推荐）
2. **使用 Docker 环境编译**：
   ```bash
   docker run --rm -v $(pwd):/workspace ethereum/solc:0.4.11 /workspace/legacy_contracts/ZRXToken.sol
   ```
3. **在 Intel Mac 或 Linux 环境编译**

## 兼容性状态

✅ **Apple Silicon 原生支持**：
- IERC20Token, IEtherToken
- v08 目录中的所有库
- 新开发的合约

⚠️ **需要特殊处理**：
- ZRXToken (0.4.11)
- WETH9 (0.5.9)
- v06 库 (0.6.x)

## 升级路径

1. **立即可用**：现代化的接口和 v08 库
2. **渐进升级**：根据需要升级遗留合约
3. **保持兼容**：遗留合约仍然可用，只是编译方式不同

这个解决方案确保了在 Apple Silicon 上的完全兼容性，同时保持了所有功能的可访问性。 