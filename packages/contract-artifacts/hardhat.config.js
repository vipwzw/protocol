require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
  },
  paths: {
    sources: "./artifacts",
    tests: "./lib/test",
    cache: "./cache",
    artifacts: "./build",
  },
  mocha: {
    timeout: 10000,
  },
}; 