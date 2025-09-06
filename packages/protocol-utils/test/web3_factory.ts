import { ethers } from 'hardhat';

// Test account from hardhat config
const TEST_ADDRESS = '0x5409ED021D9299bf6814279A6A1411A7e866A631';
const TEST_PRIVATE_KEY = '0xf2f48ee19680706196e2e339e5da3491186e0c4c5030670656b0e0164837257d';

// Simple web3 factory for testing using Hardhat's built-in provider
export const web3Factory = {
    getRpcProvider(): any {
        // Use Hardhat's built-in provider instead of external connection
        const provider = ethers.provider;
        
        // Create a Web3 provider compatible object with getSigner support
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
            // 添加 getSigner 方法来支持签名功能
            getSigner: async (address: string) => {
                // 对于测试地址，返回对应的 signer
                const signers = await ethers.getSigners();
                const targetSigner = signers.find(s => s.address.toLowerCase() === address.toLowerCase());
                if (targetSigner) {
                    return targetSigner;
                }
                // 如果没找到，尝试使用第一个 signer
                return signers[0];
            },
        };
    }
};

// Web3Wrapper removed - using ethers.js directly 