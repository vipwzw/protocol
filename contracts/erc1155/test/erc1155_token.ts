import { constants, BlockchainLifecycle } from '@0x/test-utils';
import { RevertReason } from '@0x/utils';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import * as _ from 'lodash';

import { DummyERC1155Receiver__factory, ERC1155Mintable__factory, DummyERC1155Receiver, ERC1155Mintable } from './wrappers';

const blockchainLifecycle = new BlockchainLifecycle();
// tslint:disable:no-unnecessary-type-assertion
describe('ERC1155Token', () => {
    // constant values used in transfer tests
    const nftOwnerBalance = 1n;
    const nftNotOwnerBalance = 0n;
    const spenderInitialFungibleBalance = 500n;
    const receiverInitialFungibleBalance = 0n;
    const fungibleValueToTransfer = spenderInitialFungibleBalance / 2n;
    const nonFungibleValueToTransfer = nftOwnerBalance;
    const receiverCallbackData = '0x01020304';
    // tokens & addresses
    let owner: string;
    let spender: string;
    let delegatedSpender: string;
    let receiver: string;
    let erc1155Contract: ERC1155Mintable;
    let erc1155Receiver: DummyERC1155Receiver;
    let nonFungibleToken: bigint;
    let fungibleToken: bigint;
    // tests
    before(async () => {
        await blockchainLifecycle.startAsync();
    });
    after(async () => {
        await blockchainLifecycle.revertAsync();
    });
    before(async () => {
        // deploy erc1155 contract & receiver
        const signers = await ethers.getSigners();
        [owner, spender, delegatedSpender] = [signers[0].address, signers[1].address, signers[2].address];
        
        erc1155Contract = await new ERC1155Mintable__factory(signers[0]).deploy();
        erc1155Receiver = await new DummyERC1155Receiver__factory(signers[0]).deploy();
        receiver = await erc1155Receiver.getAddress();
        
        // 创建和 mint tokens
        const ownerSigner = signers[0];
        
        // Create fungible token type and get the returned token ID
        fungibleToken = await erc1155Contract.connect(ownerSigner).create.staticCall('https://example.com/fungible', false);
        await erc1155Contract.connect(ownerSigner).create('https://example.com/fungible', false);
        
        // Create non-fungible token type and get the returned token ID
        nonFungibleToken = await erc1155Contract.connect(ownerSigner).create.staticCall('https://example.com/nft', true);
        await erc1155Contract.connect(ownerSigner).create('https://example.com/nft', true);
        
        // Mint fungible tokens to spender
        await erc1155Contract.connect(ownerSigner).mintFungible(
            fungibleToken,
            [spender],
            [spenderInitialFungibleBalance]
        );
        
        // Mint non-fungible token to spender  
        await erc1155Contract.connect(ownerSigner).mintNonFungible(
            nonFungibleToken,
            [spender]
        );
        
        // 计算实际的 NFT item ID (base type | index)
        // index 从 1 开始，第一个 NFT 的 index 是 1
        const nftItemId = nonFungibleToken | 1n;
    });
    beforeEach(async () => {
        await blockchainLifecycle.startAsync();
    });
    afterEach(async () => {
        await blockchainLifecycle.revertAsync();
    });
    describe('safeTransferFrom', () => {
        it('should transfer fungible token if called by token owner', async () => {
            // setup test parameters
            const tokenToTransfer = fungibleToken;
            const valueToTransfer = fungibleValueToTransfer;
            
            // check balances before transfer
            const spenderBalanceBefore = await erc1155Contract.balanceOf(spender, tokenToTransfer);
            const receiverBalanceBefore = await erc1155Contract.balanceOf(receiver, tokenToTransfer);
            expect(spenderBalanceBefore).to.equal(spenderInitialFungibleBalance);
            expect(receiverBalanceBefore).to.equal(receiverInitialFungibleBalance);
            
            // execute transfer
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1]; // spender is signers[1].address
            await erc1155Contract.connect(spenderSigner).safeTransferFrom(
                spender,
                receiver,
                fungibleToken,
                valueToTransfer,
                receiverCallbackData
            );
            
            // check balances after transfer
            const spenderBalanceAfter = await erc1155Contract.balanceOf(spender, tokenToTransfer);
            const receiverBalanceAfter = await erc1155Contract.balanceOf(receiver, tokenToTransfer);
            expect(spenderBalanceAfter).to.equal(spenderInitialFungibleBalance - valueToTransfer);
            expect(receiverBalanceAfter).to.equal(receiverInitialFungibleBalance + valueToTransfer);
        });
        it('should transfer non-fungible token if called by token owner', async () => {
            // setup test parameters - 使用实际的 NFT item ID
            const nftItemId = nonFungibleToken | 1n; // base type | index
            const tokenToTransfer = nftItemId;
            const valueToTransfer = nonFungibleValueToTransfer;
            
            // check balances before transfer
            const spenderBalanceBefore = await erc1155Contract.balanceOf(spender, tokenToTransfer);
            const receiverBalanceBefore = await erc1155Contract.balanceOf(receiver, tokenToTransfer);
            expect(spenderBalanceBefore).to.equal(nftOwnerBalance);
            expect(receiverBalanceBefore).to.equal(nftNotOwnerBalance);
            
            // execute transfer
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1];
            await erc1155Contract.connect(spenderSigner).safeTransferFrom(
                spender,
                receiver,
                tokenToTransfer,
                valueToTransfer,
                receiverCallbackData
            );
            
            // check balances after transfer
            const spenderBalanceAfter = await erc1155Contract.balanceOf(spender, tokenToTransfer);
            const receiverBalanceAfter = await erc1155Contract.balanceOf(receiver, tokenToTransfer);
            expect(spenderBalanceAfter).to.equal(nftNotOwnerBalance);
            expect(receiverBalanceAfter).to.equal(nftOwnerBalance);
        });
        it('should trigger callback if transferring to a contract', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokenToTransfer = fungibleToken;
            const valueToTransfer = fungibleValueToTransfer;
            // check balances before transfer
            const expectedInitialBalances = [
                spenderInitialFungibleBalance,
                receiverInitialFungibleBalance,
                nftOwnerBalance,
                nftNotOwnerBalance,
            ];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, [tokenToTransfer], expectedInitialBalances);
            // execute transfer
            const tx = await erc1155Wrapper.safeTransferFromAsync(
                spender,
                receiver,
                tokenToTransfer,
                valueToTransfer,
                receiverCallbackData,
            );
            expect(tx.logs.length).to.be.equal(2);
            const receiverLog = tx.logs[1] as LogWithDecodedArgs<DummyERC1155ReceiverBatchTokenReceivedEventArgs>;
            // check callback logs
            const expectedCallbackLog = {
                operator: spender,
                from: spender,
                tokenId: tokenToTransfer,
                tokenValue: valueToTransfer,
                data: receiverCallbackData,
            };
            expect(receiverLog.args.operator).to.be.equal(expectedCallbackLog.operator);
            expect(receiverLog.args.from).to.be.equal(expectedCallbackLog.from);
            expect(receiverLog.args.tokenId).to.be.bignumber.equal(expectedCallbackLog.tokenId);
            expect(receiverLog.args.tokenValue).to.be.bignumber.equal(expectedCallbackLog.tokenValue);
            expect(receiverLog.args.data).to.be.deep.equal(expectedCallbackLog.data);
            // check balances after transfer
            const expectedFinalBalances = [
                spenderInitialFungibleBalance - valueToTransfer,
                receiverInitialFungibleBalance + valueToTransfer,
            ];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, [tokenToTransfer], expectedFinalBalances);
        });
        it('should revert if transfer reverts', async () => {
            // setup test parameters
            const tokenToTransfer = fungibleToken;
            const valueToTransfer = spenderInitialFungibleBalance + 1n;
            // create the expected error (a uint256 underflow)
            const expectedError = new SafeMathRevertErrors.Uint256BinOpError(
                SafeMathRevertErrors.BinOpErrorCodes.SubtractionUnderflow,
                spenderInitialFungibleBalance,
                valueToTransfer,
            );
            // execute transfer
            const tx = erc1155Contract
                .safeTransferFrom(spender, receiver, tokenToTransfer, valueToTransfer, receiverCallbackData)
                .sendTransactionAsync({ from: spender });
            return expect(tx).to.revertWith(expectedError);
        });
        it('should revert if callback reverts', async () => {
            // setup test parameters
            const tokenToTransfer = fungibleToken;
            const valueToTransfer = fungibleValueToTransfer;
            // set receiver to reject balances
            const shouldRejectTransfer = true;
            await web3Wrapper.awaitTransactionSuccessAsync(
                await erc1155Receiver.setRejectTransferFlag(shouldRejectTransfer).sendTransactionAsync(),
                constants.AWAIT_TRANSACTION_MINED_MS,
            );
            // execute transfer
            return expect(
                erc1155Contract
                    .safeTransferFrom(spender, receiver, tokenToTransfer, valueToTransfer, receiverCallbackData)
                    .awaitTransactionSuccessAsync({ from: spender }),
            ).to.revertWith(RevertReason.TransferRejected);
        });
    });
    describe('batchSafeTransferFrom', () => {
        it('should transfer fungible tokens if called by token owner', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = [fungibleToken];
            const valuesToTransfer = [fungibleValueToTransfer];
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await erc1155Wrapper.safeBatchTransferFromAsync(
                spender,
                receiver,
                tokensToTransfer,
                valuesToTransfer,
                receiverCallbackData,
            );
            // check balances after transfer
            const expectedFinalBalances = [
                spenderInitialFungibleBalance - valuesToTransfer[0],
                receiverInitialFungibleBalance + valuesToTransfer[0],
            ];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should transfer non-fungible token if called by token owner', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = [nonFungibleToken];
            const valuesToTransfer = [nonFungibleValueToTransfer];
            // check balances before transfer
            const expectedInitialBalances = [nftOwnerBalance, nftNotOwnerBalance];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await erc1155Wrapper.safeBatchTransferFromAsync(
                spender,
                receiver,
                tokensToTransfer,
                valuesToTransfer,
                receiverCallbackData,
            );
            // check balances after transfer
            const expectedFinalBalances = [nftNotOwnerBalance, nftOwnerBalance];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should transfer mix of fungible / non-fungible tokens if called by token owner', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = [fungibleToken, nonFungibleToken];
            const valuesToTransfer = [fungibleValueToTransfer, nonFungibleValueToTransfer];
            // check balances before transfer
            const expectedInitialBalances = [
                // spender
                spenderInitialFungibleBalance,
                nftOwnerBalance,
                // receiver
                receiverInitialFungibleBalance,
                nftNotOwnerBalance,
            ];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await erc1155Wrapper.safeBatchTransferFromAsync(
                spender,
                receiver,
                tokensToTransfer,
                valuesToTransfer,
                receiverCallbackData,
            );
            // check balances after transfer
            const expectedFinalBalances = [
                // spender
                spenderInitialFungibleBalance - valuesToTransfer[0],
                nftNotOwnerBalance,
                // receiver
                receiverInitialFungibleBalance + valuesToTransfer[0],
                nftOwnerBalance,
            ];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should trigger callback if transferring to a contract', async () => {
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = [fungibleToken, nonFungibleToken];
            const valuesToTransfer = [fungibleValueToTransfer, nonFungibleValueToTransfer];
            // check balances before transfer
            const expectedInitialBalances = [
                // spender
                spenderInitialFungibleBalance,
                nftOwnerBalance,
                // receiver
                receiverInitialFungibleBalance,
                nftNotOwnerBalance,
            ];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            const tx = await erc1155Wrapper.safeBatchTransferFromAsync(
                spender,
                receiver,
                tokensToTransfer,
                valuesToTransfer,
                receiverCallbackData,
            );
            expect(tx.logs.length).to.be.equal(2);
            const receiverLog = tx.logs[1] as LogWithDecodedArgs<DummyERC1155ReceiverBatchTokenReceivedEventArgs>;
            // check callback logs
            const expectedCallbackLog = {
                operator: spender,
                from: spender,
                tokenIds: tokensToTransfer,
                tokenValues: valuesToTransfer,
                data: receiverCallbackData,
            };
            expect(receiverLog.args.operator).to.be.equal(expectedCallbackLog.operator);
            expect(receiverLog.args.from).to.be.equal(expectedCallbackLog.from);
            expect(receiverLog.args.tokenIds.length).to.be.equal(2);
            expect(receiverLog.args.tokenIds[0]).to.be.bignumber.equal(expectedCallbackLog.tokenIds[0]);
            expect(receiverLog.args.tokenIds[1]).to.be.bignumber.equal(expectedCallbackLog.tokenIds[1]);
            expect(receiverLog.args.tokenValues.length).to.be.equal(2);
            expect(receiverLog.args.tokenValues[0]).to.be.bignumber.equal(expectedCallbackLog.tokenValues[0]);
            expect(receiverLog.args.tokenValues[1]).to.be.bignumber.equal(expectedCallbackLog.tokenValues[1]);
            expect(receiverLog.args.data).to.be.deep.equal(expectedCallbackLog.data);
            // check balances after transfer
            const expectedFinalBalances = [
                // spender
                spenderInitialFungibleBalance - valuesToTransfer[0],
                nftNotOwnerBalance,
                // receiver
                receiverInitialFungibleBalance + valuesToTransfer[0],
                nftOwnerBalance,
            ];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should revert if transfer reverts', async () => {
            // setup test parameters
            const tokensToTransfer = [fungibleToken];
            const valuesToTransfer = [spenderInitialFungibleBalance + 1n];
            // create the expected error (a uint256 underflow)
            const expectedError = new SafeMathRevertErrors.Uint256BinOpError(
                SafeMathRevertErrors.BinOpErrorCodes.SubtractionUnderflow,
                spenderInitialFungibleBalance,
                valuesToTransfer[0],
            );
            // execute transfer
            const tx = erc1155Contract
                .safeBatchTransferFrom(spender, receiver, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                .sendTransactionAsync({ from: spender });
            return expect(tx).to.revertWith(expectedError);
        });
        it('should revert if callback reverts', async () => {
            // setup test parameters
            const tokensToTransfer = [fungibleToken];
            const valuesToTransfer = [fungibleValueToTransfer];
            // set receiver to reject balances
            const shouldRejectTransfer = true;
            await web3Wrapper.awaitTransactionSuccessAsync(
                await erc1155Receiver.setRejectTransferFlag(shouldRejectTransfer).sendTransactionAsync(),
                constants.AWAIT_TRANSACTION_MINED_MS,
            );
            // execute transfer
            return expect(
                erc1155Contract
                    .safeBatchTransferFrom(spender, receiver, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                    .awaitTransactionSuccessAsync({ from: spender }),
            ).to.revertWith(RevertReason.TransferRejected);
        });
    });
    describe('setApprovalForAll', () => {
        it('should transfer token via safeTransferFrom if called by approved account', async () => {
            // set approval
            const isApprovedForAll = true;
            await erc1155Wrapper.setApprovalForAllAsync(spender, delegatedSpender, isApprovedForAll);
            const isApprovedForAllCheck = await erc1155Wrapper.isApprovedForAllAsync(spender, delegatedSpender);
            expect(isApprovedForAllCheck).to.be.true();
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokenToTransfer = fungibleToken;
            const valueToTransfer = fungibleValueToTransfer;
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, [tokenToTransfer], expectedInitialBalances);
            // execute transfer
            await erc1155Wrapper.safeTransferFromAsync(
                spender,
                receiver,
                tokenToTransfer,
                valueToTransfer,
                receiverCallbackData,
                delegatedSpender,
            );
            // check balances after transfer
            const expectedFinalBalances = [
                spenderInitialFungibleBalance - valueToTransfer,
                receiverInitialFungibleBalance + valueToTransfer,
            ];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, [tokenToTransfer], expectedFinalBalances);
        });
        it('should revert if trying to transfer tokens via safeTransferFrom by an unapproved account', async () => {
            // check approval not set
            const isApprovedForAllCheck = await erc1155Wrapper.isApprovedForAllAsync(spender, delegatedSpender);
            expect(isApprovedForAllCheck).to.be.false();
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokenToTransfer = fungibleToken;
            const valueToTransfer = fungibleValueToTransfer;
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, [tokenToTransfer], expectedInitialBalances);
            // execute transfer
            return expect(
                erc1155Contract
                    .safeTransferFrom(spender, receiver, tokenToTransfer, valueToTransfer, receiverCallbackData)
                    .awaitTransactionSuccessAsync({ from: delegatedSpender }),
            ).to.revertWith(RevertReason.InsufficientAllowance);
        });
        it('should transfer token via safeBatchTransferFrom if called by approved account', async () => {
            // set approval
            const isApprovedForAll = true;
            await erc1155Wrapper.setApprovalForAllAsync(spender, delegatedSpender, isApprovedForAll);
            const isApprovedForAllCheck = await erc1155Wrapper.isApprovedForAllAsync(spender, delegatedSpender);
            expect(isApprovedForAllCheck).to.be.true();
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = [fungibleToken];
            const valuesToTransfer = [fungibleValueToTransfer];
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            await erc1155Wrapper.safeBatchTransferFromAsync(
                spender,
                receiver,
                tokensToTransfer,
                valuesToTransfer,
                receiverCallbackData,
                delegatedSpender,
            );
            // check balances after transfer
            const expectedFinalBalances = [
                spenderInitialFungibleBalance - valuesToTransfer[0],
                receiverInitialFungibleBalance + valuesToTransfer[0],
            ];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, tokensToTransfer, expectedFinalBalances);
        });
        it('should revert if trying to transfer tokens via safeBatchTransferFrom by an unapproved account', async () => {
            // check approval not set
            const isApprovedForAllCheck = await erc1155Wrapper.isApprovedForAllAsync(spender, delegatedSpender);
            expect(isApprovedForAllCheck).to.be.false();
            // setup test parameters
            const tokenHolders = [spender, receiver];
            const tokensToTransfer = [fungibleToken];
            const valuesToTransfer = [fungibleValueToTransfer];
            // check balances before transfer
            const expectedInitialBalances = [spenderInitialFungibleBalance, receiverInitialFungibleBalance];
            await erc1155Wrapper.assertBalancesAsync(tokenHolders, tokensToTransfer, expectedInitialBalances);
            // execute transfer
            return expect(
                erc1155Contract
                    .safeBatchTransferFrom(spender, receiver, tokensToTransfer, valuesToTransfer, receiverCallbackData)
                    .awaitTransactionSuccessAsync({ from: delegatedSpender }),
            ).to.revertWith(RevertReason.InsufficientAllowance);
        });
    });
});
// tslint:disable:max-file-line-count
// tslint:enable:no-unnecessary-type-assertion
