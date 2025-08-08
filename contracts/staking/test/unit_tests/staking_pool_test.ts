import { expect } from 'chai';
import {
    constants,
    expect,
    filterLogsToArguments,
    verifyEventsFromLogs,
    expectBigIntEqual,
    toBigInt,
} from '../test_constants';
import { SafeMathRevertErrors } from '@0x/contracts-utils';
import { hexUtils } from '../test_constants';
import * as _ from 'lodash';

import { StakingRevertErrors } from '../../src';
import { TestMixinStakingPool__factory, TestMixinStakingPool } from '../../src/typechain-types';
import { ethers } from 'hardhat';
import {
    TestMixinStakingPoolEvents,
    TestMixinStakingPoolStakingPoolCreatedEventArgs as StakingPoolCreated,
} from '../wrappers';

describe('MixinStakingPool unit tests', env => {
    let testContract: TestMixinStakingPool;
    let operator: string;
    let maker: string;
    let notOperatorOrMaker: string;

    before(async () => {
        [operator, maker, notOperatorOrMaker] = await ethers.getSigners().then(signers => signers.map(s => s.address));
        const [deployer] = await ethers.getSigners();
        const factory = new TestMixinStakingPool__factory(deployer);
        testContract = await factory.deploy();
    });

    function toNextPoolId(lastPoolId: string): string {
        return hexUtils.leftPad((BigInt(lastPoolId.slice(2), 16) + 1n).toString(16));
    }

    function randomOperatorShare(): number {
        return _.random(0, constants.PPM_100_PERCENT);
    }

    interface CreatePoolOpts {
        poolId: string;
        operator: string;
        operatorShare: number;
    }

    async function createPoolAsync(opts?: Partial<CreatePoolOpts>): Promise<CreatePoolOpts> {
        const _opts = {
            poolId: hexUtils.random(),
            operator,
            operatorShare: randomOperatorShare(),
            ...opts,
        };
        const tx = await testContract
            .setPoolById(_opts.poolId, {
                operator: _opts.operator,
                operatorShare: _opts.operatorShare,
            });
        await tx.wait();
        return _opts;
    }

    async function addMakerToPoolAsync(poolId: string, _maker: string): Promise<void> {
        const tx = await testContract.setPoolIdByMaker(poolId, _maker);
        await tx.wait();
    }

    describe('onlyStakingPoolOperator modifier', () => {
        it('fails if not called by the pool operator', async () => {
            const { poolId } = await createPoolAsync();
            const tx = testContract.connect(await ethers.getSigner(notOperatorOrMaker)).testOnlyStakingPoolOperatorModifier(poolId);
            return expect(tx).to.be.reverted;
        });
        it('fails if called by a pool maker', async () => {
            const { poolId } = await createPoolAsync();
            await addMakerToPoolAsync(poolId, maker);
            const tx = testContract.connect(await ethers.getSigner(maker)).testOnlyStakingPoolOperatorModifier(poolId);
            return expect(tx).to.be.reverted;
        });
        it('succeeds if called by the pool operator', async () => {
            const { poolId } = await createPoolAsync();
            await testContract.connect(await ethers.getSigner(operator)).testOnlyStakingPoolOperatorModifier(poolId);
        });
    });

    describe('createStakingPool()', () => {
        let nextPoolId: string;

        before(async () => {
            nextPoolId = toNextPoolId(await testContract.lastPoolId()());
        });

        it('fails if the next pool ID overflows', async () => {
            await testContract.setLastPoolId(hexUtils.toHex(constants.MAX_UINT256)); await tx.wait();
            const tx = testContract.createStakingPool(randomOperatorShare(), false); await tx.wait();
            const expectedError = new SafeMathRevertErrors.Uint256BinOpError(
                SafeMathRevertErrors.BinOpErrorCodes.AdditionOverflow,
                constants.MAX_UINT256,
                1n,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('fails if the operator share is invalid', async () => {
            const operatorShare = constants.PPM_100_PERCENT + 1;
            const tx = testContract.createStakingPool(operatorShare, false); await tx.wait();
            const expectedError = new StakingRevertErrors.OperatorShareError(
                StakingRevertErrors.OperatorShareErrorCodes.OperatorShareTooLarge,
                nextPoolId,
                operatorShare,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('operator can create and own multiple pools', async () => {
            const { logs: logs1 } = await testContract
                .createStakingPool(randomOperatorShare(), false)
                ; await tx.wait();
            const { logs: logs2 } = await testContract
                .createStakingPool(randomOperatorShare(), false)
                ; await tx.wait();
            const createEvents = filterLogsToArguments<StakingPoolCreated>(
                [...logs1, ...logs2],
                TestMixinStakingPoolEvents.StakingPoolCreated,
            );
            expect(createEvents).to.be.length(2);
            const poolIds = createEvents.map(e => e.poolId);
            expect(poolIds[0]).to.not.eq(poolIds[1]);
            const pools = await Promise.all(
                poolIds.map(async poolId => testContract.getStakingPool(poolId)()),
            );
            expect(pools[0].operator).to.eq(pools[1].operator);
        });
        it('operator can only be maker of one pool', async () => {
            await testContract.createStakingPool(randomOperatorShare(), true); await tx.wait();
            const { logs } = await testContract
                .createStakingPool(randomOperatorShare(), true)
                ; await tx.wait();
            const createEvents = filterLogsToArguments<StakingPoolCreated>(
                logs,
                TestMixinStakingPoolEvents.StakingPoolCreated,
            );
            const makerPool = await testContract.poolIdByMaker(operator)();
            expect(makerPool).to.eq(createEvents[0].poolId);
        });
        it('computes correct next pool ID', async () => {
            const { logs } = await testContract
                .createStakingPool(randomOperatorShare(), false)
                ; await tx.wait();
            const createEvents = filterLogsToArguments<StakingPoolCreated>(
                logs,
                TestMixinStakingPoolEvents.StakingPoolCreated,
            );
            const poolId = createEvents[0].poolId;
            expect(poolId).to.eq(nextPoolId);
        });
        it('increments last pool ID counter', async () => {
            await testContract.createStakingPool(randomOperatorShare(), false); await tx.wait();
            const lastPoolIdAfter = await testContract.lastPoolId()();
            expect(lastPoolIdAfter).to.eq(nextPoolId);
        });
        it('records pool details', async () => {
            const operatorShare = randomOperatorShare();
            await testContract.createStakingPool(operatorShare, false).awaitTransactionSuccessAsync({ from: operator });
            const pool = await testContract.getStakingPool(nextPoolId)();
            expect(pool.operator).to.eq(operator);
            expectBigIntEqual(toBigInt(pool.operatorShare), toBigInt(operatorShare));
        });
        it('records pool details when operator share is 100%', async () => {
            const operatorShare = constants.PPM_100_PERCENT;
            await testContract.createStakingPool(operatorShare, false).awaitTransactionSuccessAsync({ from: operator });
            const pool = await testContract.getStakingPool(nextPoolId)();
            expect(pool.operator).to.eq(operator);
            expectBigIntEqual(toBigInt(pool.operatorShare), toBigInt(operatorShare));
        });
        it('records pool details when operator share is 0%', async () => {
            const operatorShare = constants.ZERO_AMOUNT;
            await testContract.createStakingPool(operatorShare, false).awaitTransactionSuccessAsync({ from: operator });
            const pool = await testContract.getStakingPool(nextPoolId)();
            expect(pool.operator).to.eq(operator);
            expectBigIntEqual(toBigInt(pool.operatorShare), toBigInt(operatorShare));
        });
        it('returns the next pool ID', async () => {
            const poolId = await testContract.createStakingPool(randomOperatorShare(), false).callAsync({
                from: operator,
            });
            expect(poolId).to.eq(nextPoolId);
        });
        it('can add operator as a maker', async () => {
            const operatorShare = randomOperatorShare();
            await testContract.createStakingPool(operatorShare, true).awaitTransactionSuccessAsync({ from: operator });
            const makerPoolId = await testContract.poolIdByMaker(operator)();
            expect(makerPoolId).to.eq(nextPoolId);
        });
        it('emits a `StakingPoolCreated` event', async () => {
            const operatorShare = randomOperatorShare();
            const { logs } = await testContract.createStakingPool(operatorShare, false).awaitTransactionSuccessAsync({
                from: operator,
            });
            verifyEventsFromLogs(
                logs,
                [
                    {
                        poolId: nextPoolId,
                        operator,
                        operatorShare: operatorSharen,
                    },
                ],
                TestMixinStakingPoolEvents.StakingPoolCreated,
            );
        });
        it('emits a `MakerStakingPoolSet` event when also joining as a maker', async () => {
            const operatorShare = randomOperatorShare();
            const { logs } = await testContract.createStakingPool(operatorShare, true).awaitTransactionSuccessAsync({
                from: operator,
            });
            verifyEventsFromLogs(
                logs,
                [
                    {
                        makerAddress: operator,
                        poolId: nextPoolId,
                    },
                ],
                TestMixinStakingPoolEvents.MakerStakingPoolSet,
            );
        });
    });

    describe('decreaseStakingPoolOperatorShare()', () => {
        it('fails if not called by operator', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            const tx = testContract
                .decreaseStakingPoolOperatorShare(poolId, operatorShare - 1)
                .awaitTransactionSuccessAsync({ from: notOperatorOrMaker });
            const expectedError = new StakingRevertErrors.OnlyCallableByPoolOperatorError(notOperatorOrMaker, poolId);
            return expect(tx).to.revertedWith(expectedError);
        });
        it('fails if called by maker', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            await addMakerToPoolAsync(poolId, maker);
            const tx = testContract
                .decreaseStakingPoolOperatorShare(poolId, operatorShare - 1)
                .awaitTransactionSuccessAsync({ from: maker });
            const expectedError = new StakingRevertErrors.OnlyCallableByPoolOperatorError(maker, poolId);
            return expect(tx).to.revertedWith(expectedError);
        });
        it('fails if operator share is greater than current', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            const tx = testContract
                .decreaseStakingPoolOperatorShare(poolId, operatorShare + 1)
                .awaitTransactionSuccessAsync({ from: operator });
            const expectedError = new StakingRevertErrors.OperatorShareError(
                StakingRevertErrors.OperatorShareErrorCodes.CanOnlyDecreaseOperatorShare,
                poolId,
                operatorShare + 1,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('fails if operator share is greater than PPM_100_PERCENT', async () => {
            const { poolId } = await createPoolAsync();
            const tx = testContract
                .decreaseStakingPoolOperatorShare(poolId, constants.PPM_100_PERCENT + 1)
                .awaitTransactionSuccessAsync({ from: operator });
            const expectedError = new StakingRevertErrors.OperatorShareError(
                StakingRevertErrors.OperatorShareErrorCodes.OperatorShareTooLarge,
                poolId,
                constants.PPM_100_PERCENT + 1,
            );
            return expect(tx).to.revertedWith(expectedError);
        });
        it('records new operator share', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            await testContract
                .decreaseStakingPoolOperatorShare(poolId, operatorShare - 1)
                .awaitTransactionSuccessAsync({ from: operator });
            const pool = await testContract.getStakingPool(poolId)();
            expectBigIntEqual(toBigInt(pool.operatorShare), toBigInt(operatorShare - 1));
        });
        it('does not modify operator share if equal to current', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            await testContract.decreaseStakingPoolOperatorShare(poolId, operatorShare).awaitTransactionSuccessAsync({
                from: operator,
            });
            const pool = await testContract.getStakingPool(poolId)();
            expectBigIntEqual(toBigInt(pool.operatorShare), toBigInt(operatorShare));
        });
        it('does not modify operator', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            await testContract
                .decreaseStakingPoolOperatorShare(poolId, operatorShare - 1)
                .awaitTransactionSuccessAsync({ from: operator });
            const pool = await testContract.getStakingPool(poolId)();
            expect(pool.operator).to.eq(operator);
        });
        it('emits an `OperatorShareDecreased` event', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            const { logs } = await testContract
                .decreaseStakingPoolOperatorShare(poolId, operatorShare - 1)
                .awaitTransactionSuccessAsync({ from: operator });
            verifyEventsFromLogs(
                logs,
                [
                    {
                        poolId,
                        oldOperatorShare: operatorSharen,
                        newOperatorShare: operatorShare - 1n,
                    },
                ],
                TestMixinStakingPoolEvents.OperatorShareDecreased,
            );
        });
    });

    describe('joinStakingPoolAsMaker()', () => {
        it('records sender as maker for the pool', async () => {
            const { poolId } = await createPoolAsync();
            await testContract.joinStakingPoolAsMaker(poolId).awaitTransactionSuccessAsync({ from: maker });
            const makerPoolId = await testContract.poolIdByMaker(maker)();
            expect(makerPoolId).to.eq(poolId);
        });
        it('operator can join as maker for the pool', async () => {
            const { poolId } = await createPoolAsync();
            await testContract.joinStakingPoolAsMaker(poolId).awaitTransactionSuccessAsync({ from: operator });
            const makerPoolId = await testContract.poolIdByMaker(operator)();
            expect(makerPoolId).to.eq(poolId);
        });
        it('can join the same pool as a maker twice', async () => {
            const { poolId } = await createPoolAsync();
            await testContract.joinStakingPoolAsMaker(poolId).awaitTransactionSuccessAsync({ from: maker });
            await testContract.joinStakingPoolAsMaker(poolId).awaitTransactionSuccessAsync({ from: maker });
            const makerPoolId = await testContract.poolIdByMaker(maker)();
            expect(makerPoolId).to.eq(poolId);
        });
        it('can only be a maker in one pool at a time', async () => {
            const { poolId: poolId1 } = await createPoolAsync();
            const { poolId: poolId2 } = await createPoolAsync();
            await testContract.joinStakingPoolAsMaker(poolId1).awaitTransactionSuccessAsync({ from: maker });
            let makerPoolId = await testContract.poolIdByMaker(maker)();
            expect(makerPoolId).to.eq(poolId1);
            await testContract.joinStakingPoolAsMaker(poolId2).awaitTransactionSuccessAsync({ from: maker });
            makerPoolId = await testContract.poolIdByMaker(maker)();
            expect(makerPoolId).to.eq(poolId2);
        });
        it('emits a `MakerStakingPoolSet` event', async () => {
            const { poolId } = await createPoolAsync();
            const { logs } = await testContract.joinStakingPoolAsMaker(poolId).awaitTransactionSuccessAsync({
                from: maker,
            });
            verifyEventsFromLogs(
                logs,
                [
                    {
                        makerAddress: maker,
                        poolId,
                    },
                ],
                TestMixinStakingPoolEvents.MakerStakingPoolSet,
            );
        });
    });
});
// tslint:disable: max-file-line-count
