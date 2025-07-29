import { JsonRpcProvider } from 'ethers';

// Hardhat node configuration  
const HARDHAT_URL = 'http://localhost:8545';

// Test account from hardhat default mnemonic
const TEST_ADDRESS = '0x5409ED021D9299bf6814279A6A1411A7e866A631';
const TEST_PRIVATE_KEY = '0xf2f48ee19680706196e2e339e5da3491186e0c4c5030670656b0e0164837257d';

// Simple web3 factory for testing
export const web3Factory = {
    getRpcProvider(): any {
        // Connect to local Hardhat node
        const provider = new JsonRpcProvider(HARDHAT_URL);
        
        // Create a Web3 provider compatible object
        return {
            send: async (method: string, params: any[]): Promise<any> => {
                return await provider.send(method, params);
            },
            sendAsync: (payload: any, callback: (error: any, result: any) => void): void => {
                provider.send(payload.method, payload.params || [])
                    .then((result: any) => {
                        callback(null, { jsonrpc: '2.0', id: payload.id, result });
                    })
                    .catch((error: any) => {
                        callback(error, null);
                    });
            },
        };
    }
};

// Web3Wrapper removed - using ethers.js directly 