# TypeChain Migration Guide

This document outlines the migration from `@0x/abi-gen` to **TypeChain** with ethers v6 and native bigint support.

## 🎯 Migration Summary

| Feature | Before (@0x/abi-gen) | After (TypeChain) |
|---------|---------------------|-------------------|
| **Type Generator** | `@0x/abi-gen` | `TypeChain` |
| **Ethers Version** | v4 | v6 |
| **Numeric Types** | `BigNumber` | `bigint` (native) |
| **Type Safety** | Basic | Enhanced |
| **Contract Factories** | Manual wrappers | Auto-generated factories |

## 📦 What Changed

### 1. Package Dependencies

**Removed:**
```json
{
  "@0x/abi-gen": "removed",
  "ethers": "~4.0.4"
}
```

**Added:**
```json
{
  "typechain": "^8.3.2",
  "@typechain/hardhat": "^9.1.0", 
  "@typechain/ethers-v6": "^0.5.1",
  "ethers": "^6.0.0"
}
```

### 2. Generated Code Structure

**Before:**
```
src/generated-wrappers/
├── erc20_token.ts
├── staking.ts
└── ...
```

**After:**
```
src/typechain-types/
├── IERC20Token.ts
├── IZeroEx.ts
├── factories/
│   ├── IERC20Token__factory.ts
│   └── IZeroEx__factory.ts
└── index.ts
```

### 3. Contract Usage

**Before (BigNumber):**
```typescript
import { ERC20TokenContract } from '@0x/contract-wrappers';
import { BigNumber } from '@0x/utils';

const contract = new ERC20TokenContract(address, provider);
const balance: BigNumber = await contract.balanceOf.callAsync(userAddress);
const amount = new BigNumber('1000000000000000000');

// Format with ethers v4
const formatted = ethers.utils.formatEther(balance.toString());
```

**After (bigint):**
```typescript
import { IERC20Token__factory } from '@0x/contract-wrappers';

const contract = IERC20Token__factory.connect(address, provider);
const balance: bigint = await contract.balanceOf(userAddress);
const amount = 1000000000000000000n; // Native bigint literal

// Format with ethers v6
const formatted = ethers.formatEther(balance);
```

### 4. Event Handling

**Before:**
```typescript
const filter = contract.Transfer();
contract.subscribe(filter, (log) => {
  const args = log.args;
  const value: BigNumber = args._value;
});
```

**After:**
```typescript
const filter = contract.filters.Transfer();
const events = await contract.queryFilter(filter);

contract.on('Transfer', (from, to, value: bigint) => {
  console.log(`Transfer: ${ethers.formatEther(value)} tokens`);
});
```

## 🚀 Key Benefits

### 1. Native bigint Support
- No more BigNumber conversions
- Smaller bundle size  
- Better performance
- ES2020 standard compliance

### 2. Enhanced Type Safety
```typescript
// TypeChain provides stricter typing
const result: bigint = await contract.totalSupply(); // ✅ Type-safe
const wrong: string = await contract.totalSupply(); // ❌ Compile error
```

### 3. Modern Contract Interaction
```typescript
// Auto-completion and IntelliSense
const contract = IERC20Token__factory.connect(address, provider);
contract. // Full IDE support with all methods
```

### 4. Simplified Event Filtering
```typescript
// Type-safe event filters
const filter = contract.filters.Transfer(
  fromAddress,    // indexed parameter
  toAddress,      // indexed parameter  
  null           // non-indexed (any value)
);
```

## ⚡ Performance Improvements

| Metric | BigNumber | bigint | Improvement |
|--------|-----------|--------|-------------|
| **Bundle Size** | +50KB | Native | 📉 Smaller |
| **Runtime Speed** | Slower | Native | 🚀 Faster |
| **Memory Usage** | Higher | Lower | 💾 Efficient |

## 🔧 Breaking Changes

### Contract Instantiation
```typescript
// OLD
const contract = new ERC20TokenContract(address, provider);

// NEW  
const contract = IERC20Token__factory.connect(address, provider);
```

### Method Calls
```typescript
// OLD
const balance = await contract.balanceOf.callAsync(address);

// NEW
const balance = await contract.balanceOf(address);
```

### Event Subscriptions
```typescript
// OLD
contract.subscribe(contract.Transfer(), callback);

// NEW
contract.on('Transfer', callback);
```

## 📝 Migration Checklist

- [ ] Update imports from `generated-wrappers` to `typechain-types`
- [ ] Replace `BigNumber` with `bigint`
- [ ] Update contract instantiation to use factories
- [ ] Migrate event handling to new API
- [ ] Update ethers utility calls (v4 → v6)
- [ ] Test all contract interactions
- [ ] Update documentation and examples

## 🎉 Next Steps

1. **Update your imports**
2. **Replace BigNumber with bigint**
3. **Use factory pattern for contracts**
4. **Enjoy modern TypeScript experience!**

The migration unlocks modern JavaScript features while maintaining full 0x protocol compatibility. 