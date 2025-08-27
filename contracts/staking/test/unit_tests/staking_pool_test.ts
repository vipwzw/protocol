import { expect } from 'chai';
import {
    constants,
    filterLogsToArguments,
    verifyEventsFromLogs,
    expectBigIntEqual,
    toBigInt,
} from '../test_constants';
import { hexUtils } from '../test_constants';
import * as _ from 'lodash';

import { TestMixinStakingPool__factory, TestMixinStakingPool } from '../../src/typechain-types';
import { ethers } from 'hardhat';
import { TestMixinStakingPool } from '../../src/typechain-types';
// 事件名称直接使用合约 ABI 中的名称
const TestMixinStakingPoolEvents = {
    StakingPoolCreated: 'StakingPoolCreated',
    MakerStakingPoolSet: 'MakerStakingPoolSet',
    OperatorShareDecreased: 'OperatorShareDecreased',
};
type StakingPoolCreated = { poolId: string; operator: string; operatorShare: bigint };

describe('MixinStakingPool unit tests', () => {
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

        beforeEach(async () => {
            const [deployer] = await ethers.getSigners();
            const factory = new TestMixinStakingPool__factory(deployer);
            testContract = await factory.deploy();
            nextPoolId = toNextPoolId(await testContract.lastPoolId());
        });

        it('fails if the next pool ID overflows', async () => {
            const tx1 = await testContract.setLastPoolId(hexUtils.leftPad(constants.MAX_UINT256));
            await tx1.wait();
            const tx = testContract.createStakingPool(randomOperatorShare(), false);
            return expect(tx).to.be.reverted;
        });
        it('fails if the operator share is invalid', async () => {
            const operatorShare = constants.PPM_100_PERCENT + 1;
            const tx = testContract.createStakingPool(operatorShare, false);
            return expect(tx).to.be.reverted;
        });
        it('operator can create and own multiple pools', async () => {
            const receipt1 = await (await testContract.createStakingPool(randomOperatorShare(), false)).wait();
            const receipt2 = await (await testContract.createStakingPool(randomOperatorShare(), false)).wait();
            const logs1 = receipt1?.logs ?? [];
            const logs2 = receipt2?.logs ?? [];
            const createEvents = filterLogsToArguments<StakingPoolCreated>(
                [...logs1, ...logs2],
                TestMixinStakingPoolEvents.StakingPoolCreated,
            );
            expect(createEvents).to.be.length(2);
            const poolIds = createEvents.map(e => e.poolId);
            expect(poolIds[0]).to.not.eq(poolIds[1]);
            const pools = await Promise.all(
                poolIds.map(async poolId => testContract.getStakingPool(poolId)),
            );
            expect(pools[0].operator).to.eq(pools[1].operator);
        });
        it('operator can only be maker of one pool', async () => {
            await (await testContract.createStakingPool(randomOperatorShare(), true)).wait();
            const receipt = await (await testContract.createStakingPool(randomOperatorShare(), true)).wait();
            const createEvents = filterLogsToArguments<StakingPoolCreated>(
                receipt?.logs ?? [],
                TestMixinStakingPoolEvents.StakingPoolCreated,
            );
            const makerPool = await testContract.poolIdByMaker(operator);
            expect(makerPool).to.eq(createEvents[0].poolId);
        });
        it('computes correct next pool ID', async () => {
            const receipt = await (await testContract.createStakingPool(randomOperatorShare(), false)).wait();
            const createEvents = filterLogsToArguments<StakingPoolCreated>(
                receipt?.logs ?? [],
                TestMixinStakingPoolEvents.StakingPoolCreated,
            );
            const poolId = createEvents[0].poolId;
            expect(poolId).to.eq(nextPoolId);
        });
        it('increments last pool ID counter', async () => {
            await (await testContract.createStakingPool(randomOperatorShare(), false)).wait();
            const lastPoolIdAfter = await testContract.lastPoolId();
            expect(lastPoolIdAfter).to.eq(nextPoolId);
        });
        it('records pool details', async () => {
            const operatorShare = randomOperatorShare();
            const opSigner = await ethers.getSigner(operator);
            await (await testContract.connect(opSigner).createStakingPool(operatorShare, false)).wait();
            const pool = await testContract.getStakingPool(nextPoolId);
            expect(pool.operator).to.eq(operator);
            expectBigIntEqual(toBigInt(pool.operatorShare), toBigInt(operatorShare));
        });
        it('records pool details when operator share is 100%', async () => {
            const operatorShare = constants.PPM_100_PERCENT;
            const opSigner = await ethers.getSigner(operator);
            await (await testContract.connect(opSigner).createStakingPool(operatorShare, false)).wait();
            const pool = await testContract.getStakingPool(nextPoolId);
            expect(pool.operator).to.eq(operator);
            expectBigIntEqual(toBigInt(pool.operatorShare), toBigInt(operatorShare));
        });
        it('records pool details when operator share is 0%', async () => {
            const operatorShare = constants.ZERO_AMOUNT;
            const opSigner = await ethers.getSigner(operator);
            await (await testContract.connect(opSigner).createStakingPool(operatorShare, false)).wait();
            const pool = await testContract.getStakingPool(nextPoolId);
            expect(pool.operator).to.eq(operator);
            expectBigIntEqual(toBigInt(pool.operatorShare), toBigInt(operatorShare));
        });
        it('returns the next pool ID', async () => {
            const opSigner = await ethers.getSigner(operator);
            const poolId = await testContract.connect(opSigner).createStakingPool.staticCall(randomOperatorShare(), false);
            expect(poolId).to.eq(nextPoolId);
        });
        it('can add operator as a maker', async () => {
            const operatorShare = randomOperatorShare();
            const opSigner = await ethers.getSigner(operator);
            await (await testContract.connect(opSigner).createStakingPool(operatorShare, true)).wait();
            const makerPoolId = await testContract.poolIdByMaker(operator);
            expect(makerPoolId).to.eq(nextPoolId);
        });
        it('emits a `StakingPoolCreated` event', async () => {
            const operatorShare = randomOperatorShare();
            const opSigner = await ethers.getSigner(operator);
            const receipt = await (await testContract.connect(opSigner).createStakingPool(operatorShare, false)).wait();
            verifyEventsFromLogs(
                receipt?.logs ?? [],
                [
                    {
                        poolId: nextPoolId,
                        operator,
                        operatorShare: toBigInt(operatorShare),
                    },
                ],
                TestMixinStakingPoolEvents.StakingPoolCreated,
            );
        });
        it('emits a `MakerStakingPoolSet` event when also joining as a maker', async () => {
            const operatorShare = randomOperatorShare();
            const opSigner = await ethers.getSigner(operator);
            const receipt = await (await testContract.connect(opSigner).createStakingPool(operatorShare, true)).wait();
            verifyEventsFromLogs(
                receipt?.logs ?? [],
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
            const signer = await ethers.getSigner(notOperatorOrMaker);
            const tx = testContract.connect(signer).decreaseStakingPoolOperatorShare(poolId, Math.max(0, operatorShare - 1));
            return expect(tx).to.be.reverted;
        });
        it('fails if called by maker', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            await addMakerToPoolAsync(poolId, maker);
            const signer = await ethers.getSigner(maker);
            const tx = testContract.connect(signer).decreaseStakingPoolOperatorShare(poolId, Math.max(0, operatorShare - 1));
            return expect(tx).to.be.reverted;
        });
        it('fails if operator share is greater than current', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            const opSigner = await ethers.getSigner(operator);
            const tx = testContract.connect(opSigner).decreaseStakingPoolOperatorShare(poolId, operatorShare + 1);
            return expect(tx).to.be.reverted;
        });
        it('fails if operator share is greater than PPM_100_PERCENT', async () => {
            const { poolId } = await createPoolAsync();
            const opSigner = await ethers.getSigner(operator);
            const tx = testContract.connect(opSigner).decreaseStakingPoolOperatorShare(poolId, constants.PPM_100_PERCENT + 1);
            return expect(tx).to.be.reverted;
        });
        it('records new operator share', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            const opSigner = await ethers.getSigner(operator);
            const newShare = Math.max(0, operatorShare - 1);
            await (await testContract.connect(opSigner).decreaseStakingPoolOperatorShare(poolId, newShare)).wait();
            const pool = await testContract.getStakingPool(poolId);
            expectBigIntEqual(toBigInt(pool.operatorShare), toBigInt(newShare));
        });
        it('does not modify operator share if equal to current', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            const opSigner = await ethers.getSigner(operator);
            await (await testContract.connect(opSigner).decreaseStakingPoolOperatorShare(poolId, operatorShare)).wait();
            const pool = await testContract.getStakingPool(poolId);
            expectBigIntEqual(toBigInt(pool.operatorShare), toBigInt(operatorShare));
        });
        it('does not modify operator', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            const opSigner = await ethers.getSigner(operator);
            await (await testContract.connect(opSigner).decreaseStakingPoolOperatorShare(poolId, operatorShare - 1)).wait();
            const pool = await testContract.getStakingPool(poolId);
            expect(pool.operator).to.eq(operator);
        });
        it('emits an `OperatorShareDecreased` event', async () => {
            const { poolId, operatorShare } = await createPoolAsync();
            const opSigner = await ethers.getSigner(operator);
            const receipt = await (await testContract.connect(opSigner).decreaseStakingPoolOperatorShare(poolId, Math.max(0, operatorShare - 1))).wait();
            verifyEventsFromLogs(
                receipt?.logs ?? [],
                [
                    {
                        poolId,
                        oldOperatorShare: toBigInt(operatorShare),
                        newOperatorShare: toBigInt(Math.max(0, operatorShare - 1)),
                    },
                ],
                TestMixinStakingPoolEvents.OperatorShareDecreased,
            );
        });
    });

    describe('joinStakingPoolAsMaker()', () => {
        it('records sender as maker for the pool', async () => {
            const { poolId } = await createPoolAsync();
            const signer = await ethers.getSigner(maker);
            await (await testContract.connect(signer).joinStakingPoolAsMaker(poolId)).wait();
            const makerPoolId = await testContract.poolIdByMaker(maker);
            expect(makerPoolId).to.eq(poolId);
        });
        it('operator can join as maker for the pool', async () => {
            const { poolId } = await createPoolAsync();
            const opSigner = await ethers.getSigner(operator);
            await (await testContract.connect(opSigner).joinStakingPoolAsMaker(poolId)).wait();
            const makerPoolId = await testContract.poolIdByMaker(operator);
            expect(makerPoolId).to.eq(poolId);
        });
        it('can join the same pool as a maker twice', async () => {
            const { poolId } = await createPoolAsync();
            const signer = await ethers.getSigner(maker);
            await (await testContract.connect(signer).joinStakingPoolAsMaker(poolId)).wait();
            await (await testContract.connect(signer).joinStakingPoolAsMaker(poolId)).wait();
            const makerPoolId = await testContract.poolIdByMaker(maker);
            expect(makerPoolId).to.eq(poolId);
        });
        it('can only be a maker in one pool at a time', async () => {
            const { poolId: poolId1 } = await createPoolAsync();
            const { poolId: poolId2 } = await createPoolAsync();
            const signer = await ethers.getSigner(maker);
            await (await testContract.connect(signer).joinStakingPoolAsMaker(poolId1)).wait();
            let makerPoolId = await testContract.poolIdByMaker(maker);
            expect(makerPoolId).to.eq(poolId1);
            await (await testContract.connect(signer).joinStakingPoolAsMaker(poolId2)).wait();
            makerPoolId = await testContract.poolIdByMaker(maker);
            expect(makerPoolId).to.eq(poolId2);
        });
        it('emits a `MakerStakingPoolSet` event', async () => {
            const { poolId } = await createPoolAsync();
            const signer = await ethers.getSigner(maker);
            const receipt = await (await testContract.connect(signer).joinStakingPoolAsMaker(poolId)).wait();
            verifyEventsFromLogs(
                receipt?.logs ?? [],
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
