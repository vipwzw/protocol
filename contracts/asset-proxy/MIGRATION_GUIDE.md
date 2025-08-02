# 现代化测试迁移指南

基于 `asset-proxy` 模块的成功现代化经验，本指南提供了将旧式测试代码迁移到 Hardhat + ethers v6 + TypeChain 的最佳实践。

## 🎯 迁移概览

### 核心目标
- 从 `@0x/test-utils` 迁移到现代 Hardhat 生态
- 从 `BigNumber` 迁移到原生 `BigInt`
- 从旧式部署模式迁移到现代工厂模式
- 统一使用现代 Chai 断言

### 成功案例
- ✅ **57个测试通过** (asset-proxy 模块)
- ✅ **5个桥接测试** 全部修复
- ✅ **27个代理测试** 全部通过

## 📋 迁移清单

### 1. 基础设施配置

#### 创建 `hardhat.config.ts`
```typescript
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@typechain/hardhat';
import '@typechain/ethers-v6';

const config: HardhatUserConfig = {
    solidity: {
        version: '0.8.28',
        settings: {
            optimizer: { enabled: true, runs: 1000000 },
            evmVersion: 'shanghai',
        },
    },
    networks: {
        hardhat: {
            chainId: 1337,
            accounts: {
                mnemonic: 'concert load couple harbor equip island argue ramp clarify fence smart topic',
                count: 20,
            },
        },
    },
    typechain: {
        outDir: 'src/typechain-types',
        target: 'ethers-v6',
        alwaysGenerateOverloads: false,
        discriminateTypes: true,
    },
    mocha: { timeout: 60000 },
};

export default config;
```

#### 更新 `global_hooks.ts`
```typescript
// 删除 ethereum-waffle 导入
// import { solidity } from 'ethereum-waffle';
// chai.use(solidity);

// Hardhat chai matchers 通过 hardhat.config.ts 自动加载
before('setup test environment', () => {
    console.log('✅ Test environment setup with modern chai matchers');
});
```

### 2. 导入替换模式

#### 替换 @0x/test-utils 导入
```typescript
// ❌ 旧方式
import { expect, constants, randomAddress } from '@0x/test-utils';

// ✅ 新方式  
import { expect } from 'chai';
import { ethers } from 'hardhat';

// 本地常量定义
const constants = {
    NULL_ADDRESS: ethers.ZeroAddress,
    NULL_BYTES: '0x',
    ZERO_AMOUNT: 0n,
};

const randomAddress = () => ethers.Wallet.createRandom().address;
```

#### 替换 @0x/utils 导入
```typescript
// ❌ 旧方式
import { BigNumber } from '@0x/utils';
import { AssetProxyId, RevertReason } from '@0x/utils';

// ✅ 新方式 - 本地定义
const AssetProxyId = {
    ERC20Bridge: '0xdc1600f3'
};

const RevertReason = {
    SenderNotAuthorizedError: 'only authorized',
    TransferFailed: 'transfer failed'
};
```

### 3. 合约部署现代化

#### 使用 TypeChain 工厂
```typescript
// ❌ 旧方式
import { TestBancorBridge } from './wrappers';
const testContract = await TestBancorBridge.deployFrom0xArtifactAsync(/*...*/);

// ✅ 新方式
import { TestBancorBridge__factory } from '../src/typechain-types';
const signers = await ethers.getSigners();
const deployer = signers[0];
const factory = new TestBancorBridge__factory(deployer);
const testContract = await factory.deploy();
await testContract.waitForDeployment();
```

### 4. 事务处理现代化

#### 替换旧式事务 API
```typescript
// ❌ 旧方式
await contract.someMethod().awaitTransactionSuccessAsync();
const result = await contract.someMethod();

// ✅ 新方式
const tx = await contract.someMethod();
const receipt = await tx.wait();

// 对于需要返回值的调用，使用 staticCall
const returnValue = await contract.someMethod.staticCall();
await contract.someMethod(); // 实际执行交易
```

### 5. BigNumber 到 BigInt 迁移

#### 数值操作替换
```typescript
// ❌ 旧方式
const result = amount.times(rate).div(base);
const max = TO_TOKEN_BASE.times(100);

// ✅ 新方式
const result = (amount * rate) / base;
const max = Number(TO_TOKEN_BASE * 100n);
```

### 6. 断言现代化

#### 回滚断言
```typescript
// ❌ 旧方式
expect(tx).to.eventually.be.rejectedWith(RevertReason.SomeError);

// ✅ 新方式
await expect(tx).to.be.revertedWith('SomeError');
// 或对于自定义错误
await expect(tx).to.be.revertedWithCustomError(contract, 'CustomError');
// 或简单检查回滚
await expect(tx).to.be.reverted;
```

#### 余额检查
```typescript
// ❌ 旧方式
expect(balance).to.bignumber.eq(expectedBalance);

// ✅ 新方式
expect(balance).to.equal(expectedBalance);
```

### 7. 账户管理现代化

#### 获取签名者
```typescript
// ❌ 旧方式
const [owner, user] = await web3Wrapper.getAvailableAddressesAsync();

// ✅ 新方式
const signers = await ethers.getSigners();
const [owner, user] = signers;
const ownerAddress = await owner.getAddress();
const userAddress = await user.getAddress();
```

## 🛠️ 常见问题和解决方案

### 问题 1: createToken 调用失败
```typescript
// 问题: testContract.createToken is not a function
// 解决: 使用正确的测试合约工厂

// ❌ 错误
const testContract = await BancorBridge__factory(deployer).deploy();

// ✅ 正确
const testContract = await TestBancorBridge__factory(deployer).deploy();
```

### 问题 2: BigNumber 方法调用失败
```typescript
// 问题: TO_TOKEN_BASE.times is not a function
// 解决: 迁移到 BigInt

// ❌ 错误
const amount = getRandomInteger(1, TO_TOKEN_BASE.times(100));

// ✅ 正确
const amount = getRandomInteger(1, Number(TO_TOKEN_BASE * 100n));
```

### 问题 3: 授权错误断言失败
```typescript
// 问题: Expected transaction to be reverted with reason 'SenderNotAuthorizedError', but it didn't revert
// 解决: 确保使用正确的签名者

// ✅ 正确的授权测试
async function transferFromAsync(opts, caller) {
    let contractToUse = assetProxy;
    if (caller && caller !== owner) {
        const signers = await ethers.getSigners();
        const callerSigner = signers.find(s => s.address.toLowerCase() === caller.toLowerCase());
        if (callerSigner) {
            contractToUse = assetProxy.connect(callerSigner);
        }
    }
    return await contractToUse.transferFrom(/*...*/);
}
```

## 📁 文件结构示例

```
contracts/your-module/
├── hardhat.config.ts           # Hardhat 配置
├── src/
│   ├── typechain-types/        # TypeChain 生成的类型
│   └── artifacts.ts           # 工件导出
├── test/
│   ├── global_hooks.ts        # 全局测试设置
│   ├── utils/
│   │   └── deployment_utils.ts # 现代部署工具
│   └── *.test.ts             # 测试文件
└── contracts/
    ├── src/                  # 合约源码
    └── test/                 # 测试合约
```

## ✅ 验证清单

迁移完成后，确保：

- [ ] 所有测试文件导入了现代依赖
- [ ] 使用 TypeChain 工厂进行合约部署
- [ ] 所有 `BigNumber` 操作替换为 `BigInt`
- [ ] 事务使用 `.wait()` 而不是 `awaitTransactionSuccessAsync()`
- [ ] 断言使用现代 Hardhat Chai matchers
- [ ] `yarn test:hardhat` 成功运行
- [ ] TypeChain 类型生成正常

## 🎯 成功指标

- **编译**: `yarn build` 成功
- **类型检查**: TypeScript 无错误
- **测试**: 核心功能测试通过
- **性能**: 测试运行时间合理 (< 60s)

---

*基于 asset-proxy 模块的实际迁移经验编写*