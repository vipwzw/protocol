require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
      evmVersion: "cancun",
    },
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
  paths: {
    sources: "./src",
    tests: "./lib/test",
    cache: "./cache/hardhat",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 100000,
  },
}; 