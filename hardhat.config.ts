import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

const config: HardhatUserConfig = {
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
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic: "concert load couple harbor equip island argue ramp clarify fence smart topic",
        count: 20,
      },
    },
    localhost: {
      url: "http://localhost:8545",
    },
  },
  paths: {
    sources: "./contracts/test-utils/src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 100000,
  },
};

export default config; 