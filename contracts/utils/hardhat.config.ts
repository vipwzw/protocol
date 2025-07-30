import { HardhatUserConfig } from 'hardhat/config';
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-chai-matchers';
const config: HardhatUserConfig = {
    solidity: '0.8.28',
    typechain: {
        outDir: 'test/typechain-types',
        target: 'ethers-v6',
        alwaysGenerateOverloads: false,
        externalArtifacts: ['artifacts/**/*.json', '!artifacts/**/*.dbg.json', '!artifacts/**/build-info/**'],
        dontOverrideCompile: true,
    },
};

export default config;
