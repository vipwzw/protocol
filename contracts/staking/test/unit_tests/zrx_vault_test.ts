import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ERC20Wrapper } from '@0x/contracts-asset-proxy';
import { filterLogsToArguments, constants as testUtilsConstants } from '../test_constants';

// Local bigint assertion helper
function expectBigIntEqual(actual: any, expected: any): void {
    const actualBigInt = typeof actual === 'bigint' ? actual : BigInt(actual.toString());
    const expectedBigInt = typeof expected === 'bigint' ? expected : BigInt(expected.toString());
    expect(actualBigInt).to.equal(expectedBigInt);
}
import { assetDataUtils } from '@0x/order-utils';
import { DummyERC20Token__factory } from '@0x/contracts-erc20';
import { RevertReason } from '@0x/utils';
import { AuthorizableRevertErrors, SafeMathRevertErrors, StakingRevertErrors } from '@0x/utils';
import { TransactionReceiptWithDecodedLogs } from 'ethereum-types';

import { constants as stakingConstants } from '../../src/constants';

import { ZrxVault, ZrxVault__factory } from '../../src/typechain-types';

describe('ZrxVault unit tests', () => {
    let accounts: string[];
    let owner: string;
    let nonOwnerAddresses: string[];
    let erc20Wrapper: ERC20Wrapper;
    let zrxVault: ZrxVault;
    let zrxAssetData: string;
    let zrxTokenAddress: string;
    let zrxProxyAddress: string;
    let erc20ProxyContract: any;
    async function ensureAuthorizedAsync(addr: string) {
        const list = await zrxVault.getAuthorizedAddresses();
        if (!list.includes(addr)) {
            await (await zrxVault.addAuthorizedAddress(addr)).wait();
        }
    }

    before(async () => {
        // create accounts
        accounts = await ethers.getSigners().then(signers => signers.map(s => s.address));
        [owner, ...nonOwnerAddresses] = accounts;

        // set up ERC20Wrapper
        erc20Wrapper = new ERC20Wrapper(await ethers.getSigners().then(signers => signers[0]), accounts, owner);
        // deploy erc20 proxy
        erc20ProxyContract = await erc20Wrapper.deployProxyAsync();
        zrxProxyAddress = await erc20ProxyContract.getAddress();
        // deploy zrx token
        const [zrxTokenContract] = await erc20Wrapper.deployDummyTokensAsync(
            1,
            Number(testUtilsConstants.DUMMY_TOKEN_DECIMALS),
        );
        zrxTokenAddress = await zrxTokenContract.getAddress();
        zrxAssetData = assetDataUtils.encodeERC20AssetData(zrxTokenAddress);

        await erc20Wrapper.setBalancesAndAllowancesAsync();

        const deployer = await ethers.getSigners().then(signers => signers[0]);
        zrxVault = await new ZrxVault__factory(deployer).deploy(zrxProxyAddress, zrxTokenAddress);
        await (await zrxVault.addAuthorizedAddress(owner)).wait();

        // configure erc20 proxy to accept calls from zrx vault
        await erc20ProxyContract.addAuthorizedAddress(await zrxVault.getAddress());
    });

    async function deployFreshVault(): Promise<void> {
        const deployer = await ethers.getSigners().then(signers => signers[0]);
        zrxVault = await new ZrxVault__factory(deployer).deploy(zrxProxyAddress, zrxTokenAddress);
        await (await zrxVault.addAuthorizedAddress(owner)).wait();
        await erc20ProxyContract.addAuthorizedAddress(await zrxVault.getAddress());
    }

    async function redeployZrxVault(): Promise<void> {
        const deployer = await ethers.getSigners().then(signers => signers[0]);
        zrxVault = await new ZrxVault__factory(deployer).deploy(zrxProxyAddress, zrxTokenAddress);
        await (await zrxVault.addAuthorizedAddress(owner)).wait();
        // configure erc20 proxy to accept calls from zrx vault
        const erc20ProxyAddress = zrxProxyAddress;
        const erc20ProxyContract = { addAuthorizedAddress: async (addr: string) => {} } as any; // no-op here
        // Already authorized earlier for first instance
    }

    enum ZrxTransfer {
        Deposit,
        Withdrawal,
    }

    async function verifyTransferPostconditionsAsync(
        transferType: ZrxTransfer,
        staker: string,
        amount: BigNumber,
        initialVaultBalance: BigNumber,
        initialTokenBalance: BigNumber,
        receipt: TransactionReceiptWithDecodedLogs,
    ): Promise<void> {
        const eventArgs =
            transferType === ZrxTransfer.Deposit
                ? filterLogsToArguments<ZrxVaultDepositEventArgs>(receipt.logs, 'Deposit')
                : filterLogsToArguments<ZrxVaultWithdrawEventArgs>(receipt.logs, 'Withdraw');
        expect(eventArgs.length).to.equal(1);
        expect(eventArgs[0].staker).to.equal(staker);
        expectBigIntEqual(eventArgs[0].amount, amount);

        const newVaultBalance = await zrxVault.balanceOf(staker);
        const token = DummyERC20Token__factory.connect(zrxTokenAddress, await ethers.getSigners().then(s => s[0]));
        const newTokenBalance = await token.balanceOf(staker);
        const [expectedVaultBalance, expectedTokenBalance] =
            transferType === ZrxTransfer.Deposit
                ? [
                      BigInt(initialVaultBalance.toString()) + BigInt(amount.toString()),
                      BigInt(initialTokenBalance.toString()) - BigInt(amount.toString()),
                  ]
                : [
                      BigInt(initialVaultBalance.toString()) - BigInt(amount.toString()),
                      BigInt(initialTokenBalance.toString()) + BigInt(amount.toString()),
                  ];
        expectBigIntEqual(newVaultBalance, expectedVaultBalance);
        expectBigIntEqual(newTokenBalance, expectedTokenBalance);
    }

    describe('Normal operation', () => {
        describe('Setting proxies', () => {
            async function verifyStakingProxySetAsync(
                receipt: TransactionReceiptWithDecodedLogs,
                newProxy: string,
            ): Promise<void> {
                const eventArgs = filterLogsToArguments<ZrxVaultStakingProxySetEventArgs>(
                    receipt.logs,
                    'StakingProxySet',
                );
                expect(eventArgs.length).to.equal(1);
                expect(eventArgs[0].stakingProxyAddress).to.equal(newProxy);
                const actualAddress = await zrxVault.stakingProxyAddress();
                expect(actualAddress).to.equal(newProxy);
            }

            it('Owner can set the ZRX proxy', async () => {
                const newProxy = nonOwnerAddresses[0];
                const tx = await zrxVault.setZrxProxy(newProxy);
                const receipt = await tx.wait();
                const eventArgs = filterLogsToArguments<ZrxVaultZrxProxySetEventArgs>(receipt.logs, 'ZrxProxySet');
                expect(eventArgs.length).to.equal(1);
                expect(eventArgs[0].zrxProxyAddress).to.equal(newProxy);
            });
            it('Authorized address can set the ZRX proxy', async () => {
                const [authorized, newProxy] = nonOwnerAddresses;
                await zrxVault.addAuthorizedAddress(authorized);
                const tx = await zrxVault.connect(await ethers.getSigner(authorized)).setZrxProxy(newProxy);
                const receipt = await tx.wait();
                const eventArgs = filterLogsToArguments<ZrxVaultZrxProxySetEventArgs>(receipt.logs, 'ZrxProxySet');
                expect(eventArgs.length).to.equal(1);
                expect(eventArgs[0].zrxProxyAddress).to.equal(newProxy);
            });
            it('Non-authorized address cannot set the ZRX proxy', async () => {
                const notAuthorized = nonOwnerAddresses[2] || nonOwnerAddresses[0];
                const newProxy = nonOwnerAddresses[3] || nonOwnerAddresses[1];
                const tx = zrxVault.connect(await ethers.getSigner(notAuthorized)).setZrxProxy(newProxy);
                return expect(tx).to.be.reverted;
            });
            it('Owner can set the staking proxy', async () => {
                const newProxy = nonOwnerAddresses[0];
                const tx = await zrxVault.setStakingProxy(newProxy);
                const receipt = await tx.wait();
                await verifyStakingProxySetAsync(receipt, newProxy);
            });
            it('Authorized address can set the staking proxy', async () => {
                const authorized = nonOwnerAddresses[2] || nonOwnerAddresses[0];
                const newProxy = nonOwnerAddresses[3] || nonOwnerAddresses[1];
                await ensureAuthorizedAsync(authorized);
                const tx = await zrxVault.connect(await ethers.getSigner(authorized)).setStakingProxy(newProxy);
                const receipt = await tx.wait();
                await verifyStakingProxySetAsync(receipt, newProxy);
            });
            it('Non-authorized address cannot set the staking proxy', async () => {
                const notAuthorized = nonOwnerAddresses[4] || nonOwnerAddresses[0];
                const newProxy = nonOwnerAddresses[5] || nonOwnerAddresses[1];
                const tx = zrxVault.connect(await ethers.getSigner(notAuthorized)).setStakingProxy(newProxy);
                return expect(tx).to.be.reverted;
            });
        });
        describe('ZRX management', () => {
            let staker: string;
            let stakingProxy: string;
            let initialVaultBalance: BigNumber;
            let initialTokenBalance: BigNumber;

            before(async () => {
                [staker, stakingProxy] = nonOwnerAddresses;
                // Reset ZRX proxy in case previous tests changed it
                await (await zrxVault.setZrxProxy(zrxProxyAddress)).wait();
                await (await zrxVault.setStakingProxy(stakingProxy)).wait();
                // Ensure token balance and allowance for staker towards ERC20Proxy
                // Ensure wrapper knows about this token by constructing asset data it created
                // If wrapper cannot find token by assetData, fall back to direct mint via token contract
                const token = DummyERC20Token__factory.connect(
                    zrxTokenAddress,
                    await ethers.getSigners().then(s => s[0]),
                );
                await (await token.setBalance(staker, 1000n * 10n ** 18n)).wait();
                const stakerSigner = await ethers.getSigner(staker);
                await (await token.connect(stakerSigner).approve(zrxProxyAddress, 1000n * 10n ** 18n)).wait();
                const stakingProxySigner = await ethers.getSigner(stakingProxy);
                await (await zrxVault.connect(stakingProxySigner).depositFrom(staker, 10n)).wait();
            });

            beforeEach(async () => {
                initialVaultBalance = await zrxVault.balanceOf(staker);
                const token = DummyERC20Token__factory.connect(
                    zrxTokenAddress,
                    await ethers.getSigners().then(s => s[0]),
                );
                initialTokenBalance = await token.balanceOf(staker);
            });

            describe('Deposit', () => {
                it('Staking proxy can deposit zero amount on behalf of staker', async () => {
                    const signer = await ethers.getSigner(stakingProxy);
                    const tx = await zrxVault.connect(signer).depositFrom(staker, testUtilsConstants.ZERO_AMOUNT);
                    const receipt = await tx.wait();
                    await verifyTransferPostconditionsAsync(
                        ZrxTransfer.Deposit,
                        staker,
                        testUtilsConstants.ZERO_AMOUNT,
                        initialVaultBalance,
                        initialTokenBalance,
                        receipt,
                    );
                });
                it('Staking proxy can deposit nonzero amount on behalf of staker', async () => {
                    const signer = await ethers.getSigner(stakingProxy);
                    const tx = await zrxVault.connect(signer).depositFrom(staker, 1n);
                    const receipt = await tx.wait();
                    await verifyTransferPostconditionsAsync(
                        ZrxTransfer.Deposit,
                        staker,
                        1n,
                        initialVaultBalance,
                        initialTokenBalance,
                        receipt,
                    );
                });
                it('Staking proxy can deposit entire ZRX balance on behalf of staker', async () => {
                    const signer = await ethers.getSigner(stakingProxy);
                    const tx = await zrxVault.connect(signer).depositFrom(staker, initialTokenBalance);
                    const receipt = await tx.wait();
                    await verifyTransferPostconditionsAsync(
                        ZrxTransfer.Deposit,
                        staker,
                        initialTokenBalance,
                        initialVaultBalance,
                        initialTokenBalance,
                        receipt,
                    );
                });
                it("Reverts if attempting to deposit more than staker's ZRX balance", async () => {
                    const stakingProxySigner = await ethers.getSigner(stakingProxy);
                    const tx = zrxVault
                        .connect(stakingProxySigner)
                        .depositFrom(staker, BigInt(initialTokenBalance.toString()) + 1n);
                    return expect(tx).to.be.reverted;
                });
            });
            describe('Withdrawal', () => {
                it('Staking proxy can withdraw zero amount on behalf of staker', async () => {
                    const signer = await ethers.getSigner(stakingProxy);
                    const tx = await zrxVault.connect(signer).withdrawFrom(staker, testUtilsConstants.ZERO_AMOUNT);
                    const receipt = await tx.wait();
                    await verifyTransferPostconditionsAsync(
                        ZrxTransfer.Withdrawal,
                        staker,
                        testUtilsConstants.ZERO_AMOUNT,
                        initialVaultBalance,
                        initialTokenBalance,
                        receipt,
                    );
                });
                it('Staking proxy can withdraw nonzero amount on behalf of staker', async () => {
                    const signer = await ethers.getSigner(stakingProxy);
                    const tx = await zrxVault.connect(signer).withdrawFrom(staker, 1n);
                    const receipt = await tx.wait();
                    await verifyTransferPostconditionsAsync(
                        ZrxTransfer.Withdrawal,
                        staker,
                        1n,
                        initialVaultBalance,
                        initialTokenBalance,
                        receipt,
                    );
                });
                it('Staking proxy can withdraw entire vault balance on behalf of staker', async () => {
                    const signer = await ethers.getSigner(stakingProxy);
                    const tx = await zrxVault.connect(signer).withdrawFrom(staker, initialVaultBalance);
                    const receipt = await tx.wait();
                    await verifyTransferPostconditionsAsync(
                        ZrxTransfer.Withdrawal,
                        staker,
                        initialVaultBalance,
                        initialVaultBalance,
                        initialTokenBalance,
                        receipt,
                    );
                });
                it("Reverts if attempting to withdraw more than staker's vault balance", async () => {
                    const stakingProxySigner = await ethers.getSigner(stakingProxy);
                    const tx = zrxVault
                        .connect(stakingProxySigner)
                        .withdrawFrom(staker, BigInt(initialVaultBalance.toString()) + 1n);
                    return expect(tx).to.be.reverted;
                });
            });
        });
    });

    describe('Catastrophic Failure Mode', () => {
        describe('Authorization', () => {
            beforeEach(async () => {
                await deployFreshVault();
            });
            async function verifyCatastrophicFailureModeAsync(sender: string, receipt: any): Promise<void> {
                const eventArgs = filterLogsToArguments(receipt.logs, 'InCatastrophicFailureMode');
                expect(eventArgs.length).to.equal(1);
                expect(eventArgs[0].sender).to.equal(sender);
                expect(await zrxVault.isInCatastrophicFailure()).to.equal(true);
            }

            it('Owner can turn on Catastrophic Failure Mode', async () => {
                const tx = await zrxVault.enterCatastrophicFailure();
                const receipt = await tx.wait();
                await verifyCatastrophicFailureModeAsync(owner, receipt);
            });
            it('Authorized address can turn on Catastrophic Failure Mode', async () => {
                const authorized = nonOwnerAddresses[0];
                await ensureAuthorizedAsync(authorized);
                const tx = await zrxVault.connect(await ethers.getSigner(authorized)).enterCatastrophicFailure();
                const receipt = await tx.wait();
                await verifyCatastrophicFailureModeAsync(authorized, receipt);
            });
            it('Non-authorized address cannot turn on Catastrophic Failure Mode', async () => {
                const notAuthorized = nonOwnerAddresses[0];
                const tx = zrxVault.connect(await ethers.getSigner(notAuthorized)).enterCatastrophicFailure();
                return expect(tx).to.be.reverted;
            });
            it('Catastrophic Failure Mode can only be turned on once', async () => {
                const authorized = nonOwnerAddresses[0];
                const tx1 = await zrxVault.addAuthorizedAddress(authorized);
                await tx1.wait();
                const tx2 = await zrxVault.connect(await ethers.getSigner(authorized)).enterCatastrophicFailure();
                await tx2.wait();
                const tx = zrxVault.enterCatastrophicFailure();
                return expect(tx).to.be.reverted;
            });
        });

        describe('Affected functionality', () => {
            let staker: string;
            let stakingProxy: string;
            let initialVaultBalance: BigNumber;
            let initialTokenBalance: BigNumber;

            before(async () => {
                await deployFreshVault();
                [staker, stakingProxy, ...nonOwnerAddresses] = nonOwnerAddresses;
                await (await zrxVault.setStakingProxy(stakingProxy)).wait();
                // Ensure staker has token balance and approval
                const deployer = await ethers.getSigners().then(s => s[0]);
                const token = DummyERC20Token__factory.connect(zrxTokenAddress, deployer);
                await (await token.setBalance(staker, 1000n * 10n ** 18n)).wait();
                const stakerSigner = await ethers.getSigner(staker);
                await (await token.connect(stakerSigner).approve(zrxProxyAddress, 1000n * 10n ** 18n)).wait();
                const signer = await ethers.getSigner(stakingProxy);
                await (await zrxVault.connect(signer).depositFrom(staker, 10n)).wait();
                await (await zrxVault.enterCatastrophicFailure()).wait();
            });

            beforeEach(async () => {
                initialVaultBalance = await zrxVault.balanceOf(staker);
                const token = DummyERC20Token__factory.connect(
                    zrxTokenAddress,
                    await ethers.getSigners().then(s => s[0]),
                );
                initialTokenBalance = await token.balanceOf(staker);
            });

            it('Owner cannot set the ZRX proxy', async () => {
                const newProxy = nonOwnerAddresses[0];
                const tx = zrxVault.setZrxProxy(newProxy);
                return expect(tx).to.be.reverted;
                const actualAddress = await zrxVault.zrxAssetProxy();
                expect(actualAddress).to.equal(zrxProxyAddress);
            });
            it('Authorized address cannot set the ZRX proxy', async () => {
                const [authorized, newProxy] = nonOwnerAddresses;
                await zrxVault.addAuthorizedAddress(authorized);
                const tx = zrxVault.connect(await ethers.getSigner(authorized)).setZrxProxy(newProxy);
                return expect(tx).to.be.reverted;
                const actualAddress = await zrxVault.zrxAssetProxy();
                expect(actualAddress).to.equal(zrxProxyAddress);
            });
            it('Staking proxy cannot deposit ZRX', async () => {
                const tx = zrxVault.depositFrom(staker, 1n);
                return expect(tx).to.be.reverted;
            });

            describe('Withdrawal', () => {
                it('Staking proxy cannot call `withdrawFrom`', async () => {
                    const tx = zrxVault.withdrawFrom(staker, 1n);
                    return expect(tx).to.be.reverted;
                });
                it('Staker can withdraw all their ZRX', async () => {
                    const tx = await zrxVault.withdrawAllFrom(staker);
                    const receipt = await tx.wait();
                    await verifyTransferPostconditionsAsync(
                        ZrxTransfer.Withdrawal,
                        staker,
                        initialVaultBalance,
                        initialVaultBalance,
                        initialTokenBalance,
                        receipt,
                    );
                });
                it('Owner can withdraw ZRX on behalf of a staker', async () => {
                    const tx = await zrxVault.withdrawAllFrom(staker);
                    const receipt = await tx.wait();
                    await verifyTransferPostconditionsAsync(
                        ZrxTransfer.Withdrawal,
                        staker,
                        initialVaultBalance,
                        initialVaultBalance,
                        initialTokenBalance,
                        receipt,
                    );
                });
                it('Non-owner address can withdraw ZRX on behalf of a staker', async () => {
                    const tx = await zrxVault.withdrawAllFrom(staker);
                    const receipt = await tx.wait();
                    await verifyTransferPostconditionsAsync(
                        ZrxTransfer.Withdrawal,
                        staker,
                        initialVaultBalance,
                        initialVaultBalance,
                        initialTokenBalance,
                        receipt,
                    );
                });
            });
        });
    });
});
