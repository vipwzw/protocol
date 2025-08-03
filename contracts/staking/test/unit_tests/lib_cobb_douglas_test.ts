import {
    assertRoughlyEquals,
    blockchainTests,
    getRandomInteger,
    getRandomPortion,
    Numberish,
    toDecimal,
} from '@0x/test-utils';
import { BigNumber } from '@0x/utils';
import * as _ from 'lodash';

import { artifacts } from '../artifacts';
import { TestCobbDouglasContract } from '../wrappers';

blockchainTests('LibCobbDouglas unit tests', env => {
    const FUZZ_COUNT = 1024;
    const PRECISION = 15;

    let testContract: TestCobbDouglasContract;

    before(async () => {
        testContract = await TestCobbDouglasContract.deployFrom0xArtifactAsync(
            artifacts.TestCobbDouglas,
            env.provider,
            env.txDefaults,
            artifacts,
        );
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

        const MAX_COBB_DOUGLAS_GAS = 11e3;
        const TX_GAS_FEE = 21e3;
        const DEFAULT_COBB_DOUGLAS_PARAMS: CobbDouglasParams = {
            totalRewards: 100e18,
            ownerFees: 10e18,
            totalFees: 500e18,
            ownerStake: 1.1e21,
            totalStake: 3e27,
            alphaNumerator: 1,
            alphaDenominator: 3,
            gas: MAX_COBB_DOUGLAS_GAS,
        };

        async function callCobbDouglasAsync(params?: Partial<CobbDouglasParams>): Promise<BigNumber> {
            const _params = {
                ...DEFAULT_COBB_DOUGLAS_PARAMS,
                ...params,
            };
            // 在 TypeChain + ethers v6 中，直接调用合约方法
            // 处理科学记数法，将数值转换为整数再转为BigInt
            const toBigIntSafe = (value: any): bigint => {
                if (typeof value === 'number') {
                    // 处理科学记数法，确保是整数
                    return BigInt(Math.floor(value));
                }
                return BigInt(value.toString());
            };
            
            const result = await testContract.cobbDouglas(
                toBigIntSafe(_params.totalRewards),
                toBigIntSafe(_params.ownerFees),
                toBigIntSafe(_params.totalFees),
                toBigIntSafe(_params.ownerStake),
                toBigIntSafe(_params.totalStake),
                toBigIntSafe(_params.alphaNumerator),
                toBigIntSafe(_params.alphaDenominator),
            );
            
            // 将 BigInt 结果转换为 BigNumber 以保持向后兼容
            return new BigNumber(result.toString());
        }

        function cobbDouglas(params?: Partial<CobbDouglasParams>): BigNumber {
            const { totalRewards, ownerFees, totalFees, ownerStake, totalStake, alphaNumerator, alphaDenominator } = {
                ...DEFAULT_COBB_DOUGLAS_PARAMS,
                ...params,
            };
            
            // 直接使用原始数字值，不经过toDecimal处理
            // toDecimal会进行18位小数的转换，这里我们需要保持原始数值
            const totalRewardsNum = Number(totalRewards.toString());
            const feeRatio = Number(ownerFees.toString()) / Number(totalFees.toString());
            const stakeRatio = Number(ownerStake.toString()) / Number(totalStake.toString());
            const alpha = Number(alphaNumerator.toString()) / Number(alphaDenominator.toString());
            
            // totalRewards * feeRatio ^ alpha * stakeRatio ^ (1-alpha)
            const result = totalRewardsNum * 
                Math.pow(feeRatio, alpha) * 
                Math.pow(stakeRatio, 1 - alpha);
            
            // 转换回 BigNumber，使用向下取整
            return new BigNumber(Math.floor(result));
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
            assertRoughlyEquals(r, expected, PRECISION);
        });

        it('computes the correct reward with zero stake ratio', async () => {
            const ownerStake = 0;
            const expected = cobbDouglas({ ownerStake });
            const r = await callCobbDouglasAsync({ ownerStake });
            assertRoughlyEquals(r, expected, PRECISION);
        });

        it('computes the correct reward with full stake ratio', async () => {
            const ownerStake = DEFAULT_COBB_DOUGLAS_PARAMS.totalStake;
            const expected = cobbDouglas({ ownerStake });
            const r = await callCobbDouglasAsync({ ownerStake });
            assertRoughlyEquals(r, expected, PRECISION);
        });

        it('computes the correct reward with a very low stake ratio', async () => {
            const ownerStake = new BigNumber(DEFAULT_COBB_DOUGLAS_PARAMS.totalStake).times(1e-18);
            const expected = cobbDouglas({ ownerStake });
            const r = await callCobbDouglasAsync({ ownerStake });
            assertRoughlyEquals(r, expected, PRECISION);
        });

        it('computes the correct reward with a very high stake ratio', async () => {
            const ownerStake = new BigNumber(DEFAULT_COBB_DOUGLAS_PARAMS.totalStake).times(1 - 1e-18);
            const expected = cobbDouglas({ ownerStake });
            const r = await callCobbDouglasAsync({ ownerStake });
            assertRoughlyEquals(r, expected, PRECISION);
        });

        it('computes the correct reward with zero fee ratio', async () => {
            const ownerFees = 0;
            const expected = cobbDouglas({ ownerFees });
            const r = await callCobbDouglasAsync({ ownerFees });
            assertRoughlyEquals(r, expected, PRECISION);
        });

        it('computes the correct reward with full fee ratio', async () => {
            const ownerFees = DEFAULT_COBB_DOUGLAS_PARAMS.totalFees;
            const expected = cobbDouglas({ ownerFees });
            const r = await callCobbDouglasAsync({ ownerFees });
            assertRoughlyEquals(r, expected, PRECISION);
        });

        it('computes the correct reward with a very low fee ratio', async () => {
            const ownerFees = new BigNumber(DEFAULT_COBB_DOUGLAS_PARAMS.totalFees).times(1e-18);
            const expected = cobbDouglas({ ownerFees });
            const r = await callCobbDouglasAsync({ ownerFees });
            assertRoughlyEquals(r, expected, PRECISION);
        });

        it('computes the correct reward with a very high fee ratio', async () => {
            const ownerFees = new BigNumber(DEFAULT_COBB_DOUGLAS_PARAMS.totalFees).times(1 - 1e-18);
            const expected = cobbDouglas({ ownerFees });
            const r = await callCobbDouglasAsync({ ownerFees });
            assertRoughlyEquals(r, expected, PRECISION);
        });

        it('computes the correct reward with equal fee and stake ratios', async () => {
            const ownerFees = new BigNumber(DEFAULT_COBB_DOUGLAS_PARAMS.totalFees).times(0.5);
            const ownerStake = new BigNumber(DEFAULT_COBB_DOUGLAS_PARAMS.totalStake).times(0.5);
            const expected = cobbDouglas({ ownerFees, ownerStake });
            const r = await callCobbDouglasAsync({ ownerFees, ownerStake });
            assertRoughlyEquals(r, expected, PRECISION);
        });

        it('computes the correct reward with full fee and stake ratios', async () => {
            const ownerFees = new BigNumber(DEFAULT_COBB_DOUGLAS_PARAMS.totalFees);
            const ownerStake = new BigNumber(DEFAULT_COBB_DOUGLAS_PARAMS.totalStake);
            const expected = cobbDouglas({ ownerFees, ownerStake });
            const r = await callCobbDouglasAsync({ ownerFees, ownerStake });
            assertRoughlyEquals(r, expected, PRECISION);
        });

        it('computes the correct reward with zero fee and stake ratios', async () => {
            const ownerFees = 0;
            const ownerStake = 0;
            const expected = cobbDouglas({ ownerFees, ownerStake });
            const r = await callCobbDouglasAsync({ ownerFees, ownerStake });
            assertRoughlyEquals(r, expected, PRECISION);
        });

        blockchainTests.optional('fuzzing', () => {
            const inputs = _.times(FUZZ_COUNT, () => getRandomParams());
            for (const params of inputs) {
                it(`cobbDouglas(${JSON.stringify(params, (key, value) => typeof value === 'bigint' ? value.toString() : value)})`, async () => {
                    const expected = cobbDouglas(params);
                    const r = await callCobbDouglasAsync(params);
                    assertRoughlyEquals(r, expected, PRECISION);
                });
            }
        });
    });
});
