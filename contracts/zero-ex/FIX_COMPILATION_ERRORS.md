# 🚨 编译错误修复计划

## 当前问题分析

### 主要语法错误类型：
1. **数学表达式语法错误** - 由 BigNumber 链式调用替换导致
2. **括号不匹配** - `.times().div()` 替换后的语法问题
3. **分号缺失** - Math.floor 替换导致的问题

### 需要修复的文件：
- `test/utils/orders.ts` - 多个数学表达式错误
- `test/features/erc1155_orders_test.ts` - 括号和表达式问题
- `test/features/erc721_orders_test.ts` - 类似问题

## 修复策略

### 1. 手动修复关键文件
- 先修复 `orders.ts` 中的核心问题
- 然后处理测试文件中的表达式

### 2. 标准化数学表达式
```typescript
// 错误的替换结果
fillAmount.times(order.makerAmount).div(order.takerAmount);

// 正确的替换
Math.floor(fillAmount * order.makerAmount / order.takerAmount)
```

### 3. 验证修复效果
- 每次修复后立即测试编译
- 确保不引入新的错误