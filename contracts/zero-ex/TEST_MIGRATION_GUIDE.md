# Zero-ex 测试文件现代化迁移指南

## 📊 修复成果
- ✅ `lib_limit_orders_test.ts` - 2 个测试通过
- ✅ `lib_signature_test.ts` - 7 个测试通过
- ✅ `storage_uniqueness_test.ts` - 1 个测试通过
- ✅ `transformer_deployer_test.ts` - 9 个测试通过
- **总计：19 个测试全部通过！**

## 🔧 修复模式

### 1. 导入更新

#### 旧方式：
```typescript
import { TestLibNativeOrderContract } from './wrappers';
```

#### 新方式：
```typescript
import { ethers } from 'ethers';
import { TestLibNativeOrder__factory } from '../src/typechain-types/factories/contracts/test';
import type { TestLibNativeOrder } from '../src/typechain-types/contracts/test/TestLibNativeOrder';
```

### 2. 合约部署

#### 旧方式：
```typescript
testContract = await TestLibNativeOrderContract.deployFrom0xArtifactAsync(
    artifacts.TestLibNativeOrder,
    env.provider,
    env.txDefaults,
    artifacts,
);
```

#### 新方式：
```typescript
const accounts = await env.getAccountAddressesAsync();
const signer = await env.provider.getSigner(accounts[0]);

const factory = new TestLibNativeOrder__factory(signer);
testContract = await factory.deploy();
await testContract.waitForDeployment();
```

### 3. 合约调用

#### 旧方式：
```typescript
const result = await testContract.someMethod(params).callAsync();
```

#### 新方式：
```typescript
const result = await testContract.someMethod(params);
```

### 4. 数值类型转换

#### 对于合约调用参数：
```typescript
// 将 BigNumber 转换为字符串
const orderStruct = {
    makerAmount: order.makerAmount.toString(),
    takerAmount: order.takerAmount.toString(),
    // ... 其他字段
};
```

### 5. 地址比较

#### 处理大小写不敏感比较：
```typescript
expect(recovered.toLowerCase()).to.eq(signer.toLowerCase());
```

### 6. 错误断言

#### 简化版本（推荐）：
```typescript
return expect(contract.method(params)).to.be.reverted;
```

#### 具体错误版本：
```typescript
return expect(contract.method(params)).to.be.revertedWithCustomError(
    contract,
    'ErrorName'
);
```

### 7. 权限控制合约

#### 使用正确的签名者：
```typescript
// 对于需要特定权限的合约调用
const authoritySigner = await env.provider.getSigner(authority);
const contractAsAuthority = contract.connect(authoritySigner);
await contractAsAuthority.restrictedMethod(params);
```

### 8. 静态调用预览

#### 获取返回值而不执行事务：
```typescript
const result = await contract.method.staticCall(params);
const tx = await contract.method(params);
await tx.wait();
```

### 7. artifacts.ts 更新

需要为每个测试合约添加对应的 artifact 导入：

```typescript
import * as TestLibSignature from '../artifacts/contracts/test/TestLibSignature.sol/TestLibSignature.json';

export const artifacts = {
    // ... 其他 artifacts
    TestLibSignature: TestLibSignature as ContractArtifact,
};
```

### 8. wrappers.ts 更新

添加 TypeChain 类型导出：

```typescript
// 测试合约类型导出
export type { TestLibSignature as TestLibSignatureContract } from '../src/typechain-types/contracts/test/TestLibSignature';

// 导出工厂类型
export { TestLibSignature__factory } from '../src/typechain-types/factories/contracts/test';
```

## 🔄 迁移步骤

1. **更新 artifacts.ts** - 添加测试合约的 artifact 导入
2. **更新 wrappers.ts** - 添加 TypeChain 类型和工厂导出
3. **修改测试文件导入** - 使用 TypeChain 生成的类型
4. **更新合约部署代码** - 使用 ethers v6 + TypeChain 工厂
5. **移除 .callAsync()** - 直接调用合约方法
6. **转换数值类型** - BigNumber → string
7. **修复断言** - 使用现代 chai 断言
8. **处理地址比较** - 统一大小写

## 📝 常见问题

### Q: deployFrom0xArtifactAsync 未定义
**A:** 替换为 TypeChain 工厂模式部署

### Q: callAsync 不是函数
**A:** 移除 `.callAsync()`，直接调用方法

### Q: BigNumberish 值无效
**A:** 将 BigNumber 转换为字符串：`.toString()`

### Q: 地址比较失败
**A:** 使用 `.toLowerCase()` 进行大小写不敏感比较

### Q: revertWith 属性无效
**A:** 使用 `.revertedWith` 或简化为 `.reverted`

## 🚀 批量应用

使用此指南可以快速修复其他测试文件。核心原则是：
- **现代化部署方式**：TypeChain 工厂 + ethers v6
- **简化调用方式**：直接调用，无需 callAsync
- **类型安全**：使用 TypeScript 严格类型
- **兼容性处理**：数值和地址格式转换

每个修复的测试文件都可以作为其他文件的参考模板！