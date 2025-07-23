import { Web3Wrapper } from '@0x/web3-wrapper';

// Simple web3 factory for testing
export const web3Factory = {
    getRpcProvider(): any {
        // Return a mock provider for testing
        return {
            send: async (method: string, params: any[]): Promise<any> => {
                switch (method) {
                    case 'eth_accounts':
                        return ['0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266']; // Test account
                    case 'eth_chainId':
                        return '0x1'; // Mainnet chain ID
                    case 'net_version':
                        return '1';
                    case 'eth_sign':
                        // Return a mock signature for testing
                        return '0xc1ea77c46d7aabf3f68f29870bc61eb583f9acb25af5a953ce2bff341b4c456a66133126ef3058ec52081f9e3dd77103980483f3ab20d0529b14e4b194e7d12d1b';
                    case 'personal_sign':
                        return '0xc1ea77c46d7aabf3f68f29870bc61eb583f9acb25af5a953ce2bff341b4c456a66133126ef3058ec52081f9e3dd77103980483f3ab20d0529b14e4b194e7d12d1b';
                    default:
                        return null;
                }
            },
            sendAsync: (payload: any, callback: (error: any, result: any) => void): void => {
                let result = null;
                switch (payload.method) {
                    case 'eth_accounts':
                        result = ['0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'];
                        break;
                    case 'eth_chainId':
                        result = '0x1';
                        break;
                    case 'net_version':
                        result = '1';
                        break;
                    case 'eth_sign':
                    case 'personal_sign':
                        result = '0xc1ea77c46d7aabf3f68f29870bc61eb583f9acb25af5a953ce2bff341b4c456a66133126ef3058ec52081f9e3dd77103980483f3ab20d0529b14e4b194e7d12d1b';
                        break;
                }
                callback(null, { jsonrpc: '2.0', id: payload.id, result });
            },
        };
    }
};

export { Web3Wrapper }; 