import { Web3Wrapper } from '@0x/web3-wrapper';

// Simple web3 factory for testing
export const web3Factory = {
    getRpcProvider(): any {
        // Return a mock provider for testing
        return {
            send: async (method: string, params: any[]): Promise<any> => {
                return null;
            },
            sendAsync: (payload: any, callback: (error: any, result: any) => void): void => {
                callback(null, { jsonrpc: '2.0', id: payload.id, result: null });
            },
        };
    }
};

export { Web3Wrapper }; 