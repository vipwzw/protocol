import { expect } from 'chai';
import { ethers } from 'hardhat';
import { artifacts } from './artifacts';
import { TestStorageLayoutAndConstantsContract } from './wrappers';

describe('Storage Layout and Deployment Constants Regression Tests', () => {
    it('Should successfully deploy the staking contract after running the layout and regression test', async () => {
        const { ethers } = require('hardhat');
        const txDefaults = { from: (await ethers.getSigners())[0].address };
        
        await TestStorageLayoutAndConstantsContract.deployFrom0xArtifactAsync(
            artifacts.TestStorageLayoutAndConstants,
            ethers.provider,
            txDefaults,
            artifacts,
        );
    });
});
