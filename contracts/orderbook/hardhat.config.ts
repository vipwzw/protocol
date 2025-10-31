import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-foundry";
import * as path from "path";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.28",
        settings: {
            optimizer: {
                enabled: true,
                runs: 1_000_000,
            },
            evmVersion: "cancun",
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
    networks: {
        hardhat: {
            chainId: 1337,
            accounts: {
                count: 10,
                accountsBalance: "10000000000000000000000", // 10000 ETH
            },
        },
    },
    typechain: {
        outDir: "src/types",
        target: "ethers-v6",
    },
};

export default config;

