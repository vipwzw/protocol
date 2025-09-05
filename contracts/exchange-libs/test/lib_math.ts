import {
    constants,
    testCombinatoriallyWithReferenceFunc,
    uint256Values,
} from '@0x/utils';
import { expect } from 'chai';
import { SafeMathRevertErrors } from '@0x/contracts-utils';
import { LibMathRevertErrors } from '@0x/utils';

import {
    getPartialAmountCeil,
    getPartialAmountFloor,
    isRoundingErrorCeil,
    isRoundingErrorFloor,
    safeGetPartialAmountCeil,
    safeGetPartialAmountFloor,
} from '../src/reference_functions';

import { artifacts } from './artifacts';
import { TestLibMath__factory } from '../src/typechain-types';

describe('LibMath', () => {
    const ONE_ETHER = ethers.parseEther('1');
    const MAX_UINT256 = 2n ** 256n - 1n;
    const MAX_UINT256_ROOT = 340282366920938463463374607431768211455n; // 2^128 - 1
    const ZERO_AMOUNT = 0n;
    let libsContract: any;

    before(async () => {
        const { ethers } = require('hardhat');
        const signer = (await ethers.getSigners())[0];
        libsContract = await new TestLibMath__factory(signer).deploy();
    });

    // Wrap a reference function with identical arguments in a promise.
    function createAsyncReferenceFunction<T>(ref: (...args: any[]) => T): (...args: any[]) => Promise<T> {
        return async (...args: any[]): Promise<T> => {
            try {
                const result = ref(...args);
                console.log('Reference raw result:', result, 'Type:', typeof result);
                return result;
            } catch (error) {
                console.log('Reference function threw error:', error.message);
                throw error; // Re-throw to be caught by the test helper
            }
        };
    }

    function createContractTestFunction<T>(name: string): (...args: any[]) => Promise<T> {
        return async (...args: any[]): Promise<T> => {
            const result = await (libsContract as any)[name](...args);
            console.log('Contract raw result:', result, 'Type:', typeof result);
            
            // Convert ethers BigNumber to native BigInt for comparison
            if (typeof result === 'object' && result !== null) {
                if ('toBigInt' in result) {
                    const bigIntResult = result.toBigInt();
                    console.log('Converted to BigInt:', bigIntResult);
                    return bigIntResult as T;
                } else if ('toString' in result) {
                    const bigIntResult = BigInt(result.toString());
                    console.log('Converted via toString to BigInt:', bigIntResult);
                    return bigIntResult as T;
                }
            }
            console.log('Returning result as-is:', result);
            return result;
        };
    }

    describe('getPartialAmountFloor', () => {
        describe('combinatorial tests', () => {
            testCombinatoriallyWithReferenceFunc(
                'getPartialAmountFloor',
                createAsyncReferenceFunction(getPartialAmountFloor),
                createContractTestFunction('getPartialAmountFloor'),
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            it('matches the reference function output', async () => {
                const numerator = ethers.parseEther('1');
                const denominator = ethers.parseEther('0.5');
                const target = ethers.parseEther('0.01');
                const expected = getPartialAmountFloor(numerator, denominator, target);
                const actual = await libsContract.getPartialAmountFloor(numerator, denominator, target);
                expect(actual).to.equal(expected);
            });

            it('rounds down when computing the partial amount', async () => {
                const numerator = ethers.parseEther('0.6');
                const denominator = ethers.parseEther('1.8');
                const target = ONE_ETHER;
                const expected = ONE_ETHER / 3n;
                const actual = await libsContract.getPartialAmountFloor(numerator, denominator, target);
                expect(actual).to.equal(expected);
            });

            it('reverts if `denominator` is zero', async () => {
                const numerator = ethers.parseEther('1');
                const denominator = ZERO_AMOUNT;
                const target = ethers.parseEther('0.01');
                // In Solidity 0.8.28, division by zero results in panic code 0x12
                await expect(
                    libsContract.getPartialAmountFloor(numerator, denominator, target)
                ).to.be.reverted;
            });

            it('reverts if `numerator * target` overflows', async () => {
                const numerator = MAX_UINT256;
                const denominator = ethers.parseEther('0.5');
                const target = MAX_UINT256_ROOT * 2n;
                // In Solidity 0.8.28, multiplication overflow results in panic code 0x11
                await expect(
                    libsContract.getPartialAmountFloor(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });
        });
    });

    describe('getPartialAmountCeil', () => {
        describe('combinatorial tests', () => {
            testCombinatoriallyWithReferenceFunc(
                'getPartialAmountCeil',
                createAsyncReferenceFunction(getPartialAmountCeil),
                createContractTestFunction('getPartialAmountCeil'),
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            it('matches the reference function output', async () => {
                const numerator = ethers.parseEther('1');
                const denominator = ethers.parseEther('0.5');
                const target = ethers.parseEther('0.01');
                const expected = getPartialAmountCeil(numerator, denominator, target);
                const actual = await libsContract.getPartialAmountCeil(numerator, denominator, target);
                expect(actual).to.equal(expected);
            });

            it('rounds up when computing the partial amount', async () => {
                const numerator = ethers.parseEther('0.6');
                const denominator = ethers.parseEther('1.8');
                const target = ONE_ETHER;
                const expected = ONE_ETHER / 3n+ 1n;
                const actual = await libsContract.getPartialAmountCeil(numerator, denominator, target);
                expect(actual).to.equal(expected);
            });

            it('reverts if `denominator` is zero', async () => {
                const numerator = ethers.parseEther('1');
                const denominator = ZERO_AMOUNT;
                const target = ethers.parseEther('0.01');
                // This will actually manifest as a subtraction underflow.
                const expectedError = new SafeMathRevertErrors.Uint256BinOpError(
                    SafeMathRevertErrors.BinOpErrorCodes.SubtractionUnderflow,
                    denominator,
                    1n,
                );
                await expect(
                    libsContract.getPartialAmountCeil(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x12); // Division by zero
            });

            it('reverts if `numerator * target` overflows', async () => {
                const numerator = MAX_UINT256;
                const denominator = ethers.parseEther('0.5');
                const target = MAX_UINT256_ROOT * 2n;
                // In Solidity 0.8.28, multiplication overflow results in panic code 0x11
                await expect(
                    libsContract.getPartialAmountCeil(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });
        });
    });

    describe('safeGetPartialAmountFloor', () => {
        describe('combinatorial tests', () => {
            testCombinatoriallyWithReferenceFunc(
                'safeGetPartialAmountFloor',
                createAsyncReferenceFunction(safeGetPartialAmountFloor),
                createContractTestFunction('safeGetPartialAmountFloor'),
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            it('matches the reference function output', async () => {
                const numerator = ethers.parseEther('1');
                const denominator = ethers.parseEther('0.5');
                const target = ethers.parseEther('0.01');
                const expected = safeGetPartialAmountFloor(numerator, denominator, target);
                const actual = await libsContract.safeGetPartialAmountFloor(numerator, denominator, target);
                expect(actual).to.equal(expected);
            });

            it('rounds down when computing the partial amount', async () => {
                const numerator = ethers.parseEther('0.6');
                const denominator = ethers.parseEther('1.8');
                const target = ONE_ETHER;
                const expected = ONE_ETHER / 3n;
                const actual = await libsContract.safeGetPartialAmountFloor(numerator, denominator, target);
                expect(actual).to.equal(expected);
            });

            it('reverts for a rounding error', async () => {
                const numerator = 1000n;
                const denominator = 10000n;
                const target = 333n;
                await expect(
                    libsContract.safeGetPartialAmountFloor(numerator, denominator, target)
                ).to.be.reverted;
            });

            it('reverts if `denominator` is zero', async () => {
                const numerator = ethers.parseEther('1');
                const denominator = ZERO_AMOUNT;
                const target = ethers.parseEther('0.01');
                await expect(
                    libsContract.safeGetPartialAmountFloor(numerator, denominator, target)
                ).to.be.reverted;
            });

            it('reverts if `numerator * target` overflows', async () => {
                const numerator = MAX_UINT256;
                const denominator = ethers.parseEther('0.5');
                const target = MAX_UINT256_ROOT * 2n;
                // In Solidity 0.8.28, multiplication overflow results in panic code 0x11
                await expect(
                    libsContract.safeGetPartialAmountFloor(numerator, denominator, target)
                ).to.be.reverted;
            });
        });
    });

    describe('safeGetPartialAmountCeil', () => {
        describe('combinatorial tests', () => {
            testCombinatoriallyWithReferenceFunc(
                'safeGetPartialAmountCeil',
                createAsyncReferenceFunction(safeGetPartialAmountCeil),
                createContractTestFunction('safeGetPartialAmountCeil'),
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            it('matches the reference function output', async () => {
                const numerator = ethers.parseEther('1');
                const denominator = ethers.parseEther('0.5');
                const target = ethers.parseEther('0.01');
                const expected = safeGetPartialAmountCeil(numerator, denominator, target);
                const actual = await libsContract.safeGetPartialAmountCeil(numerator, denominator, target);
                expect(actual).to.equal(expected);
            });

            it('rounds up when computing the partial amount', async () => {
                const numerator = ethers.parseEther('0.6');
                const denominator = ethers.parseEther('1.8');
                const target = ONE_ETHER;
                const expected = ONE_ETHER / 3n+ 1n;
                const actual = await libsContract.safeGetPartialAmountCeil(numerator, denominator, target);
                expect(actual).to.equal(expected);
            });

            it('reverts for a rounding error', async () => {
                const numerator = 1000n;
                const denominator = 10000n;
                const target = 333n;
                await expect(
                    libsContract.safeGetPartialAmountCeil(numerator, denominator, target)
                ).to.be.reverted;
            });

            it('reverts if `denominator` is zero', async () => {
                const numerator = ethers.parseEther('1');
                const denominator = ZERO_AMOUNT;
                const target = ethers.parseEther('0.01');
                await expect(
                    libsContract.safeGetPartialAmountCeil(numerator, denominator, target)
                ).to.be.reverted;
            });

            it('reverts if `numerator * target` overflows', async () => {
                const numerator = MAX_UINT256;
                const denominator = ethers.parseEther('0.5');
                const target = MAX_UINT256_ROOT * 2n;
                // In Solidity 0.8.28, multiplication overflow results in panic code 0x11
                await expect(
                    libsContract.safeGetPartialAmountCeil(numerator, denominator, target)
                ).to.be.reverted;
            });
        });
    });

    describe('isRoundingErrorFloor', () => {
        describe('combinatorial tests', () => {
            testCombinatoriallyWithReferenceFunc(
                'isRoundingErrorFloor',
                createAsyncReferenceFunction(isRoundingErrorFloor),
                createContractTestFunction('isRoundingErrorFloor'),
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            it('returns true when `numerator * target / denominator` produces an error >= 0.1%', async () => {
                const numerator = 100n;
                const denominator = 102n;
                const target = 52n;
                // tslint:disable-next-line: boolean-naming
                const actual = await libsContract.isRoundingErrorFloor(numerator, denominator, target);
                expect(actual).to.eq(true);
            });

            it('returns false when `numerator * target / denominator` produces an error < 0.1%', async () => {
                const numerator = 100n;
                const denominator = 101n;
                const target = 92n;
                // tslint:disable-next-line: boolean-naming
                const actual = await libsContract.isRoundingErrorFloor(numerator, denominator, target);
                expect(actual).to.eq(false);
            });

            it('matches the reference function output', async () => {
                const numerator = ethers.parseEther('1');
                const denominator = ethers.parseEther('0.5');
                const target = ethers.parseEther('0.01');
                // tslint:disable-next-line: boolean-naming
                const expected = isRoundingErrorFloor(numerator, denominator, target);
                // tslint:disable-next-line: boolean-naming
                const actual = await libsContract.isRoundingErrorFloor(numerator, denominator, target);
                expect(actual).to.eq(expected);
            });

            it('reverts if `denominator` is zero', async () => {
                const numerator = ethers.parseEther('1');
                const denominator = ZERO_AMOUNT;
                const target = ethers.parseEther('0.01');
                await expect(
                    libsContract.isRoundingErrorFloor(numerator, denominator, target)
                ).to.be.reverted;
            });

            it('reverts if `numerator * target` overflows', async () => {
                const numerator = MAX_UINT256;
                const denominator = ethers.parseEther('0.5');
                const target = MAX_UINT256_ROOT * 2n;
                // In Solidity 0.8.28, multiplication overflow results in panic code 0x11
                await expect(
                    libsContract.isRoundingErrorFloor(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });
        });
    });

    describe('isRoundingErrorCeil', () => {
        describe('combinatorial tests', () => {
            testCombinatoriallyWithReferenceFunc(
                'isRoundingErrorCeil',
                createAsyncReferenceFunction(isRoundingErrorCeil),
                createContractTestFunction('isRoundingErrorCeil'),
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            it('returns true when `numerator * target / (denominator - 1)` produces an error >= 0.1%', async () => {
                const numerator = 100n;
                const denominator = 101n;
                const target = 92n;
                // tslint:disable-next-line: boolean-naming
                const actual = await libsContract.isRoundingErrorCeil(numerator, denominator, target);
                expect(actual).to.eq(true);
            });

            it('returns false when `numerator * target / (denominator - 1)` produces an error < 0.1%', async () => {
                const numerator = 100n;
                const denominator = 102n;
                const target = 52n;
                // tslint:disable-next-line: boolean-naming
                const actual = await libsContract.isRoundingErrorCeil(numerator, denominator, target);
                expect(actual).to.eq(false);
            });

            it('matches the reference function output', async () => {
                const numerator = ethers.parseEther('1');
                const denominator = ethers.parseEther('0.5');
                const target = ethers.parseEther('0.01');
                // tslint:disable-next-line: boolean-naming
                const expected = isRoundingErrorCeil(numerator, denominator, target);
                // tslint:disable-next-line: boolean-naming
                const actual = await libsContract.isRoundingErrorCeil(numerator, denominator, target);
                expect(actual).to.eq(expected);
            });

            it('reverts if `denominator` is zero', async () => {
                const numerator = ethers.parseEther('1');
                const denominator = ZERO_AMOUNT;
                const target = ethers.parseEther('0.01');
                await expect(
                    libsContract.isRoundingErrorCeil(numerator, denominator, target)
                ).to.be.reverted;
            });

            it('reverts if `numerator * target` overflows', async () => {
                const numerator = MAX_UINT256;
                const denominator = ethers.parseEther('0.5');
                const target = MAX_UINT256_ROOT * 2n;
                // In Solidity 0.8.28, multiplication overflow results in panic code 0x11
                await expect(
                    libsContract.isRoundingErrorCeil(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });
        });
    });
});
