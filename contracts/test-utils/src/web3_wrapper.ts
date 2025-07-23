import { Web3Wrapper } from '@0x/web3-wrapper';
const { ethers } = require('hardhat');
import * as _ from 'lodash';

import { constants } from './constants';

export const txDefaults = {
    from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Hardhat default first account
    gas: 10000000,
    gasPrice: constants.DEFAULT_GAS_PRICE,
};

// Use Hardhat's provider directly
const provider = ethers.provider;
const web3Wrapper = new Web3Wrapper(provider as any);

export { provider, web3Wrapper };
