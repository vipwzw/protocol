import {
    artifacts as erc1155Artifacts,
} from '../../erc1155/src';
import { ERC1155Mintable } from '@0x/contracts-erc1155';
import { DummyERC1155Receiver, DummyERC1155Receiver__factory } from '@0x/contracts-erc1155/test/wrappers';
import {
    chaiSetup,
    constants,
    expectTransactionFailedAsync,
    expectTransactionFailedWithoutReasonAsync,
    provider,
    txDefaults,
    web3Wrapper,
} from '@0x/test-utils';
import { SafeMathRevertErrors } from '@0x/contracts-utils';
import { BlockchainLifecycle } from '@0x/dev-utils';
import { AssetProxyId, RevertReason } from '@0x/utils';

import * as chai from 'chai';
import { LogWithDecodedArgs } from 'ethereum-types';
import * as ethUtil from 'ethereumjs-util';
import * as _ from 'lodash';
import { ethers } from 'hardhat';

import { ERC1155ProxyWrapper } from '../src/erc1155_proxy_wrapper';
import { ERC1155Proxy, IAssetData, IAssetData__factory } from './wrappers';

import { artifacts } from './artifacts';

chaiSetup.configure();
const expect = chai.expect;
const blockchainLifecycle = new BlockchainLifecycle(provider);

// tslint:disable:no-unnecessary-type-assertion
describe('ERC1155Proxy', () => {
    // constant values used in transfer tests
    const nftOwnerBalance = 1n;
    const nftNotOwnerBalance = 0n;
    const INITIAL_ERC1155_FUNGIBLE_BALANCE = 1000n; // Define local constant since it's missing from test-utils
    const spenderInitialFungibleBalance = INITIAL_ERC1155_FUNGIBLE_BALANCE;
    const receiverInitialFungibleBalance = INITIAL_ERC1155_FUNGIBLE_BALANCE;
    const receiverContractInitialFungibleBalance = 0n;
    const fungibleValueToTransferSmall = spenderInitialFungibleBalance / 100n;
    const fungibleValueToTransferLarge = spenderInitialFungibleBalance / 4n;
    const valueMultiplierSmall = 2n;
    const valueMultiplierNft = 1n;
    const nonFungibleValueToTransfer = nftOwnerBalance;
    const receiverCallbackData = '0x01020304';
    // addresses
    let owner: string;
    let notAuthorized: string;
    let authorized: string;
    let spender: string;
    let receiver: string;
    let receiverContract: string;
    let erc1155Receiver: DummyERC1155Receiver;
    // contracts & wrappers
    let erc1155Proxy: ERC1155Proxy;
    let erc1155ProxyWrapper: ERC1155ProxyWrapper;
    let erc1155Contract: ERC1155Mintable;
    // tokens
    let fungibleTokens: bigint[];
    let nonFungibleTokensOwnedBySpender: bigint[];
    // IAssetData for encoding and decoding assetData
    let assetDataContract: IAssetData;
    // tests
    before(async () => {
        await blockchainLifecycle.startAsync();
    });
    after(async () => {
        await blockchainLifecycle.revertAsync();
    });
    before(async () => {
        /// deploy & configure ERC1155Proxy
        const accounts = await web3Wrapper.getAvailableAddressesAsync();
        const usedAddresses = ([owner, notAuthorized, authorized, spender, receiver] = _.slice(accounts, 0, 5));
        erc1155ProxyWrapper = new ERC1155ProxyWrapper(provider, usedAddresses, owner);
        erc1155Proxy = await erc1155ProxyWrapper.deployProxyAsync();
        await erc1155Proxy.addAuthorizedAddress(authorized);
        const erc1155ProxyAddress = await erc1155Proxy.getAddress();
        await erc1155Proxy.addAuthorizedAddress(erc1155ProxyAddress);
        // deploy & configure ERC1155 tokens and receiver
        [erc1155Contract] = await erc1155ProxyWrapper.deployDummyContractsAsync();
        
        // Deploy DummyERC1155Receiver using TypeChain factory
        const signers = await ethers.getSigners();
        const deployer = signers[0];
        erc1155Receiver = await new DummyERC1155Receiver__factory(deployer).deploy();
        await erc1155Receiver.waitForDeployment();
        receiverContract = await erc1155Receiver.getAddress();
        console.log('✅ Deployed ERC1155Receiver at:', receiverContract);
        await erc1155ProxyWrapper.setBalancesAndAllowancesAsync();
        fungibleTokens = erc1155ProxyWrapper.getFungibleTokenIds();
        const nonFungibleTokens = erc1155ProxyWrapper.getNonFungibleTokenIds();
        const tokenBalances = await erc1155ProxyWrapper.getBalancesAsync();
        nonFungibleTokensOwnedBySpender = [];
        const contractAddress = await erc1155Contract.getAddress();
        _.each(nonFungibleTokens, (nonFungibleToken: bigint) => {
            const nonFungibleTokenAsString = nonFungibleToken.toString();
            const nonFungibleTokenHeldBySpender =
                tokenBalances.nonFungible[spender][contractAddress][nonFungibleTokenAsString][0];
            nonFungibleTokensOwnedBySpender.push(nonFungibleTokenHeldBySpender);
        });
        // set up assetDataContract
        const ownerSigner = signers.find(s => s.address.toLowerCase() === owner.toLowerCase()) || signers[0];
        assetDataContract = IAssetData__factory.connect(constants.NULL_ADDRESS, ownerSigner);
    });
    beforeEach(async () => {
        await blockchainLifecycle.startAsync();
    });
    afterEach(async () => {
        await blockchainLifecycle.revertAsync();
    });
    describe('general', () => {
        it('should revert if undefined function is called', async () => {
            const undefinedSelector = '0x01020304';
            await expectTransactionFailedWithoutReasonAsync(
                web3Wrapper.sendTransactionAsync({
                    from: owner,
                    to: await erc1155Proxy.getAddress(),
                    value: constants.ZERO_AMOUNT,
                    data: undefinedSelector,
                }),
            );
        });
        it('should have an id of 0xa7cb5fb7', async () => {
            const proxyAddress = await erc1155Proxy.getAddress();
            const { getProxyId } = await import('../src/proxy_utils');
            const proxyId = await getProxyId(proxyAddress, provider);
            const expectedProxyId = AssetProxyId.ERC1155;
            expect(proxyId).to.equal(expectedProxyId);
        });
    });
    describe('transferFrom', () => {
        it('should successfully transfer value for a single, fungible token', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiver,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
            );
            // check balances after transfer
            const totalValueTransferred = valuesToTransfer[0] * valueMultiplier;
            const expectedFinalBalances = [
                spenderInitialFungibleBalance - totalValueTransferred,
                receiverInitialFungibleBalance + totalValueTransferred,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should successfully transfer value for the same fungible token several times', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokenToTransfer = fungibleTokens[0];
            const tokensToTransfer = [tokenToTransfer, tokenToTransfer, tokenToTransfer];
            const valuesToTransfer = [
                fungibleValueToTransferSmall + 10n,
                fungibleValueToTransferSmall + 20n,
                fungibleValueToTransferSmall + 30n,
            ];
            const valueMultiplier = valueMultiplierSmall;
            // check balances before transfer
            const expectedInitialBalances = [
                // spender
                spenderInitialFungibleBalance,
                // receiver
                receiverInitialFungibleBalance,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, [tokenToTransfer], expectedInitialBalances);
            // execute transfer
            await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiver,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
            );
            // check balances after transfer
            let totalValueTransferred = _.reduce(valuesToTransfer, (sum: bigint, value: bigint) => {
                return sum + value;
            }) as bigint;
            totalValueTransferred = totalValueTransferred * valueMultiplier;
            const expectedFinalBalances = [
                // spender
                spenderInitialFungibleBalance - totalValueTransferred,
                // receiver
                receiverInitialFungibleBalance + totalValueTransferred,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, [tokenToTransfer], expectedFinalBalances);
        });
        it('should successfully transfer value for several fungible tokens', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = fungibleTokens.slice(0, 3);
            const valuesToTransfer = [
                fungibleValueToTransferSmall + 10n,
                fungibleValueToTransferSmall + 20n,
                fungibleValueToTransferSmall + 30n,
            ];
            const valueMultiplier = valueMultiplierSmall;
            // check balances before transfer
            const expectedInitialBalances = [
                // spender
                spenderInitialFungibleBalance,
                spenderInitialFungibleBalance,
                spenderInitialFungibleBalance,
                // receiver
                receiverInitialFungibleBalance,
                receiverInitialFungibleBalance,
                receiverInitialFungibleBalance,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiver,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
            );
            // check balances after transfer
            const totalValuesTransferred = _.map(valuesToTransfer, (value: bigint) => {
                return value * valueMultiplier;
            });
            const expectedFinalBalances = [
                // spender
                spenderInitialFungibleBalance - totalValuesTransferred[0],
                spenderInitialFungibleBalance - totalValuesTransferred[1],
                spenderInitialFungibleBalance - totalValuesTransferred[2],
                // receiver
                receiverInitialFungibleBalance + totalValuesTransferred[0],
                receiverInitialFungibleBalance + totalValuesTransferred[1],
                receiverInitialFungibleBalance + totalValuesTransferred[2],
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should successfully transfer a non-fungible token', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = nonFungibleTokensOwnedBySpender.slice(0, 1);
            const valuesToTransfer = [nonFungibleValueToTransfer];
            const valueMultiplier = valueMultiplierNft;
            // check balances before transfer
            const expectedInitialBalances = [
                // spender
                nftOwnerBalance,
                // receiver
                nftNotOwnerBalance,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiver,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
            );
            // check balances after transfer
            const expectedFinalBalances = [
                // spender
                nftNotOwnerBalance,
                // receiver
                nftOwnerBalance,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should successfully transfer multiple non-fungible tokens', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = nonFungibleTokensOwnedBySpender.slice(0, 3);
            const valuesToTransfer = [
                nonFungibleValueToTransfer,
                nonFungibleValueToTransfer,
                nonFungibleValueToTransfer,
            ];
            const valueMultiplier = valueMultiplierNft;
            // check balances before transfer
            const expectedInitialBalances = [
                // spender
                nftOwnerBalance,
                nftOwnerBalance,
                nftOwnerBalance,
                // receiver
                nftNotOwnerBalance,
                nftNotOwnerBalance,
                nftNotOwnerBalance,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiver,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
            );
            // check balances after transfer
            const expectedFinalBalances = [
                // spender
                nftNotOwnerBalance,
                nftNotOwnerBalance,
                nftNotOwnerBalance,
                // receiver
                nftOwnerBalance,
                nftOwnerBalance,
                nftOwnerBalance,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should successfully transfer value for a combination of several fungible/non-fungible tokens', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const fungibleTokensToTransfer = fungibleTokens.slice(0, 3);
            const nonFungibleTokensToTransfer = nonFungibleTokensOwnedBySpender.slice(0, 2);
            const tokensToTransfer = fungibleTokensToTransfer.concat(nonFungibleTokensToTransfer);
            const valuesToTransfer = [
                fungibleValueToTransferLarge,
                fungibleValueToTransferSmall,
                fungibleValueToTransferSmall,
                nonFungibleValueToTransfer,
                nonFungibleValueToTransfer,
            ];
            const valueMultiplier = valueMultiplierNft;
            // check balances before transfer
            const expectedInitialBalances = [
                // spender
                spenderInitialFungibleBalance,
                spenderInitialFungibleBalance,
                spenderInitialFungibleBalance,
                nftOwnerBalance,
                nftOwnerBalance,
                // receiver
                receiverInitialFungibleBalance,
                receiverInitialFungibleBalance,
                receiverInitialFungibleBalance,
                nftNotOwnerBalance,
                nftNotOwnerBalance,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiver,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
            );
            // check balances after transfer
            const totalValuesTransferred = _.map(valuesToTransfer, (value: bigint) => {
                return value * valueMultiplier;
            });
            const expectedFinalBalances = [
                // spender
                expectedInitialBalances[0] - totalValuesTransferred[0],
                expectedInitialBalances[1] - totalValuesTransferred[1],
                expectedInitialBalances[2] - totalValuesTransferred[2],
                expectedInitialBalances[3] - totalValuesTransferred[3],
                expectedInitialBalances[4] - totalValuesTransferred[4],
                // receiver
                expectedInitialBalances[5] + totalValuesTransferred[0],
                expectedInitialBalances[6] + totalValuesTransferred[1],
                expectedInitialBalances[7] + totalValuesTransferred[2],
                expectedInitialBalances[8] + totalValuesTransferred[3],
                expectedInitialBalances[9] + totalValuesTransferred[4],
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should successfully transfer value to a smart contract and trigger its callback', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiverContract];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const totalValuesTransferred = _.map(valuesToTransfer, (value: bigint) => {
                return value * valueMultiplier;
            });
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverContractInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            const txReceipt = await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiverContract,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
            );
            // check receiver log ignored extra asset data
            expect(txReceipt.logs.length).to.be.equal(2);
            const receiverLog = txReceipt
                .logs[1];
            const parsedLog = erc1155Receiver.interface.parseLog(receiverLog)!;
            expect(parsedLog.args.operator).to.be.equal(await erc1155Proxy.getAddress());
            expect(parsedLog.args.from).to.be.equal(spender);
            expect(parsedLog.args.tokenIds.length).to.be.deep.equal(1);
            expect(parsedLog.args.tokenIds[0]).to.equal(tokensToTransfer[0]);
            expect(parsedLog.args.tokenValues.length).to.be.deep.equal(1);
            expect(parsedLog.args.tokenValues[0]).to.equal(totalValuesTransferred[0]);
            // note - if the `extraData` is ignored then the receiver log should ignore it as well.
            expect(parsedLog.args.data).to.be.deep.equal(receiverCallbackData);
            // check balances after transfer
            const expectedFinalBalances = [
                expectedInitialBalances[0] - totalValuesTransferred[0],
                expectedInitialBalances[1] + totalValuesTransferred[0],
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should successfully transfer value to a smart contract and trigger its callback, when callback `data` is NULL', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiverContract];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const totalValuesTransferred = _.map(valuesToTransfer, (value: bigint) => {
                return value * valueMultiplier;
            });
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverContractInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            const nullReceiverCallbackData = '0x';
            const txReceipt = await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiverContract,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                nullReceiverCallbackData,
                authorized,
            );
            // check receiver log ignored extra asset data
            expect(txReceipt.logs.length).to.be.equal(2);
            const receiverLog = txReceipt
                .logs[1];
            const parsedLog = erc1155Receiver.interface.parseLog(receiverLog)!;
            expect(parsedLog.args.operator).to.be.equal(await erc1155Proxy.getAddress());
            expect(parsedLog.args.from).to.be.equal(spender);
            expect(parsedLog.args.tokenIds.length).to.be.deep.equal(1);
            expect(parsedLog.args.tokenIds[0]).to.equal(tokensToTransfer[0]);
            expect(parsedLog.args.tokenValues.length).to.be.deep.equal(1);
            expect(parsedLog.args.tokenValues[0]).to.equal(totalValuesTransferred[0]);
            // note - if the `extraData` is ignored then the receiver log should ignore it as well.
            expect(parsedLog.args.data).to.be.deep.equal(nullReceiverCallbackData);
            // check balances after transfer
            const expectedFinalBalances = [
                expectedInitialBalances[0] - totalValuesTransferred[0],
                expectedInitialBalances[1] + totalValuesTransferred[0],
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should successfully transfer value to a smart contract and trigger its callback, when callback `data` is one word', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiverContract];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const totalValuesTransferred = _.map(valuesToTransfer, (value: bigint) => {
                return value * valueMultiplier;
            });
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverContractInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // create word of callback data
            const customReceiverCallbackData = '0x0102030405060708091001020304050607080910010203040506070809100102';
            const customReceiverCallbackDataAsBuffer = ethUtil.toBuffer(customReceiverCallbackData);
            const oneWordInBytes = 32;
            expect(customReceiverCallbackDataAsBuffer.byteLength).to.be.equal(oneWordInBytes);
            // execute transfer
            const txReceipt = await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiverContract,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                customReceiverCallbackData,
                authorized,
            );
            // check receiver log ignored extra asset data
            expect(txReceipt.logs.length).to.be.equal(2);
            const receiverLog = txReceipt
                .logs[1];
            const parsedLog = erc1155Receiver.interface.parseLog(receiverLog)!;
            expect(parsedLog.args.operator).to.be.equal(await erc1155Proxy.getAddress());
            expect(parsedLog.args.from).to.be.equal(spender);
            expect(parsedLog.args.tokenIds.length).to.be.deep.equal(1);
            expect(parsedLog.args.tokenIds[0]).to.equal(tokensToTransfer[0]);
            expect(parsedLog.args.tokenValues.length).to.be.deep.equal(1);
            expect(parsedLog.args.tokenValues[0]).to.equal(totalValuesTransferred[0]);
            // note - if the `extraData` is ignored then the receiver log should ignore it as well.
            expect(parsedLog.args.data).to.be.deep.equal(customReceiverCallbackData);
            // check balances after transfer
            const expectedFinalBalances = [
                expectedInitialBalances[0] - totalValuesTransferred[0],
                expectedInitialBalances[1] + totalValuesTransferred[0],
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should successfully transfer value to a smart contract and trigger its callback, when callback `data` is multiple words', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiverContract];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const totalValuesTransferred = _.map(valuesToTransfer, (value: bigint) => {
                return value * valueMultiplier;
            });
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverContractInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // create word of callback data
            const scalar = 5;
            const customReceiverCallbackData = `0x${'0102030405060708091001020304050607080910010203040506070809100102'.repeat(
                scalar,
            )}`;
            const customReceiverCallbackDataAsBuffer = ethUtil.toBuffer(customReceiverCallbackData);
            const oneWordInBytes = 32;
            expect(customReceiverCallbackDataAsBuffer.byteLength).to.be.equal(oneWordInBytes * scalar);
            // execute transfer
            const txReceipt = await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiverContract,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                customReceiverCallbackData,
                authorized,
            );
            // check receiver log ignored extra asset data
            expect(txReceipt.logs.length).to.be.equal(2);
            const receiverLog = txReceipt
                .logs[1];
            const parsedLog = erc1155Receiver.interface.parseLog(receiverLog)!;
            expect(parsedLog.args.operator).to.be.equal(await erc1155Proxy.getAddress());
            expect(parsedLog.args.from).to.be.equal(spender);
            expect(parsedLog.args.tokenIds.length).to.be.deep.equal(1);
            expect(parsedLog.args.tokenIds[0]).to.equal(tokensToTransfer[0]);
            expect(parsedLog.args.tokenValues.length).to.be.deep.equal(1);
            expect(parsedLog.args.tokenValues[0]).to.equal(totalValuesTransferred[0]);
            // note - if the `extraData` is ignored then the receiver log should ignore it as well.
            expect(parsedLog.args.data).to.be.deep.equal(customReceiverCallbackData);
            // check balances after transfer
            const expectedFinalBalances = [
                expectedInitialBalances[0] - totalValuesTransferred[0],
                expectedInitialBalances[1] + totalValuesTransferred[0],
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should successfully transfer value to a smart contract and trigger its callback, when callback `data` is multiple words but not word-aligned', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiverContract];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const totalValuesTransferred = _.map(valuesToTransfer, (value: bigint) => {
                return value * valueMultiplier;
            });
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverContractInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // create word of callback data
            const scalar = 5;
            const customReceiverCallbackData = `0x${'0102030405060708091001020304050607080910010203040506070809100102'.repeat(
                scalar,
            )}090807`;
            const customReceiverCallbackDataAsBuffer = ethUtil.toBuffer(customReceiverCallbackData);
            const oneWordInBytes = 32;
            expect(customReceiverCallbackDataAsBuffer.byteLength).to.be.greaterThan(oneWordInBytes * scalar);
            expect(customReceiverCallbackDataAsBuffer.byteLength).to.be.lessThan(oneWordInBytes * (scalar + 1));
            // execute transfer
            const txReceipt = await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiverContract,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                customReceiverCallbackData,
                authorized,
            );
            // check receiver log ignored extra asset data
            expect(txReceipt.logs.length).to.be.equal(2);
            const receiverLog = txReceipt
                .logs[1];
            const parsedLog = erc1155Receiver.interface.parseLog(receiverLog)!;
            expect(parsedLog.args.operator).to.be.equal(await erc1155Proxy.getAddress());
            expect(parsedLog.args.from).to.be.equal(spender);
            expect(parsedLog.args.tokenIds.length).to.be.deep.equal(1);
            expect(parsedLog.args.tokenIds[0]).to.equal(tokensToTransfer[0]);
            expect(parsedLog.args.tokenValues.length).to.be.deep.equal(1);
            expect(parsedLog.args.tokenValues[0]).to.equal(totalValuesTransferred[0]);
            // note - if the `extraData` is ignored then the receiver log should ignore it as well.
            expect(parsedLog.args.data).to.be.deep.equal(customReceiverCallbackData);
            // check balances after transfer
            const expectedFinalBalances = [
                expectedInitialBalances[0] - totalValuesTransferred[0],
                expectedInitialBalances[1] + totalValuesTransferred[0],
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should successfully transfer value and ignore extra assetData', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiverContract];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const totalValuesTransferred = _.map(valuesToTransfer, (value: bigint) => {
                return value * valueMultiplier;
            });
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const assetData = assetDataContract.interface.encodeFunctionData(
                'ERC1155Assets',
                [erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData]
            );
            const extraData = '0102030405060708091001020304050607080910010203040506070809100102';
            const assetDataWithExtraData = `${assetData}${extraData}`;
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverContractInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            const txReceipt = await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiverContract,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
                assetDataWithExtraData,
            );
            // check receiver log ignored extra asset data
            expect(txReceipt.logs.length).to.be.equal(2);
            const receiverLog = txReceipt
                .logs[1];
            const parsedLog = erc1155Receiver.interface.parseLog(receiverLog)!;
            expect(parsedLog.args.operator).to.be.equal(await erc1155Proxy.getAddress());
            expect(parsedLog.args.from).to.be.equal(spender);
            expect(parsedLog.args.tokenIds.length).to.be.deep.equal(1);
            expect(parsedLog.args.tokenIds[0]).to.equal(tokensToTransfer[0]);
            expect(parsedLog.args.tokenValues.length).to.be.deep.equal(1);
            expect(parsedLog.args.tokenValues[0]).to.equal(totalValuesTransferred[0]);
            // note - if the `extraData` is ignored then the receiver log should ignore it as well.
            expect(parsedLog.args.data).to.be.deep.equal(receiverCallbackData);
            // check balances after transfer
            const expectedFinalBalances = [
                expectedInitialBalances[0] - totalValuesTransferred[0],
                expectedInitialBalances[1] + totalValuesTransferred[0],
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should successfully transfer if token ids and values are abi encoded to same entry in calldata', async () => {
            /**
             * Suppose the `tokensToTransfer` and `valuesToTransfer` are identical; their offsets in
             * the ABI-encoded asset data may be the same. E.g. token IDs [1, 2] and values [1, 2].
             * Suppose we scale by a factor of 2, then we expect to trade token IDs [1, 2] and values [2, 4].
             * This test ensures that scaling the values does not simultaneously scale the token IDs.
             */
            ///// Step 1/5 /////
            // Create tokens with ids [1, 2, 3, 4] and mint a balance of 4 for the `spender`
            const tokensToCreate = [1n, 2n, 3n, 4n];
            const spenderInitialBalance = 4n;
            const receiverInitialBalance = 0n;
            const tokenUri = '';
            for (const tokenToCreate of tokensToCreate) {
                // create token
                const signers = await ethers.getSigners();
                const ownerSigner = signers.find(s => s.address.toLowerCase() === owner.toLowerCase()) || signers[0];
                const contractWithSigner = erc1155Contract.connect(ownerSigner);
                await contractWithSigner.createWithType(tokenToCreate, tokenUri);

                // mint balance for spender
                await contractWithSigner.mintFungible(tokenToCreate.toString(), [spender], [spenderInitialBalance.toString()]);
            }
            ///// Step 2/5 /////
            // Check balances before transfer
            const balanceHolders = [spender, spender, spender, spender, receiver, receiver, receiver, receiver];
            const balanceTokens = tokensToCreate.concat(tokensToCreate);
            const initialBalances = await _getBalancesAsync(erc1155Contract, balanceHolders, balanceTokens);
            const expectedInitialBalances = [
                spenderInitialBalance, // Token ID 1 / Spender Balance
                spenderInitialBalance, // Token ID 2 / Spender Balance
                spenderInitialBalance, // Token ID 3 / Spender Balance
                spenderInitialBalance, // Token ID 4 / Spender Balance
                receiverInitialBalance, // Token ID 1 / Receiver Balance
                receiverInitialBalance, // Token ID 2 / Receiver Balance
                receiverInitialBalance, // Token ID 3 / Receiver Balance
                receiverInitialBalance, // Token ID 4 / Receiver Balance
            ];
            expect(initialBalances).to.be.deep.equal(expectedInitialBalances);
            ///// Step 3/5 /////
            // Create optimized calldata. We expect it to be formatted like the table below.
            // 0x         0000000000000000000000000b1ba0af832d7c05fd64161e0db78e85978e8082      // ERC1155 contract address
            // 0x20       0000000000000000000000000000000000000000000000000000000000000080      // Offset to token IDs
            // 0x40       0000000000000000000000000000000000000000000000000000000000000080      // Offset to token values (same as IDs)
            // 0x60       00000000000000000000000000000000000000000000000000000000000000e0      // Offset to data
            // 0x80       0000000000000000000000000000000000000000000000000000000000000002      // Length of token Ids / token values
            // 0xA0       0000000000000000000000000000000000000000000000000000000000000001      // First Token ID / Token value
            // 0xC0       0000000000000000000000000000000000000000000000000000000000000002      // Second Token ID / Token value
            // 0xE0       0000000000000000000000000000000000000000000000000000000000000004      // Length of callback data
            // 0x100      0102030400000000000000000000000000000000000000000000000000000000      // Callback data
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const tokensToTransfer = [1n, 2n];
            const valuesToTransfer = tokensToTransfer;
            const valueMultiplier = 2n;

            // hand encode optimized assetData because our tooling (based on LibAssetData.sol/ERC1155Assets) does not use optimized encoding
            const selector = assetDataContract.getSelector('ERC1155Assets');
            const assetDataWithoutContractAddress =
                '0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000040102030400000000000000000000000000000000000000000000000000000000';
            const assetData = `${selector}000000000000000000000000${erc1155ContractAddress.substr(
                2,
            )}${assetDataWithoutContractAddress}`;

            ///// Step 4/5 /////
            // Transfer token IDs [1, 2] and amounts [1, 2] with a multiplier of 2;
            // the expected trade will be token IDs [1, 2] and amounts [2, 4]
            await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiver,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
                assetData,
            );
            ///// Step 5/5 /////
            // Validate final balances
            const finalBalances = await _getBalancesAsync(erc1155Contract, balanceHolders, balanceTokens);
            const expectedAmountsTransferred = _.map(valuesToTransfer, value => {
                return value * valueMultiplier;
            });
            const expectedFinalBalances = [
                spenderInitialBalance - expectedAmountsTransferred[0], // Token ID 1 / Spender Balance
                spenderInitialBalance - expectedAmountsTransferred[1], // Token ID 2 / Spender Balance
                spenderInitialBalance, // Token ID 3 / Spender Balance
                spenderInitialBalance, // Token ID 4 / Spender Balance
                receiverInitialBalance + expectedAmountsTransferred[0], // Token ID 1 / Receiver Balance
                receiverInitialBalance + expectedAmountsTransferred[1], // Token ID 2 / Receiver Balance
                receiverInitialBalance, // Token ID 3 / Receiver Balance
                receiverInitialBalance, // Token ID 4 / Receiver Balance
            ];
            expect(finalBalances).to.be.deep.equal(expectedFinalBalances);
        });
        it('should successfully transfer if token values and data are abi encoded to same entry in calldata', async () => {
            /**
             * This test ensures that scaling the values does not simultaneously scale the data.
             * Note that this test is slightly more contrived than the test above, as asset data must be
             * intentionally hand-modified to produce this result: a functioning abi encoder will not produce it.
             */
            ///// Step 1/5 /////
            // Create tokens with ids [1, 2, 3, 4] and mint a balance of 4 for the `spender`
            const tokensToCreate = [1n, 2n, 3n, 4n];
            const spenderInitialBalance = 4n;
            const receiverInitialBalance = 0n;
            const tokenUri = '';
            for (const tokenToCreate of tokensToCreate) {
                // create token
                const signers = await ethers.getSigners();
                const ownerSigner = signers.find(s => s.address.toLowerCase() === owner.toLowerCase()) || signers[0];
                const contractWithSigner = erc1155Contract.connect(ownerSigner);
                await contractWithSigner.createWithType(tokenToCreate, tokenUri);

                // mint balance for spender
                await contractWithSigner.mintFungible(tokenToCreate.toString(), [spender], [spenderInitialBalance.toString()]);
            }
            ///// Step 2/5 /////
            // Check balances before transfer
            const balanceHolders = [
                spender,
                spender,
                spender,
                spender,
                receiverContract,
                receiverContract,
                receiverContract,
                receiverContract,
            ];
            const balanceTokens = tokensToCreate.concat(tokensToCreate);
            const initialBalances = await _getBalancesAsync(erc1155Contract, balanceHolders, balanceTokens);
            const expectedInitialBalances = [
                spenderInitialBalance, // Token ID 1 / Spender Balance
                spenderInitialBalance, // Token ID 2 / Spender Balance
                spenderInitialBalance, // Token ID 3 / Spender Balance
                spenderInitialBalance, // Token ID 4 / Spender Balance
                receiverInitialBalance, // Token ID 1 / Receiver Balance
                receiverInitialBalance, // Token ID 2 / Receiver Balance
                receiverInitialBalance, // Token ID 3 / Receiver Balance
                receiverInitialBalance, // Token ID 4 / Receiver Balance
            ];
            expect(initialBalances).to.be.deep.equal(expectedInitialBalances);
            ///// Step 3/5 /////
            // Create optimized calldata. We format like the table below.
            // 0x         0000000000000000000000000b1ba0af832d7c05fd64161e0db78e85978e8082      // ERC1155 contract address
            // 0x20       0000000000000000000000000000000000000000000000000000000000000080      // Offset to token IDs
            // 0x40       00000000000000000000000000000000000000000000000000000000000000e0      // Offset to token values
            // 0x60       00000000000000000000000000000000000000000000000000000000000000e0      // Offset to data (same as values)
            // 0x80       0000000000000000000000000000000000000000000000000000000000000002      // Length of token Ids
            // 0xA0       0000000000000000000000000000000000000000000000000000000000000001      // First Token ID
            // 0xC0       0000000000000000000000000000000000000000000000000000000000000002      // Second Token ID
            // 0xE0       0000000000000000000000000000000000000000000000000000000000000002      // Length of values (Length of data)
            // 0x100      0000000000000000000000000000000000000000000000000000000000000002      // First Value
            // 0x120      0000000000000000000000000000000000000000000000000000000000000002      // Second Value
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const tokensToTransfer = [1n, 2n];
            const valuesToTransfer = [2n, 2n];
            const valueMultiplier = 2n;
            // create callback data that is the encoded version of `valuesToTransfer`
            const generatedAssetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            // remove the function selector and contract address from check, as these change on each test
            const offsetToTokenIds = 74;
            const assetDataSelectorAndContractAddress = generatedAssetData.substr(0, offsetToTokenIds);
            const assetDataParameters =
                '000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002';
            const assetData = `${assetDataSelectorAndContractAddress}${assetDataParameters}`;
            ///// Step 4/5 /////
            // Transfer tokens
            const txReceipt = await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiverContract,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
                assetData,
            );
            // check receiver log ignored extra asset data
            expect(txReceipt.logs.length).to.be.equal(2);
            const receiverLog = txReceipt
                .logs[1];
            const parsedLog = erc1155Receiver.interface.parseLog(receiverLog)!;
            expect(parsedLog.args.operator).to.be.equal(await erc1155Proxy.getAddress());
            expect(parsedLog.args.from).to.be.equal(spender);
            expect(parsedLog.args.tokenIds.length).to.be.deep.equal(2);
            expect(parsedLog.args.tokenIds[0]).to.equal(tokensToTransfer[0]);
            expect(parsedLog.args.tokenIds[1]).to.equal(tokensToTransfer[1]);
            expect(parsedLog.args.tokenValues.length).to.be.deep.equal(2);
            expect(parsedLog.args.tokenValues[0]).to.equal(valuesToTransfer[0] * valueMultiplier);
            expect(parsedLog.args.tokenValues[1]).to.equal(valuesToTransfer[1] * valueMultiplier);
            expect(parsedLog.args.data).to.be.deep.equal('0x0000');
            ///// Step 5/5 /////
            // Validate final balances
            const finalBalances = await _getBalancesAsync(erc1155Contract, balanceHolders, balanceTokens);
            const expectedAmountsTransferred = _.map(valuesToTransfer, value => {
                return value * valueMultiplier;
            });
            const expectedFinalBalances = [
                spenderInitialBalance - expectedAmountsTransferred[0], // Token ID 1 / Spender Balance
                spenderInitialBalance - expectedAmountsTransferred[1], // Token ID 2 / Spender Balance
                spenderInitialBalance, // Token ID 3 / Spender Balance
                spenderInitialBalance, // Token ID 4 / Spender Balance
                receiverInitialBalance + expectedAmountsTransferred[0], // Token ID 1 / Receiver Balance
                receiverInitialBalance + expectedAmountsTransferred[1], // Token ID 2 / Receiver Balance
                receiverInitialBalance, // Token ID 3 / Receiver Balance
                receiverInitialBalance, // Token ID 4 / Receiver Balance
            ];
            expect(finalBalances).to.be.deep.equal(expectedFinalBalances);
        });
        it('should successfully transfer if token ids, values and data are abi encoded to same entry in calldata', async () => {
            /**
             * This test combines the two tests above.
             * Similar to the test above, the asset data must be manually constructed.
             */
            ///// Step 1/5 /////
            // Create tokens with ids [1, 2, 3, 4] and mint a balance of 4 for the `spender`
            const tokensToCreate = [1n, 2n, 3n, 4n];
            const spenderInitialBalance = 4n;
            const receiverInitialBalance = 0n;
            const tokenUri = '';
            for (const tokenToCreate of tokensToCreate) {
                // create token
                const signers = await ethers.getSigners();
                const ownerSigner = signers.find(s => s.address.toLowerCase() === owner.toLowerCase()) || signers[0];
                const contractWithSigner = erc1155Contract.connect(ownerSigner);
                await contractWithSigner.createWithType(tokenToCreate, tokenUri);

                // mint balance for spender
                await contractWithSigner.mintFungible(tokenToCreate.toString(), [spender], [spenderInitialBalance.toString()]);
            }
            ///// Step 2/5 /////
            // Check balances before transfer
            const balanceHolders = [
                spender,
                spender,
                spender,
                spender,
                receiverContract,
                receiverContract,
                receiverContract,
                receiverContract,
            ];
            const balanceTokens = tokensToCreate.concat(tokensToCreate);
            const initialBalances = await _getBalancesAsync(erc1155Contract, balanceHolders, balanceTokens);
            const expectedInitialBalances = [
                spenderInitialBalance, // Token ID 1 / Spender Balance
                spenderInitialBalance, // Token ID 2 / Spender Balance
                spenderInitialBalance, // Token ID 3 / Spender Balance
                spenderInitialBalance, // Token ID 4 / Spender Balance
                receiverInitialBalance, // Token ID 1 / Receiver Balance
                receiverInitialBalance, // Token ID 2 / Receiver Balance
                receiverInitialBalance, // Token ID 3 / Receiver Balance
                receiverInitialBalance, // Token ID 4 / Receiver Balance
            ];
            expect(initialBalances).to.be.deep.equal(expectedInitialBalances);
            ///// Step 3/5 /////
            // Create optimized calldata. We format like the table below.
            // 0x         0000000000000000000000000b1ba0af832d7c05fd64161e0db78e85978e8082      // ERC1155 contract address
            // 0x20       0000000000000000000000000000000000000000000000000000000000000080      // Offset to token IDs
            // 0x40       0000000000000000000000000000000000000000000000000000000000000080      // Offset to token values
            // 0x60       0000000000000000000000000000000000000000000000000000000000000080      // Offset to data (same as values)
            // 0x80       0000000000000000000000000000000000000000000000000000000000000002      // Length of token Ids (Length of values / data)
            // 0xA0       0000000000000000000000000000000000000000000000000000000000000001      // First Token ID (First Value)
            // 0xC0       0000000000000000000000000000000000000000000000000000000000000002      // Second Token ID (Second Value)
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const tokensToTransfer = [1n, 2n];
            const valuesToTransfer = [1n, 2n];
            const valueMultiplier = 2n;
            // create callback data that is the encoded version of `valuesToTransfer`
            const generatedAssetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            // remove the function selector and contract address from check, as these change on each test
            const offsetToTokenIds = 74;
            const assetDataSelectorAndContractAddress = generatedAssetData.substr(0, offsetToTokenIds);
            const assetDataParameters =
                '000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002';
            const assetData = `${assetDataSelectorAndContractAddress}${assetDataParameters}`;
            ///// Step 4/5 /////
            // Transfer tokens
            const txReceipt = await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiverContract,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
                assetData,
            );
            // check receiver log ignored extra asset data
            expect(txReceipt.logs.length).to.be.equal(2);
            const receiverLog = txReceipt
                .logs[1];
            const parsedLog = erc1155Receiver.interface.parseLog(receiverLog)!;
            expect(parsedLog.args.operator).to.be.equal(await erc1155Proxy.getAddress());
            expect(parsedLog.args.from).to.be.equal(spender);
            expect(parsedLog.args.tokenIds.length).to.be.deep.equal(2);
            expect(parsedLog.args.tokenIds[0]).to.equal(tokensToTransfer[0]);
            expect(parsedLog.args.tokenIds[1]).to.equal(tokensToTransfer[1]);
            expect(parsedLog.args.tokenValues.length).to.be.deep.equal(2);
            expect(parsedLog.args.tokenValues[0]).to.equal(valuesToTransfer[0] * valueMultiplier);
            expect(parsedLog.args.tokenValues[1]).to.equal(valuesToTransfer[1] * valueMultiplier);
            expect(parsedLog.args.data).to.be.deep.equal('0x0000');
            ///// Step 5/5 /////
            // Validate final balances
            const finalBalances = await _getBalancesAsync(erc1155Contract, balanceHolders, balanceTokens);
            const expectedAmountsTransferred = _.map(valuesToTransfer, value => {
                return value * valueMultiplier;
            });
            const expectedFinalBalances = [
                spenderInitialBalance - expectedAmountsTransferred[0], // Token ID 1 / Spender Balance
                spenderInitialBalance - expectedAmountsTransferred[1], // Token ID 2 / Spender Balance
                spenderInitialBalance, // Token ID 3 / Spender Balance
                spenderInitialBalance, // Token ID 4 / Spender Balance
                receiverInitialBalance + expectedAmountsTransferred[0], // Token ID 1 / Receiver Balance
                receiverInitialBalance + expectedAmountsTransferred[1], // Token ID 2 / Receiver Balance
                receiverInitialBalance, // Token ID 3 / Receiver Balance
                receiverInitialBalance, // Token ID 4 / Receiver Balance
            ];
            expect(finalBalances).to.be.deep.equal(expectedFinalBalances);
        });
        it('should revert if token ids resolves to outside the bounds of calldata', async () => {
            // setup test parameters
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const assetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            // The asset data we just generated will look like this:
            // a7cb5fb7
            // 0x         0000000000000000000000000b1ba0af832d7c05fd64161e0db78e85978e8082
            // 0x20       0000000000000000000000000000000000000000000000000000000000000080 // offset to token ids
            // 0x40       00000000000000000000000000000000000000000000000000000000000000c0
            // 0x60       0000000000000000000000000000000000000000000000000000000000000100
            // 0x80       0000000000000000000000000000000000000000000000000000000000000001
            // 0xA0       0000000000000000000000000000000100000000000000000000000000000000
            // 0xC0       0000000000000000000000000000000000000000000000000000000000000001
            // 0xE0       0000000000000000000000000000000000000000000000878678326eac900000
            // 0x100      0000000000000000000000000000000000000000000000000000000000000004
            // 0x120      0102030400000000000000000000000000000000000000000000000000000000
            //
            // We want to change the offset to token ids to point outside the calldata.
            const encodedOffsetToTokenIds = '0000000000000000000000000000000000000000000000000000000000000080';
            const badEncodedOffsetToTokenIds = '0000000000000000000000000000000000000000000000000000000000000180';
            const assetDataWithBadTokenIdsOffset = assetData.replace(
                encodedOffsetToTokenIds,
                badEncodedOffsetToTokenIds,
            );
            // execute transfer
            await expectTransactionFailedWithoutReasonAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiverContract,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                    assetDataWithBadTokenIdsOffset,
                ),
            );
        });
        it('should revert if an element of token ids lies to outside the bounds of calldata', async () => {
            // setup test parameters
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const assetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            // The asset data we just generated will look like this:
            // a7cb5fb7
            // 0x         0000000000000000000000000b1ba0af832d7c05fd64161e0db78e85978e8082
            // 0x20       0000000000000000000000000000000000000000000000000000000000000080 // offset to token ids
            // 0x40       00000000000000000000000000000000000000000000000000000000000000c0
            // 0x60       0000000000000000000000000000000000000000000000000000000000000100
            // 0x80       0000000000000000000000000000000000000000000000000000000000000001
            // 0xA0       0000000000000000000000000000000100000000000000000000000000000000
            // 0xC0       0000000000000000000000000000000000000000000000000000000000000001
            // 0xE0       0000000000000000000000000000000000000000000000878678326eac900000
            // 0x100      0000000000000000000000000000000000000000000000000000000000000004
            // 0x120      0102030400000000000000000000000000000000000000000000000000000000
            //
            // We want to change the offset to token ids to the end of calldata.
            // Then we'll add an invalid length: we encode length of 2 but only add 1 element.
            const encodedOffsetToTokenIds = '0000000000000000000000000000000000000000000000000000000000000080';
            const newEcodedOffsetToTokenIds = '0000000000000000000000000000000000000000000000000000000000000140';
            const assetDataWithNewTokenIdsOffset = assetData.replace(
                encodedOffsetToTokenIds,
                newEcodedOffsetToTokenIds,
            );
            const encodedTokenIdsLength = '0000000000000000000000000000000000000000000000000000000000000002';
            const encodedTokenIdValues = '0000000000000000000000000000000000000000000000000000000000000001';
            const assetDataWithBadTokenIds = `${assetDataWithNewTokenIdsOffset}${encodedTokenIdsLength}${encodedTokenIdValues}`;
            // execute transfer
            await expectTransactionFailedWithoutReasonAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiverContract,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                    assetDataWithBadTokenIds,
                ),
            );
        });
        it('should revert token ids length overflows', async () => {
            // setup test parameters
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const assetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            // The asset data we just generated will look like this:
            // a7cb5fb7
            // 0x         0000000000000000000000000b1ba0af832d7c05fd64161e0db78e85978e8082
            // 0x20       0000000000000000000000000000000000000000000000000000000000000080 // offset to token ids
            // 0x40       00000000000000000000000000000000000000000000000000000000000000c0
            // 0x60       0000000000000000000000000000000000000000000000000000000000000100
            // 0x80       0000000000000000000000000000000000000000000000000000000000000001
            // 0xA0       0000000000000000000000000000000100000000000000000000000000000000
            // 0xC0       0000000000000000000000000000000000000000000000000000000000000001
            // 0xE0       0000000000000000000000000000000000000000000000878678326eac900000
            // 0x100      0000000000000000000000000000000000000000000000000000000000000004
            // 0x120      0102030400000000000000000000000000000000000000000000000000000000
            //
            // We want to change the offset to token ids to point to the end of calldata
            const encodedOffsetToTokenIds = '0000000000000000000000000000000000000000000000000000000000000080';
            const badEncodedOffsetToTokenIds = '0000000000000000000000000000000000000000000000000000000000000140';
            const assetDataWithBadTokenIdsOffset = assetData.replace(
                encodedOffsetToTokenIds,
                badEncodedOffsetToTokenIds,
            );
            // We want a length that will overflow when converted to bytes - ie, multiplied by 32.
            const encodedIdsLengthOverflow = '0800000000000000000000000000000000000000000000000000000000000001';
            const buffer = '0'.repeat(64 * 10);
            const assetDataWithOverflow = `${assetDataWithBadTokenIdsOffset}${encodedIdsLengthOverflow}${buffer}`;
            // execute transfer
            await expectTransactionFailedWithoutReasonAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiverContract,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                    assetDataWithOverflow,
                ),
            );
        });
        it('should revert token values length overflows', async () => {
            // setup test parameters
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const assetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            // The asset data we just generated will look like this:
            // a7cb5fb7
            // 0x         0000000000000000000000000b1ba0af832d7c05fd64161e0db78e85978e8082
            // 0x20       0000000000000000000000000000000000000000000000000000000000000080
            // 0x40       00000000000000000000000000000000000000000000000000000000000000c0 // offset to token values
            // 0x60       0000000000000000000000000000000000000000000000000000000000000100
            // 0x80       0000000000000000000000000000000000000000000000000000000000000001
            // 0xA0       0000000000000000000000000000000100000000000000000000000000000000
            // 0xC0       0000000000000000000000000000000000000000000000000000000000000001
            // 0xE0       0000000000000000000000000000000000000000000000878678326eac900000
            // 0x100      0000000000000000000000000000000000000000000000000000000000000004
            // 0x120      0102030400000000000000000000000000000000000000000000000000000000
            //
            // We want to change the offset to token values to point to the end of calldata
            const encodedOffsetToTokenIds = '00000000000000000000000000000000000000000000000000000000000000c0';
            const badEncodedOffsetToTokenIds = '0000000000000000000000000000000000000000000000000000000000000140';
            const assetDataWithBadTokenIdsOffset = assetData.replace(
                encodedOffsetToTokenIds,
                badEncodedOffsetToTokenIds,
            );
            // We want a length that will overflow when converted to bytes - ie, multiplied by 32.
            const encodedIdsLengthOverflow = '0800000000000000000000000000000000000000000000000000000000000001';
            const buffer = '0'.repeat(64 * 10);
            const assetDataWithOverflow = `${assetDataWithBadTokenIdsOffset}${encodedIdsLengthOverflow}${buffer}`;
            // execute transfer
            await expectTransactionFailedWithoutReasonAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiverContract,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                    assetDataWithOverflow,
                ),
            );
        });
        it('should revert token data length overflows', async () => {
            // setup test parameters
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const assetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            // The asset data we just generated will look like this:
            // a7cb5fb7
            // 0x         0000000000000000000000000b1ba0af832d7c05fd64161e0db78e85978e8082
            // 0x20       0000000000000000000000000000000000000000000000000000000000000080
            // 0x40       00000000000000000000000000000000000000000000000000000000000000c0
            // 0x60       0000000000000000000000000000000000000000000000000000000000000100 // offset to token data
            // 0x80       0000000000000000000000000000000000000000000000000000000000000001
            // 0xA0       0000000000000000000000000000000100000000000000000000000000000000
            // 0xC0       0000000000000000000000000000000000000000000000000000000000000001
            // 0xE0       0000000000000000000000000000000000000000000000878678326eac900000
            // 0x100      0000000000000000000000000000000000000000000000000000000000000004
            // 0x120      0102030400000000000000000000000000000000000000000000000000000000
            //
            // We want to change the offset to token ids to point to the end of calldata,
            // which we'll extend with a bad length.
            const encodedOffsetToTokenIds = '0000000000000000000000000000000000000000000000000000000000000100';
            const badEncodedOffsetToTokenIds = '0000000000000000000000000000000000000000000000000000000000000140';
            const assetDataWithBadTokenIdsOffset = assetData.replace(
                encodedOffsetToTokenIds,
                badEncodedOffsetToTokenIds,
            );
            // We want a length that will overflow when converted to bytes - ie, multiplied by 32.
            const encodedIdsLengthOverflow = '0800000000000000000000000000000000000000000000000000000000000001';
            const buffer = '0'.repeat(64 * 10);
            const assetDataWithOverflow = `${assetDataWithBadTokenIdsOffset}${encodedIdsLengthOverflow}${buffer}`;
            // execute transfer
            await expectTransactionFailedWithoutReasonAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiverContract,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                    assetDataWithOverflow,
                ),
            );
        });
        it('should revert if token values resolves to outside the bounds of calldata', async () => {
            // setup test parameters
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const assetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            // The asset data we just generated will look like this:
            // a7cb5fb7
            // 0x         0000000000000000000000000b1ba0af832d7c05fd64161e0db78e85978e8082
            // 0x20       0000000000000000000000000000000000000000000000000000000000000080
            // 0x40       00000000000000000000000000000000000000000000000000000000000000c0 // offset to token values
            // 0x60       0000000000000000000000000000000000000000000000000000000000000100
            // 0x80       0000000000000000000000000000000000000000000000000000000000000001
            // 0xA0       0000000000000000000000000000000100000000000000000000000000000000
            // 0xC0       0000000000000000000000000000000000000000000000000000000000000001
            // 0xE0       0000000000000000000000000000000000000000000000878678326eac900000
            // 0x100      0000000000000000000000000000000000000000000000000000000000000004
            // 0x120      0102030400000000000000000000000000000000000000000000000000000000
            //
            // We want to change the offset to token values to point outside the calldata.
            const encodedOffsetToTokenValues = '00000000000000000000000000000000000000000000000000000000000000c0';
            const badEncodedOffsetToTokenValues = '00000000000000000000000000000000000000000000000000000000000001c0';
            const assetDataWithBadTokenIdsOffset = assetData.replace(
                encodedOffsetToTokenValues,
                badEncodedOffsetToTokenValues,
            );
            // execute transfer
            await expectTransactionFailedWithoutReasonAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiverContract,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                    assetDataWithBadTokenIdsOffset,
                ),
            );
        });
        it('should revert if an element of token values lies to outside the bounds of calldata', async () => {
            // setup test parameters
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const assetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            // The asset data we just generated will look like this:
            // a7cb5fb7
            // 0x         0000000000000000000000000b1ba0af832d7c05fd64161e0db78e85978e8082
            // 0x20       0000000000000000000000000000000000000000000000000000000000000080
            // 0x40       00000000000000000000000000000000000000000000000000000000000000c0 // offset to token values
            // 0x60       0000000000000000000000000000000000000000000000000000000000000100
            // 0x80       0000000000000000000000000000000000000000000000000000000000000001
            // 0xA0       0000000000000000000000000000000100000000000000000000000000000000
            // 0xC0       0000000000000000000000000000000000000000000000000000000000000001
            // 0xE0       0000000000000000000000000000000000000000000000878678326eac900000
            // 0x100      0000000000000000000000000000000000000000000000000000000000000004
            // 0x120      0102030400000000000000000000000000000000000000000000000000000000
            //
            // We want to change the offset to token values to the end of calldata.
            // Then we'll add an invalid length: we encode length of 2 but only add 1 element.
            const encodedOffsetToTokenValues = '00000000000000000000000000000000000000000000000000000000000000c0';
            const newEcodedOffsetToTokenValues = '0000000000000000000000000000000000000000000000000000000000000140';
            const assetDataWithNewTokenValuesOffset = assetData.replace(
                encodedOffsetToTokenValues,
                newEcodedOffsetToTokenValues,
            );
            const encodedTokenValuesLength = '0000000000000000000000000000000000000000000000000000000000000002';
            const encodedTokenValuesElements = '0000000000000000000000000000000000000000000000000000000000000001';
            const assetDataWithBadTokenIds = `${assetDataWithNewTokenValuesOffset}${encodedTokenValuesLength}${encodedTokenValuesElements}`;
            // execute transfer
            await expectTransactionFailedWithoutReasonAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiverContract,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                    assetDataWithBadTokenIds,
                ),
            );
        });
        it('should revert if token data resolves to outside the bounds of calldata', async () => {
            // setup test parameters
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const assetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            // The asset data we just generated will look like this:
            // a7cb5fb7
            // 0x         0000000000000000000000000b1ba0af832d7c05fd64161e0db78e85978e8082
            // 0x20       0000000000000000000000000000000000000000000000000000000000000080
            // 0x40       00000000000000000000000000000000000000000000000000000000000000c0
            // 0x60       0000000000000000000000000000000000000000000000000000000000000100 // offset to token data
            // 0x80       0000000000000000000000000000000000000000000000000000000000000001
            // 0xA0       0000000000000000000000000000000100000000000000000000000000000000
            // 0xC0       0000000000000000000000000000000000000000000000000000000000000001
            // 0xE0       0000000000000000000000000000000000000000000000878678326eac900000
            // 0x100      0000000000000000000000000000000000000000000000000000000000000004
            // 0x120      0102030400000000000000000000000000000000000000000000000000000000
            //
            // We want to change the offset to token data to point outside the calldata.
            const encodedOffsetToTokenData = '0000000000000000000000000000000000000000000000000000000000000100';
            const badEncodedOffsetToTokenData = '00000000000000000000000000000000000000000000000000000000000001c0';
            const assetDataWithBadTokenDataOffset = assetData.replace(
                encodedOffsetToTokenData,
                badEncodedOffsetToTokenData,
            );
            // execute transfer
            await expectTransactionFailedWithoutReasonAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiverContract,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                    assetDataWithBadTokenDataOffset,
                ),
            );
        });
        it('should revert if an element of token data lies to outside the bounds of calldata', async () => {
            // setup test parameters
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const assetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            // The asset data we just generated will look like this:
            // a7cb5fb7
            // 0x         0000000000000000000000000b1ba0af832d7c05fd64161e0db78e85978e8082
            // 0x20       0000000000000000000000000000000000000000000000000000000000000080
            // 0x40       00000000000000000000000000000000000000000000000000000000000000c0
            // 0x60       0000000000000000000000000000000000000000000000000000000000000100 // offset to token data
            // 0x80       0000000000000000000000000000000000000000000000000000000000000001
            // 0xA0       0000000000000000000000000000000100000000000000000000000000000000
            // 0xC0       0000000000000000000000000000000000000000000000000000000000000001
            // 0xE0       0000000000000000000000000000000000000000000000878678326eac900000
            // 0x100      0000000000000000000000000000000000000000000000000000000000000004
            // 0x120      0102030400000000000000000000000000000000000000000000000000000000
            //
            // We want to change the offset to token data to the end of calldata.
            // Then we'll add an invalid length: we encode length of 33 but only add 32 elements.
            const encodedOffsetToTokenData = '0000000000000000000000000000000000000000000000000000000000000100';
            const newEcodedOffsetToTokenData = '0000000000000000000000000000000000000000000000000000000000000140';
            const assetDataWithNewTokenDataOffset = assetData.replace(
                encodedOffsetToTokenData,
                newEcodedOffsetToTokenData,
            );
            const encodedTokenDataLength = '0000000000000000000000000000000000000000000000000000000000000021';
            const encodedTokenDataElements = '0000000000000000000000000000000000000000000000000000000000000001';
            const assetDataWithBadTokenData = `${assetDataWithNewTokenDataOffset}${encodedTokenDataLength}${encodedTokenDataElements}`;
            // execute transfer
            await expectTransactionFailedWithoutReasonAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiverContract,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                    assetDataWithBadTokenData,
                ),
            );
        });
        it('should revert if asset data lies outside the bounds of calldata', async () => {
            // setup test parameters
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const assetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            const txData = await erc1155ProxyWrapper.getTransferFromAbiEncodedTxDataAsync(
                spender,
                receiverContract,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
                assetData,
            );
            const offsetToAssetData = '0000000000000000000000000000000000000000000000000000000000000080';
            const invalidOffsetToAssetData = '0000000000000000000000000000000000000000000000000000000000000180';
            const badTxData = txData.replace(offsetToAssetData, invalidOffsetToAssetData);
            // execute transfer
            await expectTransactionFailedWithoutReasonAsync(
                erc1155ProxyWrapper.transferFromRawAsync(badTxData, authorized),
            );
        });
        it('should revert if asset data lies outside the bounds of calldata', async () => {
            // setup test parameters
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            const erc1155ContractAddress = await erc1155Contract.getAddress();
            const assetData = assetDataContract
                .ERC1155Assets(erc1155ContractAddress, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .getABIEncodedTransactionData();
            const txData = await erc1155ProxyWrapper.getTransferFromAbiEncodedTxDataAsync(
                spender,
                receiverContract,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
                assetData,
            );
            // append asset data to end of tx data with a length of 0x300 bytes, which will extend past actual calldata.
            const offsetToAssetData = '0000000000000000000000000000000000000000000000000000000000000080';
            const invalidOffsetToAssetData = '0000000000000000000000000000000000000000000000000000000000000200';
            const newAssetData = '0000000000000000000000000000000000000000000000000000000000000304';
            const badTxData = `${txData.replace(offsetToAssetData, invalidOffsetToAssetData)}${newAssetData}`;
            // execute transfer
            await expectTransactionFailedWithoutReasonAsync(
                erc1155ProxyWrapper.transferFromRawAsync(badTxData, authorized),
            );
        });
        it('should revert if length of assetData is less than 132 bytes', async () => {
            // setup test parameters
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            // we'll construct asset data that has a 4 byte selector plus
            // 96 byte payload. This results in asset data that is 100 bytes
            // long and will trigger the `invalid length` error.
            // we must be sure to use a # of bytes that is still %32
            // so that we know the error is not triggered by another check in the code.
            const zeros96Bytes = '0'.repeat(188);
            const assetData131Bytes = `${AssetProxyId.ERC1155}${zeros96Bytes}`;
            // execute transfer
            await expectTransactionFailedWithoutReasonAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiverContract,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                    assetData131Bytes,
                ),
            );
        });
        it('should transfer nothing if value is zero', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [0n];
            const valueMultiplier = valueMultiplierSmall;
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiver,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
            );
            // check balances after transfer
            const expectedFinalBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should transfer nothing if value multiplier is zero', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = 0n;
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiver,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
            );
            // check balances after transfer
            const expectedFinalBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should transfer nothing if there are no tokens in asset data', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer: bigint[] = [];
            const valuesToTransfer: bigint[] = [];
            const valueMultiplier = valueMultiplierSmall;
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiver,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
            );
            // check balances after transfer
            const expectedFinalBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should propagate revert reason from erc1155 contract failure', async () => {
            // disable transfers
            const shouldRejectTransfer = true;
            await erc1155Receiver.setRejectTransferFlag(shouldRejectTransfer).awaitTransactionSuccessAsync({
                from: owner,
            });
            // setup test parameters
            const tokenHolders = [spender, receiverContract];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverContractInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await expectTransactionFailedAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiverContract,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                ),
                RevertReason.TransferRejected,
            );
        });
        it('should revert if transferring the same non-fungible token more than once', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const nftToTransfer = nonFungibleTokensOwnedBySpender[0];
            const tokensToTransfer = [nftToTransfer, nftToTransfer];
            const valuesToTransfer = [nonFungibleValueToTransfer, nonFungibleValueToTransfer];
            const valueMultiplier = valueMultiplierNft;
            // check balances before transfer
            const expectedInitialBalances = [
                // spender
                nftOwnerBalance,
                nftOwnerBalance,
                // receiver
                nftNotOwnerBalance,
                nftNotOwnerBalance,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await expectTransactionFailedAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiver,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                ),
                RevertReason.NFTNotOwnedByFromAddress,
            );
        });
        it('should revert if there is a multiplication overflow', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = nonFungibleTokensOwnedBySpender.slice(0, 3);
            const maxUintValue = 2n ** 256n - 1n;
            const valuesToTransfer = [nonFungibleValueToTransfer, maxUintValue, nonFungibleValueToTransfer];
            const valueMultiplier = 2n;
            // check balances before transfer
            const expectedInitialBalances = [
                // spender
                nftOwnerBalance,
                nftOwnerBalance,
                nftOwnerBalance,
                // receiver
                nftNotOwnerBalance,
                nftNotOwnerBalance,
                nftNotOwnerBalance,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            const expectedError = new SafeMathRevertErrors.Uint256BinOpError(
                SafeMathRevertErrors.BinOpErrorCodes.MultiplicationOverflow,
                maxUintValue,
                valueMultiplier,
            );
            // execute transfer
            // note - this will overflow because we are trying to transfer `maxUintValue * 2` of the 2nd token
            await expect(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiver,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                ),
            ).to.be.revertedWith(expectedError);
        });
        it('should revert if transferring > 1 instances of a non-fungible token (valueMultiplier field >1)', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = nonFungibleTokensOwnedBySpender.slice(0, 1);
            const valuesToTransfer = [nonFungibleValueToTransfer];
            const valueMultiplier = 2n;
            // check balances before transfer
            const expectedInitialBalances = [
                // spender
                nftOwnerBalance,
                // receiver
                nftNotOwnerBalance,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await expectTransactionFailedAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiver,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                ),
                RevertReason.AmountEqualToOneRequired,
            );
        });
        it('should revert if transferring > 1 instances of a non-fungible token (`valuesToTransfer` field >1)', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = nonFungibleTokensOwnedBySpender.slice(0, 1);
            const valuesToTransfer = [2n];
            const valueMultiplier = valueMultiplierNft;
            // check balances before transfer
            const expectedInitialBalances = [
                // spender
                nftOwnerBalance,
                // receiver
                nftNotOwnerBalance,
            ];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await expectTransactionFailedAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiver,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                ),
                RevertReason.AmountEqualToOneRequired,
            );
        });
        it('should revert if sender balance is insufficient', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valueGreaterThanSpenderBalance = spenderInitialFungibleBalance + 1n;
            const valuesToTransfer = [valueGreaterThanSpenderBalance];
            const valueMultiplier = valueMultiplierSmall;
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            const expectedError = new SafeMathRevertErrors.Uint256BinOpError(
                SafeMathRevertErrors.BinOpErrorCodes.SubtractionUnderflow,
                spenderInitialFungibleBalance,
                valuesToTransfer[0] * valueMultiplier,
            );
            // execute transfer
            const tx = erc1155ProxyWrapper.transferFromAsync(
                spender,
                receiver,
                await erc1155Contract.getAddress(),
                tokensToTransfer,
                valuesToTransfer,
                valueMultiplier,
                receiverCallbackData,
                authorized,
            );
            return expect(tx).to.be.revertedWith(expectedError);
        });
        it('should revert if sender allowance is insufficient', async () => {
            // dremove allowance for ERC1155 proxy
            const wrapper = erc1155ProxyWrapper.getContractWrapper(await erc1155Contract.getAddress());
            const isApproved = false;
            await wrapper.setApprovalForAllAsync(spender, await erc1155Proxy.getAddress(), isApproved);
            const isApprovedActualValue = await wrapper.isApprovedForAllAsync(spender, await erc1155Proxy.getAddress());
            expect(isApprovedActualValue).to.be.equal(isApproved);
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await expectTransactionFailedAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiver,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    authorized,
                ),
                RevertReason.InsufficientAllowance,
            );
        });
        it('should revert if caller is not authorized', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = fungibleTokens.slice(0, 1);
            const valuesToTransfer = [fungibleValueToTransferLarge];
            const valueMultiplier = valueMultiplierSmall;
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await _assertBalancesAsync(erc1155Contract, tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await expectTransactionFailedAsync(
                erc1155ProxyWrapper.transferFromAsync(
                    spender,
                    receiver,
                    await erc1155Contract.getAddress(),
                    tokensToTransfer,
                    valuesToTransfer,
                    valueMultiplier,
                    receiverCallbackData,
                    notAuthorized,
                ),
                RevertReason.SenderNotAuthorized,
            );
        });
    });
    
    // Helper functions for ERC1155 balance checks
    async function _assertBalancesAsync(
        contract: ERC1155Mintable,
        owners: string[],
        tokens: bigint[],
        expectedBalances: bigint[],
    ): Promise<void> {
        const { expect } = await import('chai');
        const actualBalances = await _getBalancesAsync(contract, owners, tokens);
        
        expect(actualBalances.length).to.equal(expectedBalances.length, 
            `Expected ${expectedBalances.length} balances, but got ${actualBalances.length}`);
        
        for (let i = 0; i < actualBalances.length; i++) {
            expect(actualBalances[i]).to.equal(expectedBalances[i], 
                `Balance mismatch for owner ${owners[i]} and token ${tokens[i]}: expected ${expectedBalances[i]}, got ${actualBalances[i]}`);
        }
    }
    
    async function _getBalancesAsync(
        contract: ERC1155Mintable,
        owners: string[],
        tokens: bigint[],
    ): Promise<bigint[]> {
        // Create parallel arrays for balanceOfBatch - each owner for each token
        const batchOwners: string[] = [];
        const batchTokens: string[] = [];
        
        for (const owner of owners) {
            for (const token of tokens) {
                batchOwners.push(owner);
                batchTokens.push(token.toString());
            }
        }
        
        const balances = await contract.balanceOfBatch(batchOwners, batchTokens);
        return balances.map(balance => BigInt(balance.toString()));
    }
});
// tslint:enable:no-unnecessary-type-assertion
// tslint:disable:max-file-line-count
