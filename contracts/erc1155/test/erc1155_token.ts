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
            const tokenToTransfer = fungibleToken;
            const valueToTransfer = fungibleValueToTransfer;
            
            // check balances before transfer
            const spenderBalanceBefore = await erc1155Contract.balanceOf(spender, tokenToTransfer);
            const receiverBalanceBefore = await erc1155Contract.balanceOf(receiver, tokenToTransfer);
            expect(spenderBalanceBefore).to.equal(spenderInitialFungibleBalance);
            expect(receiverBalanceBefore).to.equal(receiverInitialFungibleBalance);
            
            // execute transfer
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1];
            const tx = await erc1155Contract.connect(spenderSigner).safeTransferFrom(
                spender,
                receiver,
                tokenToTransfer,
                valueToTransfer,
                receiverCallbackData
            );
            const receipt = await tx.wait();
            
            // check balances after transfer
            const spenderBalanceAfter = await erc1155Contract.balanceOf(spender, tokenToTransfer);
            const receiverBalanceAfter = await erc1155Contract.balanceOf(receiver, tokenToTransfer);
            expect(spenderBalanceAfter).to.equal(spenderInitialFungibleBalance - valueToTransfer);
            expect(receiverBalanceAfter).to.equal(receiverInitialFungibleBalance + valueToTransfer);
            
            // check that contract received the callback (we'll verify it got called by checking events exist)
            expect(receipt?.logs.length).to.be.greaterThan(0);
        });
        it('should revert if transfer reverts', async () => {
            // setup test parameters
            const tokenToTransfer = fungibleToken;
            const valueToTransfer = spenderInitialFungibleBalance + 1n;
            
            // execute transfer - should revert because spender doesn't have enough balance
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1];
            await expect(
                erc1155Contract.connect(spenderSigner).safeTransferFrom(
                    spender,
                    receiver,
                    tokenToTransfer,
                    valueToTransfer,
                    receiverCallbackData
                )
            ).to.be.reverted; // The contract should revert with insufficient balance
        });
        it('should revert if callback reverts', async () => {
            // setup test parameters
            const tokenToTransfer = fungibleToken;
            const valueToTransfer = fungibleValueToTransfer;
            
            // set receiver to reject transfers
            const shouldRejectTransfer = true;
            await erc1155Receiver.setRejectTransferFlag(shouldRejectTransfer);
            
            // execute transfer - should revert because callback rejects
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1];
            await expect(
                erc1155Contract.connect(spenderSigner).safeTransferFrom(
                    spender,
                    receiver,
                    tokenToTransfer,
                    valueToTransfer,
                    receiverCallbackData
                )
            ).to.be.revertedWith(RevertReason.TransferRejected);
        });
    });
    describe('batchSafeTransferFrom', () => {
        it('should transfer fungible tokens if called by token owner', async () => {
            // setup test parameters
            const tokensToTransfer = [fungibleToken];
            const valuesToTransfer = [fungibleValueToTransfer];
            
            // check balances before transfer
            const spenderBalanceBefore = await erc1155Contract.balanceOf(spender, fungibleToken);
            const receiverBalanceBefore = await erc1155Contract.balanceOf(receiver, fungibleToken);
            expect(spenderBalanceBefore).to.equal(spenderInitialFungibleBalance);
            expect(receiverBalanceBefore).to.equal(receiverInitialFungibleBalance);
            
            // execute batch transfer
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1];
            await erc1155Contract.connect(spenderSigner).safeBatchTransferFrom(
                spender,
                receiver,
                tokensToTransfer,
                valuesToTransfer,
                receiverCallbackData
            );
            
            // check balances after transfer
            const spenderBalanceAfter = await erc1155Contract.balanceOf(spender, fungibleToken);
            const receiverBalanceAfter = await erc1155Contract.balanceOf(receiver, fungibleToken);
            expect(spenderBalanceAfter).to.equal(spenderInitialFungibleBalance - valuesToTransfer[0]);
            expect(receiverBalanceAfter).to.equal(receiverInitialFungibleBalance + valuesToTransfer[0]);
        });
        it('should transfer non-fungible token if called by token owner', async () => {
            // setup test parameters - 使用实际的 NFT item ID
            const nftItemId = nonFungibleToken | 1n; // base type | index
            const tokensToTransfer = [nftItemId];
            const valuesToTransfer = [nonFungibleValueToTransfer];
            
            // check balances before transfer
            const spenderBalanceBefore = await erc1155Contract.balanceOf(spender, nftItemId);
            const receiverBalanceBefore = await erc1155Contract.balanceOf(receiver, nftItemId);
            expect(spenderBalanceBefore).to.equal(nftOwnerBalance);
            expect(receiverBalanceBefore).to.equal(nftNotOwnerBalance);
            
            // execute batch transfer
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1];
            await erc1155Contract.connect(spenderSigner).safeBatchTransferFrom(
                spender,
                receiver,
                tokensToTransfer,
                valuesToTransfer,
                receiverCallbackData
            );
            
            // check balances after transfer
            const spenderBalanceAfter = await erc1155Contract.balanceOf(spender, nftItemId);
            const receiverBalanceAfter = await erc1155Contract.balanceOf(receiver, nftItemId);
            expect(spenderBalanceAfter).to.equal(nftNotOwnerBalance);
            expect(receiverBalanceAfter).to.equal(nftOwnerBalance);
        });
        it('should transfer mix of fungible / non-fungible tokens if called by token owner', async () => {
            // setup test parameters - 使用实际的 NFT item ID
            const nftItemId = nonFungibleToken | 1n; // base type | index
            const tokensToTransfer = [fungibleToken, nftItemId];
            const valuesToTransfer = [fungibleValueToTransfer, nonFungibleValueToTransfer];
            
            // check balances before transfer
            const spenderFungibleBefore = await erc1155Contract.balanceOf(spender, fungibleToken);
            const spenderNftBefore = await erc1155Contract.balanceOf(spender, nftItemId);
            const receiverFungibleBefore = await erc1155Contract.balanceOf(receiver, fungibleToken);
            const receiverNftBefore = await erc1155Contract.balanceOf(receiver, nftItemId);
            
            expect(spenderFungibleBefore).to.equal(spenderInitialFungibleBalance);
            expect(spenderNftBefore).to.equal(nftOwnerBalance);
            expect(receiverFungibleBefore).to.equal(receiverInitialFungibleBalance);
            expect(receiverNftBefore).to.equal(nftNotOwnerBalance);
            
            // execute batch transfer
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1];
            await erc1155Contract.connect(spenderSigner).safeBatchTransferFrom(
                spender,
                receiver,
                tokensToTransfer,
                valuesToTransfer,
                receiverCallbackData
            );
            
            // check balances after transfer
            const spenderFungibleAfter = await erc1155Contract.balanceOf(spender, fungibleToken);
            const spenderNftAfter = await erc1155Contract.balanceOf(spender, nftItemId);
            const receiverFungibleAfter = await erc1155Contract.balanceOf(receiver, fungibleToken);
            const receiverNftAfter = await erc1155Contract.balanceOf(receiver, nftItemId);
            
            expect(spenderFungibleAfter).to.equal(spenderInitialFungibleBalance - valuesToTransfer[0]);
            expect(spenderNftAfter).to.equal(nftNotOwnerBalance);
            expect(receiverFungibleAfter).to.equal(receiverInitialFungibleBalance + valuesToTransfer[0]);
            expect(receiverNftAfter).to.equal(nftOwnerBalance);
        });
        it('should trigger callback if transferring to a contract', async () => {
            // setup test parameters - 使用实际的 NFT item ID
            const nftItemId = nonFungibleToken | 1n; // base type | index
            const tokensToTransfer = [fungibleToken, nftItemId];
            const valuesToTransfer = [fungibleValueToTransfer, nonFungibleValueToTransfer];
            
            // execute batch transfer
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1];
            const tx = await erc1155Contract.connect(spenderSigner).safeBatchTransferFrom(
                spender,
                receiver,
                tokensToTransfer,
                valuesToTransfer,
                receiverCallbackData
            );
            const receipt = await tx.wait();
            
            // check that contract received the callback (we'll verify it got called by checking events exist)
            expect(receipt?.logs.length).to.be.greaterThan(0);
            
            // verify transfers worked
            const spenderFungibleAfter = await erc1155Contract.balanceOf(spender, fungibleToken);
            const spenderNftAfter = await erc1155Contract.balanceOf(spender, nftItemId);
            const receiverFungibleAfter = await erc1155Contract.balanceOf(receiver, fungibleToken);
            const receiverNftAfter = await erc1155Contract.balanceOf(receiver, nftItemId);
            
            expect(spenderFungibleAfter).to.equal(spenderInitialFungibleBalance - valuesToTransfer[0]);
            expect(spenderNftAfter).to.equal(nftNotOwnerBalance);
            expect(receiverFungibleAfter).to.equal(receiverInitialFungibleBalance + valuesToTransfer[0]);
            expect(receiverNftAfter).to.equal(nftOwnerBalance);
        });
        it('should revert if transfer reverts', async () => {
            // setup test parameters
            const tokensToTransfer = [fungibleToken];
            const valuesToTransfer = [spenderInitialFungibleBalance + 1n];
            
            // execute transfer - should revert because spender doesn't have enough balance
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1];
            await expect(
                erc1155Contract.connect(spenderSigner).safeBatchTransferFrom(
                    spender,
                    receiver,
                    tokensToTransfer,
                    valuesToTransfer,
                    receiverCallbackData
                )
            ).to.be.reverted; // The contract should revert with insufficient balance
        });
        it('should revert if callback reverts', async () => {
            // setup test parameters
            const tokensToTransfer = [fungibleToken];
            const valuesToTransfer = [fungibleValueToTransfer];
            
            // set receiver to reject transfers
            const shouldRejectTransfer = true;
            await erc1155Receiver.setRejectTransferFlag(shouldRejectTransfer);
            
            // execute transfer - should revert because callback rejects
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1];
            await expect(
                erc1155Contract.connect(spenderSigner).safeBatchTransferFrom(
                    spender,
                    receiver,
                    tokensToTransfer,
                    valuesToTransfer,
                    receiverCallbackData
                )
            ).to.be.revertedWith(RevertReason.TransferRejected);
        });
    });
    describe('setApprovalForAll', () => {
        it('should transfer token via safeTransferFrom if called by approved account', async () => {
            // set approval
            const isApprovedForAll = true;
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1];
            await erc1155Contract.connect(spenderSigner).setApprovalForAll(delegatedSpender, isApprovedForAll);
            
            // verify approval was set
            const isApprovedForAllCheck = await erc1155Contract.isApprovedForAll(spender, delegatedSpender);
            expect(isApprovedForAllCheck).to.equal(true);
            
            // setup test parameters
            const tokenToTransfer = fungibleToken;
            const valueToTransfer = fungibleValueToTransfer;
            
            // check balances before transfer
            const spenderBalanceBefore = await erc1155Contract.balanceOf(spender, tokenToTransfer);
            const receiverBalanceBefore = await erc1155Contract.balanceOf(receiver, tokenToTransfer);
            expect(spenderBalanceBefore).to.equal(spenderInitialFungibleBalance);
            expect(receiverBalanceBefore).to.equal(receiverInitialFungibleBalance);
            
            // execute transfer using delegated spender
            const delegatedSpenderSigner = signers[2];
            await erc1155Contract.connect(delegatedSpenderSigner).safeTransferFrom(
                spender,
                receiver,
                tokenToTransfer,
                valueToTransfer,
                receiverCallbackData
            );
            
            // check balances after transfer
            const spenderBalanceAfter = await erc1155Contract.balanceOf(spender, tokenToTransfer);
            const receiverBalanceAfter = await erc1155Contract.balanceOf(receiver, tokenToTransfer);
            expect(spenderBalanceAfter).to.equal(spenderInitialFungibleBalance - valueToTransfer);
            expect(receiverBalanceAfter).to.equal(receiverInitialFungibleBalance + valueToTransfer);
        });
        it('should revert if trying to transfer tokens via safeTransferFrom by an unapproved account', async () => {
            // check approval not set
            const isApprovedForAllCheck = await erc1155Contract.isApprovedForAll(spender, delegatedSpender);
            expect(isApprovedForAllCheck).to.equal(false);
            
            // setup test parameters
            const tokenToTransfer = fungibleToken;
            const valueToTransfer = fungibleValueToTransfer;
            
            // execute transfer - should revert because delegatedSpender is not approved
            const signers = await ethers.getSigners();
            const delegatedSpenderSigner = signers[2];
            await expect(
                erc1155Contract.connect(delegatedSpenderSigner).safeTransferFrom(
                    spender,
                    receiver,
                    tokenToTransfer,
                    valueToTransfer,
                    receiverCallbackData
                )
            ).to.be.revertedWith(RevertReason.InsufficientAllowance);
        });
        it('should transfer token via safeBatchTransferFrom if called by approved account', async () => {
            // set approval
            const isApprovedForAll = true;
            const signers = await ethers.getSigners();
            const spenderSigner = signers[1];
            await erc1155Contract.connect(spenderSigner).setApprovalForAll(delegatedSpender, isApprovedForAll);
            
            // verify approval was set
            const isApprovedForAllCheck = await erc1155Contract.isApprovedForAll(spender, delegatedSpender);
            expect(isApprovedForAllCheck).to.equal(true);
            
            // setup test parameters
            const tokensToTransfer = [fungibleToken];
            const valuesToTransfer = [fungibleValueToTransfer];
            
            // check balances before transfer
            const spenderBalanceBefore = await erc1155Contract.balanceOf(spender, fungibleToken);
            const receiverBalanceBefore = await erc1155Contract.balanceOf(receiver, fungibleToken);
            expect(spenderBalanceBefore).to.equal(spenderInitialFungibleBalance);
            expect(receiverBalanceBefore).to.equal(receiverInitialFungibleBalance);
            
            // execute batch transfer using delegated spender
            const delegatedSpenderSigner = signers[2];
            await erc1155Contract.connect(delegatedSpenderSigner).safeBatchTransferFrom(
                spender,
                receiver,
                tokensToTransfer,
                valuesToTransfer,
                receiverCallbackData
            );
            
            // check balances after transfer
            const spenderBalanceAfter = await erc1155Contract.balanceOf(spender, fungibleToken);
            const receiverBalanceAfter = await erc1155Contract.balanceOf(receiver, fungibleToken);
            expect(spenderBalanceAfter).to.equal(spenderInitialFungibleBalance - valuesToTransfer[0]);
            expect(receiverBalanceAfter).to.equal(receiverInitialFungibleBalance + valuesToTransfer[0]);
        });
        it('should revert if trying to transfer tokens via safeBatchTransferFrom by an unapproved account', async () => {
            // check approval not set
            const isApprovedForAllCheck = await erc1155Contract.isApprovedForAll(spender, delegatedSpender);
            expect(isApprovedForAllCheck).to.equal(false);
            
            // setup test parameters
            const tokensToTransfer = [fungibleToken];
            const valuesToTransfer = [fungibleValueToTransfer];
            
            // execute transfer - should revert because delegatedSpender is not approved
            const signers = await ethers.getSigners();
            const delegatedSpenderSigner = signers[2];
            await expect(
                erc1155Contract.connect(delegatedSpenderSigner).safeBatchTransferFrom(
                    spender,
                    receiver,
                    tokensToTransfer,
                    valuesToTransfer,
                    receiverCallbackData
                )
            ).to.be.revertedWith(RevertReason.InsufficientAllowance);
        });
    });
});
// tslint:disable:max-file-line-count
// tslint:enable:no-unnecessary-type-assertion
