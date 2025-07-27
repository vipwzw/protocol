import { assert } from '@0x/assert';
import { ContractAddresses } from '@0x/contract-addresses';
import { Web3Wrapper } from '@0x/web3-wrapper';
import { SupportedProvider } from 'ethereum-types';
import { ethers } from 'ethers';

import { ContractWrappersConfigSchema } from './contract_wrappers_config_schema';
import { WETH9__factory, IZeroEx__factory } from './typechain-types/factories';
import { ContractWrappersConfig } from './types';
import { _getDefaultContractAddresses } from './utils/contract_addresses';

/**
 * The ContractWrappers class contains smart contract wrappers helpful when building on 0x protocol.
 */
export class ContractWrappers {
    /**
     * An index of the default contract addresses for this chain.
     */
    public contractAddresses: ContractAddresses;
    /**
     * WETH9 contract factory for creating contract instances
     */
    public weth9Factory: typeof WETH9__factory;
    /**
     * IZeroEx contract factory for creating contract instances  
     */
    public exchangeProxyFactory: typeof IZeroEx__factory;

    private readonly _web3Wrapper: Web3Wrapper;
    private readonly _ethersProvider: ethers.Provider;
    
    /**
     * Instantiates a new ContractWrappers instance.
     * @param   supportedProvider    The Provider instance you would like the contract-wrappers library to use for interacting with
     *                      the Ethereum network.
     * @param   config      The configuration object. Look up the type for the description.
     * @return  An instance of the ContractWrappers class.
     */
    constructor(supportedProvider: SupportedProvider, config: ContractWrappersConfig) {
        assert.doesConformToSchema('config', config, ContractWrappersConfigSchema);
        const txDefaults = {
            gasPrice: config.gasPrice ? config.gasPrice.toString() : undefined,
        };
        this._web3Wrapper = new Web3Wrapper(supportedProvider, txDefaults);
        this.contractAddresses = config.contractAddresses || _getDefaultContractAddresses(config.chainId);
        
        // Create ethers provider from the supported provider
        // Note: We cast to unknown first to handle the type conversion safely
        this._ethersProvider = new ethers.BrowserProvider(supportedProvider as unknown as ethers.Eip1193Provider);
        
        // Initialize contract factories
        this.weth9Factory = WETH9__factory;
        this.exchangeProxyFactory = IZeroEx__factory;
    }

    /**
     * Get a WETH9 contract instance
     */
    public getWETH9Contract(address: string) {
        return this.weth9Factory.connect(address, this._ethersProvider);
    }

    /**
     * Get an IZeroEx contract instance  
     */
    public getExchangeProxyContract(address: string) {
        return this.exchangeProxyFactory.connect(address, this._ethersProvider);
    }

    /**
     * Unsubscribes from all subscriptions for all contracts.
     */
    public unsubscribeAll(): void {
        // TypeChain contracts don't require explicit unsubscription management
        // Event listeners are managed per contract instance
    }

    /**
     * Get the provider instance
     */
    public getProvider() {
        return this._web3Wrapper.getProvider();
    }

    /**
     * Get the ethers provider instance
     */
    public getEthersProvider() {
        return this._ethersProvider;
    }
}
