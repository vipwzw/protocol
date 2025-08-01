import { artifacts as erc20Artifacts, DummyERC20Token__factory, DummyERC20Token } from '@0x/contracts-erc20';
import { constants, ERC20BalancesByOwner, txDefaults } from '@0x/test-utils';
import { ZeroExProvider } from 'ethereum-types';
import * as _ from 'lodash';

import { artifacts } from './artifacts';

import { IAssetData__factory, ERC20Proxy__factory, ERC20Proxy } from './typechain-types';

export class ERC20Wrapper {
    private readonly _tokenOwnerAddresses: string[];
    private readonly _contractOwnerAddress: string;
    private readonly _provider: ZeroExProvider;
    private readonly _dummyTokenContracts: DummyERC20Token[];
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
        this._assetDataInterface = IAssetData__factory.connect(constants.NULL_ADDRESS, provider as any);
    }
    public async deployDummyTokensAsync(
        numberToDeploy: number,
        decimals: bigint = 18n,
    ): Promise<DummyERC20Token[]> {
        const { ethers } = require('hardhat');
        const [signer] = await ethers.getSigners();
        
        for (let i = 0; i < numberToDeploy; i++) {
            const factory = new DummyERC20Token__factory(signer);
            const contract = await factory.deploy(
                `Dummy Token ${i}`,
                `DUM${i}`,
                decimals, 
                constants.DUMMY_TOKEN_TOTAL_SUPPLY, // 1 billion tokens from constants
            );
            await contract.waitForDeployment();
            this._dummyTokenContracts.push(contract);
        }
        return this._dummyTokenContracts;
    }
    public async deployProxyAsync(): Promise<ERC20Proxy> {
        // Get signer from provider for deployment
        const { ethers } = require('hardhat');
        const [signer] = await ethers.getSigners();
        const factory = new ERC20Proxy__factory(signer);
        this._proxyContract = await factory.deploy() as ERC20Proxy;
        await this._proxyContract.waitForDeployment();
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
        
        const { ethers } = require('hardhat');
        const signers = await ethers.getSigners();
        const proxyAddress = await this._proxyContract!.getAddress();
        
        // 使用默认的初始余额和权限额度
        const initialBalance = 1000000000000000000n; // 1 token with 18 decimals
        const allowanceAmount = 1000000000000000000n; // 1 token allowance
        
        for (const dummyTokenContract of this._dummyTokenContracts) {
            for (let i = 0; i < this._tokenOwnerAddresses.length; i++) {
                const tokenOwnerAddress = this._tokenOwnerAddresses[i];
                
                try {
                    // 设置余额 - 直接调用 setBalance (DummyERC20Token 特有方法)
                    const setBalanceTx = await dummyTokenContract.setBalance(tokenOwnerAddress, initialBalance);
                    await setBalanceTx.wait();
                    
                    // 获取对应的 signer 来执行 approve
                    const ownerSigner = signers.find((s: any) => s.address.toLowerCase() === tokenOwnerAddress.toLowerCase()) || signers[i % signers.length];
                    const contractWithSigner = dummyTokenContract.connect(ownerSigner);
                    
                    // 设置代理合约的 allowance
                    const approveTx = await contractWithSigner.approve(proxyAddress, allowanceAmount);
                    await approveTx.wait();
                    
                } catch (error) {
                    console.warn(`Failed to set balance/allowance for ${tokenOwnerAddress} on token ${await dummyTokenContract.getAddress()}:`, error);
                    // 继续处理下一个，不要因为单个失败就停止整个过程
                }
            }
        }
    }
    public async getBalanceAsync(userAddress: string, assetData: string): Promise<bigint> {
        const tokenContract = await this._getTokenContractFromAssetDataAsync(assetData);
        const balance = await tokenContract.balanceOf(userAddress);
        return balance;
    }
    public async setBalanceAsync(userAddress: string, assetData: string, amount: bigint): Promise<void> {
        const tokenContract = await this._getTokenContractFromAssetDataAsync(assetData);
        const tx = await tokenContract.setBalance(userAddress, amount);
        await tx.wait();
    }
    public async getProxyAllowanceAsync(userAddress: string, assetData: string): Promise<bigint> {
        const tokenContract = await this._getTokenContractFromAssetDataAsync(assetData);
        const proxyAddress = await this._proxyContract!.getAddress();
        const allowance = await tokenContract.allowance(userAddress, proxyAddress);
        return allowance;
    }
    public async setAllowanceAsync(userAddress: string, assetData: string, amount: bigint): Promise<void> {
        const tokenContract = await this._getTokenContractFromAssetDataAsync(assetData);
        const proxyAddress = await this._proxyContract!.getAddress();
        const tx = await tokenContract.approve(proxyAddress, amount);
        await tx.wait();
    }
    public async getBalancesAsync(): Promise<ERC20BalancesByOwner> {
        this._validateDummyTokenContractsExistOrThrow();
        const balancesByOwner: ERC20BalancesByOwner = {};
        const balances: bigint[] = [];
        const balanceInfo: Array<{ tokenOwnerAddress: string; tokenAddress: string }> = [];
        for (const dummyTokenContract of this._dummyTokenContracts) {
            for (const tokenOwnerAddress of this._tokenOwnerAddresses) {
                balances.push(await dummyTokenContract.balanceOf(tokenOwnerAddress));
                balanceInfo.push({
                    tokenOwnerAddress,
                    tokenAddress: await dummyTokenContract.getAddress(),
                });
            }
        }
        _.forEach(balances, (balance, balanceIndex) => {
            const tokenAddress = balanceInfo[balanceIndex].tokenAddress;
            const tokenOwnerAddress = balanceInfo[balanceIndex].tokenOwnerAddress;
            if (balancesByOwner[tokenOwnerAddress] === undefined) {
                balancesByOwner[tokenOwnerAddress] = {};
            }
            balancesByOwner[tokenOwnerAddress][tokenAddress] = balance;
        });
        return balancesByOwner;
    }
    public addDummyTokenContract(dummy: DummyERC20Token): void {
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
    public async getTokenAddresses(): Promise<string[]> {
        const tokenAddresses = await Promise.all(
            this._dummyTokenContracts.map(async dummyTokenContract => await dummyTokenContract.getAddress())
        );
        return tokenAddresses;
    }
    private async _getTokenContractFromAssetDataAsync(assetData: string): Promise<DummyERC20Token> {
        // For now, simplified implementation - decode assetData to get token address
        // This would typically use a proper asset data decoder
        const tokenAddress = assetData.slice(34); // Skip function selector and padding
        const tokenContractIfExists = await Promise.all(
            this._dummyTokenContracts.map(async c => ({
                contract: c,
                address: await c.getAddress()
            }))
        ).then(contracts => contracts.find(c => c.address.toLowerCase() === tokenAddress.toLowerCase())?.contract);
        
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
