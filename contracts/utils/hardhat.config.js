require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");

const path = require("path");

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
      evmVersion: "cancun",
    },
  },
  paths: {
    sources: "./contracts/src",
    tests: "./test",
    cache: "./cache/hardhat",
    artifacts: "./artifacts",
    root: path.join(__dirname, "."),
  },
  // Hardhat 原生支持 import remapping - 避免符号链接！
  importRemappings: {
    "@0x/contracts-erc20/": "../erc20/",
    "@0x/contracts-governance/": "../governance/",
  },
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic: "concert load couple harbor equip island argue ramp clarify fence smart topic",
      },
    },
    localhost: {
      url: "http://localhost:8545",
    },
  },
  mocha: {
    timeout: 100000,
  },
}; 