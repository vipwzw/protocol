import { ethers } from 'ethers';
const hardhat = require('hardhat');
import * as _ from 'lodash';

import { constants } from './constants';

export const txDefaults = {
    from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Hardhat default first account
    gas: 10000000,
    gasPrice: constants.DEFAULT_GAS_PRICE,
};

// Use Hardhat's provider with ethers
const provider = new ethers.BrowserProvider(hardhat.network.provider);

// Create a simple wrapper object for backward compatibility
const web3Wrapper = {
    async getNodeTypeAsync() {
        // Simplified node type detection
        try {
            const version = await provider.send('web3_clientVersion', []);
            if (version.includes('Hardhat')) {
                return 'Ganache'; // Treat Hardhat as Ganache for compatibility
            }
            return 'Geth';
        } catch {
            return 'Ganache'; // Default fallback
        }
    },
    
    async awaitTransactionMinedAsync(txHash: string) {
        return await provider.getTransactionReceipt(txHash);
    },
    
    async awaitTransactionSuccessAsync(txHash: string) {
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            throw new Error('Transaction receipt not found');
        }
        return receipt;
    },
    
    async getAvailableAddressesAsync() {
        const accounts = await provider.send('eth_accounts', []);
        return accounts;
    },
    
    async increaseTimeAsync(seconds: number) {
        await provider.send('evm_increaseTime', [seconds]);
        await provider.send('evm_mine', []);
        return seconds;
    },
    
    async sendTransactionAsync(txData: any) {
        const signer = await provider.getSigner(0);
        const tx = await signer.sendTransaction(txData);
        return tx.hash;
    },
    
    async getBlockIfExistsAsync(blockIdentifier: string | number) {
        try {
            return await provider.getBlock(blockIdentifier);
        } catch {
            return null;
        }
    },
    
    getProvider() {
        return hardhat.network.provider;
    }
};

export { provider, web3Wrapper };
