import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Numberish, getRandomInteger } from '../test_constants';

const getRandomPortion = (max: Numberish): Numberish => {
    const m = BigInt(max as any);
    if (m === 0n) return 0n;
    const r = BigInt(getRandomInteger(0, 1_000_000));
    return (m * r) / 1_000_000n;
};
// BigNumber 已移除，使用原生 bigint
import * as _ from 'lodash';

// 实现 assertRoughlyEquals 函数
function assertRoughlyEquals(actual: bigint, expected: bigint, precision: number): void {
    const actualNum = Number(actual);
    const expectedNum = Number(expected);
    const tolerance = 10 ** -precision;

    if (expectedNum === 0) {
        expect(Math.abs(actualNum)).to.be.lessThan(
            tolerance,
            `Expected ${actualNum} to be roughly equal to ${expectedNum} with precision ${precision}`,
        );
    } else {
        const relativeError = Math.abs((actualNum - expectedNum) / expectedNum);
        expect(relativeError).to.be.lessThan(
            tolerance,
            `Expected ${actualNum} to be roughly equal to ${expectedNum} with precision ${precision}. Relative error: ${relativeError}`,
        );
    }
}

import { TestCobbDouglas__factory, TestCobbDouglas } from '../../src/typechain-types';

describe('LibCobbDouglas unit tests', () => {
    const FUZZ_COUNT = 1024;
    const PRECISION = 15;

    let testContract: TestCobbDouglas;

    before(async () => {
        const [deployer] = await ethers.getSigners();
        const factory = new TestCobbDouglas__factory(deployer);
        testContract = await factory.deploy();
    });

    describe('cobbDouglas()', () => {
        interface CobbDouglasParams {
            totalRewards: Numberish;
            ownerFees: Numberish;
            totalFees: Numberish;
            ownerStake: Numberish;
            totalStake: Numberish;
            alphaNumerator: Numberish;
            alphaDenominator: Numberish;
            gas?: number;
        }

        const MAX_COBB_DOUGLAS_GAS = 11_000;
        const TX_GAS_FEE = 21_000;
        const DEFAULT_COBB_DOUGLAS_PARAMS: CobbDouglasParams = {
            totalRewards: 100n * 10n ** 18n,
            ownerFees: 10n * 10n ** 18n,
            totalFees: 500n * 10n ** 18n,
            ownerStake: 1_100n * 10n ** 18n,
            totalStake: 3_000_000_000n * 10n ** 18n,
            alphaNumerator: 1,
            alphaDenominator: 3,
            gas: MAX_COBB_DOUGLAS_GAS,
        };

        async function callCobbDouglasAsync(params?: Partial<CobbDouglasParams>): Promise<bigint> {
            const _params = {
                ...DEFAULT_COBB_DOUGLAS_PARAMS,
                ...params,
            };
            const toBigIntSafe = (value: any): bigint => BigInt(value);

            const result = await testContract.cobbDouglas(
                toBigIntSafe(_params.totalRewards),
                toBigIntSafe(_params.ownerFees),
                toBigIntSafe(_params.totalFees),
                toBigIntSafe(_params.ownerStake),
                toBigIntSafe(_params.totalStake),
                toBigIntSafe(_params.alphaNumerator),
                toBigIntSafe(_params.alphaDenominator),
            );
            return result;
        }

        function cobbDouglas(params?: Partial<CobbDouglasParams>): bigint {
            const { totalRewards, ownerFees, totalFees, ownerStake, totalStake, alphaNumerator, alphaDenominator } = {
                ...DEFAULT_COBB_DOUGLAS_PARAMS,
                ...params,
            };
            // 采用浮点近似计算，再转为 bigint floor
            const totalRewardsNum = Number(totalRewards);
            const feeRatio = Number(ownerFees) / Number(totalFees);
            const stakeRatio = Number(ownerStake) / Number(totalStake);
            const alpha = Number(alphaNumerator) / Number(alphaDenominator);
            const result = totalRewardsNum * Math.pow(feeRatio, alpha) * Math.pow(stakeRatio, 1 - alpha);
            return BigInt(Math.floor(result));
        }

        function getRandomParams(overrides?: Partial<CobbDouglasParams>): CobbDouglasParams {
            const totalRewards = _.get(overrides, 'totalRewards', getRandomInteger(0, 1e27)) as Numberish;
            const totalFees = _.get(overrides, 'totalFees', getRandomInteger(1, 1e27)) as Numberish;
            const ownerFees = _.get(overrides, 'ownerFees', getRandomPortion(totalFees)) as Numberish;
            const totalStake = _.get(overrides, 'totalStake', getRandomInteger(1, 1e27)) as Numberish;
            const ownerStake = _.get(overrides, 'ownerStake', getRandomPortion(totalStake)) as Numberish;
            const alphaDenominator = _.get(overrides, 'alphaDenominator', getRandomInteger(1, 1e6)) as Numberish;
            const alphaNumerator = _.get(overrides, 'alphaNumerator', getRandomPortion(alphaDenominator)) as Numberish;
            return {
                totalRewards,
                ownerFees,
                totalFees,
                ownerStake,
                totalStake,
                alphaNumerator,
                alphaDenominator,
            };
        }

        it('computes the correct reward', async () => {
            const expected = cobbDouglas();
            const r = await callCobbDouglasAsync();
            expect(Number(r)).to.be.closeTo(Number(expected), 10 ** PRECISION);
        });

        it('computes the correct reward with zero stake ratio', async () => {
            const ownerStake = 0;
            const expected = cobbDouglas({ ownerStake });
            const r = await callCobbDouglasAsync({ ownerStake });
            expect(Number(r)).to.be.closeTo(Number(expected), 10 ** PRECISION);
        });

        it('computes the correct reward with full stake ratio', async () => {
            const ownerStake = DEFAULT_COBB_DOUGLAS_PARAMS.totalStake;
            const expected = cobbDouglas({ ownerStake });
            const r = await callCobbDouglasAsync({ ownerStake });
            expect(Number(r)).to.be.closeTo(Number(expected), 10 ** PRECISION);
        });

        it('computes the correct reward with a very low stake ratio', async () => {
            const ownerStake = BigInt(DEFAULT_COBB_DOUGLAS_PARAMS.totalStake) / 10n ** 18n;
            const expected = cobbDouglas({ ownerStake });
            const r = await callCobbDouglasAsync({ ownerStake });
            expect(Number(r)).to.be.closeTo(Number(expected), 10 ** PRECISION);
        });

        it('computes the correct reward with a very high stake ratio', async () => {
            const ownerStake =
                BigInt(DEFAULT_COBB_DOUGLAS_PARAMS.totalStake) -
                BigInt(DEFAULT_COBB_DOUGLAS_PARAMS.totalStake) / 10n ** 18n;
            const expected = cobbDouglas({ ownerStake });
            const r = await callCobbDouglasAsync({ ownerStake });
            expect(Number(r)).to.be.closeTo(Number(expected), 10 ** PRECISION);
        });

        it('computes the correct reward with zero fee ratio', async () => {
            const ownerFees = 0;
            const expected = cobbDouglas({ ownerFees });
            const r = await callCobbDouglasAsync({ ownerFees });
            expect(Number(r)).to.be.closeTo(Number(expected), 10 ** PRECISION);
        });

        it('computes the correct reward with full fee ratio', async () => {
            const ownerFees = DEFAULT_COBB_DOUGLAS_PARAMS.totalFees;
            const expected = cobbDouglas({ ownerFees });
            const r = await callCobbDouglasAsync({ ownerFees });
            expect(Number(r)).to.be.closeTo(Number(expected), 10 ** PRECISION);
        });

        it('computes the correct reward with a very low fee ratio', async () => {
            const ownerFees = BigInt(DEFAULT_COBB_DOUGLAS_PARAMS.totalFees) / 10n ** 18n;
            const expected = cobbDouglas({ ownerFees });
            const r = await callCobbDouglasAsync({ ownerFees });
            expect(Number(r)).to.be.closeTo(Number(expected), 10 ** PRECISION);
        });

        it('computes the correct reward with a very high fee ratio', async () => {
            const ownerFees =
                BigInt(DEFAULT_COBB_DOUGLAS_PARAMS.totalFees) -
                BigInt(DEFAULT_COBB_DOUGLAS_PARAMS.totalFees) / 10n ** 18n;
            const expected = cobbDouglas({ ownerFees });
            const r = await callCobbDouglasAsync({ ownerFees });
            expect(Number(r)).to.be.closeTo(Number(expected), 10 ** PRECISION);
        });

        it('computes the correct reward with equal fee and stake ratios', async () => {
            const ownerFees = BigInt(DEFAULT_COBB_DOUGLAS_PARAMS.totalFees) / 2n;
            const ownerStake = BigInt(DEFAULT_COBB_DOUGLAS_PARAMS.totalStake) / 2n;
            const expected = cobbDouglas({ ownerFees, ownerStake });
            const r = await callCobbDouglasAsync({ ownerFees, ownerStake });
            expect(Number(r)).to.be.closeTo(Number(expected), 10 ** PRECISION);
        });

        it('computes the correct reward with full fee and stake ratios', async () => {
            const ownerFees = BigInt(DEFAULT_COBB_DOUGLAS_PARAMS.totalFees);
            const ownerStake = BigInt(DEFAULT_COBB_DOUGLAS_PARAMS.totalStake);
            const expected = cobbDouglas({ ownerFees, ownerStake });
            const r = await callCobbDouglasAsync({ ownerFees, ownerStake });
            expect(Number(r)).to.be.closeTo(Number(expected), 10 ** PRECISION);
        });

        it('computes the correct reward with zero fee and stake ratios', async () => {
            const ownerFees = 0;
            const ownerStake = 0;
            const expected = cobbDouglas({ ownerFees, ownerStake });
            const r = await callCobbDouglasAsync({ ownerFees, ownerStake });
            expect(Number(r)).to.be.closeTo(Number(expected), 10 ** PRECISION);
        });

        describe('fuzzing', () => {
            const inputs = _.times(FUZZ_COUNT, () => getRandomParams());
            for (const params of inputs) {
                it(`cobbDouglas(${JSON.stringify(params, (key, value) => (typeof value === 'bigint' ? value.toString() : value))})`, async () => {
                    const expected = cobbDouglas(params);
                    const r = await callCobbDouglasAsync(params);
                    assertRoughlyEquals(r, expected, PRECISION);
                });
            }
        });
    });
});
