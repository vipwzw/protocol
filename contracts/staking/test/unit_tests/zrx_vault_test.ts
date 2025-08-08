import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ERC20Wrapper } from '@0x/contracts-asset-proxy';
import { filterLogsToArguments } from '../test_constants';
import { constants } from '@0x/test-utils';

// Local bigint assertion helper
function expectBigIntEqual(actual: any, expected: any): void {
    const actualBigInt = typeof actual === 'bigint' ? actual : BigInt(actual.toString());
    const expectedBigInt = typeof expected === 'bigint' ? expected : BigInt(expected.toString());
    expect(actualBigInt).to.equal(expectedBigInt);
}
import { assetDataUtils } from '@0x/order-utils';
import { RevertReason } from '@0x/utils';
import { AuthorizableRevertErrors, SafeMathRevertErrors, StakingRevertErrors } from '@0x/utils';
import { TransactionReceiptWithDecodedLogs } from 'ethereum-types';

import { constants as stakingConstants } from '../../src/constants';

import { artifacts } from '../artifacts';
import {
    ZrxVaultContract,
    ZrxVaultDepositEventArgs,
    ZrxVaultInCatastrophicFailureModeEventArgs,
    ZrxVaultStakingProxySetEventArgs,
    ZrxVaultWithdrawEventArgs,
    ZrxVaultZrxProxySetEventArgs,
} from '../wrappers';

describe('ZrxVault unit tests', () => {
    let accounts: string[];
    let owner: string;
    let nonOwnerAddresses: string[];
    let erc20Wrapper: ERC20Wrapper;
    let zrxVault: ZrxVaultContract;
    let zrxAssetData: string;
    let zrxProxyAddress: string;

    before(async () => {
        // create accounts
        accounts = await ethers.getSigners().then(signers => signers.map(s => s.address));
        [owner, ...nonOwnerAddresses] = accounts;

        // set up ERC20Wrapper
        erc20Wrapper = new ERC20Wrapper(await ethers.getSigners().then(signers => signers[0]), accounts, owner);
        // deploy erc20 proxy
        const erc20ProxyContract = await erc20Wrapper.deployProxyAsync();
        zrxProxyAddress = await erc20ProxyContract.getAddress();
        // deploy zrx token
        const [zrxTokenContract] = await erc20Wrapper.deployDummyTokensAsync(1, constants.DUMMY_TOKEN_DECIMALS);
        zrxAssetData = assetDataUtils.encodeERC20AssetData(await zrxTokenContract.getAddress());

        await erc20Wrapper.setBalancesAndAllowancesAsync();

        zrxVault = await ZrxVaultContract.deployFrom0xArtifactAsync(
            artifacts.ZrxVault,
            await ethers.getSigners().then(signers => signers[0]),
            {},
            artifacts,
            zrxProxyAddress,
            await zrxTokenContract.getAddress(),
        );

        await zrxVault.addAuthorizedAddress(owner);

        // configure erc20 proxy to accept calls from zrx vault
        await erc20ProxyContract.addAuthorizedAddress(await zrxVault.getAddress());
    });

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
        const newTokenBalance = await erc20Wrapper.getBalanceAsync(staker, zrxAssetData);
        const [expectedVaultBalance, expectedTokenBalance] =
            transferType === ZrxTransfer.Deposit
                ? [BigInt(initialVaultBalance.toString()) + BigInt(amount.toString()), BigInt(initialTokenBalance.toString()) - BigInt(amount.toString())]
                : [BigInt(initialVaultBalance.toString()) - BigInt(amount.toString()), BigInt(initialTokenBalance.toString()) + BigInt(amount.toString())];
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
                const [notAuthorized, newProxy] = nonOwnerAddresses;
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
                const [authorized, newProxy] = nonOwnerAddresses;
                await zrxVault.addAuthorizedAddress(authorized);
                const tx = await zrxVault.setStakingProxy(newProxy);
                const receipt = await tx.wait();
                await verifyStakingProxySetAsync(receipt, newProxy);
            });
            it('Non-authorized address cannot set the staking proxy', async () => {
                const [notAuthorized, newProxy] = nonOwnerAddresses;
                const tx = zrxVault.setStakingProxy(newProxy);
                const expectedError = new AuthorizableRevertErrors.SenderNotAuthorizedError(notAuthorized);
                expect(tx).to.revertedWith(expectedError);
                const actualAddress = await zrxVault.stakingProxyAddress();
                expect(actualAddress).to.equal(stakingConstants.NIL_ADDRESS);
            });
        });
        describe('ZRX management', () => {
            let staker: string;
            let stakingProxy: string;
            let initialVaultBalance: BigNumber;
            let initialTokenBalance: BigNumber;

            before(async () => {
                [staker, stakingProxy] = nonOwnerAddresses;
                await zrxVault.setStakingProxy(stakingProxy);
                await zrxVault.depositFrom(staker, 10n).awaitTransactionSuccessAsync({
                    from: stakingProxy,
                });
            });

            beforeEach(async () => {
                initialVaultBalance = await zrxVault.balanceOf(staker);
                initialTokenBalance = await erc20Wrapper.getBalanceAsync(staker, zrxAssetData);
            });

            describe('Deposit', () => {
                it('Staking proxy can deposit zero amount on behalf of staker', async () => {
                    const receipt = await zrxVault
                        .depositFrom(staker, constants.ZERO_AMOUNT)
                        .awaitTransactionSuccessAsync({
                            from: stakingProxy,
                        });
                    await verifyTransferPostconditionsAsync(
                        ZrxTransfer.Deposit,
                        staker,
                        constants.ZERO_AMOUNT,
                        initialVaultBalance,
                        initialTokenBalance,
                        receipt,
                    );
                });
                it('Staking proxy can deposit nonzero amount on behalf of staker', async () => {
                    const tx = await zrxVault.depositFrom(staker, 1n);
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
                    const receipt = await zrxVault
                        .depositFrom(staker, initialTokenBalance)
                        .awaitTransactionSuccessAsync({
                            from: stakingProxy,
                        });
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
                    const tx = zrxVault.depositFrom(staker, BigInt(initialTokenBalance.toString()) + 1n);
                    return expect(tx).to.revertedWith(RevertReason.TransferFailed);
                });
            });
            describe('Withdrawal', () => {
                it('Staking proxy can withdraw zero amount on behalf of staker', async () => {
                    const receipt = await zrxVault
                        .withdrawFrom(staker, constants.ZERO_AMOUNT)
                        .awaitTransactionSuccessAsync({
                            from: stakingProxy,
                        });
                    await verifyTransferPostconditionsAsync(
                        ZrxTransfer.Withdrawal,
                        staker,
                        constants.ZERO_AMOUNT,
                        initialVaultBalance,
                        initialTokenBalance,
                        receipt,
                    );
                });
                it('Staking proxy can withdraw nonzero amount on behalf of staker', async () => {
                    const tx = await zrxVault.withdrawFrom(staker, 1n);
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
                    const receipt = await zrxVault
                        .withdrawFrom(staker, initialVaultBalance)
                        .awaitTransactionSuccessAsync({
                            from: stakingProxy,
                        });
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
                    const tx = zrxVault.withdrawFrom(staker, BigInt(initialVaultBalance.toString()) + 1n);
                    const expectedError = new SafeMathRevertErrors.Uint256BinOpError(
                        SafeMathRevertErrors.BinOpErrorCodes.SubtractionUnderflow,
                        initialVaultBalance,
                        BigInt(initialVaultBalance.toString()) + 1n,
                    );
                    expect(tx).to.revertedWith(expectedError);
                });
            });
        });
    });

    describe('Catastrophic Failure Mode', () => {
        describe('Authorization', () => {
            async function verifyCatastrophicFailureModeAsync(
                sender: string,
                receipt: TransactionReceiptWithDecodedLogs,
            ): Promise<void> {
                const eventArgs = filterLogsToArguments<ZrxVaultInCatastrophicFailureModeEventArgs>(
                    receipt.logs,
                    'InCatastrophicFailureMode',
                );
                expect(eventArgs.length).to.equal(1);
                expect(eventArgs[0].sender).to.equal(sender);
                expect(await zrxVault.isInCatastrophicFailure()).to.be.true();
            }

            it('Owner can turn on Catastrophic Failure Mode', async () => {
                const receipt = await zrxVault.enterCatastrophicFailure();
                await verifyCatastrophicFailureModeAsync(owner, receipt);
            });
            it('Authorized address can turn on Catastrophic Failure Mode', async () => {
                const authorized = nonOwnerAddresses[0];
                await zrxVault.addAuthorizedAddress(authorized);
                const tx = await zrxVault.enterCatastrophicFailure();
                const receipt = await tx.wait();
                await verifyCatastrophicFailureModeAsync(authorized, receipt);
            });
            it('Non-authorized address cannot turn on Catastrophic Failure Mode', async () => {
                const notAuthorized = nonOwnerAddresses[0];
                const tx = zrxVault.enterCatastrophicFailure();
                const expectedError = new AuthorizableRevertErrors.SenderNotAuthorizedError(notAuthorized);
                expect(tx).to.revertedWith(expectedError);
                expect(await zrxVault.isInCatastrophicFailure()).to.be.false();
            });
            it('Catastrophic Failure Mode can only be turned on once', async () => {
                const authorized = nonOwnerAddresses[0];
                const tx1 = await zrxVault.addAuthorizedAddress(authorized);
                await tx1.wait();
                const tx2 = await zrxVault.enterCatastrophicFailure();
                await tx2.wait();
                const expectedError = new StakingRevertErrors.OnlyCallableIfNotInCatastrophicFailureError();
                return expect(zrxVault.enterCatastrophicFailure()).to.revertedWith(
                    expectedError,
                );
            });
        });

        describe('Affected functionality', () => {
            let staker: string;
            let stakingProxy: string;
            let initialVaultBalance: BigNumber;
            let initialTokenBalance: BigNumber;

            before(async () => {
                [staker, stakingProxy, ...nonOwnerAddresses] = nonOwnerAddresses;
                await zrxVault.setStakingProxy(stakingProxy);
                await zrxVault.depositFrom(staker, 10n).awaitTransactionSuccessAsync({
                    from: stakingProxy,
                });
                await zrxVault.enterCatastrophicFailure();
            });

            beforeEach(async () => {
                initialVaultBalance = await zrxVault.balanceOf(staker);
                initialTokenBalance = await erc20Wrapper.getBalanceAsync(staker, zrxAssetData);
            });

            it('Owner cannot set the ZRX proxy', async () => {
                const newProxy = nonOwnerAddresses[0];
                const tx = zrxVault.setZrxProxy(newProxy);
                const expectedError = new StakingRevertErrors.OnlyCallableIfNotInCatastrophicFailureError();
                expect(tx).to.revertedWith(expectedError);
                const actualAddress = await zrxVault.zrxAssetProxy();
                expect(actualAddress).to.equal(zrxProxyAddress);
            });
            it('Authorized address cannot set the ZRX proxy', async () => {
                const [authorized, newProxy] = nonOwnerAddresses;
                await zrxVault.addAuthorizedAddress(authorized);
                const tx = zrxVault.setZrxProxy(newProxy);
                const expectedError = new StakingRevertErrors.OnlyCallableIfNotInCatastrophicFailureError();
                expect(tx).to.revertedWith(expectedError);
                const actualAddress = await zrxVault.zrxAssetProxy();
                expect(actualAddress).to.equal(zrxProxyAddress);
            });
            it('Staking proxy cannot deposit ZRX', async () => {
                const tx = zrxVault.depositFrom(staker, 1n);
                const expectedError = new StakingRevertErrors.OnlyCallableIfNotInCatastrophicFailureError();
                expect(tx).to.revertedWith(expectedError);
            });

            describe('Withdrawal', () => {
                it('Staking proxy cannot call `withdrawFrom`', async () => {
                    const tx = zrxVault.withdrawFrom(staker, 1n);
                    const expectedError = new StakingRevertErrors.OnlyCallableIfNotInCatastrophicFailureError();
                    expect(tx).to.revertedWith(expectedError);
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
