import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import * as path from "path";

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
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache/hardhat",
    artifacts: "./artifacts",
    root: path.join(__dirname, "."),
  },
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic: "concert load couple harbor equip island argue ramp clarify fence smart topic",
        count: 20,
      },
      mining: {
        auto: true,
        interval: 0,
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

export default config; 