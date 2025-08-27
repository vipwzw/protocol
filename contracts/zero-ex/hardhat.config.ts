import { HardhatUserConfig } from 'hardhat/config';
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';

const config: HardhatUserConfig = {
    solidity: {
        version: '0.8.28',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            evmVersion: 'cancun',
        },
    },
    networks: {
        hardhat: {
            initialBaseFeePerGas: 0, // 设置 base fee 为 0 以支持 gasPrice: 0
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
    },
};

export default config;
