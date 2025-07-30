import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@typechain/hardhat';

const config: HardhatUserConfig = {
    solidity: {
        version: '0.8.28',
        settings: {
            optimizer: {
                enabled: true,
                runs: 1000000,
            },
            evmVersion: 'cancun',
        },
    },
    networks: {
        hardhat: {
            chainId: 1337,
            accounts: {
                mnemonic: 'concert load couple harbor equip island argue ramp clarify fence smart topic',
                count: 20,
            },
        },
        localhost: {
            url: 'http://localhost:8545',
        },
    },
    paths: {
        sources: './src',
        tests: './test',
        cache: './cache/hardhat',
        artifacts: './artifacts',
    },
    typechain: {
        outDir: 'typechain-types',
        target: 'ethers-v6',
        alwaysGenerateOverloads: false,
    },
    mocha: {
        timeout: 100000,
    },
};

export default config;
