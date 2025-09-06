import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';

const config: HardhatUserConfig = {
    paths: {
        sources: './src',
        tests: './test',
        cache: './cache',
        artifacts: './artifacts',
    },
    solidity: {
        version: '0.8.28',
        settings: {
            optimizer: {
                enabled: true,
                runs: 1000000,
            },
        },
    },
    networks: {
        hardhat: {
            chainId: 1337,
            accounts: {
                mnemonic: 'test test test test test test test test test test test junk',
                count: 20,
                accountsBalance: '10000000000000000000000', // 10000 ETH
            },
            loggingEnabled: false,
        },
    },
    mocha: {
        timeout: 30000,
    },
};

export default config;
