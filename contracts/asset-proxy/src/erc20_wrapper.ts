import { artifacts as erc20Artifacts, DummyERC20TokenContract } from '../../erc20/src';
import { DummyERC20Token__factory, DummyERC20Token } from '../../erc20/src/typechain-types';
import { constants, ERC20BalancesByOwner, txDefaults } from '@0x/test-utils';
import { BigNumber } from '@0x/utils';
import { ZeroExProvider } from 'ethereum-types';
import * as _ from 'lodash';

import { artifacts } from './artifacts';

import { IAssetData__factory, ERC20Proxy__factory, ERC20Proxy } from './typechain-types';

export class ERC20Wrapper {
    private readonly _tokenOwnerAddresses: string[];
    private readonly _contractOwnerAddress: string;
    private readonly _provider: ZeroExProvider;
    private readonly _dummyTokenContracts: DummyERC20TokenContract[];
    private readonly _assetDataInterface: any;
    private _proxyContract?: ERC20Proxy;
    private _proxyIdIfExists?: string;
    /**
     * Instanitates an ERC20Wrapper
     * @param provider Web3 provider to use for all JSON RPC requests
     * @param tokenOwnerAddresses Addresses that we want to endow as owners for dummy ERC20 tokens
     * @param contractOwnerAddress Desired owner of the contract
     * Instance of ERC20Wrapper
     */
    constructor(provider: ZeroExProvider, tokenOwnerAddresses: string[], contractOwnerAddress: string) {
        this._dummyTokenContracts = [];
        this._provider = provider;
        this._tokenOwnerAddresses = tokenOwnerAddresses;
        this._contractOwnerAddress = contractOwnerAddress;
        this._assetDataInterface = IAssetData__factory.connect(constants.NULL_ADDRESS, provider);
    }
    public async deployDummyTokensAsync(
        numberToDeploy: number,
        decimals: BigNumber,
    ): Promise<DummyERC20TokenContract[]> {
        const { ethers } = require('hardhat');
        const [signer] = await ethers.getSigners();
        
        for (let i = 0; i < numberToDeploy; i++) {
            const factory = new DummyERC20Token__factory(signer);
            const contract = await factory.deploy(
                constants.DUMMY_TOKEN_NAME,
                constants.DUMMY_TOKEN_SYMBOL,
                decimals,
                constants.DUMMY_TOKEN_TOTAL_SUPPLY,
            );
            this._dummyTokenContracts.push(contract as any);
        }
        return this._dummyTokenContracts;
    }
    public async deployProxyAsync(): Promise<ERC20Proxy> {
        // Get signer from provider for deployment
        const { ethers } = require('hardhat');
        const [signer] = await ethers.getSigners();
        const factory = new ERC20Proxy__factory(signer);
        this._proxyContract = await factory.deploy() as ERC20Proxy;
        this._proxyIdIfExists = await this._proxyContract.getProxyId();
        return this._proxyContract;
    }
    public getProxyId(): string {
        this._validateProxyContractExistsOrThrow();
        return this._proxyIdIfExists as string;
    }
    public async setBalancesAndAllowancesAsync(): Promise<void> {
        this._validateDummyTokenContractsExistOrThrow();
        this._validateProxyContractExistsOrThrow();
        for (const dummyTokenContract of this._dummyTokenContracts) {
            for (const tokenOwnerAddress of this._tokenOwnerAddresses) {
                const tx1 = await dummyTokenContract.setBalance(tokenOwnerAddress, constants.INITIAL_ERC20_BALANCE);
                await tx1.wait();
                
                const tx2 = await dummyTokenContract.approve(await this._proxyContract!.getAddress(), constants.INITIAL_ERC20_ALLOWANCE);
                await tx2.wait();
            }
        }
    }
    public async getBalanceAsync(userAddress: string, assetData: string): Promise<BigNumber> {
        const tokenContract = await this._getTokenContractFromAssetDataAsync(assetData);
        const balance = new BigNumber(await tokenContract.balanceOf(userAddress).callAsync());
        return balance;
    }
    public async setBalanceAsync(userAddress: string, assetData: string, amount: BigNumber): Promise<void> {
        const tokenContract = await this._getTokenContractFromAssetDataAsync(assetData);
        await tokenContract
            .setBalance(userAddress, amount)
            .awaitTransactionSuccessAsync(
                { from: this._contractOwnerAddress },
                { pollingIntervalMs: constants.AWAIT_TRANSACTION_MINED_MS },
            );
    }
    public async getProxyAllowanceAsync(userAddress: string, assetData: string): Promise<BigNumber> {
        const tokenContract = await this._getTokenContractFromAssetDataAsync(assetData);
        const proxyAddress = (this._proxyContract as ERC20ProxyContract).address;
        const allowance = new BigNumber(await tokenContract.allowance(userAddress, proxyAddress).callAsync());
        return allowance;
    }
    public async setAllowanceAsync(userAddress: string, assetData: string, amount: BigNumber): Promise<void> {
        const tokenContract = await this._getTokenContractFromAssetDataAsync(assetData);
        const proxyAddress = (this._proxyContract as ERC20ProxyContract).address;
        await tokenContract.approve(proxyAddress, amount).awaitTransactionSuccessAsync({ from: userAddress });
    }
    public async getBalancesAsync(): Promise<ERC20BalancesByOwner> {
        this._validateDummyTokenContractsExistOrThrow();
        const balancesByOwner: ERC20BalancesByOwner = {};
        const balances: BigNumber[] = [];
        const balanceInfo: Array<{ tokenOwnerAddress: string; tokenAddress: string }> = [];
        for (const dummyTokenContract of this._dummyTokenContracts) {
            for (const tokenOwnerAddress of this._tokenOwnerAddresses) {
                balances.push(await dummyTokenContract.balanceOf(tokenOwnerAddress).callAsync());
                balanceInfo.push({
                    tokenOwnerAddress,
                    tokenAddress: dummyTokenContract.address,
                });
            }
        }
        _.forEach(balances, (balance, balanceIndex) => {
            const tokenAddress = balanceInfo[balanceIndex].tokenAddress;
            const tokenOwnerAddress = balanceInfo[balanceIndex].tokenOwnerAddress;
            if (balancesByOwner[tokenOwnerAddress] === undefined) {
                balancesByOwner[tokenOwnerAddress] = {};
            }
            const wrappedBalance = new BigNumber(balance);
            balancesByOwner[tokenOwnerAddress][tokenAddress] = wrappedBalance;
        });
        return balancesByOwner;
    }
    public addDummyTokenContract(dummy: DummyERC20TokenContract): void {
        if (this._dummyTokenContracts !== undefined) {
            this._dummyTokenContracts.push(dummy);
        }
    }
    public addTokenOwnerAddress(address: string): void {
        this._tokenOwnerAddresses.push(address);
    }
    public getTokenOwnerAddresses(): string[] {
        return this._tokenOwnerAddresses;
    }
    public getTokenAddresses(): string[] {
        const tokenAddresses = _.map(this._dummyTokenContracts, dummyTokenContract => dummyTokenContract.address);
        return tokenAddresses;
    }
    private async _getTokenContractFromAssetDataAsync(assetData: string): Promise<DummyERC20TokenContract> {
        const tokenAddress = this._assetDataInterface.getABIDecodedTransactionData<string>('ERC20Token', assetData); // tslint:disable-line:no-unused-variable
        const tokenContractIfExists = _.find(this._dummyTokenContracts, c => c.address === tokenAddress);
        if (tokenContractIfExists === undefined) {
            throw new Error(`Token: ${tokenAddress} was not deployed through ERC20Wrapper`);
        }
        return tokenContractIfExists;
    }
    private _validateDummyTokenContractsExistOrThrow(): void {
        if (this._dummyTokenContracts === undefined) {
            throw new Error('Dummy ERC20 tokens not yet deployed, please call "deployDummyTokensAsync"');
        }
    }
    private _validateProxyContractExistsOrThrow(): void {
        if (this._proxyContract === undefined) {
            throw new Error('ERC20 proxy contract not yet deployed, please call "deployProxyAsync"');
        }
    }
}
