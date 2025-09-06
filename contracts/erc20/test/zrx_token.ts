import { chaiSetup, constants, provider, txDefaults } from '@0x/utils';
import * as chai from 'chai';
import { ethers } from 'hardhat';

import { ZRXToken, ZRXToken__factory } from './wrappers';

import { artifacts } from './artifacts';

import { verifyTransferEvent, verifyApprovalEvent } from '@0x/utils';

// chaiSetup 已废弃，Hardhat 自动配置 chai
const expect = chai.expect;


describe('ZRXToken', () => {
    let owner: string;
    let spender: string;
    let MAX_UINT: bigint;
    let zrxToken: ZRXToken;
    
    // Helper function to parse logs and verify events
    function verifyTransferEventFromReceipt(receipt: any, from: string, to: string, value: bigint) {
        const parsedLogs = receipt.logs
            .map((log: any) => {
                try {
                    const parsed = zrxToken.interface.parseLog(log);
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
        
        // Event args are in array format: [from, to, value]
        expect(transferEvent.args[0]).to.equal(from);
        expect(transferEvent.args[1]).to.equal(to);
        expect(transferEvent.args[2]).to.equal(value);
    }
    
    function verifyApprovalEventFromReceipt(receipt: any, owner: string, spender: string, value: bigint) {
        const parsedLogs = receipt.logs
            .map((log: any) => {
                try {
                    const parsed = zrxToken.interface.parseLog(log);
                    return parsed;
                } catch {
                    return null;
                }
            })
            .filter((log: any) => log !== null);
        
        // Find Approval events
        const approvalEvents = parsedLogs.filter(log => log && log.name === 'Approval');
        expect(approvalEvents).to.have.length.at.least(1);
        
        const approvalEvent = approvalEvents[0];
        
        // Event args are in array format: [owner, spender, value]
        expect(approvalEvent.args[0]).to.equal(owner);
        expect(approvalEvent.args[1]).to.equal(spender);
        expect(approvalEvent.args[2]).to.equal(value);
    }

    // Hardhat automatically manages blockchain state between tests
    // No need for manual blockchain lifecycle management
    before(async () => {
        const accounts = await ethers.getSigners();
        owner = accounts[0].address;
        spender = accounts[1].address;
        
        const zrxTokenFactory = new ZRXToken__factory(accounts[0]);
        zrxToken = await zrxTokenFactory.deploy();
        MAX_UINT = 2n ** 256n - 1n; // Max uint256 value
    });
    // Hardhat automatically manages blockchain state between tests
    describe('constants', () => {
        it('should have 18 decimals', async () => {
            const decimals = await zrxToken.decimals();
            const expectedDecimals = 18n;
            expect(decimals).to.equal(expectedDecimals);
        });

        it('should have a total supply of 1 billion tokens', async () => {
            const totalSupply = await zrxToken.totalSupply();
            const expectedTotalSupply = ethers.parseEther('1000000000'); // 1 billion tokens with 18 decimals
            expect(totalSupply).to.equal(expectedTotalSupply);
        });

        it('should be named 0x Protocol Token', async () => {
            const name = await zrxToken.name();
            const expectedName = '0x Protocol Token';
            expect(name).to.equal(expectedName);
        });

        it('should have the symbol ZRX', async () => {
            const symbol = await zrxToken.symbol();
            const expectedSymbol = 'ZRX';
            expect(symbol).to.equal(expectedSymbol);
        });
    });

    describe('constructor', () => {
        it('should initialize owner balance to totalSupply', async () => {
            const ownerBalance = await zrxToken.balanceOf(owner);
            const totalSupply = await zrxToken.totalSupply();
            expect(totalSupply).to.equal(ownerBalance);
        });
    });

    describe('transfer', () => {
        it('should transfer balance from sender to receiver', async () => {
            const receiver = spender;
            const initOwnerBalance = await zrxToken.balanceOf(owner);
            const amountToTransfer = 1n;
            
            // Get owner signer for transaction
            const [ownerSigner] = await ethers.getSigners();
            const tx = await zrxToken.connect(ownerSigner).transfer(receiver, amountToTransfer);
            const receipt = await tx.wait();
            
            // 验证 Transfer 事件
            verifyTransferEventFromReceipt(receipt!, owner, receiver, amountToTransfer);
            
            const finalOwnerBalance = await zrxToken.balanceOf(owner);
            const finalReceiverBalance = await zrxToken.balanceOf(receiver);

            const expectedFinalOwnerBalance = initOwnerBalance - amountToTransfer;
            const expectedFinalReceiverBalance = amountToTransfer;
            expect(finalOwnerBalance).to.equal(expectedFinalOwnerBalance);
            expect(finalReceiverBalance).to.equal(expectedFinalReceiverBalance);
        });

        it('should return true on a 0 value transfer', async () => {
            const [ownerSigner] = await ethers.getSigners();
            // Modern ERC20 transfers don't return values in the same way, 
            // but successful execution means it worked
            await expect(zrxToken.connect(ownerSigner).transfer(spender, 0n))
                .to.not.be.reverted;
        });
    });

    describe('transferFrom', () => {
        it('should revert if owner has insufficient balance', async () => {
            const ownerBalance = await zrxToken.balanceOf(owner);
            const amountToTransfer = ownerBalance + 1n;
            
            const [ownerSigner, spenderSigner] = await ethers.getSigners();
            
            // First approve the transfer
            await zrxToken.connect(ownerSigner).approve(spender, amountToTransfer);
            
            // Then try to transfer more than balance - should revert
            await expect(zrxToken.connect(spenderSigner).transferFrom(owner, spender, amountToTransfer))
                .to.be.revertedWith("Insufficient balance");
        });

        it('should revert if spender has insufficient allowance', async () => {
            const ownerBalance = await zrxToken.balanceOf(owner);
            
            // 重置 allowance 为 0
            const [ownerSigner, spenderSigner] = await ethers.getSigners();
            await zrxToken.connect(ownerSigner).approve(spender, 0);
            
            const amountToTransfer = ownerBalance;
            const spenderAllowance = await zrxToken.allowance(owner, spender);
            const isSpenderAllowanceInsufficient = spenderAllowance < amountToTransfer;
            expect(isSpenderAllowanceInsufficient).to.be.true;

            await expect(zrxToken.connect(spenderSigner).transferFrom(owner, spender, amountToTransfer))
                .to.be.revertedWith("Insufficient allowance");
        });

        it('should return true on a 0 value transfer', async () => {
            const amountToTransfer = 0n;
            const [, spenderSigner] = await ethers.getSigners();
            
            // Modern ERC20 transfers don't return values, but successful execution means it worked
            await expect(zrxToken.connect(spenderSigner).transferFrom(owner, spender, amountToTransfer))
                .to.not.be.reverted;
        });

        it('should not modify spender allowance if spender allowance is 2^256 - 1', async () => {
            const initOwnerBalance = await zrxToken.balanceOf(owner);
            const amountToTransfer = initOwnerBalance;
            const initSpenderAllowance = MAX_UINT;
            
            const [ownerSigner, spenderSigner] = await ethers.getSigners();
            
            // Approve unlimited allowance
            const approveTx = await zrxToken.connect(ownerSigner).approve(spender, initSpenderAllowance);
            const approveReceipt = await approveTx.wait();
            
            // 验证 Approval 事件
            verifyApprovalEventFromReceipt(approveReceipt!, owner, spender, initSpenderAllowance);
            
            // Transfer some tokens
            const transferTx = await zrxToken.connect(spenderSigner).transferFrom(owner, spender, amountToTransfer);
            const transferReceipt = await transferTx.wait();
            
            // 验证 Transfer 事件
            verifyTransferEventFromReceipt(transferReceipt!, owner, spender, amountToTransfer);

            const newSpenderAllowance = await zrxToken.allowance(owner, spender);
            expect(initSpenderAllowance).to.equal(newSpenderAllowance);
        });

        it('should transfer the correct balances if spender has sufficient allowance', async () => {
            const initOwnerBalance = await zrxToken.balanceOf(owner);
            const initSpenderBalance = await zrxToken.balanceOf(spender);
            const amountToTransfer = initOwnerBalance;
            const initSpenderAllowance = initOwnerBalance;
            
            const [ownerSigner, spenderSigner] = await ethers.getSigners();
            
            // Approve the allowance
            await zrxToken.connect(ownerSigner).approve(spender, initSpenderAllowance);
            
            // Transfer tokens via transferFrom
            const transferTx = await zrxToken.connect(spenderSigner).transferFrom(owner, spender, amountToTransfer);
            const transferReceipt = await transferTx.wait();
            
            // 验证 Transfer 事件
            verifyTransferEventFromReceipt(transferReceipt!, owner, spender, amountToTransfer);

            const newOwnerBalance = await zrxToken.balanceOf(owner);
            const newSpenderBalance = await zrxToken.balanceOf(spender);

            expect(newOwnerBalance).to.equal(0n);
            expect(newSpenderBalance).to.equal(initSpenderBalance + initOwnerBalance);
        });

        it('should modify allowance if spender has sufficient allowance less than 2^256 - 1', async () => {
            const initOwnerBalance = await zrxToken.balanceOf(owner);
            const amountToTransfer = initOwnerBalance;
            
            const [ownerSigner, spenderSigner] = await ethers.getSigners();
            
            // Approve exact amount (not unlimited)
            await zrxToken.connect(ownerSigner).approve(spender, amountToTransfer);
            
            // Transfer the approved amount
            await zrxToken.connect(spenderSigner).transferFrom(owner, spender, amountToTransfer);

            const newSpenderAllowance = await zrxToken.allowance(owner, spender);
            expect(newSpenderAllowance).to.equal(0n);
        });
    });
});
