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
      remappings: [
        "@0x/contracts-erc20/=../erc20/",
        "@0x/contracts-utils/=../utils/contracts/",
      ],
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
    sources: "./contracts/src",
    tests: "./lib/test",
    cache: "./cache/hardhat",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 100000,
  },
}; 