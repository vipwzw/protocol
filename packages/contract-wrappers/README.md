# @0x/contract-wrappers

Wrappers for 0x smart contract wrappers generated using **TypeChain** with native **ethers v6** and **bigint** support.

## 🎉 Recent Upgrade

This package has been upgraded from `@0x/abi-gen` to **TypeChain** with the following benefits:

- ✅ **Native ethers v6 support**
- ✅ **Native ES2020 bigint support** (no more BigNumber!)
- ✅ **Better TypeScript experience**
- ✅ **Automatic type generation**
- ✅ **Modern contract interaction patterns**

## Installation

```bash
yarn add @0x/contract-wrappers
```

## Usage

### Basic Usage with TypeChain

```typescript
import { ContractWrappers, IERC20Token__factory } from '@0x/contract-wrappers';
import { ethers } from 'ethers';

// Create contract wrappers instance
const contractWrappers = new ContractWrappers(provider, { chainId: 1 });

// Get ERC20 token contract with native bigint support
const tokenAddress = '0xA0b86a33E6441Cd0Ed45b3d6dC72B45f01f1b8E7'; // WETH
const tokenContract = IERC20Token__factory.connect(tokenAddress, provider);

// All numeric values are now bigint! 🎉
const balance: bigint = await tokenContract.balanceOf(userAddress);
const decimals: bigint = await tokenContract.decimals();

// No more BigNumber conversions needed
const formattedBalance = ethers.formatUnits(balance, Number(decimals));
```

### Available Contract Types

All contracts now have native bigint support:

- `IERC20Token` - ERC20 token interface
- `IEtherToken` - WETH interface  
- `WETH9` - WETH9 implementation
- `IZeroEx` - 0x Exchange Proxy
- `ZRXToken` - ZRX token

### Factory Usage

```typescript
import { WETH9__factory, IZeroEx__factory } from '@0x/contract-wrappers';

// Create contract instances directly
const weth = WETH9__factory.connect(wethAddress, provider);
const zeroEx = IZeroEx__factory.connect(exchangeProxyAddress, provider);

// All methods return bigint values
const wethBalance: bigint = await weth.balanceOf(userAddress);
```

## Migration from BigNumber

If you're migrating from the old BigNumber-based version:

```typescript
// OLD (BigNumber)
const balance = await contract.balanceOf(address);
const amount = BigNumber.from('1000000000000000000'); // 1 ETH
const formatted = ethers.utils.formatEther(balance);

// NEW (bigint) ✨
const balance: bigint = await contract.balanceOf(address);
const amount = 1000000000000000000n; // 1 ETH as bigint literal  
const formatted = ethers.formatEther(balance);
```

## Contract Wrappers API

The main `ContractWrappers` class now provides factory methods:

```typescript
const contractWrappers = new ContractWrappers(provider, config);

// Get contract instances
const weth = contractWrappers.getWETH9Contract(wethAddress);
const exchangeProxy = contractWrappers.getExchangeProxyContract(proxyAddress);
```

## TypeScript Support

Full TypeScript support with strict typing:

```typescript
// Event filtering with types
const filter = contract.filters.Transfer(fromAddress, toAddress);
const events = await contract.queryFilter(filter);

// Typed function calls
const result: bigint = await contract.allowance(owner, spender);
```

## Development

```bash
# Install dependencies
yarn install

# Generate TypeChain types
yarn typechain:generate

# Build
yarn build

# Lint
yarn lint
```
