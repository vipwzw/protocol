import { expect } from 'chai';
import { ethers } from 'hardhat';
import { expect, Numberish } from '../test_constants';

import { constants } from '../../src/constants';
import { StoredBalance } from '../../src/types';

import { StakingRevertErrors } from '../../src';

import { artifacts } from '../artifacts';
import { TestMixinStakeStorageContract } from '../wrappers';

describe('MixinStakeStorage unit tests', env => {
    let testContract: TestMixinStakeStorageContract;
    let defaultUninitializedBalance: StoredBalance;
    let defaultSyncedBalance: StoredBalance;
    let defaultUnsyncedBalance: StoredBalance;

    const CURRENT_EPOCH = 5n;
    const INDEX_ZERO = 0n;
    const INDEX_ONE = 1n;

    before(async () => {
        testContract = await TestMixinStakeStorageContract.deployFrom0xArtifactAsync(
            artifacts.TestMixinStakeStorage,
            await ethers.getSigners().then(signers => signers[0]),
            {},
            artifacts,
        );
        const tx = await testContract.setCurrentEpoch(CURRENT_EPOCH);
        await tx.wait();
        defaultUninitializedBalance = {
            currentEpoch: constants.INITIAL_EPOCH,
            currentEpochBalance: 0n,
            nextEpochBalance: 0n,
        };
        defaultSyncedBalance = {
            currentEpoch: CURRENT_EPOCH,
            currentEpochBalance: 16n,
            nextEpochBalance: 16n,
        };
        defaultUnsyncedBalance = {
            currentEpoch: BigInt(CURRENT_EPOCH.toString()) - 1n,
            currentEpochBalance: 10n,
            nextEpochBalance: 16n,
        };
    });

    async function getTestBalancesAsync(index: Numberish): Promise<StoredBalance> {
        const storedBalance: Partial<StoredBalance> = {};
        [storedBalance.currentEpoch, storedBalance.currentEpochBalance, storedBalance.nextEpochBalance] =
            await testContract.testBalances(index);
        return storedBalance as StoredBalance;
    }

    describe('Move stake', () => {
        async function moveStakeAndVerifyBalancesAsync(
            fromBalance: StoredBalance,
            toBalance: StoredBalance,
            amount: BigNumber,
        ): Promise<void> {
            let tx = await testContract.setStoredBalance(fromBalance, INDEX_ZERO);
            await tx.wait();
            tx = await testContract.setStoredBalance(toBalance, INDEX_ONE);
            await tx.wait();
            tx = await testContract.moveStake(INDEX_ZERO, INDEX_ONE, amount);
            await tx.wait();

            const actualBalances = await Promise.all([
                getTestBalancesAsync(INDEX_ZERO),
                getTestBalancesAsync(INDEX_ONE),
            ]);
            expect(actualBalances[0]).to.deep.equal({
                currentEpoch: CURRENT_EPOCH,
                currentEpochBalance: fromBalance.currentEpochBalance,
                nextEpochBalance: BigInt(fromBalance.nextEpochBalance.toString()) - BigInt(amount.toString()),
            });
            expect(actualBalances[1]).to.deep.equal({
                currentEpoch: CURRENT_EPOCH,
                currentEpochBalance: toBalance.currentEpochBalance,
                nextEpochBalance: BigInt(toBalance.nextEpochBalance.toString()) + BigInt(amount.toString()),
            });
        }

        it('Updates balances to reflect move', async () => {
            await moveStakeAndVerifyBalancesAsync(
                defaultSyncedBalance,
                defaultSyncedBalance,
                BigInt(defaultSyncedBalance.nextEpochBalance.toString()) / 2n,
            );
        });
        it('Can move amount equal to next epoch balance', async () => {
            await moveStakeAndVerifyBalancesAsync(
                defaultSyncedBalance,
                defaultSyncedBalance,
                defaultSyncedBalance.nextEpochBalance,
            );
        });
        it('Moves to and initializes a previously uninitalized balance', async () => {
            await moveStakeAndVerifyBalancesAsync(
                defaultSyncedBalance,
                defaultUninitializedBalance,
                BigInt(defaultSyncedBalance.nextEpochBalance.toString()) / 2n,
            );
        });
        it('Noop if pointers are equal', async () => {
            let tx = await testContract.setStoredBalance(defaultSyncedBalance, INDEX_ZERO);
            await tx.wait();
            // If the pointers weren't equal, this would revert with InsufficientBalanceError
            tx = await testContract
                .moveStake(INDEX_ZERO, INDEX_ZERO, BigInt(defaultSyncedBalance.nextEpochBalance.toString()) + 1n);
            await tx.wait();
            const actualBalance = await getTestBalancesAsync(INDEX_ZERO);
            expect(actualBalance).to.deep.equal(defaultSyncedBalance);
        });
        it("Reverts if attempting to move more than next epoch's balance", async () => {
            let tx = await testContract.setStoredBalance(defaultSyncedBalance, INDEX_ZERO);
            await tx.wait();
            const amount = BigInt(defaultSyncedBalance.nextEpochBalance.toString()) + 1n;
            tx = testContract.moveStake(INDEX_ZERO, INDEX_ONE, amount);
            return expect(tx).to.be.reverted;
        });
    });

    describe('Load balance', () => {
        it('Balance does not change state if balance was previously synced in the current epoch', async () => {
            const tx = await testContract.setStoredBalance(defaultSyncedBalance, INDEX_ZERO);
            await tx.wait();
            const tx2 = await testContract.loadCurrentBalance(INDEX_ZERO);
            await tx2.wait();
            const actualBalance = await getTestBalancesAsync(INDEX_ZERO);
            expect(actualBalance).to.deep.equal(defaultSyncedBalance);
        });
        it('Balance updates current epoch fields if the balance has not yet been synced in the current epoch', async () => {
            const tx = await testContract.setStoredBalance(defaultUnsyncedBalance, INDEX_ZERO);
            await tx.wait();
            const tx2 = await testContract.loadCurrentBalance(INDEX_ZERO);
            await tx2.wait();
            const actualBalance = await getTestBalancesAsync(INDEX_ZERO);
            expect(actualBalance).to.deep.equal(defaultSyncedBalance);
        });
        it('Balance loads unsynced balance from storage without changing fields', async () => {
            const tx = await testContract.setStoredBalance(defaultUnsyncedBalance, INDEX_ZERO);
            await tx.wait();
            const result = await testContract.loadStaleBalance(INDEX_ZERO);
            const actualBalance = {
                currentEpoch: result[0],
                currentEpochBalance: result[1],
                nextEpochBalance: result[2],
            };
            expect(actualBalance).to.deep.equal(defaultUnsyncedBalance);
        });
        it('Balance loads synced balance from storage without changing fields', async () => {
            const tx = await testContract.setStoredBalance(defaultSyncedBalance, INDEX_ZERO);
            await tx.wait();
            const result = await testContract.loadStaleBalance(INDEX_ZERO);
            const actualBalance = {
                currentEpoch: result[0],
                currentEpochBalance: result[1],
                nextEpochBalance: result[2],
            };
            expect(actualBalance).to.deep.equal(defaultSyncedBalance);
        });
    });

    describe('Increase/decrease balance', () => {
        it('_increaseCurrentAndNextBalance', async () => {
            let tx = await testContract.setStoredBalance(defaultUnsyncedBalance, INDEX_ZERO);
            await tx.wait();
            const amount = defaultUnsyncedBalance.currentEpochBalance / 2n;
            tx = await testContract.increaseCurrentAndNextBalance(INDEX_ZERO, amount);
            await tx.wait();
            const actualBalance = await getTestBalancesAsync(INDEX_ZERO);
            expect(actualBalance).to.deep.equal({
                ...defaultSyncedBalance,
                currentEpochBalance: defaultSyncedBalance.currentEpochBalance + amount,
                nextEpochBalance: defaultSyncedBalance.nextEpochBalance + amount,
            });
        });
        it('_increaseCurrentAndNextBalance (previously uninitialized)', async () => {
            let tx = await testContract.setStoredBalance(defaultUninitializedBalance, INDEX_ZERO);
            await tx.wait();
            const amount = defaultSyncedBalance.currentEpochBalance;
            tx = await testContract.increaseCurrentAndNextBalance(INDEX_ZERO, amount);
            await tx.wait();
            const actualBalance = await getTestBalancesAsync(INDEX_ZERO);
            expect(actualBalance).to.deep.equal(defaultSyncedBalance);
        });
        it('_decreaseCurrentAndNextBalance', async () => {
            let tx = await testContract.setStoredBalance(defaultUnsyncedBalance, INDEX_ZERO);
            await tx.wait();
            const amount = defaultUnsyncedBalance.currentEpochBalance / 2n;
            tx = await testContract.decreaseCurrentAndNextBalance(INDEX_ZERO, amount);
            await tx.wait();
            const actualBalance = await getTestBalancesAsync(INDEX_ZERO);
            expect(actualBalance).to.deep.equal({
                ...defaultSyncedBalance,
                currentEpochBalance: defaultSyncedBalance.currentEpochBalance - amount,
                nextEpochBalance: defaultSyncedBalance.nextEpochBalance - amount,
            });
        });
        it('_increaseNextBalance', async () => {
            let tx = await testContract.setStoredBalance(defaultUnsyncedBalance, INDEX_ZERO);
            await tx.wait();
            const amount = defaultUnsyncedBalance.currentEpochBalance / 2n;
            tx = await testContract.increaseNextBalance(INDEX_ZERO, amount);
            await tx.wait();
            const actualBalance = await getTestBalancesAsync(INDEX_ZERO);
            expect(actualBalance).to.deep.equal({
                ...defaultSyncedBalance,
                nextEpochBalance: defaultSyncedBalance.nextEpochBalance + amount,
            });
        });
        it('_increaseCurrentAndNextBalance (previously uninitialized)', async () => {
            let tx = await testContract.setStoredBalance(defaultUninitializedBalance, INDEX_ZERO);
            await tx.wait();
            const amount = defaultSyncedBalance.currentEpochBalance;
            tx = await testContract.increaseNextBalance(INDEX_ZERO, amount);
            await tx.wait();
            const actualBalance = await getTestBalancesAsync(INDEX_ZERO);
            expect(actualBalance).to.deep.equal({
                ...defaultSyncedBalance,
                currentEpochBalance: 0n,
            });
        });
        it('_decreaseNextBalance', async () => {
            let tx = await testContract.setStoredBalance(defaultUnsyncedBalance, INDEX_ZERO);
            await tx.wait();
            const amount = defaultUnsyncedBalance.currentEpochBalance / 2n;
            tx = await testContract.decreaseNextBalance(INDEX_ZERO, amount);
            await tx.wait();
            const actualBalance = await getTestBalancesAsync(INDEX_ZERO);
            expect(actualBalance).to.deep.equal({
                ...defaultSyncedBalance,
                nextEpochBalance: defaultSyncedBalance.nextEpochBalance - amount,
            });
        });
    });
});
