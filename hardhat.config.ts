import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@typechain/hardhat';
import '@typechain/ethers-v6';

// Extend HardhatUserConfig to include typechain
declare module 'hardhat/config' {
    interface HardhatUserConfig {
        typechain?: {
            outDir?: string;
            target?: string;
            alwaysGenerateOverloads?: boolean;
            discriminateTypes?: boolean;
        };
    }
}

const config: HardhatUserConfig = {
    solidity: {
        version: '0.8.28',
        settings: {
            optimizer: {
                enabled: true,
                runs: 1000000,
            },
            evmVersion: 'shanghai',
        },
    },
    networks: {
        hardhat: {
            chainId: 1337,
            accounts: {
                mnemonic: 'concert load couple harbor equip island argue ramp clarify fence smart topic',
                count: 20,
            },
            // ⭐ 支持 test-main 兼容的低 gas 设置
            gasPrice: 1337, // 设置默认 gas 价格
            initialBaseFeePerGas: 0, // 禁用 EIP-1559 基础费用，允许低 gasPrice
            blockGasLimit: 30000000, // 增加区块 gas 限制
        },
        localhost: {
            url: 'http://localhost:8545',
        },
    },
    paths: {
        sources: './contracts',
        tests: './test',
        cache: './cache/hardhat',
        artifacts: './artifacts',
    },
    typechain: {
        outDir: 'src/typechain-types',
        target: 'ethers-v6',
        alwaysGenerateOverloads: false,
        discriminateTypes: true,
    },
    mocha: {
        timeout: 100000,
    },
};

export default config;