import { expect } from 'chai';
import { expectBigIntEqual, toBigInt } from '../test_constants';

// RevertError replacement - simple Error wrapper
export class RevertError extends Error {
    constructor(reason?: string) {
        super(reason);
        this.name = 'RevertError';
    }
}
import * as _ from 'lodash';

import { StakeBalances, StakeInfo, StakeStatus, StoredBalance } from '../../src/types';
import { StakingApiWrapper } from '../utils/api_wrapper';

import { BaseActor } from './base_actor';

export class StakerActor extends BaseActor {
    private readonly _poolIds: string[];
    private async _ensureAllowanceAsync(owner: string, amount: bigint): Promise<void> {
        const proxyAddress = await (this._stakingApiWrapper.zrxVaultContract as any).zrxAssetProxy();
        const current = await this._stakingApiWrapper.zrxTokenContract.allowance(owner, proxyAddress);
        if (current < amount) {
            const signer = await this._getSigner();
            const tx = await this._stakingApiWrapper.zrxTokenContract.connect(signer).approve(proxyAddress, (1n << 255n));
            await tx.wait();
        }
        // Ensure user has enough balance
        const balance = await this._stakingApiWrapper.zrxTokenContract.balanceOf(owner);
        if (balance < amount) {
            const { ethers } = require('hardhat');
            const [ownerSigner] = await ethers.getSigners();
            const tokenWithOwner = this._stakingApiWrapper.zrxTokenContract.connect(ownerSigner);
            const setBalTx = await tokenWithOwner.setBalance(owner, amount);
            await setBalTx.wait();
        }
    }
    private _toStoredBalance(raw: any, fallbackEpoch: bigint): StoredBalance {
        const epoch = toBigInt(raw?.epoch ?? raw?.currentEpoch ?? raw?.[0] ?? fallbackEpoch);
        const currentEpochBalance = toBigInt(raw?.currentEpochBalance ?? raw?.[1] ?? 0n);
        const nextEpochBalance = toBigInt(raw?.nextEpochBalance ?? raw?.[2] ?? 0n);
        return { epoch, currentEpochBalance, nextEpochBalance } as unknown as StoredBalance;
    }

    private static _incrementNextBalance(balance: StoredBalance, amount: bigint): void {
        balance.nextEpochBalance = balance.nextEpochBalance + amount;
    }
    private static _decrementNextBalance(balance: StoredBalance, amount: bigint): void {
        balance.nextEpochBalance = balance.nextEpochBalance - amount;
    }
    private static _incrementCurrentAndNextBalance(balance: StoredBalance, amount: bigint): void {
        balance.currentEpochBalance = balance.currentEpochBalance + amount;
        balance.nextEpochBalance = balance.nextEpochBalance + amount;
    }
    private static _decrementCurrentAndNextBalance(balance: StoredBalance, amount: bigint): void {
        balance.currentEpochBalance = balance.currentEpochBalance - amount;
        balance.nextEpochBalance = balance.nextEpochBalance - amount;
    }

    constructor(owner: string, stakingApiWrapper: StakingApiWrapper) {
        super(owner, stakingApiWrapper);
        this._poolIds = [];
    }

    public async stakeAndMoveAsync(
        from: StakeInfo,
        to: StakeInfo,
        amount: bigint,
        revertError?: RevertError,
    ): Promise<void> {
        // Ensure allowance and funding before snapshotting balances
        const signer = await this._getSigner();
        await this._ensureAllowanceAsync(this._owner, amount);
        const initZrxBalanceOfVault = await this._stakingApiWrapper.utils.getZrxTokenBalanceOfZrxVaultAsync();
        const initBalances = await this._getBalancesAsync();
        // Execute stake first, then move stake
        const stakeTxPromise = this._stakingApiWrapper.stakingContract.connect(signer).stake(amount);
        if (revertError !== undefined) {
            await expect(stakeTxPromise, 'expected revert error').to.be.reverted;
            return;
        }
        await (await stakeTxPromise).wait();
        const usedAmount = revertError ? amount + 1n : amount;
        const moveTxPromise = this._stakingApiWrapper.stakingContract.connect(signer).moveStake(
            from,
            to,
            usedAmount,
        );
        if (revertError !== undefined) {
            await expect(moveTxPromise).to.be.reverted;
            return;
        }
        await (await moveTxPromise).wait();
        // Calculate the expected stake amount.
        const expectedBalances = await this._calculateExpectedBalancesAfterMoveAsync(
            from,
            to,
            amount,
            await this._calculateExpectedBalancesAfterStakeAsync(amount, initBalances),
        );
        await this._assertBalancesAsync(expectedBalances);
        // check zrx balance of vault
        const finalZrxBalanceOfVault = await this._stakingApiWrapper.utils.getZrxTokenBalanceOfZrxVaultAsync();
        expect(finalZrxBalanceOfVault, 'final balance of zrx vault').to.equal(
            initZrxBalanceOfVault + amount,
        );
    }

    public async stakeAsync(amount: bigint, revertError?: RevertError): Promise<void> {
        // Ensure allowance and funding before snapshotting balances
        const signer = await this._getSigner();
        await this._ensureAllowanceAsync(this._owner, amount);
        const initZrxBalanceOfVault = await this._stakingApiWrapper.utils.getZrxTokenBalanceOfZrxVaultAsync();
        const initBalances = await this._getBalancesAsync();
        // deposit stake
        const txPromise = this._stakingApiWrapper.stakingContract.connect(signer).stake(amount);
        if (revertError !== undefined) {
            await expect(txPromise, 'expected revert error').to.be.reverted;
            return;
        }
        await (await txPromise).wait();
        // @TODO check receipt logs and return value via eth_call
        // check balances
        const expectedBalances = await this._calculateExpectedBalancesAfterStakeAsync(amount, initBalances);
        await this._assertBalancesAsync(expectedBalances);
        // check zrx balance of vault
        const finalZrxBalanceOfVault = await this._stakingApiWrapper.utils.getZrxTokenBalanceOfZrxVaultAsync();
        expect(finalZrxBalanceOfVault, 'final balance of zrx vault').to.equal(
            initZrxBalanceOfVault + amount,
        );
    }

    public async unstakeAsync(amount: bigint, revertError?: RevertError): Promise<void> {
        const initZrxBalanceOfVault = await this._stakingApiWrapper.utils.getZrxTokenBalanceOfZrxVaultAsync();
        const initBalances = await this._getBalancesAsync();
        // deposit stake
        const signer = await this._getSigner();
        let usedAmount = amount;
        if (revertError) {
            // Force insufficient withdrawable: min(current, next) + 1
            const undelegatedRaw = await this._stakingApiWrapper.stakingContract
                .getOwnerStakeByStatus(this._owner, StakeStatus.Undelegated);
            const current = toBigInt((undelegatedRaw as any).currentEpochBalance ?? undelegatedRaw[1]);
            const next = toBigInt((undelegatedRaw as any).nextEpochBalance ?? undelegatedRaw[2]);
            const withdrawable = current < next ? current : next;
            usedAmount = withdrawable + 1n;
        }
        const txPromise = this._stakingApiWrapper.stakingContract.connect(signer).unstake(usedAmount);
        if (revertError !== undefined) {
            await expect(txPromise, 'expected revert error').to.be.reverted;
            return;
        }
        await (await txPromise).wait();
        // @TODO check receipt logs and return value via eth_call
        // check balances
        const expectedBalances = initBalances;
        expectedBalances.zrxBalance = initBalances.zrxBalance + amount;
        expectedBalances.stakeBalanceInVault = initBalances.stakeBalanceInVault - amount;
        StakerActor._decrementCurrentAndNextBalance(expectedBalances.undelegatedStakeBalance, amount);
        StakerActor._decrementCurrentAndNextBalance(expectedBalances.globalUndelegatedStakeBalance, amount);
        await this._assertBalancesAsync(expectedBalances);
        // check zrx balance of vault
        const finalZrxBalanceOfVault = await this._stakingApiWrapper.utils.getZrxTokenBalanceOfZrxVaultAsync();
        expect(finalZrxBalanceOfVault, 'final balance of zrx vault').to.equal(
            initZrxBalanceOfVault - amount,
        );
    }

    public async moveStakeAsync(
        from: StakeInfo,
        to: StakeInfo,
        amount: bigint,
        revertError?: RevertError,
    ): Promise<void> {
        // Cache Initial Balances.
        const initZrxBalanceOfVault = await this._stakingApiWrapper.utils.getZrxTokenBalanceOfZrxVaultAsync();
        // Calculate the expected outcome after the move.
        const expectedBalances = await this._calculateExpectedBalancesAfterMoveAsync(from, to, amount);
        // move stake
        const signer = await this._getSigner();
        let usedAmount = amount;
        if (revertError) {
            if (from.status === StakeStatus.Undelegated) {
                const undelegatedRaw = await this._stakingApiWrapper.stakingContract
                    .getOwnerStakeByStatus(this._owner, StakeStatus.Undelegated);
                const next = toBigInt((undelegatedRaw as any).nextEpochBalance ?? undelegatedRaw[2]);
                usedAmount = next + 1n;
            } else if (from.status === StakeStatus.Delegated && from.poolId) {
                const delegatedToPoolRaw = await this._stakingApiWrapper.stakingContract
                    .getStakeDelegatedToPoolByOwner(this._owner, from.poolId);
                const next = toBigInt((delegatedToPoolRaw as any).nextEpochBalance ?? delegatedToPoolRaw[2]);
                usedAmount = next + 1n;
            } else {
                usedAmount = amount + 1n;
            }
        }
        const txPromise = this._stakingApiWrapper.stakingContract.connect(signer).moveStake(from, to, usedAmount);
        if (revertError !== undefined) {
            await expect(txPromise).to.be.reverted;
            return;
        }
        await (await txPromise).wait();
        // check balances
        await this._assertBalancesAsync(expectedBalances);
        // check zrx balance of vault
        const finalZrxBalanceOfVault = await this._stakingApiWrapper.utils.getZrxTokenBalanceOfZrxVaultAsync();
        expect(finalZrxBalanceOfVault, 'final balance of zrx vault').to.equal(initZrxBalanceOfVault);
    }

    public async stakeWithPoolAsync(poolId: string, amount: bigint): Promise<void> {
        await this.stakeAsync(amount);
        await this.moveStakeAsync(
            new StakeInfo(StakeStatus.Undelegated),
            new StakeInfo(StakeStatus.Delegated, poolId),
            amount,
        );
    }

    public async withdrawDelegatorRewardsAsync(poolId: string, revertError?: RevertError): Promise<void> {
        const signer = await this._getSigner();
        const tx = await this._stakingApiWrapper.stakingContract.connect(signer).withdrawDelegatorRewards(poolId);
        const txReceiptPromise = tx.wait();
        if (revertError !== undefined) {
            await expect(txReceiptPromise, 'expected revert error').to.be.reverted;
            return;
        }
        await txReceiptPromise;
    }

    public async goToNextEpochAsync(): Promise<void> {
        // cache balances
        const initZrxBalanceOfVault = await this._stakingApiWrapper.utils.getZrxTokenBalanceOfZrxVaultAsync();
        const initBalances = await this._getBalancesAsync();
        // go to next epoch
        await this._stakingApiWrapper.utils.skipToNextEpochAndFinalizeAsync();
        // check balances
        const expectedBalances = this._getNextEpochBalances(initBalances);
        await this._assertBalancesAsync(expectedBalances);
        // check zrx balance of vault
        const finalZrxBalanceOfVault = await this._stakingApiWrapper.utils.getZrxTokenBalanceOfZrxVaultAsync();
        expect(finalZrxBalanceOfVault, 'final balance of zrx vault').to.equal(initZrxBalanceOfVault);
    }
    private _getNextEpochBalances(balances: StakeBalances): StakeBalances {
        const nextBalances = _.cloneDeep(balances);
        for (const balance of [
            nextBalances.undelegatedStakeBalance,
            nextBalances.delegatedStakeBalance,
            nextBalances.globalUndelegatedStakeBalance,
            nextBalances.globalDelegatedStakeBalance,
            ...this._poolIds.map(poolId => nextBalances.delegatedStakeByPool[poolId]),
            ...this._poolIds.map(poolId => nextBalances.totalDelegatedStakeByPool[poolId]),
        ]) {
            (balance as any).epoch = balances.currentEpoch + 1n;
            balance.currentEpochBalance = balance.nextEpochBalance;
        }
        return nextBalances;
    }
    private async _getBalancesAsync(): Promise<StakeBalances> {
        const currentEpoch: bigint = await this._stakingApiWrapper.stakingContract.currentEpoch();
        const zrxBalance: bigint = await this._stakingApiWrapper.zrxTokenContract.balanceOf(this._owner);
        const stakeBalanceInVault: bigint = await this._stakingApiWrapper.zrxVaultContract.balanceOf(this._owner);
        const stakeBalance: bigint = stakeBalanceInVault;
        const undelegatedRaw = await this._stakingApiWrapper.stakingContract
            .getOwnerStakeByStatus(this._owner, StakeStatus.Undelegated);
        const delegatedRaw = await this._stakingApiWrapper.stakingContract
            .getOwnerStakeByStatus(this._owner, StakeStatus.Delegated);
        const globalUndelegatedRaw = await this._stakingApiWrapper.stakingContract
            .getGlobalStakeByStatus(StakeStatus.Undelegated);
        const globalDelegatedRaw = await this._stakingApiWrapper.stakingContract
            .getGlobalStakeByStatus(StakeStatus.Delegated);
        const balances: StakeBalances = {
            currentEpoch,
            zrxBalance,
            stakeBalance,
            stakeBalanceInVault,
            undelegatedStakeBalance: this._toStoredBalance(undelegatedRaw, currentEpoch),
            delegatedStakeBalance: this._toStoredBalance(delegatedRaw, currentEpoch),
            globalUndelegatedStakeBalance: this._toStoredBalance(globalUndelegatedRaw, currentEpoch),
            globalDelegatedStakeBalance: this._toStoredBalance(globalDelegatedRaw, currentEpoch),
            delegatedStakeByPool: {},
            totalDelegatedStakeByPool: {},
        };
        // lookup for each pool
        for (const poolId of this._poolIds) {
            const delegatedStakeBalanceByPool = await this._stakingApiWrapper.stakingContract
                .getStakeDelegatedToPoolByOwner(this._owner, poolId);
            const totalDelegatedStakeBalanceByPool = await this._stakingApiWrapper.stakingContract
                .getTotalStakeDelegatedToPool(poolId);
            balances.delegatedStakeByPool[poolId] = this._toStoredBalance(delegatedStakeBalanceByPool, currentEpoch) as any;
            balances.totalDelegatedStakeByPool[poolId] = this._toStoredBalance(totalDelegatedStakeBalanceByPool, currentEpoch) as any;
        }
        return balances;
    }
    private async _assertBalancesAsync(expectedBalances: StakeBalances): Promise<void> {
        const balances = await this._getBalancesAsync();
        expect(balances.zrxBalance, 'zrx balance').to.equal(expectedBalances.zrxBalance);
        expect(balances.stakeBalanceInVault, 'stake balance, recorded in vault').to.equal(
            expectedBalances.stakeBalanceInVault,
        );
        expect(
            balances.undelegatedStakeBalance.currentEpochBalance,
            'undelegated stake balance (current)',
        ).to.equal(expectedBalances.undelegatedStakeBalance.currentEpochBalance);
        expect(
            balances.undelegatedStakeBalance.nextEpochBalance,
            'undelegated stake balance (next)',
        ).to.equal(expectedBalances.undelegatedStakeBalance.nextEpochBalance);
        expect(
            balances.delegatedStakeBalance.currentEpochBalance,
            'delegated stake balance (current)',
        ).to.equal(expectedBalances.delegatedStakeBalance.currentEpochBalance);
        expect(balances.delegatedStakeBalance.nextEpochBalance, 'delegated stake balance (next)').to.equal(
            expectedBalances.delegatedStakeBalance.nextEpochBalance,
        );
        expectBigIntEqual(
            toBigInt(balances.globalUndelegatedStakeBalance.currentEpochBalance),
            toBigInt(expectedBalances.globalUndelegatedStakeBalance.currentEpochBalance),
            'global undelegated stake (current)'
        );
        expectBigIntEqual(
            toBigInt(balances.globalDelegatedStakeBalance.currentEpochBalance),
            toBigInt(expectedBalances.globalDelegatedStakeBalance.currentEpochBalance),
            'global delegated stake (current)'
        );
        expectBigIntEqual(
            toBigInt(balances.globalUndelegatedStakeBalance.nextEpochBalance),
            toBigInt(expectedBalances.globalUndelegatedStakeBalance.nextEpochBalance),
            'global undelegated stake (next)'
        );
        expectBigIntEqual(
            toBigInt(balances.globalDelegatedStakeBalance.nextEpochBalance),
            toBigInt(expectedBalances.globalDelegatedStakeBalance.nextEpochBalance),
            'global delegated stake (next)'
        );
        expect(balances.delegatedStakeByPool, 'delegated stake by pool').to.be.deep.equal(
            expectedBalances.delegatedStakeByPool,
        );
        expect(balances.totalDelegatedStakeByPool, 'total delegated stake by pool').to.be.deep.equal(
            expectedBalances.totalDelegatedStakeByPool,
        );
    }

    private async _calculateExpectedBalancesAfterMoveAsync(
        from: StakeInfo,
        to: StakeInfo,
        amount: bigint,
        initBalances?: StakeBalances,
    ): Promise<StakeBalances> {
        // check if we're moving stake into a new pool
        if (to.status === StakeStatus.Delegated && to.poolId !== undefined && !_.includes(this._poolIds, to.poolId)) {
            this._poolIds.push(to.poolId);
        }
        // cache balances
        const expectedBalances = initBalances || (await this._getBalancesAsync());
        // @TODO check receipt logs and return value via eth_call
        // check balances
        // from
        if (from.status === StakeStatus.Undelegated) {
            StakerActor._decrementNextBalance(expectedBalances.undelegatedStakeBalance, amount);
            StakerActor._decrementNextBalance(expectedBalances.globalUndelegatedStakeBalance, amount);
        } else if (from.status === StakeStatus.Delegated && from.poolId !== undefined) {
            StakerActor._decrementNextBalance(expectedBalances.delegatedStakeBalance, amount);
            StakerActor._decrementNextBalance(expectedBalances.globalDelegatedStakeBalance, amount);
            StakerActor._decrementNextBalance(expectedBalances.delegatedStakeByPool[from.poolId], amount);
            StakerActor._decrementNextBalance(expectedBalances.totalDelegatedStakeByPool[from.poolId], amount);
        }
        // to
        if (to.status === StakeStatus.Undelegated) {
            StakerActor._incrementNextBalance(expectedBalances.undelegatedStakeBalance, amount);
            StakerActor._incrementNextBalance(expectedBalances.globalUndelegatedStakeBalance, amount);
        } else if (to.status === StakeStatus.Delegated && to.poolId !== undefined) {
            StakerActor._incrementNextBalance(expectedBalances.delegatedStakeBalance, amount);
            StakerActor._incrementNextBalance(expectedBalances.globalDelegatedStakeBalance, amount);
            StakerActor._incrementNextBalance(expectedBalances.delegatedStakeByPool[to.poolId], amount);
            StakerActor._incrementNextBalance(expectedBalances.totalDelegatedStakeByPool[to.poolId], amount);
        }
        return expectedBalances;
    }

    private async _calculateExpectedBalancesAfterStakeAsync(
        amount: bigint,
        initBalances?: StakeBalances,
    ): Promise<StakeBalances> {
        const expectedBalances = initBalances || (await this._getBalancesAsync());
        // check balances
        expectedBalances.zrxBalance = expectedBalances.zrxBalance - amount;
        expectedBalances.stakeBalanceInVault = expectedBalances.stakeBalanceInVault + amount;
        StakerActor._incrementCurrentAndNextBalance(expectedBalances.undelegatedStakeBalance, amount);
        StakerActor._incrementCurrentAndNextBalance(expectedBalances.globalUndelegatedStakeBalance, amount);
        return expectedBalances;
    }
}
