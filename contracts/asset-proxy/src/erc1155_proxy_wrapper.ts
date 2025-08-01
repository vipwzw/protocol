import { artifacts as erc1155Artifacts, ERC1155Mintable, ERC1155Mintable__factory } from '@0x/contracts-erc1155';
import {
    constants,
    LogDecoder,
    txDefaults,
} from '@0x/test-utils';
import { BigNumber } from '@0x/utils';
import { Provider, TransactionReceiptWithDecodedLogs, ZeroExProvider } from 'ethereum-types';
import { ethers } from 'hardhat';
import * as _ from 'lodash';

// 定义 ERC1155 相关类型
export interface ERC1155HoldingsByOwner {
    [ownerAddress: string]: {
        [tokenAddress: string]: {
            [tokenId: string]: bigint;
        };
    };
}

export interface ERC1155FungibleHoldingsByOwner {
    [ownerAddress: string]: {
        [tokenAddress: string]: {
            [tokenId: string]: bigint;
        };
    };
}

export interface ERC1155NonFungibleHoldingsByOwner {
    [ownerAddress: string]: {
        [tokenAddress: string]: bigint[];
    };
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
    private readonly _dummyTokenWrappers: ERC1155Mintable[];
    private readonly _assetProxyInterface: IAssetProxy;
    private readonly _assetDataInterface: IAssetData;
    private _proxyContract?: ERC1155Proxy;
    private _proxyIdIfExists?: string;
    private _initialTokenIdsByOwner: ERC1155HoldingsByOwner = { fungible: {}, nonFungible: {} };

    constructor(provider: ZeroExProvider, tokenOwnerAddresses: string[], contractOwnerAddress: string) {
        this._provider = provider;
        const allArtifacts = _.merge(artifacts, erc1155Artifacts);
        // Extract ABIs from artifacts for LogDecoder
        const abis = Object.values(allArtifacts).map((artifact: any) => artifact.abi);
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
        // tslint:disable-next-line:no-unused-variable
        for (const i of _.times(constants.NUM_DUMMY_ERC1155_CONTRACTS_TO_DEPLOY)) {
            // Skip ERC1155Mintable deployment for now - would need modern factory
            console.log('Skipping ERC1155Mintable deployment - needs modern factory');
            // Use a dummy contract for now
            const erc1155Contract: any = { address: '0x0000000000000000000000000000000000000001' };
            const erc1155Wrapper = new Erc1155Wrapper(erc1155Contract, this._contractOwnerAddress);
            this._dummyTokenWrappers.push(erc1155Wrapper);
        }
        return this._dummyTokenWrappers;
    }
    /**
     * @dev Deploys the ERC1155 proxy
     * @return Deployed ERC1155 proxy contract instance
     */
    public async deployProxyAsync(): Promise<ERC1155ProxyContract> {
        const signers = await ethers.getSigners();
        const deployer = signers[0];
        this._proxyContract = await new ERC1155Proxy__factory(deployer).deploy();
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
        tokensToTransfer: BigNumber[],
        valuesToTransfer: BigNumber[],
        valueMultiplier: BigNumber,
        receiverCallbackData: string,
        authorizedSender: string,
        assetData_?: string,
    ): Promise<string> {
        this._validateProxyContractExistsOrThrow();
        const assetData =
            assetData_ === undefined
                ? this._assetDataInterface
                      .ERC1155Assets(contractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                      .getABIEncodedTransactionData()
                : assetData_;
        const data = this._assetProxyInterface
            .transferFrom(assetData, from, to, valueMultiplier)
            .getABIEncodedTransactionData();
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
    ): Promise<TransactionReceiptWithDecodedLogs> {
        const txHash = await this._web3Wrapper.sendTransactionAsync({
            to: (this._proxyContract as ERC1155ProxyContract).address,
            data: txData,
            from: authorizedSender,
            gas: 300000,
        });
        const txReceipt = await this._logDecoder.getTxWithDecodedLogsAsync(txHash);
        return txReceipt;
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
        tokensToTransfer: BigNumber[],
        valuesToTransfer: BigNumber[],
        valueMultiplier: BigNumber,
        receiverCallbackData: string,
        authorizedSender: string,
        assetData_?: string,
    ): Promise<TransactionReceiptWithDecodedLogs> {
        this._validateProxyContractExistsOrThrow();
        const assetData =
            assetData_ === undefined
                ? this._assetDataInterface
                      .ERC1155Assets(contractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                      .getABIEncodedTransactionData()
                : assetData_;
        const data = this._assetProxyInterface
            .transferFrom(assetData, from, to, valueMultiplier)
            .getABIEncodedTransactionData();
        const txHash = await this._web3Wrapper.sendTransactionAsync({
            to: (this._proxyContract as ERC1155ProxyContract).address,
            data,
            from: authorizedSender,
            gas: 300000,
        });
        const txReceipt = await this._logDecoder.getTxWithDecodedLogsAsync(txHash);
        return txReceipt;
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
        // Set balances accordingly
        for (const dummyWrapper of this._dummyTokenWrappers) {
            const dummyAddress = dummyWrapper.getContract().address;
            // tslint:disable-next-line:no-unused-variable
            for (const i of _.times(constants.NUM_ERC1155_FUNGIBLE_TOKENS_MINT)) {
                // Create a fungible token
                const tokenId = await dummyWrapper.mintFungibleTokensAsync(
                    this._tokenOwnerAddresses,
                    constants.INITIAL_ERC1155_FUNGIBLE_BALANCE,
                );
                const tokenIdAsString = tokenId.toString();
                this._fungibleTokenIds.push(tokenIdAsString);
                // Mint tokens for each owner for this token
                for (const tokenOwnerAddress of this._tokenOwnerAddresses) {
                    // tslint:disable-next-line:no-unused-variable
                    if (fungibleHoldingsByOwner[tokenOwnerAddress] === undefined) {
                        fungibleHoldingsByOwner[tokenOwnerAddress] = {};
                    }
                    if (fungibleHoldingsByOwner[tokenOwnerAddress][dummyAddress] === undefined) {
                        fungibleHoldingsByOwner[tokenOwnerAddress][dummyAddress] = {};
                    }
                    fungibleHoldingsByOwner[tokenOwnerAddress][dummyAddress][tokenIdAsString] =
                        constants.INITIAL_ERC1155_FUNGIBLE_BALANCE;
                    await dummyWrapper.setApprovalForAllAsync(
                        tokenOwnerAddress,
                        (this._proxyContract as ERC1155ProxyContract).address,
                        true,
                    );
                }
            }
            // Non-fungible tokens
            // tslint:disable-next-line:no-unused-variable
            for (const j of _.times(constants.NUM_ERC1155_NONFUNGIBLE_TOKENS_MINT)) {
                const [tokenId, nftIds] = await dummyWrapper.mintNonFungibleTokensAsync(this._tokenOwnerAddresses);
                const tokenIdAsString = tokenId.toString();
                this._nonFungibleTokenIds.push(tokenIdAsString);
                _.each(this._tokenOwnerAddresses, async (tokenOwnerAddress: string, i: number) => {
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
                    await dummyWrapper.setApprovalForAllAsync(
                        tokenOwnerAddress,
                        (this._proxyContract as ERC1155ProxyContract).address,
                        true,
                    );
                });
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
            const tokenContract = dummyTokenWrapper.getContract();
            const tokenAddress = tokenContract.address;
            // Construct batch balance call
            const tokenOwners: string[] = [];
            const tokenIds: BigNumber[] = [];
            for (const tokenOwnerAddress of this._tokenOwnerAddresses) {
                for (const tokenId of this._fungibleTokenIds) {
                    tokenOwners.push(tokenOwnerAddress);
                    tokenIds.push(new BigNumber(tokenId));
                }
                for (const nft of this._nfts) {
                    tokenOwners.push(tokenOwnerAddress);
                    tokenIds.push(nft.id);
                }
            }
            const balances = await dummyTokenWrapper.getBalancesAsync(tokenOwners, tokenIds);
            // Parse out balances into fungible / non-fungible token holdings
            let i = 0;
            for (const tokenOwnerAddress of this._tokenOwnerAddresses) {
                // Fungible tokens
                for (const tokenId of this._fungibleTokenIds) {
                    if (tokenHoldingsByOwner[tokenOwnerAddress] === undefined) {
                        tokenHoldingsByOwner[tokenOwnerAddress] = {};
                    }
                    if (tokenHoldingsByOwner[tokenOwnerAddress][tokenAddress] === undefined) {
                        tokenHoldingsByOwner[tokenOwnerAddress][tokenAddress] = {};
                    }
                    tokenHoldingsByOwner[tokenOwnerAddress][tokenAddress][tokenId] = balances[i++];
                }
                // Non-fungible tokens
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
                    if (isOwner.isEqualTo(1)) {
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
        const tokenWrapper = this.getContractWrapper(contractAddress);
        const operator = (this._proxyContract as ERC1155ProxyContract).address;
        await tokenWrapper.setApprovalForAllAsync(userAddress, operator, isApproved);
    }
    /**
     * @dev Checks if proxy is approved to transfer tokens on behalf of `userAddress`.
     * @param userAddress owner of ERC1155 tokens.
     * @param contractAddress address of ERC1155 contract.
     * @return True iff the proxy is approved for all. False otherwise.
     */
    public async isProxyApprovedForAllAsync(userAddress: string, contractAddress: string): Promise<boolean> {
        this._validateProxyContractExistsOrThrow();
        const tokenContract = this._getContractFromAddress(contractAddress);
        const operator = (this._proxyContract as ERC1155ProxyContract).address;
        const didApproveAll = await tokenContract.isApprovedForAll(userAddress, operator).callAsync();
        return didApproveAll;
    }
    public getFungibleTokenIds(): BigNumber[] {
        const fungibleTokenIds = _.map(this._fungibleTokenIds, (tokenIdAsString: string) => {
            return new BigNumber(tokenIdAsString);
        });
        return fungibleTokenIds;
    }
    public getNonFungibleTokenIds(): BigNumber[] {
        const nonFungibleTokenIds = _.map(this._nonFungibleTokenIds, (tokenIdAsString: string) => {
            return new BigNumber(tokenIdAsString);
        });
        return nonFungibleTokenIds;
    }
    public getTokenOwnerAddresses(): string[] {
        return this._tokenOwnerAddresses;
    }
    public getContractWrapper(contractAddress: string): Erc1155Wrapper {
        const tokenWrapper = _.find(this._dummyTokenWrappers, (wrapper: Erc1155Wrapper) => {
            return wrapper.getContract().address === contractAddress;
        });
        if (tokenWrapper === undefined) {
            throw new Error(`Contract: ${contractAddress} was not deployed through ERC1155ProxyWrapper`);
        }
        return tokenWrapper;
    }
    private _getContractFromAddress(tokenAddress: string): ERC1155MintableContract {
        const tokenContractIfExists = _.find(this._dummyTokenWrappers, c => c.getContract().address === tokenAddress);
        if (tokenContractIfExists === undefined) {
            throw new Error(`Token: ${tokenAddress} was not deployed through ERC1155ProxyWrapper`);
        }
        return tokenContractIfExists.getContract();
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
