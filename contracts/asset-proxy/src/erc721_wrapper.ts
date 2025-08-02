import { artifacts as erc721Artifacts, DummyERC721Token, DummyERC721Token__factory } from '@0x/contracts-erc721';
import { constants, txDefaults } from '@0x/test-utils';
import { generatePseudoRandomSalt } from '@0x/order-utils';
import { ZeroExProvider } from 'ethereum-types';
import * as _ from 'lodash';

import { artifacts } from './artifacts';

import { ERC721Proxy, ERC721Proxy__factory } from './typechain-types';

// 定义 ERC721 相关类型
export interface ERC721TokenIdsByOwner {
    [ownerAddress: string]: {
        [tokenAddress: string]: bigint[];
    };
}

export class ERC721Wrapper {
    private readonly _tokenOwnerAddresses: string[];
    private readonly _contractOwnerAddress: string;
    private readonly _provider: ZeroExProvider;
    private readonly _dummyTokenContracts: DummyERC721Token[];
    private _contractAddressToInstance: Map<string, DummyERC721Token>;
    private _proxyContract?: ERC721Proxy;
    private _proxyIdIfExists?: string;
    private _initialTokenIdsByOwner: ERC721TokenIdsByOwner = {};
    constructor(provider: ZeroExProvider, tokenOwnerAddresses: string[], contractOwnerAddress: string) {
        this._provider = provider;
        this._dummyTokenContracts = [];
        this._contractAddressToInstance = new Map();
        this._tokenOwnerAddresses = tokenOwnerAddresses;
        this._contractOwnerAddress = contractOwnerAddress;
    }
    public async deployDummyTokensAsync(): Promise<DummyERC721Token[]> {
        const { ethers } = require('hardhat');
        const [signer] = await ethers.getSigners();
        
        for (let i = 0; i < constants.NUM_DUMMY_ERC721_TO_DEPLOY; i++) {
            const factory = new DummyERC721Token__factory(signer);
            const contract = await factory.deploy(
                `${constants.DUMMY_TOKEN_NAME} ${i}`,
                `${constants.DUMMY_TOKEN_SYMBOL}${i}`,
            );
            await contract.waitForDeployment();
            const contractAddress = await contract.getAddress();
            console.log(`Deployed ERC721 contract ${i}: ${contractAddress} with name "${constants.DUMMY_TOKEN_NAME} ${i}"`);
            
            // 验证合约基本功能
            try {
                const name = await contract.name();
                const symbol = await contract.symbol();
                console.log(`Contract ${i} verification: name="${name}", symbol="${symbol}"`);
            } catch (error) {
                console.error(`Failed to verify contract ${i}:`, error.message);
                throw error;
            }
            
            // Cache the address mapping for quick lookup
            this._contractAddressToInstance.set(contractAddress.toLowerCase(), contract);
            this._dummyTokenContracts.push(contract);
        }
        return this._dummyTokenContracts;
    }
    public async deployProxyAsync(): Promise<ERC721Proxy> {
        const { ethers } = require('hardhat');
        const [signer] = await ethers.getSigners();
        
        try {
            // 现在 ERC721Proxy 是具体实现，可以直接部署
            const factory = new ERC721Proxy__factory(signer);
            this._proxyContract = await factory.deploy();
            await this._proxyContract.waitForDeployment();
            this._proxyIdIfExists = await this._proxyContract.getProxyId();
            return this._proxyContract;
        } catch (error) {
            throw new Error(`Failed to deploy ERC721Proxy: ${error.message}`);
        }
    }
    
    /**
     * 连接到现有的 ERC721Proxy 合约
     * @param proxyAddress 已部署的代理合约地址
     */
    public async connectToProxyAsync(proxyAddress: string): Promise<ERC721Proxy> {
        const proxyContract = ERC721Proxy__factory.connect(proxyAddress, this._provider as any);
        this._proxyContract = proxyContract;
        this._proxyIdIfExists = await proxyContract.getProxyId();
        return proxyContract;
    }
    public getProxyId(): string {
        this._validateProxyContractExistsOrThrow();
        return this._proxyIdIfExists as string;
    }
    public async setBalancesAndAllowancesAsync(): Promise<void> {
        this._validateDummyTokenContractsExistOrThrow();
        this._validateProxyContractExistsOrThrow();
        this._initialTokenIdsByOwner = {};
        for (let contractIndex = 0; contractIndex < this._dummyTokenContracts.length; contractIndex++) {
            const dummyTokenContract = this._dummyTokenContracts[contractIndex];
            for (const tokenOwnerAddress of this._tokenOwnerAddresses) {
                // tslint:disable-next-line:no-unused-variable
                for (const i of _.times(constants.NUM_ERC721_TOKENS_TO_MINT)) {
                    // 为每个合约使用不同的token ID范围，避免冲突
                    const baseTokenId = generatePseudoRandomSalt();
                    const tokenId = baseTokenId + BigInt(contractIndex * 1000000);
                    try {
                        const contractAddress = await dummyTokenContract.getAddress();
                        console.log(`Attempting to mint token ${tokenId} on contract ${contractIndex} (${contractAddress}) to ${tokenOwnerAddress}`);
                        
                        await this.mintAsync(contractAddress, tokenId, tokenOwnerAddress);
                        
                        // 验证 token 是否真的被铸造了
                        try {
                            const actualOwner = await dummyTokenContract.ownerOf(tokenId);
                            if (actualOwner.toLowerCase() !== tokenOwnerAddress.toLowerCase()) {
                                throw new Error(`Token owner mismatch: expected ${tokenOwnerAddress}, got ${actualOwner}`);
                            }
                            console.log(`Successfully minted and verified token ${tokenId} on contract ${contractIndex} to ${tokenOwnerAddress}`);
                        } catch (verifyError) {
                            console.error(`Mint appeared successful but verification failed for token ${tokenId} on contract ${contractIndex}:`, verifyError.message);
                            throw verifyError;
                        }
                    } catch (error) {
                        console.error(`Failed to mint token ${tokenId} on contract ${contractIndex}:`, error.message);
                        throw error;
                    }
                    const contractAddress = await dummyTokenContract.getAddress();
                    if (this._initialTokenIdsByOwner[tokenOwnerAddress] === undefined) {
                        this._initialTokenIdsByOwner[tokenOwnerAddress] = {
                            [contractAddress]: [],
                        };
                    }
                    if (this._initialTokenIdsByOwner[tokenOwnerAddress][contractAddress] === undefined) {
                        this._initialTokenIdsByOwner[tokenOwnerAddress][contractAddress] = [];
                    }
                    this._initialTokenIdsByOwner[tokenOwnerAddress][contractAddress].push(tokenId);

                    await this.approveProxyForAllAsync(contractAddress, tokenOwnerAddress, true);
                }
            }
        }
    }
    public async doesTokenExistAsync(tokenAddress: string, tokenId: bigint): Promise<boolean> {
        const tokenContract = this._getTokenContractFromAssetData(tokenAddress);
        try {
            const owner = await tokenContract.ownerOf(tokenId);
            const doesExist = owner !== constants.NULL_ADDRESS;
            return doesExist;
        } catch (error) {
            // Token doesn't exist if ownerOf throws
            return false;
        }
    }
    public async approveProxyAsync(tokenAddress: string, tokenId: bigint): Promise<void> {
        const proxyAddress = await this._proxyContract!.getAddress();
        await this.approveAsync(proxyAddress, tokenAddress, tokenId);
    }
    public async approveProxyForAllAsync(
        tokenAddress: string,
        ownerAddress: string,
        isApproved: boolean,
    ): Promise<void> {
        const tokenContract = this._getTokenContractFromAssetData(tokenAddress);
        const proxyAddress = await this._proxyContract!.getAddress();
        const tx = await tokenContract.setApprovalForAll(proxyAddress, isApproved);
        await tx.wait();
    }
    public async approveAsync(to: string, tokenAddress: string, tokenId: bigint): Promise<void> {
        const tokenContract = this._getTokenContractFromAssetData(tokenAddress);
        const tx = await tokenContract.approve(to, tokenId);
        await tx.wait();
    }
    public async transferFromAsync(
        tokenAddress: string,
        tokenId: bigint,
        currentOwner: string,
        userAddress: string,
    ): Promise<void> {
        const tokenContract = this._getTokenContractFromAssetData(tokenAddress);
        const tx = await tokenContract.transferFrom(currentOwner, userAddress, tokenId);
        await tx.wait();
    }
    public async mintAsync(tokenAddress: string, tokenId: bigint, userAddress: string): Promise<void> {
        const tokenContract = this._getTokenContractFromAssetData(tokenAddress);
        const tx = await tokenContract.mint(userAddress, tokenId);
        await tx.wait();
    }
    public async burnAsync(tokenAddress: string, tokenId: bigint, owner: string): Promise<void> {
        const tokenContract = this._getTokenContractFromAssetData(tokenAddress);
        const tx = await tokenContract.burn(owner, tokenId);
        await tx.wait();
    }
    public async ownerOfAsync(tokenAddress: string, tokenId: bigint): Promise<string> {
        const tokenContract = this._getTokenContractFromAssetData(tokenAddress);
        const owner = await tokenContract.ownerOf(tokenId);
        return owner;
    }
    public async isOwnerAsync(userAddress: string, tokenAddress: string, tokenId: bigint): Promise<boolean> {
        const tokenContract = this._getTokenContractFromAssetData(tokenAddress);
        const tokenOwner = await tokenContract.ownerOf(tokenId);
        const isOwner = tokenOwner === userAddress;
        return isOwner;
    }
    public async isProxyApprovedForAllAsync(userAddress: string, tokenAddress: string): Promise<boolean> {
        this._validateProxyContractExistsOrThrow();
        const tokenContract = this._getTokenContractFromAssetData(tokenAddress);
        const operator = await this._proxyContract!.getAddress();
        const didApproveAll = await tokenContract.isApprovedForAll(userAddress, operator);
        return didApproveAll;
    }
    public async isProxyApprovedAsync(tokenAddress: string, tokenId: bigint): Promise<boolean> {
        this._validateProxyContractExistsOrThrow();
        const tokenContract = this._getTokenContractFromAssetData(tokenAddress);
        const approvedAddress = await tokenContract.getApproved(tokenId);
        const proxyAddress = await this._proxyContract!.getAddress();
        const isProxyAnApprovedOperator = approvedAddress === proxyAddress;
        return isProxyAnApprovedOperator;
    }
    public async getBalancesAsync(): Promise<ERC721TokenIdsByOwner> {
        this._validateDummyTokenContractsExistOrThrow();
        this._validateBalancesAndAllowancesSetOrThrow();
        const tokenIdsByOwner: ERC721TokenIdsByOwner = {};
        const tokenOwnerAddresses: string[] = [];
        const tokenInfo: Array<{ tokenId: bigint; tokenAddress: string }> = [];
        for (const dummyTokenContract of this._dummyTokenContracts) {
            for (const tokenOwnerAddress of this._tokenOwnerAddresses) {
                const contractAddress = await dummyTokenContract.getAddress();
                const initialTokenOwnerIds = this._initialTokenIdsByOwner[tokenOwnerAddress][contractAddress];
                console.log(`Checking tokens for owner ${tokenOwnerAddress} on contract ${contractAddress}`);
                console.log(`Token IDs to check:`, initialTokenOwnerIds);
                for (const tokenId of initialTokenOwnerIds) {
                    try {
                        const owner = await dummyTokenContract.ownerOf(tokenId);
                        console.log(`Token ${tokenId} owned by ${owner}`);
                        tokenOwnerAddresses.push(owner);
                        tokenInfo.push({
                            tokenId,
                            tokenAddress: contractAddress,
                        });
                    } catch (error) {
                        console.error(`Failed to get owner of token ${tokenId}:`, error.message);
                        throw error;
                    }
                }
            }
        }
        _.forEach(tokenOwnerAddresses, (tokenOwnerAddress, ownerIndex) => {
            const tokenAddress = tokenInfo[ownerIndex].tokenAddress;
            const tokenId = tokenInfo[ownerIndex].tokenId;
            if (tokenIdsByOwner[tokenOwnerAddress] === undefined) {
                tokenIdsByOwner[tokenOwnerAddress] = {
                    [tokenAddress]: [],
                };
            }
            if (tokenIdsByOwner[tokenOwnerAddress][tokenAddress] === undefined) {
                tokenIdsByOwner[tokenOwnerAddress][tokenAddress] = [];
            }
            tokenIdsByOwner[tokenOwnerAddress][tokenAddress].push(tokenId);
        });
        return tokenIdsByOwner;
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
    private _getTokenContractFromAssetData(tokenAddress: string): DummyERC721Token {
        // Use cached address mapping for exact match
        const normalizedAddress = tokenAddress.toLowerCase();
        const tokenContractIfExists = this._contractAddressToInstance.get(normalizedAddress);
        
        if (tokenContractIfExists === undefined) {
            // If exact match fails, provide debugging info
            const availableAddresses = Array.from(this._contractAddressToInstance.keys()).join(', ');
            throw new Error(`Token: ${tokenAddress} was not deployed through ERC721Wrapper. Available addresses: ${availableAddresses}`);
        }
        return tokenContractIfExists;
    }
    private _validateDummyTokenContractsExistOrThrow(): void {
        if (this._dummyTokenContracts === undefined) {
            throw new Error('Dummy ERC721 tokens not yet deployed, please call "deployDummyTokensAsync"');
        }
    }
    private _validateProxyContractExistsOrThrow(): void {
        if (this._proxyContract === undefined) {
            throw new Error('ERC721 proxy contract not yet deployed, please call "deployProxyAsync"');
        }
    }
    private _validateBalancesAndAllowancesSetOrThrow(): void {
        if (_.keys(this._initialTokenIdsByOwner).length === 0) {
            throw new Error(
                'Dummy ERC721 balances and allowances not yet set, please call "setBalancesAndAllowancesAsync"',
            );
        }
    }
}
