# 0x Protocol 统一错误处理指南

## 🎯 **概述**

这个指南提供了 0x Protocol 项目中统一的错误处理解决方案，解决了不同模块间错误处理不一致的问题。

## 🔧 **核心工具**

### 1. **UnifiedErrorMatcher** - 统一错误匹配器
主要的错误匹配工具，自动检测错误类型并使用适当的匹配策略。

### 2. **ErrorTypeDetector** - 错误类型检测器  
分析错误数据，识别错误类型，生成修复建议。

### 3. **ErrorFixAutomation** - 自动化修复工具
扫描测试文件，识别问题，生成修复报告。

## 📋 **错误类型分类**

### **A. Rich Errors (LibRichErrors.rrevert)**
- **静态参数**: Native Orders, NFT Orders
- **动态参数**: MetaTransactions, Signatures

### **B. RevertError 对象** (@0x/protocol-utils)
- Native Orders 测试中使用
- 有完整的 `.encode()` 方法

### **C. 传统字符串错误**
- 使用 `require(condition, "message")` 
- Hardhat chai-matchers 可直接处理

## 🚀 **使用方法**

### **方法 1: 自动检测（推荐）**

```typescript
import { UnifiedErrorMatcher } from '../utils/unified_error_matcher';

// ✅ 自动检测错误类型并匹配
await UnifiedErrorMatcher.expectError(
    feature.executeMetaTransaction(mtx, signature),
    expectedError // 任何类型的错误对象
);
```

### **方法 2: 指定错误类型**

```typescript
// Native Orders 错误
await UnifiedErrorMatcher.expectNativeOrdersError(
    nativeOrdersFeature.fillLimitOrder(order, signature, fillAmount),
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);

// MetaTransactions 错误（动态参数）
await UnifiedErrorMatcher.expectMetaTransactionsError(
    feature.executeMetaTransaction(mtx, signature),
    new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
        mtxHash,
        0n, // 动态参数，将自动解析
        expirationTimeSeconds
    ),
    {
        skipParameterValidation: false, // 是否跳过参数验证
        allowedBlockNumberDiff: 0       // 允许的块号差异
    }
);

// 字符串错误
await UnifiedErrorMatcher.expectStringError(
    contract.someMethod(),
    "NativeOrdersFeature/NO_CONTRACT_ORIGINS"
);
```

## 📖 **具体示例**

### **示例 1: MetaTransactions 动态参数错误**

```typescript
// ❌ 旧方法：无法处理动态参数
const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
    mtxHash,
    ???, // 无法预知 block.timestamp
    expirationTimeSeconds
);
await expect(tx).to.be.revertedWith(expectedError.encode()); // 失败

// ✅ 新方法：自动处理动态参数
await UnifiedErrorMatcher.expectMetaTransactionsError(
    feature.executeMetaTransaction(mtx, signature),
    new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
        mtxHash,
        0n, // 占位符，实际值将从错误中解析
        expirationTimeSeconds
    )
);
```

### **示例 2: Native Orders 静态参数错误**

```typescript
// ✅ 继续使用现有的成功模式
const expectedError = new RevertErrors.NativeOrders.OnlyOrderMakerAllowed(
    order.getHash(),
    notMaker,
    order.maker
);

try {
    await nativeOrdersFeature.connect(notMakerSigner).cancelLimitOrder(order);
    throw new Error("交易应该失败但没有失败");
} catch (error) {
    expect(error.data).to.equal(expectedError.encode());
}

// 🔧 或使用统一接口
await UnifiedErrorMatcher.expectNativeOrdersError(
    nativeOrdersFeature.connect(notMakerSigner).cancelLimitOrder(order),
    expectedError
);
```

### **示例 3: 签名验证错误**

```typescript
// ✅ 处理复杂的签名验证错误
await UnifiedErrorMatcher.expectMetaTransactionsError(
    feature.executeMetaTransaction(mtx, invalidSignature),
    new ZeroExRevertErrors.SignatureValidator.SignatureValidationError(
        4, // WRONG_SIGNER
        mtxHash,
        mtx.signer,
        '0x' // 签名占位符
    )
);
```

## 🔍 **错误诊断工具**

### **分析未知错误**

```typescript
import { ErrorTypeDetector } from '../utils/error_type_detector';

try {
    await someTransaction();
} catch (error) {
    const analysis = ErrorTypeDetector.analyzeError(error);
    console.log('错误分析:', analysis);
    console.log('修复建议:', analysis.suggestion);
    
    // 生成修复代码
    const fixCode = ErrorTypeDetector.generateMatchingCode(error, 'someTransaction()');
    console.log('修复代码:\n', fixCode);
}
```

### **扫描测试文件**

```typescript
import { ErrorFixAutomation } from '../utils/error_fix_automation';

// 扫描整个测试目录
const scanResult = await ErrorFixAutomation.scanTestDirectory('./test');
console.log('扫描结果:', scanResult);

// 生成修复报告
const report = ErrorFixAutomation.generateFixReport(scanResult);
console.log(report);

// 自动修复简单问题
const fixResult = await ErrorFixAutomation.autoFix('./test/some_test.ts', false);
console.log('修复结果:', fixResult);
```

## ⚠️ **重要规则**

### **禁止使用的模式**

```typescript
// ❌ 绝对禁止：通用 revert 检查
await expect(tx).to.be.reverted;

// ❌ 不推荐：通用 rejected 检查  
await expect(tx).to.be.rejected;

// ❌ 错误：直接传递错误对象而不编码
await expect(tx).to.be.revertedWith(new SomeError(...));
```

### **推荐使用的模式**

```typescript
// ✅ 推荐：使用统一错误匹配器
await UnifiedErrorMatcher.expectError(tx, expectedError);

// ✅ 可接受：具体错误匹配
await expect(tx).to.be.revertedWith(expectedError.encode());

// ✅ 可接受：字符串错误匹配
await expect(tx).to.be.revertedWith("specific error message");
```

## 🔄 **迁移步骤**

### **Step 1: 安装依赖**
```bash
# 确保已安装必要的包
npm install @0x/utils @0x/protocol-utils
```

### **Step 2: 导入工具**
```typescript
import { UnifiedErrorMatcher } from '../utils/unified_error_matcher';
import { ErrorTypeDetector } from '../utils/error_type_detector';
```

### **Step 3: 替换错误处理**
```typescript
// 旧代码
await expect(tx).to.be.reverted;

// 新代码  
await UnifiedErrorMatcher.expectError(tx, expectedError);
```

### **Step 4: 测试验证**
```bash
npx hardhat test test/features/your_test.ts
```

## 🎛️ **高级配置**

### **跳过参数验证**
```typescript
await UnifiedErrorMatcher.expectMetaTransactionsError(
    tx,
    expectedError,
    { skipParameterValidation: true } // 只检查错误类型，不验证参数
);
```

### **允许块号差异**
```typescript
await UnifiedErrorMatcher.expectMetaTransactionsError(
    tx,
    new ZeroExRevertErrors.MetaTransactions.MetaTransactionAlreadyExecutedError(mtxHash, 0n),
    { allowedBlockNumberDiff: 5 } // 允许 5 个块的差异
);
```

### **自定义错误处理**
```typescript
// 对于特殊情况，仍可使用传统方法
try {
    await tx;
    throw new Error("应该失败");
} catch (error) {
    // 自定义验证逻辑
    expect(error.data).to.include('0x47ab394e'); // 检查错误选择器
}
```

## 📊 **性能考虑**

- **UnifiedErrorMatcher** 会自动缓存错误选择器映射
- **ErrorTypeDetector** 使用高效的正则表达式匹配
- **动态参数解析** 只在必要时执行，避免不必要的计算

## 🐛 **故障排除**

### **常见问题 1: 类型错误**
```
Error: 不支持的错误类型
```
**解决方案**: 确保错误对象有 `.encode()` 方法或使用字符串

### **常见问题 2: 参数不匹配**
```
Error: 错误编码不完全匹配
```
**解决方案**: 检查动态参数，使用 `skipParameterValidation: true`

### **常见问题 3: 选择器未找到**
```
Error: 未找到预期的错误选择器
```
**解决方案**: 使用 `ErrorTypeDetector.analyzeError()` 分析实际错误

## 📚 **参考资料**

- [0x Protocol 错误处理最佳实践](./ERROR_HANDLING_AUDIT_REPORT.md)
- [Hardhat Chai Matchers 文档](https://hardhat.org/hardhat-chai-matchers/docs/overview)
- [ethers.js v6 错误处理](https://docs.ethers.org/v6/api/utils/errors/)

---

**记住**: 统一的错误处理不仅提高了测试的可靠性，还使代码更易维护和理解。始终使用具体的错误匹配，避免通用的错误检查！
