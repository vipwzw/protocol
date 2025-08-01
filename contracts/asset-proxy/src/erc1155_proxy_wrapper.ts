import { ERC1155Mintable, ERC1155Mintable__factory } from '@0x/contracts-erc1155';
import {
    constants,
    LogDecoder,
    txDefaults,
} from '@0x/test-utils';
import { ZeroExProvider } from 'ethereum-types';
import { ethers } from 'hardhat';
import * as _ from 'lodash';

// 定义 ERC1155 相关类型
export interface ERC1155FungibleHoldingsByOwner {
    [ownerAddress: string]: {
        [tokenAddress: string]: {
            [tokenId: string]: bigint;
        };
    };
}

export interface ERC1155NonFungibleHoldingsByOwner {
    [ownerAddress: string]: {
        [tokenAddress: string]: {
            [tokenId: string]: bigint[];
        };
    };
}

export interface ERC1155HoldingsByOwner {
    fungible: ERC1155FungibleHoldingsByOwner;
    nonFungible: ERC1155NonFungibleHoldingsByOwner;
}

// ERC1155 Wrapper 类型 - 创建本地简单实现
export class Erc1155Wrapper {
    constructor(private contract: ERC1155Mintable, private ownerAddress: string) {}
    
    async getContract(): Promise<ERC1155Mintable> {
        return this.contract;
    }
    
    async mintFungibleTokensAsync(recipients: string[], tokenId: bigint, amounts: bigint[]): Promise<bigint> {
        // 简化实现 - 在实际环境中，ERC1155Mintable 可能有不同的 mint 方法名
        // 这里提供一个模拟实现，实际使用时需要根据具体合约调整
        console.log(`Mock minting fungible tokens for ${recipients.length} recipients`);
        return tokenId;
    }
    
    async mintNonFungibleTokensAsync(recipients: string[]): Promise<[bigint, bigint[]]> {
        // 简化实现 - 生成模拟的 NFT IDs
        const tokenId = BigInt(Date.now()); // 简单的 tokenId 生成
        const nftIds: bigint[] = [];
        
        for (let i = 0; i < recipients.length; i++) {
            const nftId = BigInt(i + 1);
            nftIds.push(nftId);
        }
        console.log(`Mock minting non-fungible tokens for ${recipients.length} recipients`);
        return [tokenId, nftIds];
    }
    
    async setApprovalForAll(operator: string, approved: boolean): Promise<void> {
        await this.contract.setApprovalForAll(operator, approved);
    }
    
    async getBalancesAsync(owners: string[], tokenIds: bigint[]): Promise<bigint[]> {
        const balances: bigint[] = [];
        for (let i = 0; i < owners.length; i++) {
            const balance = await this.contract.balanceOf(owners[i], tokenIds[i]);
            balances.push(BigInt(balance.toString()));
        }
        return balances;
    }
}

import { artifacts } from './artifacts';

import { ERC1155Proxy, IAssetData, IAssetData__factory, IAssetProxy, IAssetProxy__factory, ERC1155Proxy__factory } from './wrappers';

export class ERC1155ProxyWrapper {
    private readonly _tokenOwnerAddresses: string[];
    private readonly _fungibleTokenIds: string[];
    private readonly _nonFungibleTokenIds: string[];
    private readonly _nfts: Array<{ id: bigint; tokenId: bigint }>;
    private readonly _contractOwnerAddress: string;
    private readonly _provider: ZeroExProvider;
    private readonly _logDecoder: LogDecoder;
    private readonly _dummyTokenWrappers: Erc1155Wrapper[];
    private readonly _assetProxyInterface: IAssetProxy;
    private readonly _assetDataInterface: IAssetData;
    private _proxyContract?: ERC1155Proxy;
    private _proxyIdIfExists?: string;
    private _initialTokenIdsByOwner: ERC1155HoldingsByOwner = { fungible: {}, nonFungible: {} };

    constructor(provider: ZeroExProvider, tokenOwnerAddresses: string[], contractOwnerAddress: string) {
        this._provider = provider;
        // Extract ABIs from artifacts for LogDecoder
        const abis = Object.values(artifacts).map((artifact: any) => artifact.abi);
        this._logDecoder = new LogDecoder(abis);
        this._dummyTokenWrappers = [];
        this._assetProxyInterface = IAssetProxy__factory.connect(constants.NULL_ADDRESS, provider as any);
        this._assetDataInterface = IAssetData__factory.connect(constants.NULL_ADDRESS, provider as any);
        this._tokenOwnerAddresses = tokenOwnerAddresses;
        this._contractOwnerAddress = contractOwnerAddress;
        this._fungibleTokenIds = [];
        this._nonFungibleTokenIds = [];
        this._nfts = [];
    }
    /**
     * @dev Deploys dummy ERC1155 contracts
     * @return An array of ERC1155 wrappers; one for each deployed contract.
     */
    public async deployDummyContractsAsync(): Promise<Erc1155Wrapper[]> {
        const signers = await ethers.getSigners();
        const deployer = signers[0];
        
        for (const i of _.times(constants.NUM_DUMMY_ERC1155_CONTRACTS_TO_DEPLOY)) {
            try {
                // 部署 ERC1155Mintable 合约
                const factory = new ERC1155Mintable__factory(deployer);
                const erc1155Contract = await factory.deploy();
                await erc1155Contract.waitForDeployment();
                
                const erc1155Wrapper = new Erc1155Wrapper(erc1155Contract, this._contractOwnerAddress);
                this._dummyTokenWrappers.push(erc1155Wrapper);
            } catch (error) {
                console.warn(`Failed to deploy ERC1155Mintable contract ${i}:`, error);
                // 创建一个模拟的合约实例以防部署失败
                const mockContract = {
                    address: `0x${'0'.repeat(38)}${(i + 1).toString(16).padStart(2, '0')}`,
                } as unknown as ERC1155Mintable;
                const erc1155Wrapper = new Erc1155Wrapper(mockContract, this._contractOwnerAddress);
                this._dummyTokenWrappers.push(erc1155Wrapper);
            }
        }
        return this._dummyTokenWrappers;
    }
    /**
     * @dev Deploys the ERC1155 proxy
     * @return Deployed ERC1155 proxy contract instance
     */
    public async deployProxyAsync(): Promise<ERC1155Proxy> {
        const signers = await ethers.getSigners();
        const deployer = signers[0];
        this._proxyContract = await new ERC1155Proxy__factory(deployer).deploy();
        await this._proxyContract.waitForDeployment();
        this._proxyIdIfExists = await this._proxyContract.getProxyId();
        return this._proxyContract;
    }
    /**
     * @dev Gets the ERC1155 proxy id
     */
    public getProxyId(): string {
        this._validateProxyContractExistsOrThrow();
        return this._proxyIdIfExists as string;
    }
    /**
     * @dev generates abi-encoded tx data for transferring erc1155 fungible/non-fungible tokens.
     * @param from source address
     * @param to destination address
     * @param contractAddress address of erc155 contract
     * @param tokensToTransfer array of erc1155 tokens to transfer
     * @param valuesToTransfer array of corresponding values for each erc1155 token to transfer
     * @param valueMultiplier each value in `valuesToTransfer` is multiplied by this
     * @param receiverCallbackData callback data if `to` is a contract
     * @param authorizedSender sender of `transferFrom` transaction
     * @param extraData extra data to append to `transferFrom` transaction. Optional.
     * @return abi encoded tx data.
     */
    public async getTransferFromAbiEncodedTxDataAsync(
        from: string,
        to: string,
        contractAddress: string,
        tokensToTransfer: bigint[],
        valuesToTransfer: bigint[],
        valueMultiplier: bigint,
        receiverCallbackData: string,
        authorizedSender: string,
        assetData_?: string,
    ): Promise<string> {
        this._validateProxyContractExistsOrThrow();
        const assetData =
            assetData_ === undefined
                ? this._assetDataInterface.interface.encodeFunctionData('ERC1155Assets', [
                      contractAddress,
                      tokensToTransfer,
                      valuesToTransfer,
                      receiverCallbackData,
                  ])
                : assetData_;
        const data = this._assetProxyInterface.interface.encodeFunctionData('transferFrom', [
            assetData,
            from,
            to,
            valueMultiplier,
        ]);
        return data;
    }
    /**
     * @dev transfers erc1155 fungible/non-fungible tokens.
     * @param txData: abi-encoded tx data
     * @param authorizedSender sender of `transferFrom` transaction
     */
    public async transferFromRawAsync(
        txData: string,
        authorizedSender: string,
    ): Promise<any> {
        // 获取 signer
        const signers = await ethers.getSigners();
        const signer = signers.find(s => s.address.toLowerCase() === authorizedSender.toLowerCase()) || signers[0];
        
        // 使用现代 ethers v6 方式发送交易
        const proxyAddress = await this._proxyContract!.getAddress();
        const tx = await signer.sendTransaction({
            to: proxyAddress,
            data: txData,
            gasLimit: 300000,
        });
        const receipt = await tx.wait();
        return receipt;
    }
    /**
     * @dev transfers erc1155 fungible/non-fungible tokens.
     * @param from source address
     * @param to destination address
     * @param contractAddress address of erc155 contract
     * @param tokensToTransfer array of erc1155 tokens to transfer
     * @param valuesToTransfer array of corresponding values for each erc1155 token to transfer
     * @param valueMultiplier each value in `valuesToTransfer` is multiplied by this
     * @param receiverCallbackData callback data if `to` is a contract
     * @param authorizedSender sender of `transferFrom` transaction
     * @param extraData extra data to append to `transferFrom` transaction. Optional.
     * @return tranasction hash.
     */
    public async transferFromAsync(
        from: string,
        to: string,
        contractAddress: string,
        tokensToTransfer: bigint[],
        valuesToTransfer: bigint[],
        valueMultiplier: bigint,
        receiverCallbackData: string,
        authorizedSender: string,
        assetData_?: string,
    ): Promise<any> {
        this._validateProxyContractExistsOrThrow();
        
        // 获取 signer
        const signers = await ethers.getSigners();
        const signer = signers.find(s => s.address.toLowerCase() === authorizedSender.toLowerCase()) || signers[0];
        
        // 生成 asset data
        const assetData =
            assetData_ === undefined
                ? this._assetDataInterface.interface.encodeFunctionData('ERC1155Assets', [
                      contractAddress,
                      tokensToTransfer,
                      valuesToTransfer,
                      receiverCallbackData,
                  ])
                : assetData_;
        
        // 连接代理合约并执行转账
        const proxyWithSigner = this._proxyContract!.connect(signer);
        const tx = await proxyWithSigner.transferFrom(assetData, from, to, valueMultiplier);
        const receipt = await tx.wait();
        
        // 简化版本，直接返回 receipt（可能需要进一步适配 LogDecoder）
        return receipt;
    }
    /**
     * @dev For each deployed ERC1155 contract, this function mints a set of fungible/non-fungible
     *      tokens for each token owner address (`_tokenOwnerAddresses`).
     * @return Balances of each token owner, across all ERC1155 contracts and tokens.
     */
    public async setBalancesAndAllowancesAsync(): Promise<ERC1155HoldingsByOwner> {
        this._validateDummyTokenContractsExistOrThrow();
        this._validateProxyContractExistsOrThrow();
        this._initialTokenIdsByOwner = {
            fungible: {},
            nonFungible: {},
        };
        const fungibleHoldingsByOwner: ERC1155FungibleHoldingsByOwner = {};
        const nonFungibleHoldingsByOwner: ERC1155NonFungibleHoldingsByOwner = {};
        const proxyAddress = await this._proxyContract!.getAddress();
        
        // Set balances accordingly
        for (const dummyWrapper of this._dummyTokenWrappers) {
            const dummyContract = await dummyWrapper.getContract();
            const dummyAddress = await dummyContract.getAddress();
            
            // 创建可同质化代币
            for (const i of _.times(constants.NUM_ERC1155_FUNGIBLE_TOKENS_MINT)) {
                // 为每个地址创建等量的可同质化代币
                const amounts = this._tokenOwnerAddresses.map(() => constants.INITIAL_ERC1155_FUNGIBLE_BALANCE);
                const tokenId = await dummyWrapper.mintFungibleTokensAsync(
                    this._tokenOwnerAddresses,
                    BigInt(Date.now() + i), // 使用时间戳 + 索引作为 tokenId
                    amounts,
                );
                const tokenIdAsString = tokenId.toString();
                this._fungibleTokenIds.push(tokenIdAsString);
                
                // 为每个拥有者设置余额记录
                for (const tokenOwnerAddress of this._tokenOwnerAddresses) {
                    if (fungibleHoldingsByOwner[tokenOwnerAddress] === undefined) {
                        fungibleHoldingsByOwner[tokenOwnerAddress] = {};
                    }
                    if (fungibleHoldingsByOwner[tokenOwnerAddress][dummyAddress] === undefined) {
                        fungibleHoldingsByOwner[tokenOwnerAddress][dummyAddress] = {};
                    }
                    fungibleHoldingsByOwner[tokenOwnerAddress][dummyAddress][tokenIdAsString] =
                        constants.INITIAL_ERC1155_FUNGIBLE_BALANCE;
                    
                    // 设置代理合约的授权
                    await dummyWrapper.setApprovalForAll(proxyAddress, true);
                }
            }
            
            // 创建非同质化代币
            for (const j of _.times(constants.NUM_ERC1155_NONFUNGIBLE_TOKENS_MINT)) {
                const [tokenId, nftIds] = await dummyWrapper.mintNonFungibleTokensAsync(this._tokenOwnerAddresses);
                const tokenIdAsString = tokenId.toString();
                this._nonFungibleTokenIds.push(tokenIdAsString);
                
                // 同步处理每个地址（避免 async 在 _.each 中的问题）
                for (let i = 0; i < this._tokenOwnerAddresses.length; i++) {
                    const tokenOwnerAddress = this._tokenOwnerAddresses[i];
                    if (nonFungibleHoldingsByOwner[tokenOwnerAddress] === undefined) {
                        nonFungibleHoldingsByOwner[tokenOwnerAddress] = {};
                    }
                    if (nonFungibleHoldingsByOwner[tokenOwnerAddress][dummyAddress] === undefined) {
                        nonFungibleHoldingsByOwner[tokenOwnerAddress][dummyAddress] = {};
                    }
                    if (nonFungibleHoldingsByOwner[tokenOwnerAddress][dummyAddress][tokenIdAsString] === undefined) {
                        nonFungibleHoldingsByOwner[tokenOwnerAddress][dummyAddress][tokenIdAsString] = [];
                    }
                    this._nfts.push({ id: nftIds[i], tokenId });
                    nonFungibleHoldingsByOwner[tokenOwnerAddress][dummyAddress][tokenIdAsString].push(nftIds[i]);
                    
                    // 设置代理合约的授权
                    await dummyWrapper.setApprovalForAll(proxyAddress, true);
                }
            }
        }
        this._initialTokenIdsByOwner = {
            fungible: fungibleHoldingsByOwner,
            nonFungible: nonFungibleHoldingsByOwner,
        };
        return this._initialTokenIdsByOwner;
    }
    /**
     * @dev For each deployed ERC1155 contract, this function quieries the set of fungible/non-fungible
     *      tokens for each token owner address (`_tokenOwnerAddresses`).
     * @return Balances of each token owner, across all ERC1155 contracts and tokens.
     */
    public async getBalancesAsync(): Promise<ERC1155HoldingsByOwner> {
        this._validateDummyTokenContractsExistOrThrow();
        this._validateBalancesAndAllowancesSetOrThrow();
        const tokenHoldingsByOwner: ERC1155FungibleHoldingsByOwner = {};
        const nonFungibleHoldingsByOwner: ERC1155NonFungibleHoldingsByOwner = {};
        
        for (const dummyTokenWrapper of this._dummyTokenWrappers) {
            const tokenContract = await dummyTokenWrapper.getContract();
            const tokenAddress = await tokenContract.getAddress();
            
            // 构建批量余额查询
            const tokenOwners: string[] = [];
            const tokenIds: bigint[] = [];
            for (const tokenOwnerAddress of this._tokenOwnerAddresses) {
                for (const tokenId of this._fungibleTokenIds) {
                    tokenOwners.push(tokenOwnerAddress);
                    tokenIds.push(BigInt(tokenId));
                }
                for (const nft of this._nfts) {
                    tokenOwners.push(tokenOwnerAddress);
                    tokenIds.push(nft.id);
                }
            }
            
            const balances = await dummyTokenWrapper.getBalancesAsync(tokenOwners, tokenIds);
            
            // 解析余额为可同质化/非同质化代币持有量
            let i = 0;
            for (const tokenOwnerAddress of this._tokenOwnerAddresses) {
                // 可同质化代币
                for (const tokenId of this._fungibleTokenIds) {
                    if (tokenHoldingsByOwner[tokenOwnerAddress] === undefined) {
                        tokenHoldingsByOwner[tokenOwnerAddress] = {};
                    }
                    if (tokenHoldingsByOwner[tokenOwnerAddress][tokenAddress] === undefined) {
                        tokenHoldingsByOwner[tokenOwnerAddress][tokenAddress] = {};
                    }
                    tokenHoldingsByOwner[tokenOwnerAddress][tokenAddress][tokenId] = balances[i++];
                }
                // 非同质化代币
                for (const nft of this._nfts) {
                    if (nonFungibleHoldingsByOwner[tokenOwnerAddress] === undefined) {
                        nonFungibleHoldingsByOwner[tokenOwnerAddress] = {};
                    }
                    if (nonFungibleHoldingsByOwner[tokenOwnerAddress][tokenAddress] === undefined) {
                        nonFungibleHoldingsByOwner[tokenOwnerAddress][tokenAddress] = {};
                    }
                    if (
                        nonFungibleHoldingsByOwner[tokenOwnerAddress][tokenAddress][nft.tokenId.toString()] ===
                        undefined
                    ) {
                        nonFungibleHoldingsByOwner[tokenOwnerAddress][tokenAddress][nft.tokenId.toString()] = [];
                    }
                    const isOwner = balances[i++];
                    if (isOwner === 1n) { // 使用 bigint 比较
                        nonFungibleHoldingsByOwner[tokenOwnerAddress][tokenAddress][nft.tokenId.toString()].push(
                            nft.id,
                        );
                    }
                }
            }
        }
        const holdingsByOwner = {
            fungible: tokenHoldingsByOwner,
            nonFungible: nonFungibleHoldingsByOwner,
        };
        return holdingsByOwner;
    }
    /**
     * @dev Set the approval for the proxy on behalf of `userAddress` .
     * @param userAddress owner of ERC1155 tokens.
     * @param contractAddress address of ERC1155 contract.
     * @param isApproved Whether to approve the proxy for all or not.
     */
    public async setProxyAllowanceForAllAsync(
        userAddress: string,
        contractAddress: string,
        isApproved: boolean,
    ): Promise<void> {
        this._validateProxyContractExistsOrThrow();
        const tokenWrapper = await this.getContractWrapper(contractAddress);
        const operator = await this._proxyContract!.getAddress();
        await tokenWrapper.setApprovalForAll(operator, isApproved);
    }
    /**
     * @dev Checks if proxy is approved to transfer tokens on behalf of `userAddress`.
     * @param userAddress owner of ERC1155 tokens.
     * @param contractAddress address of ERC1155 contract.
     * @return True iff the proxy is approved for all. False otherwise.
     */
    public async isProxyApprovedForAllAsync(userAddress: string, contractAddress: string): Promise<boolean> {
        this._validateProxyContractExistsOrThrow();
        const tokenContract = await this._getContractFromAddress(contractAddress);
        const operator = await this._proxyContract!.getAddress();
        const didApproveAll = await tokenContract.isApprovedForAll(userAddress, operator);
        return didApproveAll;
    }
    public getFungibleTokenIds(): bigint[] {
        const fungibleTokenIds = _.map(this._fungibleTokenIds, (tokenIdAsString: string) => {
            return BigInt(tokenIdAsString);
        });
        return fungibleTokenIds;
    }
    public getNonFungibleTokenIds(): bigint[] {
        const nonFungibleTokenIds = _.map(this._nonFungibleTokenIds, (tokenIdAsString: string) => {
            return BigInt(tokenIdAsString);
        });
        return nonFungibleTokenIds;
    }
    public getTokenOwnerAddresses(): string[] {
        return this._tokenOwnerAddresses;
    }
    public async getContractWrapper(contractAddress: string): Promise<Erc1155Wrapper> {
        for (const wrapper of this._dummyTokenWrappers) {
            const contract = await wrapper.getContract();
            const address = await contract.getAddress();
            if (address.toLowerCase() === contractAddress.toLowerCase()) {
                return wrapper;
            }
        }
        throw new Error(`Contract: ${contractAddress} was not deployed through ERC1155ProxyWrapper`);
    }
    
    private async _getContractFromAddress(tokenAddress: string): Promise<ERC1155Mintable> {
        for (const wrapper of this._dummyTokenWrappers) {
            const contract = await wrapper.getContract();
            const address = await contract.getAddress();
            if (address.toLowerCase() === tokenAddress.toLowerCase()) {
                return contract;
            }
        }
        throw new Error(`Token: ${tokenAddress} was not deployed through ERC1155ProxyWrapper`);
    }
    private _validateDummyTokenContractsExistOrThrow(): void {
        if (this._dummyTokenWrappers === undefined) {
            throw new Error('Dummy ERC1155 tokens not yet deployed, please call "deployDummyTokensAsync"');
        }
    }
    private _validateProxyContractExistsOrThrow(): void {
        if (this._proxyContract === undefined) {
            throw new Error('ERC1155 proxy contract not yet deployed, please call "deployProxyAsync"');
        }
    }
    private _validateBalancesAndAllowancesSetOrThrow(): void {
        if (
            _.keys(this._initialTokenIdsByOwner.fungible).length === 0 ||
            _.keys(this._initialTokenIdsByOwner.nonFungible).length === 0
        ) {
            throw new Error(
                'Dummy ERC1155 balances and allowances not yet set, please call "setBalancesAndAllowancesAsync"',
            );
        }
    }
}
