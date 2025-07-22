import { Web3Wrapper } from '@0x/web3-wrapper';
import * as _ from 'lodash';

import { constants } from './constants';

export const txDefaults = {
    from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Hardhat default first account
    gas: 10000000,
    gasPrice: constants.DEFAULT_GAS_PRICE,
};

// Create a provider that will be injected by Hardhat
let provider: any;
let web3Wrapper: Web3Wrapper;

// Check if we're running under Hardhat
if (typeof (global as any).network !== 'undefined') {
    // We're in Hardhat environment
    provider = (global as any).network.provider;
    web3Wrapper = new Web3Wrapper(provider);
} else {
    // Create a mock provider for non-test environments
    provider = createMockProvider();
    web3Wrapper = new Web3Wrapper(provider);
}

export { provider, web3Wrapper };

// Create a mock provider for non-test environments
function createMockProvider(): any {
    return {
        addProvider: _.noop,
        on: _.noop,
        send: (_method: string, _params: any[]): Promise<any> => {
            return Promise.resolve(null);
        },
        sendAsync: (payload: any, callback: (error: any, result: any) => void): void => {
            callback(null, { jsonrpc: '2.0', id: payload.id, result: null });
        },
        start: _.noop,
        stop: _.noop,
    };
}
