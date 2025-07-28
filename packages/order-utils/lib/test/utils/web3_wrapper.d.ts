import { ethers } from 'ethers';
declare const provider: ethers.JsonRpcProvider;
declare const web3Wrapper: {
    getAccountsAsync(): Promise<string[]>;
    getAvailableAddressesAsync(): Promise<string[]>;
    signMessageAsync(address: string, message: string): Promise<string>;
    signTypedDataAsync(address: string, typedData: any): Promise<string>;
    send(method: string, params: any[]): Promise<any>;
};
export { provider, web3Wrapper };
