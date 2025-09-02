# 错误处理修复报告

## 📊 总体统计
- 总文件数: 28
- 有问题的文件: 26
- 修复率: 7.1%

## 🔍 错误模式分布
- generic_rejected_usage: 95 个
- todo_error_handling: 19 个
- deprecated_api_usage: 400 个
- missing_encode_call: 6 个
- generic_revert_usage: 14 个
- dynamic_parameter_error: 3 个

## 📝 修复建议
### /Users/king/javascript/protocol/contracts/zero-ex/test/features/batch_fill_native_orders_test.ts
**第 381 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 403 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 583 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 603 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 380 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 402 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 32 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

**第 34 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getBalanceInWeiAsync: async (addr: string, blockTag?: number) => ethers.provider.getBalance(addr, blockTag as any),

// ✅ 现代化的 API
provider.getBalance: async (addr: string, blockTag?: number) => ethers.provider.getBalance(addr, blockTag as any),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/features/erc1155_orders_test.ts
**第 572 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 583 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 661 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 674 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 698 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 719 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 740 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 758 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 856 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 872 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 921 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 955 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1041 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1060 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1085 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1158 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1171 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1184 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1203 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1223 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1425 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1501 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).not.to.be.rejected; // 部分失败不应整体 revert，应返回 successes

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1531 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1616 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1634 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 153 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
return ethers.Wallet.createRandom().address;

// ✅ 现代化的 API
return ethers.Wallet.createRandom()await getAddress();
```

**第 207 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const signer = signers.find(s => s.address.toLowerCase() === addressOrIndex.toLowerCase());

// ✅ 现代化的 API
const signer = signers.find(s => sawait getAddress().toLowerCase() === addressOrIndex.toLowerCase());
```

**第 215 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
return signers.map(s => s.address);

// ✅ 现代化的 API
return signers.map(s => sawait getAddress());
```

**第 218 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getBalanceInWeiAsync: async (addr: string) => ethers.provider.getBalance(addr),

// ✅ 现代化的 API
provider.getBalance: async (addr: string) => ethers.provider.getBalance(addr),
```

**第 221 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const signer = signers.find(s => s.address.toLowerCase() === tx.from.toLowerCase()) || signers[0];

// ✅ 现代化的 API
const signer = signers.find(s => sawait getAddress().toLowerCase() === tx.from.toLowerCase()) || signers[0];
```

**第 239 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
return signers.find(s => s.address.toLowerCase() === address.toLowerCase()) || signers[0];

// ✅ 现代化的 API
return signers.find(s => sawait getAddress().toLowerCase() === address.toLowerCase()) || signers[0];
```

**第 254 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const signer = signers.find(s => s.address.toLowerCase() === owner.toLowerCase()) || signers[0];

// ✅ 现代化的 API
const signer = signers.find(s => sawait getAddress().toLowerCase() === owner.toLowerCase()) || signers[0];
```

**第 331 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const makerSigner = signers.find(s => s.address.toLowerCase() === order.maker.toLowerCase());

// ✅ 现代化的 API
const makerSigner = signers.find(s => sawait getAddress().toLowerCase() === order.maker.toLowerCase());
```

**第 356 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const makerSigner = signers.find(s => s.address.toLowerCase() === order.maker.toLowerCase());

// ✅ 现代化的 API
const makerSigner = signers.find(s => sawait getAddress().toLowerCase() === order.maker.toLowerCase());
```

**第 375 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const makerSigner = signers.find(s => s.address.toLowerCase() === order.maker.toLowerCase());

// ✅ 现代化的 API
const makerSigner = signers.find(s => sawait getAddress().toLowerCase() === order.maker.toLowerCase());
```

**第 902 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const signer = signers.find(s => s.address.toLowerCase() === owner.toLowerCase()) || signers[0];

// ✅ 现代化的 API
const signer = signers.find(s => sawait getAddress().toLowerCase() === owner.toLowerCase()) || signers[0];
```

**第 1576 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const signer = signers.find(s => s.address.toLowerCase() === owner.toLowerCase()) || signers[0];

// ✅ 现代化的 API
const signer = signers.find(s => sawait getAddress().toLowerCase() === owner.toLowerCase()) || signers[0];
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/features/erc721_orders_test.ts
**第 588 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 628 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 651 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 673 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 698 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 709 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 846 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 971 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 994 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1017 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1078 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1091 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1103 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1125 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1150 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1385 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1506 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1581 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1599 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1649 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1665 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1683 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1699 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1847 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1878 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 129 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

**第 131 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getBalanceInWeiAsync: async (addr: string) => ethers.provider.getBalance(addr),

// ✅ 现代化的 API
provider.getBalance: async (addr: string) => ethers.provider.getBalance(addr),
```

**第 163 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
return signers.find(s => s.address.toLowerCase() === address.toLowerCase()) || signers[0];

// ✅ 现代化的 API
return signers.find(s => sawait getAddress().toLowerCase() === address.toLowerCase()) || signers[0];
```

**第 264 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const makerSigner = signers.find(s => s.address.toLowerCase() === order.maker.toLowerCase());

// ✅ 现代化的 API
const makerSigner = signers.find(s => sawait getAddress().toLowerCase() === order.maker.toLowerCase());
```

**第 319 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const makerSigner = signers.find(s => s.address.toLowerCase() === order.maker.toLowerCase());

// ✅ 现代化的 API
const makerSigner = signers.find(s => sawait getAddress().toLowerCase() === order.maker.toLowerCase());
```

**第 338 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const makerSigner = signers.find(s => s.address.toLowerCase() === order.maker.toLowerCase());

// ✅ 现代化的 API
const makerSigner = signers.find(s => sawait getAddress().toLowerCase() === order.maker.toLowerCase());
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/features/liquidity_provider_test.ts
**第 98 行** (error): 添加 .encode() 调用或使用 UnifiedErrorMatcher
```typescript

// ❌ 缺少 .encode() 调用
).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(taker));

// ✅ 正确的编码调用
.encode()).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(taker));

// 或者使用 UnifiedErrorMatcher（推荐）
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 112 行** (error): 添加 .encode() 调用或使用 UnifiedErrorMatcher
```typescript

// ❌ 缺少 .encode() 调用
).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(taker));

// ✅ 正确的编码调用
.encode()).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(taker));

// 或者使用 UnifiedErrorMatcher（推荐）
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 124 行** (error): 添加 .encode() 调用或使用 UnifiedErrorMatcher
```typescript

// ❌ 缺少 .encode() 调用
return expect(tx).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(taker));

// ✅ 正确的编码调用
return expect(tx.encode()).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(taker));

// 或者使用 UnifiedErrorMatcher（推荐）
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 33 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/features/meta_transactions_test.ts
**第 487 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
return expect(tx).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 524 行** (warning): 使用 UnifiedErrorMatcher 处理动态参数
```typescript

// ❌ 直接使用动态参数错误
await ErrorMatcher.expectMetaTransactionAlreadyExecutedError(

// ✅ 使用 UnifiedErrorMatcher 处理动态参数
await UnifiedErrorMatcher.expectMetaTransactionsError(
    txPromise,
    new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
        mtxHash,
        0n, // 动态参数，将自动解析
        expirationTimeSeconds
    )
);
```

**第 604 行** (warning): 使用 UnifiedErrorMatcher 处理动态参数
```typescript

// ❌ 直接使用动态参数错误
await ErrorMatcher.expectMetaTransactionExpiredError(

// ✅ 使用 UnifiedErrorMatcher 处理动态参数
await UnifiedErrorMatcher.expectMetaTransactionsError(
    txPromise,
    new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
        mtxHash,
        0n, // 动态参数，将自动解析
        expirationTimeSeconds
    )
);
```

**第 759 行** (warning): 使用 UnifiedErrorMatcher 处理动态参数
```typescript

// ❌ 直接使用动态参数错误
await ErrorMatcher.expectMetaTransactionAlreadyExecutedError(

// ✅ 使用 UnifiedErrorMatcher 处理动态参数
await UnifiedErrorMatcher.expectMetaTransactionsError(
    txPromise,
    new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
        mtxHash,
        0n, // 动态参数，将自动解析
        expirationTimeSeconds
    )
);
```

**第 33 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

**第 35 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getBalanceInWeiAsync: async (addr: string, blockTag?: number) => ethers.provider.getBalance(addr, blockTag as any),

// ✅ 现代化的 API
provider.getBalance: async (addr: string, blockTag?: number) => ethers.provider.getBalance(addr, blockTag as any),
```

**第 82 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: ownerSigner.address,

// ✅ 现代化的 API
from: ownerSignerawait getAddress(),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/features/multiplex_test.ts
**第 91 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

**第 201 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const r = await factory.createPool(token0.address, token1.address)();

// ✅ 现代化的 API
const r = await factory.createPool(token0await getAddress(), token1.address)();
```

**第 207 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await mintToAsync(token0, pool.address, balance0);

// ✅ 现代化的 API
await mintToAsync(token0, poolawait getAddress(), balance0);
```

**第 208 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await mintToAsync(token1, pool.address, balance1);

// ✅ 现代化的 API
await mintToAsync(token1, poolawait getAddress(), balance1);
```

**第 209 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
if (token0.address < token1.address) {

// ✅ 现代化的 API
if (token0await getAddress() < token1.address) {
```

**第 224 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
.createPool(token0.address, token1.address, BigInt(POOL_FEE))

// ✅ 现代化的 API
.createPool(token0await getAddress(), token1.address, BigInt(POOL_FEE))
```

**第 231 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await mintToAsync(token0, pool.address, balance0);

// ✅ 现代化的 API
await mintToAsync(token0, poolawait getAddress(), balance0);
```

**第 232 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await mintToAsync(token1, pool.address, balance1);

// ✅ 现代化的 API
await mintToAsync(token1, poolawait getAddress(), balance1);
```

**第 260 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
rfqOrder.makerToken === weth.address

// ✅ 现代化的 API
rfqOrder.makerToken === wethawait getAddress()
```

**第 297 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
otcOrder.makerToken === weth.address

// ✅ 现代化的 API
otcOrder.makerToken === wethawait getAddress()
```

**第 340 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
elems.push(hexUtils.leftPad(t.address, 20));

// ✅ 现代化的 API
elems.push(hexUtils.leftPad(tawait getAddress(), 20));
```

**第 367 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
provider: liquidityProvider.address,

// ✅ 现代化的 API
provider: liquidityProviderawait getAddress(),
```

**第 544 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 545 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
zrx.address,

// ✅ 现代化的 API
zrxawait getAddress(),
```

**第 561 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 562 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
zrx.address,

// ✅ 现代化的 API
zrxawait getAddress(),
```

**第 577 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 578 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
zrx.address,

// ✅ 现代化的 API
zrxawait getAddress(),
```

**第 594 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 595 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
zrx.address,

// ✅ 现代化的 API
zrxawait getAddress(),
```

**第 596 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[rfqSubcall, getUniswapV2BatchSubcall([dai.address, zrx.address], order.takerAmount)],

// ✅ 现代化的 API
[rfqSubcall, getUniswapV2BatchSubcall([daiawait getAddress(), zrx.address], order.takerAmount)],
```

**第 626 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 627 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
zrx.address,

// ✅ 现代化的 API
zrxawait getAddress(),
```

**第 628 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[otcSubcall, getUniswapV2BatchSubcall([dai.address, zrx.address], order.takerAmount)],

// ✅ 现代化的 API
[otcSubcall, getUniswapV2BatchSubcall([daiawait getAddress(), zrx.address], order.takerAmount)],
```

**第 657 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 658 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
zrx.address,

// ✅ 现代化的 API
zrxawait getAddress(),
```

**第 659 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[rfqSubcall, getUniswapV2BatchSubcall([dai.address, zrx.address], order.takerAmount)],

// ✅ 现代化的 API
[rfqSubcall, getUniswapV2BatchSubcall([daiawait getAddress(), zrx.address], order.takerAmount)],
```

**第 679 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 681 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniswap.address,

// ✅ 现代化的 API
to: uniswapawait getAddress(),
```

**第 685 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 686 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniswap.address,

// ✅ 现代化的 API
from: uniswapawait getAddress(),
```

**第 701 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 702 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
zrx.address,

// ✅ 现代化的 API
zrxawait getAddress(),
```

**第 703 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[otcSubcall, getUniswapV2BatchSubcall([dai.address, zrx.address], order.takerAmount)],

// ✅ 现代化的 API
[otcSubcall, getUniswapV2BatchSubcall([daiawait getAddress(), zrx.address], order.takerAmount)],
```

**第 723 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 725 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniswap.address,

// ✅ 现代化的 API
to: uniswapawait getAddress(),
```

**第 729 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 730 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniswap.address,

// ✅ 现代化的 API
from: uniswapawait getAddress(),
```

**第 740 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const transformERC20Subcall = getTransformERC20Subcall(dai.address, zrx.address, order.takerAmount);

// ✅ 现代化的 API
const transformERC20Subcall = getTransformERC20Subcall(daiawait getAddress(), zrx.address, order.takerAmount);
```

**第 745 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 746 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
zrx.address,

// ✅ 现代化的 API
zrxawait getAddress(),
```

**第 767 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 773 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 778 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 803 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const sushiswapSubcall = getUniswapV2BatchSubcall([dai.address, zrx.address], undefined, true);

// ✅ 现代化的 API
const sushiswapSubcall = getUniswapV2BatchSubcall([daiawait getAddress(), zrx.address], undefined, true);
```

**第 810 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 811 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
zrx.address,

// ✅ 现代化的 API
zrxawait getAddress(),
```

**第 821 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 823 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: liquidityProvider.address,

// ✅ 现代化的 API
to: liquidityProviderawait getAddress(),
```

**第 827 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 828 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: liquidityProvider.address,

// ✅ 现代化的 API
from: liquidityProviderawait getAddress(),
```

**第 832 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 833 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV3.address,

// ✅ 现代化的 API
from: uniV3await getAddress(),
```

**第 837 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 839 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV3.address,

// ✅ 现代化的 API
to: uniV3await getAddress(),
```

**第 843 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 845 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: sushiswap.address,

// ✅ 现代化的 API
to: sushiswapawait getAddress(),
```

**第 849 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 850 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: sushiswap.address,

// ✅ 现代化的 API
from: sushiswapawait getAddress(),
```

**第 867 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, zrx.address],

// ✅ 现代化的 API
[daiawait getAddress(), zrx.address],
```

**第 872 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 873 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
zrx.address,

// ✅ 现代化的 API
zrxawait getAddress(),
```

**第 883 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 889 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 894 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 896 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniswap.address,

// ✅ 现代化的 API
to: uniswapawait getAddress(),
```

**第 900 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 901 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniswap.address,

// ✅ 现代化的 API
from: uniswapawait getAddress(),
```

**第 914 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniV2Subcall = getUniswapV2MultiHopSubcall([shib.address, zrx.address]);

// ✅ 现代化的 API
const uniV2Subcall = getUniswapV2MultiHopSubcall([shibawait getAddress(), zrx.address]);
```

**第 916 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, shib.address, zrx.address],

// ✅ 现代化的 API
[daiawait getAddress(), shib.address, zrx.address],
```

**第 924 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 925 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
zrx.address,

// ✅ 现代化的 API
zrxawait getAddress(),
```

**第 935 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 941 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 947 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 948 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV3.address,

// ✅ 现代化的 API
from: uniV3await getAddress(),
```

**第 949 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV2.address,

// ✅ 现代化的 API
to: uniV2await getAddress(),
```

**第 952 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 954 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV3.address,

// ✅ 现代化的 API
to: uniV3await getAddress(),
```

**第 958 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 959 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV2.address,

// ✅ 现代化的 API
from: uniV2await getAddress(),
```

**第 969 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const order = await getTestRfqOrder({ takerToken: weth.address });

// ✅ 现代化的 API
const order = await getTestRfqOrder({ takerToken: wethawait getAddress() });
```

**第 973 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
.multiplexBatchSellEthForToken(zrx.address, [rfqSubcall], constants.ZERO_AMOUNT)

// ✅ 现代化的 API
.multiplexBatchSellEthForToken(zrxawait getAddress(), [rfqSubcall], constants.ZERO_AMOUNT)
```

**第 984 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 990 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1000 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const order = await getTestOtcOrder({ takerToken: weth.address });

// ✅ 现代化的 API
const order = await getTestOtcOrder({ takerToken: wethawait getAddress() });
```

**第 1004 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
.multiplexBatchSellEthForToken(zrx.address, [otcSubcall], constants.ZERO_AMOUNT)

// ✅ 现代化的 API
.multiplexBatchSellEthForToken(zrxawait getAddress(), [otcSubcall], constants.ZERO_AMOUNT)
```

**第 1015 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1021 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1032 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniswapV2Subcall = getUniswapV2BatchSubcall([weth.address, zrx.address]);

// ✅ 现代化的 API
const uniswapV2Subcall = getUniswapV2BatchSubcall([wethawait getAddress(), zrx.address]);
```

**第 1035 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
.multiplexBatchSellEthForToken(zrx.address, [uniswapV2Subcall], constants.ZERO_AMOUNT)

// ✅ 现代化的 API
.multiplexBatchSellEthForToken(zrxawait getAddress(), [uniswapV2Subcall], constants.ZERO_AMOUNT)
```

**第 1046 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1048 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniswap.address,

// ✅ 现代化的 API
to: uniswapawait getAddress(),
```

**第 1052 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1053 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniswap.address,

// ✅ 现代化的 API
from: uniswapawait getAddress(),
```

**第 1064 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
.multiplexBatchSellEthForToken(zrx.address, [uniswapV3Subcall], constants.ZERO_AMOUNT)

// ✅ 现代化的 API
.multiplexBatchSellEthForToken(zrxawait getAddress(), [uniswapV3Subcall], constants.ZERO_AMOUNT)
```

**第 1075 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1076 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV3.address,

// ✅ 现代化的 API
from: uniV3await getAddress(),
```

**第 1080 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1082 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV3.address,

// ✅ 现代化的 API
to: uniV3await getAddress(),
```

**第 1092 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
.multiplexBatchSellEthForToken(zrx.address, [liquidityProviderSubcall], constants.ZERO_AMOUNT)

// ✅ 现代化的 API
.multiplexBatchSellEthForToken(zrxawait getAddress(), [liquidityProviderSubcall], constants.ZERO_AMOUNT)
```

**第 1103 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1105 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: liquidityProvider.address,

// ✅ 现代化的 API
to: liquidityProviderawait getAddress(),
```

**第 1109 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1110 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: liquidityProvider.address,

// ✅ 现代化的 API
from: liquidityProviderawait getAddress(),
```

**第 1118 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const transformERC20Subcall = getTransformERC20Subcall(weth.address, zrx.address);

// ✅ 现代化的 API
const transformERC20Subcall = getTransformERC20Subcall(wethawait getAddress(), zrx.address);
```

**第 1120 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
.multiplexBatchSellEthForToken(zrx.address, [transformERC20Subcall], constants.ZERO_AMOUNT)

// ✅ 现代化的 API
.multiplexBatchSellEthForToken(zrxawait getAddress(), [transformERC20Subcall], constants.ZERO_AMOUNT)
```

**第 1131 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1137 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1142 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1151 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const order = await getTestRfqOrder({ takerToken: weth.address, makerToken: zrx.address });

// ✅ 现代化的 API
const order = await getTestRfqOrder({ takerToken: wethawait getAddress(), makerToken: zrx.address });
```

**第 1156 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniV2Subcall = getUniswapV2MultiHopSubcall([shib.address, zrx.address]);

// ✅ 现代化的 API
const uniV2Subcall = getUniswapV2MultiHopSubcall([shibawait getAddress(), zrx.address]);
```

**第 1158 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[weth.address, shib.address, zrx.address],

// ✅ 现代化的 API
[wethawait getAddress(), shib.address, zrx.address],
```

**第 1165 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
zrx.address,

// ✅ 现代化的 API
zrxawait getAddress(),
```

**第 1175 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1181 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1187 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1188 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV3.address,

// ✅ 现代化的 API
from: uniV3await getAddress(),
```

**第 1189 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV2.address,

// ✅ 现代化的 API
to: uniV2await getAddress(),
```

**第 1192 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1194 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV3.address,

// ✅ 现代化的 API
to: uniV3await getAddress(),
```

**第 1198 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1199 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV2.address,

// ✅ 现代化的 API
from: uniV2await getAddress(),
```

**第 1209 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const order = await getTestRfqOrder({ makerToken: weth.address });

// ✅ 现代化的 API
const order = await getTestRfqOrder({ makerToken: wethawait getAddress() });
```

**第 1213 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
.multiplexBatchSellTokenForEth(dai.address, [rfqSubcall], order.takerAmount, constants.ZERO_AMOUNT)

// ✅ 现代化的 API
.multiplexBatchSellTokenForEth(daiawait getAddress(), [rfqSubcall], order.takerAmount, constants.ZERO_AMOUNT)
```

**第 1220 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1226 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1236 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const order = await getTestOtcOrder({ makerToken: weth.address });

// ✅ 现代化的 API
const order = await getTestOtcOrder({ makerToken: wethawait getAddress() });
```

**第 1240 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
.multiplexBatchSellTokenForEth(dai.address, [otcSubcall], order.takerAmount, constants.ZERO_AMOUNT)

// ✅ 现代化的 API
.multiplexBatchSellTokenForEth(daiawait getAddress(), [otcSubcall], order.takerAmount, constants.ZERO_AMOUNT)
```

**第 1247 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1253 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1263 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniswapV2Subcall = getUniswapV2BatchSubcall([dai.address, weth.address]);

// ✅ 现代化的 API
const uniswapV2Subcall = getUniswapV2BatchSubcall([daiawait getAddress(), weth.address]);
```

**第 1269 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 1280 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1282 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniswap.address,

// ✅ 现代化的 API
to: uniswapawait getAddress(),
```

**第 1286 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1287 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniswap.address,

// ✅ 现代化的 API
from: uniswapawait getAddress(),
```

**第 1301 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 1312 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1313 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV3.address,

// ✅ 现代化的 API
from: uniV3await getAddress(),
```

**第 1317 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1319 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV3.address,

// ✅ 现代化的 API
to: uniV3await getAddress(),
```

**第 1332 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 1343 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1345 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: liquidityProvider.address,

// ✅ 现代化的 API
to: liquidityProviderawait getAddress(),
```

**第 1349 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1350 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: liquidityProvider.address,

// ✅ 现代化的 API
from: liquidityProviderawait getAddress(),
```

**第 1359 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 1360 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
weth.address,

// ✅ 现代化的 API
wethawait getAddress(),
```

**第 1368 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 1379 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1385 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1390 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1399 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const order = await getTestRfqOrder({ takerToken: dai.address, makerToken: weth.address });

// ✅ 现代化的 API
const order = await getTestRfqOrder({ takerToken: daiawait getAddress(), makerToken: weth.address });
```

**第 1404 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniV2Subcall = getUniswapV2MultiHopSubcall([shib.address, weth.address]);

// ✅ 现代化的 API
const uniV2Subcall = getUniswapV2MultiHopSubcall([shibawait getAddress(), weth.address]);
```

**第 1406 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, shib.address, weth.address],

// ✅ 现代化的 API
[daiawait getAddress(), shib.address, weth.address],
```

**第 1414 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
dai.address,

// ✅ 现代化的 API
daiawait getAddress(),
```

**第 1424 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1430 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1436 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1437 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV3.address,

// ✅ 现代化的 API
from: uniV3await getAddress(),
```

**第 1438 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV2.address,

// ✅ 现代化的 API
to: uniV2await getAddress(),
```

**第 1441 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1443 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV3.address,

// ✅ 现代化的 API
to: uniV3await getAddress(),
```

**第 1447 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1448 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV2.address,

// ✅ 现代化的 API
from: uniV2await getAddress(),
```

**第 1467 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, zrx.address],

// ✅ 现代化的 API
[daiawait getAddress(), zrx.address],
```

**第 1478 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([dai.address, zrx.address]);

// ✅ 现代化的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([daiawait getAddress(), zrx.address]);
```

**第 1483 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, zrx.address],

// ✅ 现代化的 API
[daiawait getAddress(), zrx.address],
```

**第 1494 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([dai.address, zrx.address]);

// ✅ 现代化的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([daiawait getAddress(), zrx.address]);
```

**第 1499 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, zrx.address],

// ✅ 现代化的 API
[daiawait getAddress(), zrx.address],
```

**第 1511 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([dai.address, shib.address]);

// ✅ 现代化的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([daiawait getAddress(), shib.address]);
```

**第 1514 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await mintToAsync(zrx, liquidityProvider.address, buyAmount);

// ✅ 现代化的 API
await mintToAsync(zrx, liquidityProviderawait getAddress(), buyAmount);
```

**第 1518 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, shib.address, zrx.address],

// ✅ 现代化的 API
[daiawait getAddress(), shib.address, zrx.address],
```

**第 1528 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1530 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniswap.address,

// ✅ 现代化的 API
to: uniswapawait getAddress(),
```

**第 1534 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1535 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniswap.address,

// ✅ 现代化的 API
from: uniswapawait getAddress(),
```

**第 1536 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: liquidityProvider.address,

// ✅ 现代化的 API
to: liquidityProviderawait getAddress(),
```

**第 1539 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1540 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: liquidityProvider.address,

// ✅ 现代化的 API
from: liquidityProviderawait getAddress(),
```

**第 1553 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const sushiswapSubcall = getUniswapV2MultiHopSubcall([shib.address, zrx.address], true);

// ✅ 现代化的 API
const sushiswapSubcall = getUniswapV2MultiHopSubcall([shibawait getAddress(), zrx.address], true);
```

**第 1555 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await mintToAsync(shib, liquidityProvider.address, shibAmount);

// ✅ 现代化的 API
await mintToAsync(shib, liquidityProviderawait getAddress(), shibAmount);
```

**第 1559 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, shib.address, zrx.address],

// ✅ 现代化的 API
[daiawait getAddress(), shib.address, zrx.address],
```

**第 1569 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1571 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: liquidityProvider.address,

// ✅ 现代化的 API
to: liquidityProviderawait getAddress(),
```

**第 1575 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1576 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: liquidityProvider.address,

// ✅ 现代化的 API
from: liquidityProviderawait getAddress(),
```

**第 1577 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: sushiswap.address,

// ✅ 现代化的 API
to: sushiswapawait getAddress(),
```

**第 1581 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1582 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: sushiswap.address,

// ✅ 现代化的 API
from: sushiswapawait getAddress(),
```

**第 1594 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const rfqOrder = getTestRfqOrder({ takerToken: shib.address, makerToken: zrx.address });

// ✅ 现代化的 API
const rfqOrder = getTestRfqOrder({ takerToken: shibawait getAddress(), makerToken: zrx.address });
```

**第 1599 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[shib.address, zrx.address],

// ✅ 现代化的 API
[shibawait getAddress(), zrx.address],
```

**第 1606 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, shib.address, zrx.address],

// ✅ 现代化的 API
[daiawait getAddress(), shib.address, zrx.address],
```

**第 1616 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1617 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV3.address,

// ✅ 现代化的 API
from: uniV3await getAddress(),
```

**第 1621 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1623 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV3.address,

// ✅ 现代化的 API
to: uniV3await getAddress(),
```

**第 1627 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1632 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1637 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1639 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV2.address,

// ✅ 现代化的 API
to: uniV2await getAddress(),
```

**第 1642 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1643 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV2.address,

// ✅ 现代化的 API
from: uniV2await getAddress(),
```

**第 1651 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const rfqOrder = getTestRfqOrder({ takerToken: dai.address, makerToken: shib.address });

// ✅ 现代化的 API
const rfqOrder = getTestRfqOrder({ takerToken: daiawait getAddress(), makerToken: shib.address });
```

**第 1654 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniV2Subcall = getUniswapV2BatchSubcall([dai.address, shib.address]);

// ✅ 现代化的 API
const uniV2Subcall = getUniswapV2BatchSubcall([daiawait getAddress(), shib.address]);
```

**第 1664 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, shib.address, zrx.address],

// ✅ 现代化的 API
[daiawait getAddress(), shib.address, zrx.address],
```

**第 1674 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1680 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1686 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1688 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV2.address,

// ✅ 现代化的 API
to: uniV2await getAddress(),
```

**第 1692 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1693 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV2.address,

// ✅ 现代化的 API
from: uniV2await getAddress(),
```

**第 1697 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1698 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV3.address,

// ✅ 现代化的 API
from: uniV3await getAddress(),
```

**第 1702 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1704 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV3.address,

// ✅ 现代化的 API
to: uniV3await getAddress(),
```

**第 1715 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([weth.address, zrx.address]);

// ✅ 现代化的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([wethawait getAddress(), zrx.address]);
```

**第 1720 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, zrx.address],

// ✅ 现代化的 API
[daiawait getAddress(), zrx.address],
```

**第 1731 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([weth.address, shib.address]);

// ✅ 现代化的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([wethawait getAddress(), shib.address]);
```

**第 1733 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await mintToAsync(zrx, liquidityProvider.address, buyAmount);

// ✅ 现代化的 API
await mintToAsync(zrx, liquidityProviderawait getAddress(), buyAmount);
```

**第 1737 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[weth.address, shib.address, zrx.address],

// ✅ 现代化的 API
[wethawait getAddress(), shib.address, zrx.address],
```

**第 1747 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1749 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniswap.address,

// ✅ 现代化的 API
to: uniswapawait getAddress(),
```

**第 1753 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1754 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniswap.address,

// ✅ 现代化的 API
from: uniswapawait getAddress(),
```

**第 1755 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: liquidityProvider.address,

// ✅ 现代化的 API
to: liquidityProviderawait getAddress(),
```

**第 1758 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1759 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: liquidityProvider.address,

// ✅ 现代化的 API
from: liquidityProviderawait getAddress(),
```

**第 1772 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const sushiswapSubcall = getUniswapV2MultiHopSubcall([shib.address, zrx.address], true);

// ✅ 现代化的 API
const sushiswapSubcall = getUniswapV2MultiHopSubcall([shibawait getAddress(), zrx.address], true);
```

**第 1773 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await mintToAsync(shib, liquidityProvider.address, shibAmount);

// ✅ 现代化的 API
await mintToAsync(shib, liquidityProviderawait getAddress(), shibAmount);
```

**第 1777 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[weth.address, shib.address, zrx.address],

// ✅ 现代化的 API
[wethawait getAddress(), shib.address, zrx.address],
```

**第 1787 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1789 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: liquidityProvider.address,

// ✅ 现代化的 API
to: liquidityProviderawait getAddress(),
```

**第 1793 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1794 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: liquidityProvider.address,

// ✅ 现代化的 API
from: liquidityProviderawait getAddress(),
```

**第 1795 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: sushiswap.address,

// ✅ 现代化的 API
to: sushiswapawait getAddress(),
```

**第 1799 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1800 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: sushiswap.address,

// ✅ 现代化的 API
from: sushiswapawait getAddress(),
```

**第 1811 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const rfqOrder = getTestRfqOrder({ takerToken: shib.address, makerToken: zrx.address });

// ✅ 现代化的 API
const rfqOrder = getTestRfqOrder({ takerToken: shibawait getAddress(), makerToken: zrx.address });
```

**第 1816 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[shib.address, zrx.address],

// ✅ 现代化的 API
[shibawait getAddress(), zrx.address],
```

**第 1823 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[weth.address, shib.address, zrx.address],

// ✅ 现代化的 API
[wethawait getAddress(), shib.address, zrx.address],
```

**第 1833 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1834 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV3.address,

// ✅ 现代化的 API
from: uniV3await getAddress(),
```

**第 1838 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1840 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV3.address,

// ✅ 现代化的 API
to: uniV3await getAddress(),
```

**第 1844 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1849 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1854 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1856 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV2.address,

// ✅ 现代化的 API
to: uniV2await getAddress(),
```

**第 1859 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1860 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV2.address,

// ✅ 现代化的 API
from: uniV2await getAddress(),
```

**第 1868 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const rfqOrder = getTestRfqOrder({ takerToken: weth.address, makerToken: shib.address });

// ✅ 现代化的 API
const rfqOrder = getTestRfqOrder({ takerToken: wethawait getAddress(), makerToken: shib.address });
```

**第 1871 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniV2Subcall = getUniswapV2BatchSubcall([weth.address, shib.address]);

// ✅ 现代化的 API
const uniV2Subcall = getUniswapV2BatchSubcall([wethawait getAddress(), shib.address]);
```

**第 1880 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[weth.address, shib.address, zrx.address],

// ✅ 现代化的 API
[wethawait getAddress(), shib.address, zrx.address],
```

**第 1890 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1896 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1902 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1904 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV2.address,

// ✅ 现代化的 API
to: uniV2await getAddress(),
```

**第 1908 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1909 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV2.address,

// ✅ 现代化的 API
from: uniV2await getAddress(),
```

**第 1913 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: zrx.address,

// ✅ 现代化的 API
token: zrxawait getAddress(),
```

**第 1914 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV3.address,

// ✅ 现代化的 API
from: uniV3await getAddress(),
```

**第 1918 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1920 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV3.address,

// ✅ 现代化的 API
to: uniV3await getAddress(),
```

**第 1931 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([zrx.address, weth.address]);

// ✅ 现代化的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([zrxawait getAddress(), weth.address]);
```

**第 1936 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[zrx.address, dai.address],

// ✅ 现代化的 API
[zrxawait getAddress(), dai.address],
```

**第 1948 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([dai.address, shib.address]);

// ✅ 现代化的 API
const uniswapV2Subcall = getUniswapV2MultiHopSubcall([daiawait getAddress(), shib.address]);
```

**第 1951 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await mintToAsync(weth, liquidityProvider.address, buyAmount);

// ✅ 现代化的 API
await mintToAsync(weth, liquidityProviderawait getAddress(), buyAmount);
```

**第 1955 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, shib.address, weth.address],

// ✅ 现代化的 API
[daiawait getAddress(), shib.address, weth.address],
```

**第 1965 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 1967 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniswap.address,

// ✅ 现代化的 API
to: uniswapawait getAddress(),
```

**第 1971 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 1972 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniswap.address,

// ✅ 现代化的 API
from: uniswapawait getAddress(),
```

**第 1973 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: liquidityProvider.address,

// ✅ 现代化的 API
to: liquidityProviderawait getAddress(),
```

**第 1976 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 1977 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: liquidityProvider.address,

// ✅ 现代化的 API
from: liquidityProviderawait getAddress(),
```

**第 1991 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const sushiswapSubcall = getUniswapV2MultiHopSubcall([shib.address, weth.address], true);

// ✅ 现代化的 API
const sushiswapSubcall = getUniswapV2MultiHopSubcall([shibawait getAddress(), weth.address], true);
```

**第 1993 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await mintToAsync(shib, liquidityProvider.address, shibAmount);

// ✅ 现代化的 API
await mintToAsync(shib, liquidityProviderawait getAddress(), shibAmount);
```

**第 1997 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, shib.address, weth.address],

// ✅ 现代化的 API
[daiawait getAddress(), shib.address, weth.address],
```

**第 2007 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 2009 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: liquidityProvider.address,

// ✅ 现代化的 API
to: liquidityProviderawait getAddress(),
```

**第 2013 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 2014 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: liquidityProvider.address,

// ✅ 现代化的 API
from: liquidityProviderawait getAddress(),
```

**第 2015 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: sushiswap.address,

// ✅ 现代化的 API
to: sushiswapawait getAddress(),
```

**第 2019 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 2020 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: sushiswap.address,

// ✅ 现代化的 API
from: sushiswapawait getAddress(),
```

**第 2032 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const rfqOrder = getTestRfqOrder({ takerToken: shib.address, makerToken: weth.address });

// ✅ 现代化的 API
const rfqOrder = getTestRfqOrder({ takerToken: shibawait getAddress(), makerToken: weth.address });
```

**第 2037 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[shib.address, weth.address],

// ✅ 现代化的 API
[shibawait getAddress(), weth.address],
```

**第 2045 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, shib.address, weth.address],

// ✅ 现代化的 API
[daiawait getAddress(), shib.address, weth.address],
```

**第 2055 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 2056 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV3.address,

// ✅ 现代化的 API
from: uniV3await getAddress(),
```

**第 2060 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 2062 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV3.address,

// ✅ 现代化的 API
to: uniV3await getAddress(),
```

**第 2066 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 2071 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 2076 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 2078 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV2.address,

// ✅ 现代化的 API
to: uniV2await getAddress(),
```

**第 2081 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 2082 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV2.address,

// ✅ 现代化的 API
from: uniV2await getAddress(),
```

**第 2091 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const rfqOrder = getTestRfqOrder({ takerToken: dai.address, makerToken: shib.address });

// ✅ 现代化的 API
const rfqOrder = getTestRfqOrder({ takerToken: daiawait getAddress(), makerToken: shib.address });
```

**第 2094 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const uniV2Subcall = getUniswapV2BatchSubcall([dai.address, shib.address]);

// ✅ 现代化的 API
const uniV2Subcall = getUniswapV2BatchSubcall([daiawait getAddress(), shib.address]);
```

**第 2103 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
[dai.address, shib.address, weth.address],

// ✅ 现代化的 API
[daiawait getAddress(), shib.address, weth.address],
```

**第 2113 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 2119 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 2125 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: dai.address,

// ✅ 现代化的 API
token: daiawait getAddress(),
```

**第 2127 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV2.address,

// ✅ 现代化的 API
to: uniV2await getAddress(),
```

**第 2131 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 2132 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV2.address,

// ✅ 现代化的 API
from: uniV2await getAddress(),
```

**第 2136 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: weth.address,

// ✅ 现代化的 API
token: wethawait getAddress(),
```

**第 2137 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
from: uniV3.address,

// ✅ 现代化的 API
from: uniV3await getAddress(),
```

**第 2141 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
token: shib.address,

// ✅ 现代化的 API
token: shibawait getAddress(),
```

**第 2143 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
to: uniV3.address,

// ✅ 现代化的 API
to: uniV3await getAddress(),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/features/native_orders_feature_test.ts
**第 583 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 680 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 713 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 746 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1092 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1108 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1128 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1141 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1154 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
await expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1168 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1183 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1333 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1381 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1390 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1399 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1408 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1420 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1436 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1445 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1460 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejectedWith('revert');

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1498 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1554 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1569 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejectedWith('revert');

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 2008 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 2024 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 2087 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 2098 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 2156 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 2214 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 2281 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 2348 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 1378 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 1387 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 1396 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 1405 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 1417 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 1433 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 1444 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 1497 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 1553 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 2007 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 2023 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 2084 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 2097 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 2153 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 2211 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 2278 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 2345 行** (info): 需要手动检查和修复
```typescript
// 请手动分析并修复此问题
```

**第 46 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

**第 48 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getBalanceInWeiAsync: async (addr: string, blockTag?: number) => ethers.provider.getBalance(addr, blockTag as any),

// ✅ 现代化的 API
provider.getBalance: async (addr: string, blockTag?: number) => ethers.provider.getBalance(addr, blockTag as any),
```

**第 821 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             makerToken: makerToken.address,

// ✅ 现代化的 API
//             makerToken: makerTokenawait getAddress(),
```

**第 822 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             takerToken: takerToken.address,

// ✅ 现代化的 API
//             takerToken: takerTokenawait getAddress(),
```

**第 877 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             makerToken: makerToken.address,

// ✅ 现代化的 API
//             makerToken: makerTokenawait getAddress(),
```

**第 878 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             takerToken: takerToken.address,

// ✅ 现代化的 API
//             takerToken: takerTokenawait getAddress(),
```

**第 883 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             makerToken: takerToken.address,

// ✅ 现代化的 API
//             makerToken: takerTokenawait getAddress(),
```

**第 884 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             takerToken: makerToken.address,

// ✅ 现代化的 API
//             takerToken: makerTokenawait getAddress(),
```

**第 920 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             makerToken: makerToken.address,

// ✅ 现代化的 API
//             makerToken: makerTokenawait getAddress(),
```

**第 921 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             takerToken: takerToken.address,

// ✅ 现代化的 API
//             takerToken: takerTokenawait getAddress(),
```

**第 926 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             makerToken: takerToken.address,

// ✅ 现代化的 API
//             makerToken: takerTokenawait getAddress(),
```

**第 927 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             takerToken: makerToken.address,

// ✅ 现代化的 API
//             takerToken: makerTokenawait getAddress(),
```

**第 2124 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             makerToken: makerToken.address,

// ✅ 现代化的 API
//             makerToken: makerTokenawait getAddress(),
```

**第 2125 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             takerToken: takerToken.address,

// ✅ 现代化的 API
//             takerToken: takerTokenawait getAddress(),
```

**第 2182 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             makerToken: makerToken.address,

// ✅ 现代化的 API
//             makerToken: makerTokenawait getAddress(),
```

**第 2183 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             takerToken: takerToken.address,

// ✅ 现代化的 API
//             takerToken: takerTokenawait getAddress(),
```

**第 2247 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             makerToken: makerToken.address,

// ✅ 现代化的 API
//             makerToken: makerTokenawait getAddress(),
```

**第 2248 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             takerToken: takerToken.address,

// ✅ 现代化的 API
//             takerToken: takerTokenawait getAddress(),
```

**第 2253 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             makerToken: takerToken.address,

// ✅ 现代化的 API
//             makerToken: takerTokenawait getAddress(),
```

**第 2254 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             takerToken: makerToken.address,

// ✅ 现代化的 API
//             takerToken: makerTokenawait getAddress(),
```

**第 2314 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             makerToken: makerToken.address,

// ✅ 现代化的 API
//             makerToken: makerTokenawait getAddress(),
```

**第 2315 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             takerToken: takerToken.address,

// ✅ 现代化的 API
//             takerToken: takerTokenawait getAddress(),
```

**第 2320 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             makerToken: takerToken.address,

// ✅ 现代化的 API
//             makerToken: takerTokenawait getAddress(),
```

**第 2321 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
//             takerToken: makerToken.address,

// ✅ 现代化的 API
//             takerToken: makerTokenawait getAddress(),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/features/otc_orders_test.ts
**第 327 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejectedWith('revert');

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 689 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejectedWith('revert');

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 36 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

**第 416 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const order = await getTestOtcOrder({ maker: contractWallet.address });

// ✅ 现代化的 API
const order = await getTestOtcOrder({ maker: contractWalletawait getAddress() });
```

**第 425 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await makerToken.mint(contractWallet.address, order.makerAmount)();

// ✅ 现代化的 API
await makerToken.mint(contractWalletawait getAddress(), order.makerAmount)();
```

**第 443 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const order = await getTestOtcOrder({ maker: contractWallet.address });

// ✅ 现代化的 API
const order = await getTestOtcOrder({ maker: contractWalletawait getAddress() });
```

**第 452 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await makerToken.mint(contractWallet.address, order.makerAmount)();

// ✅ 现代化的 API
await makerToken.mint(contractWalletawait getAddress(), order.makerAmount)();
```

**第 475 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
const order = await getTestOtcOrder({ maker: contractWallet.address });

// ✅ 现代化的 API
const order = await getTestOtcOrder({ maker: contractWalletawait getAddress() });
```

**第 480 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
await makerToken.mint(contractWallet.address, order.makerAmount)();

// ✅ 现代化的 API
await makerToken.mint(contractWalletawait getAddress(), order.makerAmount)();
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/features/ownable_test.ts
**第 73 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 104 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 133 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 142 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 19 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/features/simple_function_registry_test.ts
**第 21 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/features/transform_erc20_test.ts
**第 130 行** (error): 添加 .encode() 调用或使用 UnifiedErrorMatcher
```typescript

// ❌ 缺少 .encode() 调用
return expect(tx).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(notOwner, owner));

// ✅ 正确的编码调用
return expect(tx.encode()).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(notOwner, owner));

// 或者使用 UnifiedErrorMatcher（推荐）
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 156 行** (error): 添加 .encode() 调用或使用 UnifiedErrorMatcher
```typescript

// ❌ 缺少 .encode() 调用
return expect(tx).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(notOwner, owner));

// ✅ 正确的编码调用
return expect(tx.encode()).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(notOwner, owner));

// 或者使用 UnifiedErrorMatcher（推荐）
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 39 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

**第 275 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
context: wallet.address,

// ✅ 现代化的 API
context: walletawait getAddress(),
```

**第 276 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
caller: zeroEx.address,

// ✅ 现代化的 API
caller: zeroExawait getAddress(),
```

**第 330 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
context: wallet.address,

// ✅ 现代化的 API
context: walletawait getAddress(),
```

**第 331 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
caller: zeroEx.address,

// ✅ 现代化的 API
caller: zeroExawait getAddress(),
```

**第 390 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
context: wallet.address,

// ✅ 现代化的 API
context: walletawait getAddress(),
```

**第 391 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
caller: zeroEx.address,

// ✅ 现代化的 API
caller: zeroExawait getAddress(),
```

**第 506 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
context: wallet.address,

// ✅ 现代化的 API
context: walletawait getAddress(),
```

**第 507 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
caller: zeroEx.address,

// ✅ 现代化的 API
caller: zeroExawait getAddress(),
```

**第 515 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
context: wallet.address,

// ✅ 现代化的 API
context: walletawait getAddress(),
```

**第 516 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
caller: zeroEx.address,

// ✅ 现代化的 API
caller: zeroExawait getAddress(),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/features/uniswapv3_test.ts
**第 425 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejectedWith('revert');

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 28 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

**第 30 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getBalanceInWeiAsync: async (addr: string) => ethers.provider.getBalance(addr),

// ✅ 现代化的 API
provider.getBalance: async (addr: string) => ethers.provider.getBalance(addr),
```

**第 217 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
// 🔧 使用getAddress()替代.address属性，解决undefined问题的根本原因

// ✅ 现代化的 API
// 🔧 使用getAddress()替代await getAddress()属性，解决undefined问题的根本原因
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/fixin_token_spender_test.ts
**第 118 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 153 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 22 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/full_migration_test.ts
**第 220 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
await expect((connected[fn](...inputs))).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 34 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
(await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
(await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/initial_migration_test.ts
**第 76 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 111 行** (error): 添加 .encode() 调用或使用 UnifiedErrorMatcher
```typescript

// ❌ 缺少 .encode() 调用
).to.be.revertedWith(new ZeroExRevertErrors.Proxy.NotImplementedError(selector));

// ✅ 正确的编码调用
.encode()).to.be.revertedWith(new ZeroExRevertErrors.Proxy.NotImplementedError(selector));

// 或者使用 UnifiedErrorMatcher（推荐）
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 19 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/lib_limit_orders_test.ts
**第 13 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/lib_signature_test.ts
**第 60 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
return expect(testLib.getSignerOfHash(hash, sig)).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 69 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
return expect(testLib.getSignerOfHash(hash, sig)).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 78 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
return expect(testLib.getSignerOfHash(hash, sig)).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 87 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
return expect(testLib.getSignerOfHash(hash, sig)).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 96 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
return expect(testLib.getSignerOfHash(hash, sig)).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 18 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/liqudity-providers/curve_test.ts
**第 18 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/liqudity-providers/mooniswap_test.ts
**第 22 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/permissionless_transformer_deployer_test.ts
**第 16 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/protocol_fees_test.ts
**第 92 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
await expect(tx).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 111 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
return expect(tx).to.be.reverted; // 余额不足应当 revert

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 19 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/transformer_deployer_test.ts
**第 38 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
return expect(deployer.deploy(deployBytes)).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 141 行** (error): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 错误的通用检查
return expect(deployer.kill(await target.getAddress(), ethRecipient)).to.be.reverted;

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);
```

**第 16 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/transformers/fill_quote_transformer_test.ts
**第 75 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

**第 77 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getBalanceInWeiAsync: async (addr: string) => ethers.provider.getBalance(addr),

// ✅ 现代化的 API
provider.getBalance: async (addr: string) => ethers.provider.getBalance(addr),
```

**第 462 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
env.web3Wrapper.getBalanceInWeiAsync(owner),

// ✅ 现代化的 API
env.web3Wrapper.provider.getBalance(owner),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/transformers/pay_taker_transformer_test.ts
**第 15 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/transformers/transformer_base_test.ts
**第 34 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 41 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 12 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

### /Users/king/javascript/protocol/contracts/zero-ex/test/transformers/weth_transformer_test.ts
**第 74 行** (warning): 使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配
```typescript

// ❌ 通用错误检查
return expect(tx).to.be.rejected;

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);
```

**第 15 行** (warning): 更新到 ethers v6 API
```typescript

// ❌ 过时的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),

// ✅ 现代化的 API
getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => sawait getAddress()),
```

