import { ethers } from 'ethers';
import * as fs from 'fs';

import { constants } from './constants';
import { env, EnvVars } from './env';

export interface Web3Config {
    total_accounts?: number; // default: 10
    shouldUseInProcessGanache?: boolean; // default: false
    shouldThrowErrorsOnGanacheRPCResponse?: boolean; // default: true
    rpcUrl?: string; // default: localhost:8545
    ganacheDatabasePath?: string; // default: undefined, creates a tmp dir
    shouldAllowUnlimitedContractSize?: boolean;
    fork?: string;
    blockTime?: number;
    locked?: boolean;
    unlocked_accounts?: string[];
    gasLimit?: string;
    gasPrice?: string;
    hardfork?: string;
    accounts?: string[];
}

export const web3Factory = {
    getRpcProvider(config: Web3Config = {}): ethers.JsonRpcProvider {
        const rpcUrl = config.rpcUrl || 'http://localhost:8545';
        
        // Return a JSON RPC provider for the given URL
        return new ethers.JsonRpcProvider(rpcUrl);
    },

    getHardhatProvider(): ethers.JsonRpcProvider {
        // Fallback to localhost for Hardhat
        return new ethers.JsonRpcProvider('http://localhost:8545');
    },

    // Legacy method for compatibility
    getProvider(config: Web3Config = {}): ethers.JsonRpcProvider {
        return this.getRpcProvider(config);
    }
};