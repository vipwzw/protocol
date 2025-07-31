import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

const config: HardhatUserConfig = {
  paths: {
    sources: "./src", // 虽然没有.sol文件，但指向src目录
    tests: "./test",
    cache: "./cache/hardhat", // 避免冲突
    artifacts: "./.artifacts", // 使用不同的目录避免被清理
  },
  solidity: {
    version: "0.8.28", // 使用项目标准的Solidity版本
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
        accountsBalance: "10000000000000000000000", // 10000 ETH
      },
      loggingEnabled: false,
    },
  },
  mocha: {
    timeout: 30000,
    testFiles: ['test/**/*.ts', 'test/*.ts'], // 确保能找到TypeScript测试文件
  },
};

export default config;