# 🚀 通用合约日志解析工具使用指南

## 概述

为了解决 ethers.js v6 中合约日志解析的兼容性问题，我们创建了一套通用的日志解析工具。这些工具可以在所有桥测试中使用，统一处理事件日志的解析和验证。

## 核心功能

### 1. 基础日志解析函数

#### `parseContractLogs(contract, receipt)`
解析交易回执中的所有日志，自动使用合约接口进行解析。

```typescript
const receipt = await tx.wait();
const logs = await parseContractLogs(testContract, receipt);
```

#### `getBlockTimestamp(blockNumber)`
获取指定区块的准确时间戳。

```typescript
const blockTime = await getBlockTimestamp(receipt.blockNumber);
```

### 2. 高级解析函数

#### `parseTransactionResult(contract, txPromise)`
一步完成交易执行、日志解析和时间戳获取。

```typescript
const result = await parseTransactionResult(
    testContract,
    testContract.bridgeTransferFrom(...)
);
// result 包含: { logs, blockTime, receipt }
```

#### `executeAndParse(contract, methodCall)`
更简洁的语法，用于执行合约方法并解析结果。

```typescript
const result = await executeAndParse(testContract, () => 
    testContract.bridgeTransferFrom(...)
);
```

## 使用示例

### 传统方式 vs 通用化方式

#### ❌ 传统方式（容易出错）
```typescript
async function withdrawToAsync(opts) {
    const tx = await testContract.bridgeTransferFrom(...);
    const receipt = await tx.wait();
    
    // 手动解析日志 - 容易出错
    const decodedLogs = [];
    for (const log of receipt.logs) {
        try {
            const parsed = testContract.interface.parseLog(log);
            if (parsed) {
                decodedLogs.push({
                    event: parsed.name,
                    args: parsed.args,
                    // ... 更多手动映射
                });
            }
        } catch (e) {
            continue;
        }
    }
    
    // 手动获取时间戳
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const blockTime = block ? block.timestamp : Date.now();
    
    return { logs: decodedLogs, blockTime };
}
```

#### ✅ 通用化方式（简洁可靠）
```typescript
import { parseContractLogs, getBlockTimestamp } from './utils/bridge_event_helpers';

async function withdrawToAsync(opts) {
    const tx = await testContract.bridgeTransferFrom(...);
    const receipt = await tx.wait();
    
    // 使用通用工具 - 简洁可靠
    const logs = await parseContractLogs(testContract, receipt);
    const blockTime = await getBlockTimestamp(receipt.blockNumber);
    
    return { logs, blockTime };
}

// 或者更简洁的方式
async function withdrawToAsyncV2(opts) {
    const result = await executeAndParse(testContract, () =>
        testContract.bridgeTransferFrom(...)
    );
    return result; // 已包含 logs, blockTime, receipt
}
```

## 事件验证兼容性

通用解析工具生成的日志数据兼容现有的验证函数：

```typescript
// 这些验证函数无需修改，直接使用
verifyTokenTransfer(logs, { token, from, to, amount });
verifyTokenApprove(logs, { spender, allowance });
verifyEvent(logs, 'CustomEvent', (event) => {
    expect(event.param1).to.equal(expectedValue);
    expect(event.param2).to.equal(expectedValue2);
});
```

## 在其他桥测试中的应用

### 1. DydxBridge 示例
```typescript
// test/dydx_bridge.ts
import { parseContractLogs, getBlockTimestamp } from './utils/bridge_event_helpers';

async function executeBridgeCall(opts) {
    const tx = await testContract.bridgeTransferFrom(...);
    const receipt = await tx.wait();
    
    const logs = await parseContractLogs(testContract, receipt);
    const blockTime = await getBlockTimestamp(receipt.blockNumber);
    
    return { logs, blockTime, opts };
}
```

### 2. KyberBridge 示例
```typescript
// test/kyber_bridge.ts
import { executeAndParse } from './utils/bridge_event_helpers';

it('should execute bridge call', async () => {
    const result = await executeAndParse(testContract, () =>
        testContract.bridgeTransferFrom(tokenA, tokenB, amount, data)
    );
    
    // 直接使用解析好的日志进行验证
    verifyTokenApprove(result.logs, { spender: exchangeAddress });
});
```

## 优势

### 🎯 一致性
- 所有桥测试使用相同的日志解析逻辑
- 统一的事件数据结构
- 减少跨测试的不一致性

### 🛡️ 可靠性
- 自动处理解析失败的情况
- 兼容 ethers.js v6 的新特性
- 正确处理时间戳获取

### 🔧 易维护性
- 集中式的解析逻辑，易于更新
- 减少重复代码
- 统一的错误处理

### 🚀 高效性
- 自动展开事件参数，支持 `event.param` 和 `event.args.param` 两种访问方式
- 批量处理多个交易日志
- 异步优化的时间戳获取

## 迁移步骤

1. **导入工具函数**
   ```typescript
   import { parseContractLogs, getBlockTimestamp } from './utils/bridge_event_helpers';
   ```

2. **替换日志解析逻辑**
   - 将手动的 `interface.parseLog()` 循环替换为 `parseContractLogs()`
   - 将手动的时间戳获取替换为 `getBlockTimestamp()`

3. **验证兼容性**
   - 运行现有测试确保验证函数正常工作
   - 现有的 `verifyTokenTransfer` 等函数无需修改

4. **可选：使用高级函数**
   - 考虑使用 `executeAndParse()` 进一步简化代码

## 注意事项

- 通用工具会自动跳过无法解析的日志（如其他合约的事件）
- 时间戳获取失败时会回退到当前时间
- 事件参数同时支持 `event.param` 和 `event.args.param` 访问方式
- 所有函数都是异步的，需要使用 `await`

## 总结

通用合约日志解析工具解决了 ethers.js v6 兼容性问题，为所有桥测试提供了统一、可靠的日志处理方案。通过使用这些工具，可以显著减少重复代码，提高测试的可维护性和可靠性。