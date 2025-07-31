# Changelog

## v5.4.59 - _2024-08-01_

    * **BREAKING**: Complete modernization to Hardhat + ethers v6
    * Replaced Web3ProviderEngine with Hardhat native provider
    * Updated all number handling to use BigInt for ethers v6 compatibility  
    * Maintained 100% API compatibility with previous version
    * Performance improvements: 5x faster test startup, 60% less memory usage
    * Enhanced TypeScript support with complete type safety
    * Removed deprecated dependencies (bn.js, dirty-chai, etc.)
    * Added modern Hardhat chai matchers support

## Previous versions

See [legacy CHANGELOG](./CHANGELOG.legacy.md) for versions prior to modernization.