import {
    blockchainTests,
    constants,
    describe,
    expect,
    testCombinatoriallyWithReferenceFunc,
    uint256Values,
} from '@0x/test-utils';
import { SafeMathRevertErrors } from '@0x/contracts-utils';
import { BigNumber, LibMathRevertErrors } from '@0x/utils';

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

blockchainTests('LibMath', env => {
    const { ONE_ETHER, MAX_UINT256, MAX_UINT256_ROOT, ZERO_AMOUNT } = constants;
    let libsContract: any;

    before(async () => {
        const { ethers } = require('hardhat');
        const signer = (await ethers.getSigners())[0];
        libsContract = await new TestLibMath__factory(signer).deploy();
    });

    // Wrap a reference function with identical arguments in a promise.
    function createAsyncReferenceFunction<T>(ref: (...args: any[]) => T): (...args: any[]) => Promise<T> {
        return async (...args: any[]): Promise<T> => {
            return ref(...args);
        };
    }

    function createContractTestFunction<T>(name: string): (...args: any[]) => Promise<T> {
        return async (...args: any[]): Promise<T> => {
            return (libsContract as any)[name](...args);
        };
    }

    describe('getPartialAmountFloor', () => {
        describe.optional('combinatorial tests', () => {
            testCombinatoriallyWithReferenceFunc(
                'getPartialAmountFloor',
                createAsyncReferenceFunction(getPartialAmountFloor),
                createContractTestFunction('getPartialAmountFloor'),
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            it('matches the reference function output', async () => {
                const numerator = ONE_ETHER;
                const denominator = ONE_ETHER / 2n;
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
                const numerator = ONE_ETHER;
                const denominator = ZERO_AMOUNT;
                const target = ethers.parseEther('0.01');
                // In Solidity 0.8.28, division by zero results in panic code 0x12
                await expect(
                    libsContract.getPartialAmountFloor(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x12); // Division by zero
            });

            it('reverts if `numerator * target` overflows', async () => {
                const numerator = MAX_UINT256;
                const denominator = ONE_ETHER / 2n;
                const target = MAX_UINT256_ROOT * 2n;
                // In Solidity 0.8.28, multiplication overflow results in panic code 0x11
                await expect(
                    libsContract.getPartialAmountFloor(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });
        });
    });

    describe('getPartialAmountCeil', () => {
        describe.optional('combinatorial tests', () => {
            testCombinatoriallyWithReferenceFunc(
                'getPartialAmountCeil',
                createAsyncReferenceFunction(getPartialAmountCeil),
                createContractTestFunction('getPartialAmountCeil'),
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            it('matches the reference function output', async () => {
                const numerator = ONE_ETHER;
                const denominator = ONE_ETHER / 2n;
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
                const numerator = ONE_ETHER;
                const denominator = ZERO_AMOUNT;
                const target = ethers.parseEther('0.01');
                // This will actually manifest as a subtraction underflow.
                const expectedError = new SafeMathRevertErrors.Uint256BinOpError(
                    SafeMathRevertErrors.BinOpErrorCodes.SubtractionUnderflow,
                    denominator,
                    new BigNumber(1),
                );
                await expect(
                    libsContract.getPartialAmountCeil(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });

            it('reverts if `numerator * target` overflows', async () => {
                const numerator = MAX_UINT256;
                const denominator = ONE_ETHER / 2n;
                const target = MAX_UINT256_ROOT * 2n;
                // In Solidity 0.8.28, multiplication overflow results in panic code 0x11
                await expect(
                    libsContract.getPartialAmountCeil(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });
        });
    });

    describe('safeGetPartialAmountFloor', () => {
        describe.optional('combinatorial tests', () => {
            testCombinatoriallyWithReferenceFunc(
                'safeGetPartialAmountFloor',
                createAsyncReferenceFunction(safeGetPartialAmountFloor),
                createContractTestFunction('safeGetPartialAmountFloor'),
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            it('matches the reference function output', async () => {
                const numerator = ONE_ETHER;
                const denominator = ONE_ETHER / 2n;
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
                ).to.be.revertedWithCustomError(libsContract, 'RoundingError');
            });

            it('reverts if `denominator` is zero', async () => {
                const numerator = ONE_ETHER;
                const denominator = ZERO_AMOUNT;
                const target = ethers.parseEther('0.01');
                await expect(
                    libsContract.safeGetPartialAmountFloor(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x12); // Division by zero
            });

            it('reverts if `numerator * target` overflows', async () => {
                const numerator = MAX_UINT256;
                const denominator = ONE_ETHER / 2n;
                const target = MAX_UINT256_ROOT * 2n;
                // In Solidity 0.8.28, multiplication overflow results in panic code 0x11
                await expect(
                    libsContract.safeGetPartialAmountFloor(numerator, denominator, target)
                ).to.be.revertedWithCustomError(libsContract, 'RoundingError');
            });
        });
    });

    describe('safeGetPartialAmountCeil', () => {
        describe.optional('combinatorial tests', () => {
            testCombinatoriallyWithReferenceFunc(
                'safeGetPartialAmountCeil',
                createAsyncReferenceFunction(safeGetPartialAmountCeil),
                createContractTestFunction('safeGetPartialAmountCeil'),
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            it('matches the reference function output', async () => {
                const numerator = ONE_ETHER;
                const denominator = ONE_ETHER / 2n;
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
                ).to.be.revertedWithCustomError(libsContract, 'RoundingError');
            });

            it('reverts if `denominator` is zero', async () => {
                const numerator = ONE_ETHER;
                const denominator = ZERO_AMOUNT;
                const target = ethers.parseEther('0.01');
                await expect(
                    libsContract.safeGetPartialAmountCeil(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x12); // Division by zero
            });

            it('reverts if `numerator * target` overflows', async () => {
                const numerator = MAX_UINT256;
                const denominator = ONE_ETHER / 2n;
                const target = MAX_UINT256_ROOT * 2n;
                // In Solidity 0.8.28, multiplication overflow results in panic code 0x11
                await expect(
                    libsContract.safeGetPartialAmountCeil(numerator, denominator, target)
                ).to.be.revertedWithCustomError(libsContract, 'RoundingError');
            });
        });
    });

    describe('isRoundingErrorFloor', () => {
        describe.optional('combinatorial tests', () => {
            testCombinatoriallyWithReferenceFunc(
                'isRoundingErrorFloor',
                createAsyncReferenceFunction(isRoundingErrorFloor),
                createContractTestFunction('isRoundingErrorFloor'),
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            it('returns true when `numerator * target / denominator` produces an error >= 0.1%', async () => {
                const numerator = new BigNumber(100);
                const denominator = new BigNumber(102);
                const target = new BigNumber(52);
                // tslint:disable-next-line: boolean-naming
                const actual = await libsContract.isRoundingErrorFloor(numerator, denominator, target);
                expect(actual).to.eq(true);
            });

            it('returns false when `numerator * target / denominator` produces an error < 0.1%', async () => {
                const numerator = new BigNumber(100);
                const denominator = new BigNumber(101);
                const target = new BigNumber(92);
                // tslint:disable-next-line: boolean-naming
                const actual = await libsContract.isRoundingErrorFloor(numerator, denominator, target);
                expect(actual).to.eq(false);
            });

            it('matches the reference function output', async () => {
                const numerator = ONE_ETHER;
                const denominator = ONE_ETHER / 2n;
                const target = ethers.parseEther('0.01');
                // tslint:disable-next-line: boolean-naming
                const expected = isRoundingErrorFloor(numerator, denominator, target);
                // tslint:disable-next-line: boolean-naming
                const actual = await libsContract.isRoundingErrorFloor(numerator, denominator, target)();
                expect(actual).to.eq(expected);
            });

            it('reverts if `denominator` is zero', async () => {
                const numerator = ONE_ETHER;
                const denominator = ZERO_AMOUNT;
                const target = ethers.parseEther('0.01');
                const expectedError = new LibMathRevertErrors.DivisionByZeroError();
                await expect(
                    libsContract.isRoundingErrorFloor(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });

            it('reverts if `numerator * target` overflows', async () => {
                const numerator = MAX_UINT256;
                const denominator = ONE_ETHER / 2n;
                const target = MAX_UINT256_ROOT * 2n;
                // In Solidity 0.8.28, multiplication overflow results in panic code 0x11
                await expect(
                    libsContract.isRoundingErrorFloor(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });
        });
    });

    describe('isRoundingErrorCeil', () => {
        describe.optional('combinatorial tests', () => {
            testCombinatoriallyWithReferenceFunc(
                'isRoundingErrorCeil',
                createAsyncReferenceFunction(isRoundingErrorCeil),
                createContractTestFunction('isRoundingErrorCeil'),
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            it('returns true when `numerator * target / (denominator - 1)` produces an error >= 0.1%', async () => {
                const numerator = new BigNumber(100);
                const denominator = new BigNumber(101);
                const target = new BigNumber(92);
                // tslint:disable-next-line: boolean-naming
                const actual = await libsContract.isRoundingErrorCeil(numerator, denominator, target);
                expect(actual).to.eq(true);
            });

            it('returns false when `numerator * target / (denominator - 1)` produces an error < 0.1%', async () => {
                const numerator = new BigNumber(100);
                const denominator = new BigNumber(102);
                const target = new BigNumber(52);
                // tslint:disable-next-line: boolean-naming
                const actual = await libsContract.isRoundingErrorCeil(numerator, denominator, target);
                expect(actual).to.eq(false);
            });

            it('matches the reference function output', async () => {
                const numerator = ONE_ETHER;
                const denominator = ONE_ETHER / 2n;
                const target = ethers.parseEther('0.01');
                // tslint:disable-next-line: boolean-naming
                const expected = isRoundingErrorCeil(numerator, denominator, target);
                // tslint:disable-next-line: boolean-naming
                const actual = await libsContract.isRoundingErrorCeil(numerator, denominator, target)();
                expect(actual).to.eq(expected);
            });

            it('reverts if `denominator` is zero', async () => {
                const numerator = ONE_ETHER;
                const denominator = ZERO_AMOUNT;
                const target = ethers.parseEther('0.01');
                await expect(
                    libsContract.isRoundingErrorCeil(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x12); // Division by zero
            });

            it('reverts if `numerator * target` overflows', async () => {
                const numerator = MAX_UINT256;
                const denominator = ONE_ETHER / 2n;
                const target = MAX_UINT256_ROOT * 2n;
                // In Solidity 0.8.28, multiplication overflow results in panic code 0x11
                await expect(
                    libsContract.isRoundingErrorCeil(numerator, denominator, target)
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });
        });
    });
});
