import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';

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
            accounts: [
                // Test private key used in protocol-utils tests
                {
                    privateKey: '0xee094b79aa0315914955f2f09be9abe541dcdc51f0aae5bec5453e9f73a471a6',
                    balance: '10000000000000000000000', // 10000 ETH
                },
                // Additional accounts from default mnemonic
                {
                    privateKey: '0xf2f48ee19680706196e2e339e5da3491186e0c4c5030670656b0e0164837257d',
                    balance: '10000000000000000000000', // 10000 ETH
                },
                {
                    privateKey: '0x5d862464fe9303452126c8bc94274b8c5f9874cbd219789b3eb2128075a76f72',
                    balance: '10000000000000000000000', // 10000 ETH
                },
            ],
        },
        localhost: {
            url: 'http://localhost:8545',
        },
    },
    paths: {
        sources: './src',
        tests: './test',
        cache: './cache',
        artifacts: './artifacts',
    },
    mocha: {
        timeout: 100000,
    },
};

export default config;
