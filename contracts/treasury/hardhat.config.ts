import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000000,
          },
          evmVersion: "cancun",
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000000,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: 1337,
      // Use default Hardhat accounts (matches test-utils configuration)
      mining: {
        auto: true,
        interval: 0,
      },
      // Set gasPrice high enough for the current baseFeePerGas
      gasPrice: 2000000000, // 2 gwei
      initialBaseFeePerGas: 1000000000, // 1 gwei
    },
    localhost: {
      url: "http://localhost:8545",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache/hardhat",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 100000,
  },
};

export default config; 