import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@typechain/hardhat';
import '@typechain/ethers-v6';

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
        timeout: 60000,
    },
};

export default config;