import { ethers } from 'hardhat';
import { getRandomInteger, randomAddress, verifyEventsFromLogs } from '@0x/utils';
import { expect } from 'chai';
import { hexUtils, RawRevertError, StringRevertError } from '@0x/utils';

import { artifacts } from './artifacts';
import {
    TestFixinTokenSpenderContract,
    TestTokenSpenderERC20TokenContract,
    TestFixinTokenSpender__factory,
    TestTokenSpenderERC20Token__factory,
} from './wrappers';

describe('FixinTokenSpender', () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
    } as any;
    let tokenSpender: TestFixinTokenSpenderContract;
    let token: TestTokenSpenderERC20TokenContract;
    let greedyToken: TestTokenSpenderERC20TokenContract;

    before(async () => {
        const [deployer] = await env.getAccountAddressesAsync();
        env.txDefaults.from = deployer;
        const signer = await env.provider.getSigner(deployer);

        const tokenFactory = new TestTokenSpenderERC20Token__factory(signer);
        token = await tokenFactory.deploy();
        await token.waitForDeployment();

        const greedyTokenFactory = new TestTokenSpenderERC20Token__factory(signer);
        greedyToken = await greedyTokenFactory.deploy();
        await greedyToken.waitForDeployment();
        await greedyToken.setGreedyRevert(true);

        const tokenSpenderFactory = new TestFixinTokenSpender__factory(signer);
        tokenSpender = await tokenSpenderFactory.deploy();
        await tokenSpender.waitForDeployment();
    });

    describe('transferERC20TokensFrom()', () => {
        const EMPTY_RETURN_AMOUNT = 1337;
        const FALSE_RETURN_AMOUNT = 1338;
        const REVERT_RETURN_AMOUNT = 1339;
        const EXTRA_RETURN_TRUE_AMOUNT = 1341;
        const EXTRA_RETURN_FALSE_AMOUNT = 1342;

        it('transferERC20TokensFrom() successfully calls compliant ERC20 token', async () => {
            const tokenFrom = randomAddress();
            const tokenTo = randomAddress();
            const tokenAmount = 123456n;
            const tx = await tokenSpender.transferERC20TokensFrom(
                await token.getAddress(),
                tokenFrom,
                tokenTo,
                tokenAmount,
            );
            const receipt = await tx.wait();
            verifyEventsFromLogs(
                receipt.logs,
                token, // 使用 token 合约实例
                [
                    {
                        event: 'TransferFromCalled',
                        args: {
                            sender: await tokenSpender.getAddress(),
                            from: tokenFrom,
                            to: tokenTo,
                            amount: tokenAmount,
                        },
                    },
                ],
            );
        });

        it('transferERC20TokensFrom() successfully calls non-compliant ERC20 token', async () => {
            const tokenFrom = randomAddress();
            const tokenTo = randomAddress();
            const tokenAmount = BigInt(EMPTY_RETURN_AMOUNT);
            const tx = await tokenSpender.transferERC20TokensFrom(
                await token.getAddress(),
                tokenFrom,
                tokenTo,
                tokenAmount,
            );
            const receipt = await tx.wait();
            verifyEventsFromLogs(
                receipt.logs,
                token, // 使用 token 合约实例
                [
                    {
                        event: 'TransferFromCalled',
                        args: {
                            sender: await tokenSpender.getAddress(),
                            from: tokenFrom,
                            to: tokenTo,
                            amount: tokenAmount,
                        },
                    },
                ],
            );
        });

        it('transferERC20TokensFrom() reverts if ERC20 token reverts', async () => {
            const tokenFrom = randomAddress();
            const tokenTo = randomAddress();
            const tokenAmount = BigInt(REVERT_RETURN_AMOUNT);
            const expectedError = new StringRevertError('TestTokenSpenderERC20Token/Revert');
            return expect(
                tokenSpender.transferERC20TokensFrom(await token.getAddress(), tokenFrom, tokenTo, tokenAmount),
            ).to.be.revertedWith('TestTokenSpenderERC20Token/Revert');
        });

        it('transferERC20TokensFrom() reverts if ERC20 token returns false', async () => {
            const tokenFrom = randomAddress();
            const tokenTo = randomAddress();
            const tokenAmount = BigInt(FALSE_RETURN_AMOUNT);
            return expect(
                tokenSpender.transferERC20TokensFrom(await token.getAddress(), tokenFrom, tokenTo, tokenAmount),
            ).to.be.reverted;
        });

        it('transferERC20TokensFrom() allows extra data after true', async () => {
            const tokenFrom = randomAddress();
            const tokenTo = randomAddress();
            const tokenAmount = BigInt(EXTRA_RETURN_TRUE_AMOUNT);

            const tx = await tokenSpender.transferERC20TokensFrom(
                await token.getAddress(),
                tokenFrom,
                tokenTo,
                tokenAmount,
            );
            const receipt = await tx.wait();
            verifyEventsFromLogs(
                receipt.logs,
                token, // 使用 token 合约实例
                [
                    {
                        event: 'TransferFromCalled',
                        args: {
                            sender: await tokenSpender.getAddress(),
                            from: tokenFrom,
                            to: tokenTo,
                            amount: tokenAmount,
                        },
                    },
                ],
            );
        });

        it("transferERC20TokensFrom() reverts when there's extra data after false", async () => {
            const tokenFrom = randomAddress();
            const tokenTo = randomAddress();
            const tokenAmount = BigInt(EXTRA_RETURN_FALSE_AMOUNT);

            return expect(
                tokenSpender.transferERC20TokensFrom(await token.getAddress(), tokenFrom, tokenTo, tokenAmount),
            ).to.be.reverted;
        });

        it('transferERC20TokensFrom() cannot call self', async () => {
            const tokenFrom = randomAddress();
            const tokenTo = randomAddress();
            const tokenAmount = 123456n;

            return expect(
                tokenSpender.transferERC20TokensFrom(await tokenSpender.getAddress(), tokenFrom, tokenTo, tokenAmount),
            ).to.be.revertedWith('FixinTokenSpender/CANNOT_INVOKE_SELF');
        });
    });

    describe('getSpendableERC20BalanceOf()', () => {
        it("returns the minimum of the owner's balance and allowance", async () => {
            const balance = getRandomInteger(1, '1e18');
            const allowance = getRandomInteger(1, '1e18');
            const tokenOwner = randomAddress();
            await token.setBalanceAndAllowanceOf(tokenOwner, balance, await tokenSpender.getAddress(), allowance);
            const spendableBalance = await tokenSpender.getSpendableERC20BalanceOf(
                await token.getAddress(),
                tokenOwner,
            );
            expect(spendableBalance).to.eq(balance < allowance ? balance : allowance);
        });
    });
});
