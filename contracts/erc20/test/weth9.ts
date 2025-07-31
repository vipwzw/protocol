import {
    chaiSetup,
    constants,
    expectInsufficientFundsAsync,
    expectTransactionFailedWithoutReasonAsync,
    provider,
    txDefaults,
} from '@0x/test-utils';
import { BlockchainLifecycle } from '@0x/dev-utils';
import * as chai from 'chai';
import { ethers } from 'hardhat';

import { WETH9, WETH9__factory } from './wrappers';

import { artifacts } from './artifacts';

chaiSetup.configure();
const expect = chai.expect;
const blockchainLifecycle = new BlockchainLifecycle();

describe('EtherToken', () => {
    let account: string;
    const gasPrice = BigInt(constants.DEFAULT_GAS_PRICE);
    let etherToken: WETH9;

    before(async () => {
        await blockchainLifecycle.startAsync();
    });
    after(async () => {
        await blockchainLifecycle.revertAsync();
    });
    before(async () => {
        const accounts = await ethers.getSigners();
        account = accounts[0].address;

        const weth9Factory = new WETH9__factory(accounts[0]);
        etherToken = await weth9Factory.deploy();
    });
    beforeEach(async () => {
        await blockchainLifecycle.startAsync();
    });
    afterEach(async () => {
        await blockchainLifecycle.revertAsync();
    });
    describe('deposit', () => {
        it('should revert if caller attempts to deposit more Ether than caller balance', async () => {
            const initEthBalance = await ethers.provider.getBalance(account);
            const ethToDeposit = initEthBalance + 1n;

            const [signer] = await ethers.getSigners();
            await expect(etherToken.connect(signer).deposit({ value: ethToDeposit }))
                .to.be.rejected;
        });

        it('should convert deposited Ether to wrapped Ether tokens', async () => {
            const initEthBalance = await ethers.provider.getBalance(account);
            const initEthTokenBalance = await etherToken.balanceOf(account);

            const ethToDeposit = ethers.parseEther('1');

            const tx = await etherToken.deposit({ value: ethToDeposit });
            await tx.wait();

            const finalEthBalance = await ethers.provider.getBalance(account);
            const finalEthTokenBalance = await etherToken.balanceOf(account);

            // 检查 ETH 余额减少（考虑到 gas 费用，应该少于初始余额）
            expect(finalEthBalance).to.be.lessThan(initEthBalance);
            // 检查 EtherToken 余额增加了正确的数量
            expect(finalEthTokenBalance).to.equal(initEthTokenBalance + ethToDeposit);
        });
    });

    describe('withdraw', () => {
        it('should revert if caller attempts to withdraw greater than caller balance', async () => {
            const initEthTokenBalance = await etherToken.balanceOf(account);
            const ethTokensToWithdraw = initEthTokenBalance + 1n;

            await expect(etherToken.withdraw(ethTokensToWithdraw)).to.be.revertedWithoutReason();
        });

        it('should convert ether tokens to ether with sufficient balance', async () => {
            const ethToDeposit = ethers.parseEther('1');
            await etherToken.deposit({ value: ethToDeposit });
            const initEthTokenBalance = await etherToken.balanceOf(account);
            const initEthBalance = await ethers.provider.getBalance(account);
            const ethTokensToWithdraw = initEthTokenBalance;
            expect(ethTokensToWithdraw).to.not.equal(0n);
            const tx = await etherToken.withdraw(ethTokensToWithdraw, {
                gasLimit: constants.MAX_ETHERTOKEN_WITHDRAW_GAS,
            });
            const receipt = await tx.wait();

            const finalEthBalance = await ethers.provider.getBalance(account);
            const finalEthTokenBalance = await etherToken.balanceOf(account);

            // 检查 ETH 余额增加（考虑到 gas 费用，应该比初始余额大但少于完整提取金额）
            expect(finalEthBalance).to.be.greaterThan(initEthBalance);
            // 检查 EtherToken 余额减少了正确的数量
            expect(finalEthTokenBalance).to.equal(initEthTokenBalance - ethTokensToWithdraw);
        });
    });

    describe('fallback', () => {
        it('should convert sent ether to ether tokens', async () => {
            const initEthBalance = await ethers.provider.getBalance(account);
            const initEthTokenBalance = await etherToken.balanceOf(account);

            const ethToDeposit = ethers.parseEther('1');

            const signer = await ethers.getSigner(account);
            const tx = await signer.sendTransaction({
                to: await etherToken.getAddress(),
                value: ethToDeposit,
                gasPrice,
            });
            const receipt = await tx.wait();

            const finalEthBalance = await ethers.provider.getBalance(account);
            const finalEthTokenBalance = await etherToken.balanceOf(account);

            // 检查 ETH 余额减少（考虑到 gas 费用，应该少于初始余额）
            expect(finalEthBalance).to.be.lessThan(initEthBalance);
            // 检查 EtherToken 余额增加了正确的数量  
            expect(finalEthTokenBalance).to.equal(initEthTokenBalance + ethToDeposit);
        });
    });
});
