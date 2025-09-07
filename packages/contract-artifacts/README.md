## @0x/contract-artifacts

Smart contract compilation artifacts for the latest version of the 0x Protocol in **native Hardhat format**. These artifacts are **directly compatible** with **TypeChain** and **ethers v6** with native **bigint** support.

## 🎯 **Key Features**

- **Zero Conversion**: Direct use of Hardhat's native artifacts format
- **TypeChain Ready**: 100% compatible with `@typechain/ethers-v6`
- **Native BigInt**: Full support for JavaScript's native `bigint` type
- **Ethers v6**: Compatible with the latest ethers.js version
- **Minimal**: Only essential properties, optimized bundle size

## Installation

```bash
yarn add @0x/contract-artifacts
```

## Usage

**Basic Import**

```typescript
import * as artifacts from '@0x/contract-artifacts';

// Access any contract artifact
console.log(artifacts.IERC20Token.abi);
console.log(artifacts.IZeroEx.contractName);
```

**TypeChain Integration**

```typescript
import { IERC20Token__factory } from '@0x/contract-wrappers';
import { ethers } from 'ethers';
import * as artifacts from '@0x/contract-artifacts';

const provider = new ethers.JsonRpcProvider('...');

// Use artifact with TypeChain factory
const tokenContract = IERC20Token__factory.connect(
    '0x...', // contract address
    provider
);

// All methods return native bigint
const balance: bigint = await tokenContract.balanceOf('0x...');
```

## Artifact Format

These artifacts are in **Hardhat's standard format** - no conversion needed!

```json
{
  "_format": "hh-sol-artifact-1",
  "contractName": "IERC20Token",
  "sourceName": "@0x/contracts-erc20/src/IERC20Token.sol",
  "abi": [...],
  "bytecode": "0x608060405234801561001057600080fd5b50...",
  "deployedBytecode": "0x608060405234801561001057600080fd5b50...",
  "linkReferences": {},
  "deployedLinkReferences": {}
}
```

## Why Native Hardhat Format?

| Aspect | Old (abi-gen format) | **New (Hardhat native)** |
|--------|---------------------|---------------------------|
| **Conversion** | Required transformation | ✅ **None needed** |
| **TypeChain** | Required adaptation | ✅ **Direct compatibility** |
| **Bundle Size** | Larger (custom schema) | ✅ **Optimized** |
| **Maintenance** | Complex pipeline | ✅ **Simple copy** |
| **BigInt** | Manual conversion | ✅ **Native support** |

## Development

### Build Process

```bash
# Copy artifacts from contracts
yarn artifacts_copy

# Build with copied artifacts  
yarn artifacts_update
```

### Deployment Workflow

1. **Compile contracts**: Run `hardhat compile` in contract packages
2. **Update artifacts**: `yarn artifacts_update` 
3. **Regenerate types**: `cd ../contract-wrappers && yarn rebuild`

That's it! No transformation steps needed.

### Adding New Contracts

Edit `scripts/copy-artifacts.js` and add the contract name to `artifactsToPublish`:

```javascript
const artifactsToPublish = [
    // ... existing contracts ...
    'YourNewContract',  // Add here
];
```

## Migration Guide

If upgrading from abi-gen format:

**Before (abi-gen format):**
```typescript
// Old format
artifact.compilerOutput.abi
artifact.compilerOutput.evm.bytecode.object
artifact.schemaVersion
```

**After (Hardhat native):**
```typescript
// New format - much simpler!
artifact.abi
artifact.bytecode  
artifact._format
```

**TypeChain Usage:**
```typescript
// Works directly with TypeChain factories
const contract = ContractFactory.connect(address, provider);
const result: bigint = await contract.someMethod(); // Native bigint!
```

## Contributing

We welcome improvements and fixes from the wider community! To report bugs within this package, please create an issue in this repository.

Please read our [contribution guidelines](../../.github/CONTRIBUTING.md) before getting started.

### Install dependencies

```bash
yarn install
```

### Build

```bash
PKG=@0x/contract-artifacts yarn build
```

### Test

```bash
yarn test
```
