import { HardhatUserConfig } from 'hardhat/config';
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';

const config: HardhatUserConfig = {
    solidity: '0.8.28',
    paths: {
        artifacts: './artifacts',
    },
    typechain: {
        outDir: 'src/typechain-types',
        target: 'ethers-v6',
        alwaysGenerateOverloads: false,
    },
};

export default config;
