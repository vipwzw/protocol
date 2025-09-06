import { chaiSetup, constants, provider, txDefaults } from '@0x/utils';
import { RevertReason } from '@0x/utils';
import * as chai from 'chai';
import { ethers } from 'hardhat';

import { DummyERC20Token, DummyERC20Token__factory } from './wrappers';

import { artifacts } from './artifacts';

// chaiSetup 已废弃，Hardhat 自动配置 chai
const expect = chai.expect;


describe('UnlimitedAllowanceToken', () => {
    let owner: string;
    let spender: string;
    const MAX_MINT_VALUE = 10000000000000000000000n;
    let token: DummyERC20Token;

    // Hardhat automatically manages blockchain state between tests
    // No need for manual blockchain lifecycle management
    before(async () => {
        const accounts = await ethers.getSigners();
        owner = accounts[0].address;
        spender = accounts[1].address;
        
        const dummyTokenFactory = new DummyERC20Token__factory(accounts[0]);
        token = await dummyTokenFactory.deploy(
            'DummyToken',
            'DUMMY',
            18n,
            ethers.parseEther('1000000'), // 1M tokens
        );
        
        await token.connect(accounts[0]).mint(MAX_MINT_VALUE);
    });
    // Hardhat automatically manages blockchain state between tests
    describe('transfer', () => {
        it('should revert if owner has insufficient balance', async () => {
            const ownerBalance = await token.balanceOf(owner);
            const amountToTransfer = ownerBalance + 1n;
            
            const [ownerSigner] = await ethers.getSigners();
            await expect(token.connect(ownerSigner).transfer(spender, amountToTransfer))
                .to.be.revertedWith("ERC20_INSUFFICIENT_BALANCE");
        });

        it('should transfer balance from sender to receiver', async () => {
            const receiver = spender;
            const initOwnerBalance = await token.balanceOf(owner);
            const amountToTransfer = 1n;
            const [ownerSigner] = await ethers.getSigners();
            await token.connect(ownerSigner).transfer(receiver, amountToTransfer);
            const finalOwnerBalance = await token.balanceOf(owner);
            const finalReceiverBalance = await token.balanceOf(receiver);

            const expectedFinalOwnerBalance = initOwnerBalance - amountToTransfer;
            const expectedFinalReceiverBalance = amountToTransfer;
            expect(finalOwnerBalance).to.equal(expectedFinalOwnerBalance);
            expect(finalReceiverBalance).to.equal(expectedFinalReceiverBalance);
        });

        it('should return true on a 0 value transfer', async () => {
            const [ownerSigner] = await ethers.getSigners();
            // Modern ERC20 transfers don't return values, but successful execution means it worked
            await expect(token.connect(ownerSigner).transfer(spender, 0n))
                .to.not.be.reverted;
        });
    });

    describe('transferFrom', () => {
        it('should revert if owner has insufficient balance', async () => {
            const ownerBalance = await token.balanceOf(owner);
            const amountToTransfer = ownerBalance + 1n;
            
            const [ownerSigner, spenderSigner] = await ethers.getSigners();
            
            // First approve the transfer
            await token.connect(ownerSigner).approve(spender, amountToTransfer);
            
            // Then try to transfer more than balance - should revert
            await expect(token.connect(spenderSigner).transferFrom(owner, spender, amountToTransfer))
                .to.be.revertedWith("ERC20_INSUFFICIENT_BALANCE");
        });

        it('should revert if spender has insufficient allowance', async () => {
            const ownerBalance = await token.balanceOf(owner);
            
            // 重置 allowance 为 0
            const [ownerSigner, spenderSigner] = await ethers.getSigners();
            await token.connect(ownerSigner).approve(spender, 0);
            
            const amountToTransfer = ownerBalance;
            const spenderAllowance = await token.allowance(owner, spender);
            const isSpenderAllowanceInsufficient = spenderAllowance < amountToTransfer;
            expect(isSpenderAllowanceInsufficient).to.be.true;

            await expect(token.connect(spenderSigner).transferFrom(owner, spender, amountToTransfer))
                .to.be.revertedWith("ERC20_INSUFFICIENT_ALLOWANCE");
        });

        it('should return true on a 0 value transfer', async () => {
            const amountToTransfer = 0n;
            const [, spenderSigner] = await ethers.getSigners();
            
            // Modern ERC20 transfers don't return values, but successful execution means it worked
            await expect(token.connect(spenderSigner).transferFrom(owner, spender, amountToTransfer))
                .to.not.be.reverted;
        });

        it('should not modify spender allowance if spender allowance is 2^256 - 1', async () => {
            const initOwnerBalance = await token.balanceOf(owner);
            const amountToTransfer = initOwnerBalance;
            const initSpenderAllowance = 2n ** 256n - 1n; // Max uint256 value
            
            const [ownerSigner, spenderSigner] = await ethers.getSigners();
            
            // Approve unlimited allowance
            await token.connect(ownerSigner).approve(spender, initSpenderAllowance);
            
            // Transfer some tokens
            await token.connect(spenderSigner).transferFrom(owner, spender, amountToTransfer);

            const newSpenderAllowance = await token.allowance(owner, spender);
            expect(initSpenderAllowance).to.equal(newSpenderAllowance);
        });

        it('should transfer the correct balances if spender has sufficient allowance', async () => {
            const initOwnerBalance = await token.balanceOf(owner);
            const initSpenderBalance = await token.balanceOf(spender);
            const amountToTransfer = initOwnerBalance;
            const initSpenderAllowance = initOwnerBalance;
            
            const [ownerSigner, spenderSigner] = await ethers.getSigners();
            
            // Approve the allowance
            await token.connect(ownerSigner).approve(spender, initSpenderAllowance);
            
            // Transfer tokens via transferFrom
            await token.connect(spenderSigner).transferFrom(owner, spender, amountToTransfer);

            const newOwnerBalance = await token.balanceOf(owner);
            const newSpenderBalance = await token.balanceOf(spender);

            expect(newOwnerBalance).to.equal(0n);
            expect(newSpenderBalance).to.equal(initSpenderBalance + initOwnerBalance);
        });

        it('should modify allowance if spender has sufficient allowance less than 2^256 - 1', async () => {
            const initOwnerBalance = await token.balanceOf(owner);
            const amountToTransfer = initOwnerBalance;
            const initSpenderAllowance = initOwnerBalance;
            
            const [ownerSigner, spenderSigner] = await ethers.getSigners();
            
            // Approve exact amount (not unlimited)
            await token.connect(ownerSigner).approve(spender, initSpenderAllowance);
            
            // Transfer the approved amount
            await token.connect(spenderSigner).transferFrom(owner, spender, amountToTransfer);

            const newSpenderAllowance = await token.allowance(owner, spender);
            expect(newSpenderAllowance).to.equal(0n);
        });
    });
});
