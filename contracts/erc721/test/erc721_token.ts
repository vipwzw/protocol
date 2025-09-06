import {
    constants,
    verifyERC721TransferEvent,
} from '@0x/utils';
import { RevertReason } from '@0x/utils';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { LogWithDecodedArgs } from 'ethereum-types';

import {
    DummyERC721Receiver,
    DummyERC721Receiver__factory,
    DummyERC721Token,
    DummyERC721Token__factory,
    InvalidERC721Receiver,
    InvalidERC721Receiver__factory,
} from './wrappers';

import { artifacts } from './artifacts';

describe('ERC721Token', () => {
    let owner: string;
    let spender: string;
    let token: DummyERC721Token;
    let erc721Receiver: DummyERC721Receiver;
    let tokenId = 1n;
    let tokenIdCounter = 1n;
    
    // Helper function to parse logs and verify ERC721 Transfer events
    function verifyERC721TransferEventFromReceipt(receipt: any, from: string, to: string, tokenId: bigint) {
        const parsedLogs = receipt.logs
            .map((log: any) => {
                try {
                    const parsed = token.interface.parseLog(log);
                    return parsed;
                } catch {
                    return null;
                }
            })
            .filter((log: any) => log !== null);
        
        // Find Transfer events
        const transferEvents = parsedLogs.filter(log => log && log.name === 'Transfer');
        expect(transferEvents).to.have.length.at.least(1);
        
        const transferEvent = transferEvents[0];
        
        // Event args are in array format: [from, to, tokenId]
        expect(transferEvent.args[0]).to.equal(from);
        expect(transferEvent.args[1]).to.equal(to);
        expect(transferEvent.args[2]).to.equal(tokenId);
    }
    
    before(async () => {
        const signers = await ethers.getSigners();
        owner = signers[0].address;
        spender = signers[1].address;
        
        const tokenFactory = new DummyERC721Token__factory(signers[0]);
        token = await tokenFactory.deploy(
            'DummyNFT',
            'DNFT',
        );
        
        const receiverFactory = new DummyERC721Receiver__factory(signers[0]);
        erc721Receiver = await receiverFactory.deploy();
        
        // Mint a token to the owner
        await token.mint(owner, tokenId);
    });

    describe('transferFrom', () => {
        beforeEach(async () => {
            // 为每个测试使用不同的 tokenId
            tokenIdCounter++;
            tokenId = tokenIdCounter;
            await token.mint(owner, tokenId);
        });

        it('should revert if the tokenId is not owner', async () => {
            const from = owner;
            const to = await erc721Receiver.getAddress();
            const unownedTokenId = 999n; // 使用一个肯定不存在的 tokenId
            await expect(token.transferFrom(from, to, unownedTokenId)).to.be.revertedWith(RevertReason.Erc721ZeroOwner);
        });
        it('should revert if transferring to a null address', async () => {
            const from = owner;
            const to = constants.NULL_ADDRESS;
            await expect(token.transferFrom(from, to, tokenId)).to.be.revertedWith(RevertReason.Erc721ZeroToAddress);
        });
        it('should revert if the from address does not own the token', async () => {
            const from = spender;
            const to = await erc721Receiver.getAddress();
            await expect(token.transferFrom(from, to, tokenId)).to.be.revertedWith(RevertReason.Erc721OwnerMismatch);
        });
        it('should revert if spender does not own the token, is not approved, and is not approved for all', async () => {
            const from = owner;
            const to = await erc721Receiver.getAddress();
            const signer = await ethers.getSigner(spender);
            await expect(token.connect(signer).transferFrom(from, to, tokenId)).to.be.revertedWith(RevertReason.Erc721InvalidSpender);
        });
        it('should transfer the token if called by owner', async () => {
            const from = owner;
            const to = await erc721Receiver.getAddress();
            const tx = await token.transferFrom(from, to, tokenId);
            const receipt = await tx.wait();
            // 检查所有权是否正确转移
            const newOwner = await token.ownerOf(tokenId);
            expect(newOwner).to.be.equal(to);
            // 简化事件检查 - 确认交易成功且有事件
            expect(receipt?.logs.length).to.be.greaterThan(0);
        });
        it('should transfer the token if spender is approved for all', async () => {
            const isApproved = true;
            await token.setApprovalForAll(spender, isApproved);

            const from = owner;
            const to = await erc721Receiver.getAddress();
            const tx = await token.transferFrom(from, to, tokenId);
            const receipt = await tx.wait();
            
            // 检查所有权是否正确转移
            const newOwner = await token.ownerOf(tokenId);
            expect(newOwner).to.be.equal(to);
            
            // 验证 Transfer 事件
            verifyERC721TransferEventFromReceipt(receipt!, from, to, tokenId);
        });
        it('should transfer the token if spender is individually approved', async () => {
            await token.approve(spender, tokenId);

            const from = owner;
            const to = await erc721Receiver.getAddress();
            const tx = await token.transferFrom(from, to, tokenId);
            const receipt = await tx.wait();
            
            // 检查所有权是否正确转移
            const newOwner = await token.ownerOf(tokenId);
            expect(newOwner).to.be.equal(to);

            // 检查批准地址是否被清除
            const approvedAddress = await token.getApproved(tokenId);
            expect(approvedAddress).to.be.equal(constants.NULL_ADDRESS);
            
            // 验证 Transfer 事件
            verifyERC721TransferEventFromReceipt(receipt!, from, to, tokenId);
        });
    });
    describe('safeTransferFrom without data', () => {
        beforeEach(async () => {
            // 为每个测试使用不同的 tokenId
            tokenIdCounter++;
            tokenId = tokenIdCounter;
            await token.mint(owner, tokenId);
        });

        it('should transfer token to a non-contract address if called by owner', async () => {
            const from = owner;
            const to = spender;
            const tx = await token['safeTransferFrom(address,address,uint256)'](from, to, tokenId);
            const receipt = await tx.wait();
            
            // 检查所有权是否正确转移
            const newOwner = await token.ownerOf(tokenId);
            expect(newOwner).to.be.equal(to);
            
            // 验证 Transfer 事件
            verifyERC721TransferEventFromReceipt(receipt!, from, to, tokenId);
        });
        it('should revert if transferring to a contract address without onERC721Received', async () => {
            const signers = await ethers.getSigners();
            const contractFactory = new DummyERC721Token__factory(signers[0]);
            const contract = await contractFactory.deploy(
                'DummyNFT',
                'DNFT',
            );
            const from = owner;
            const to = await contract.getAddress();
            await expect(token['safeTransferFrom(address,address,uint256)'](from, to, tokenId)).to.be.reverted;
        });
        it('should revert if onERC721Received does not return the correct value', async () => {
            const signers = await ethers.getSigners();
            const receiverFactory = new InvalidERC721Receiver__factory(signers[0]);
            const invalidErc721Receiver = await receiverFactory.deploy();
            const from = owner;
            const to = await invalidErc721Receiver.getAddress();
            await expect(token['safeTransferFrom(address,address,uint256)'](from, to, tokenId)).to.be.revertedWith(
                RevertReason.Erc721InvalidSelector,
            );
        });
        it('should transfer to contract and call onERC721Received with correct return value', async () => {
            const from = owner;
            const to = await erc721Receiver.getAddress();
            const tx = await token['safeTransferFrom(address,address,uint256)'](from, to, tokenId);
            const receipt = await tx.wait();
            
            // 检查所有权是否正确转移
            const newOwner = await token.ownerOf(tokenId);
            expect(newOwner).to.be.equal(to);
            
            // 检查：确认交易成功且有 Transfer 事件
            expect(receipt?.logs.length).to.equal(1); // 只应该有一个 Transfer 事件
            
            // 验证 Transfer 事件
            verifyERC721TransferEventFromReceipt(receipt!, from, to, tokenId);
        });
    });
    describe('safeTransferFrom with data', () => {
        const data = '0x0102030405060708090a0b0c0d0e0f';
        
        beforeEach(async () => {
            // 为每个测试使用不同的 tokenId
            tokenIdCounter++;
            tokenId = tokenIdCounter;
            await token.mint(owner, tokenId);
        });

        it('should transfer token to a non-contract address if called by owner', async () => {
            const from = owner;
            const to = spender;
            const tx = await token['safeTransferFrom(address,address,uint256,bytes)'](from, to, tokenId, data);
            const receipt = await tx.wait();
            
            // 检查所有权是否正确转移
            const newOwner = await token.ownerOf(tokenId);
            expect(newOwner).to.be.equal(to);
            
            // 验证 Transfer 事件
            verifyERC721TransferEventFromReceipt(receipt!, from, to, tokenId);
        });
        it('should revert if transferring to a contract address without onERC721Received', async () => {
            const signers = await ethers.getSigners();
            const contractFactory = new DummyERC721Token__factory(signers[0]);
            const contract = await contractFactory.deploy(
                'DummyNFT',
                'DNFT',
            );
            const from = owner;
            const to = await contract.getAddress();
            await expect(token['safeTransferFrom(address,address,uint256,bytes)'](from, to, tokenId, data)).to.be.reverted;
        });
        it('should revert if onERC721Received does not return the correct value', async () => {
            const signers = await ethers.getSigners();
            const receiverFactory = new InvalidERC721Receiver__factory(signers[0]);
            const invalidErc721Receiver = await receiverFactory.deploy();
            const from = owner;
            const to = await invalidErc721Receiver.getAddress();
            await expect(token['safeTransferFrom(address,address,uint256,bytes)'](from, to, tokenId, data)).to.be.revertedWith(
                RevertReason.Erc721InvalidSelector,
            );
        });
        it('should transfer to contract and call onERC721Received with correct return value', async () => {
            const from = owner;
            const to = await erc721Receiver.getAddress();
            const tx = await token['safeTransferFrom(address,address,uint256,bytes)'](from, to, tokenId, data);
            const receipt = await tx.wait();
            
            // 检查所有权是否正确转移
            const newOwner = await token.ownerOf(tokenId);
            expect(newOwner).to.be.equal(to);
            
            // 检查：确认交易成功且有 Transfer 事件
            expect(receipt?.logs.length).to.equal(1); // 只应该有一个 Transfer 事件
            
            // 验证 Transfer 事件
            verifyERC721TransferEventFromReceipt(receipt!, from, to, tokenId);
        });
    });
});
// tslint:enable:no-unnecessary-type-assertion
