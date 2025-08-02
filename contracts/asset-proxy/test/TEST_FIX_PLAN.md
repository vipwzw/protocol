# 📋 Asset Proxy 测试修复计划

## 🔍 问题分析

### 1. **主要错误类型**
- **ASSET_PROXY_MISMATCH**: 新的 fallback 验证 proxy ID 失败
- **API 不兼容**: `awaitTransactionSuccessAsync` 不存在
- **BigNumber 未定义**: 需要迁移到 BigInt
- **transferFrom 调用方式**: 需要使用 fallback 模式

### 2. **根本原因**
- ERC20Proxy fallback 现在验证 assetData 长度和 proxy ID
- 测试代码使用旧的 wrapper API
- 测试需要使用低级调用而不是直接函数调用

## 🛠️ 修复策略

### Phase 1: 修复核心 API 问题
1. 更新所有 transferFrom 调用使用 fallback
2. 替换 BigNumber 为 BigInt
3. 修复 wrapper 的 transferFrom 方法

### Phase 2: 修复测试辅助函数
1. 更新 encodeERC20AssetData 确保格式正确
2. 修复 expectTransactionFailedAsync 参数
3. 更新事件解析逻辑

### Phase 3: 修复具体测试用例
1. ERC20Proxy 测试
2. ERC721Proxy 测试
3. MultiAssetProxy 测试
4. ERC1155Proxy 测试

## 📝 具体修复

### 1. transferFrom 调用修复
```typescript
// 旧方式
await erc20Proxy.transferFrom(assetData, from, to, amount);

// 新方式
await transferFromViaFallback(
    await erc20Proxy.getAddress(),
    assetData,
    from,
    to,
    amount,
    authorizedSigner
);
```

### 2. BigNumber 迁移
```typescript
// 旧
const amount = new BigNumber(10);

// 新
const amount = 10n;
```

### 3. Asset Data 验证
确保 assetData 包含正确的 proxy ID 和长度