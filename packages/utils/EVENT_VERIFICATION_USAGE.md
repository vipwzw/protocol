# 事件验证工具使用指南

`@0x/utils` 包提供了通用的事件验证工具，可以在所有测试中使用。

## 可用函数

### 1. `verifyEventFromReceipt`

验证交易收据中的特定事件。

```typescript
import { verifyEventFromReceipt } from '@0x/utils';

// 使用示例
const tx = await contract.someMethod();
const receipt = await tx.wait();

verifyEventFromReceipt(
    receipt, 
    [{ maker: '0x123...', nonce: 42n }], // 预期事件参数
    'SomeEventName', // 事件名称
    contract // 合约实例
);
```

### 2. `verifyEventEmitted`

简单验证事件是否被触发。

```typescript
import { verifyEventEmitted } from '@0x/utils';

// 使用示例
const tx = await contract.someMethod();
const receipt = await tx.wait();

const events = verifyEventEmitted(
    receipt,
    'SomeEventName', // 事件名称
    contract, // 合约实例
    1 // 预期事件数量（可选，默认为1）
);
```

### 3. `verifyEventsFromLogs`（原版本）

用于向后兼容的事件验证函数。

```typescript
import { verifyEventsFromLogs } from '@0x/utils';

// 使用示例
await verifyEventsFromLogs(
    receipt.logs,
    [{ event: 'SomeEventName', args: { param1: 'value1' } }],
    contract.interface
);
```

## 完整示例

```typescript
import { ethers } from "hardhat";
import { expect } from "chai";
import { verifyEventFromReceipt } from '@0x/utils';

describe('MyContract', () => {
    let contract: any;
    
    before(async () => {
        const factory = await ethers.getContractFactory('MyContract');
        contract = await factory.deploy();
    });
    
    it('should emit correct event', async () => {
        const tx = await contract.doSomething(42);
        const receipt = await tx.wait();
        
        // 验证事件
        verifyEventFromReceipt(
            receipt,
            [{ value: 42n }], // 预期参数
            'SomethingDone', // 事件名称
            contract
        );
    });
});
```

## 注意事项

1. **BigInt 支持**: 函数自动处理 BigInt 类型的比较
2. **类型安全**: 使用 TypeScript 类型检查确保参数正确
3. **错误处理**: 提供清晰的错误信息帮助调试
4. **向后兼容**: 保留原有的 `verifyEventsFromLogs` 函数

## 迁移指南

如果你之前使用本地的事件验证函数，可以这样迁移：

```typescript
// 旧方式
function verifyEventsFromLogs(receipt, expectedEvents, eventName, contract) {
    // 本地实现...
}

// 新方式
import { verifyEventFromReceipt } from '@0x/utils';

// 直接替换调用
verifyEventFromReceipt(receipt, expectedEvents, eventName, contract);
```
