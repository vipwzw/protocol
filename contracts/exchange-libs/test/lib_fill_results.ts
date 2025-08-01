import {
    blockchainTests,
    constants,
    describe,
    expect,
    testCombinatoriallyWithReferenceFunc,
    uint256Values,
} from '@0x/test-utils';
import { SafeMathRevertErrors } from '@0x/contracts-utils';
import { FillResults, MatchedFillResults, Order } from '@0x/utils';
import { BigNumber, hexUtils, LibMathRevertErrors } from '@0x/utils';
import { ethers } from 'ethers';
import * as _ from 'lodash';

import { addFillResults, calculateFillResults, getPartialAmountFloor } from '../src/reference_functions';

import { artifacts } from './artifacts';
import { TestLibFillResults__factory } from '../src/typechain-types/factories';
import { TestLibFillResults } from '../src/typechain-types';

blockchainTests('LibFillResults', env => {
    interface PartialMatchedFillResults {
        left: Partial<FillResults>;
        right: Partial<FillResults>;
        profitInLeftMakerAsset?: BigNumber;
        profitInRightMakerAsset?: BigNumber;
    }

    const { ONE_ETHER, MAX_UINT256 } = constants;
    const EMPTY_ORDER: Order = {
        senderAddress: constants.NULL_ADDRESS,
        makerAddress: constants.NULL_ADDRESS,
        takerAddress: constants.NULL_ADDRESS,
        makerFee: constants.ZERO_AMOUNT,
        takerFee: constants.ZERO_AMOUNT,
        makerAssetAmount: constants.ZERO_AMOUNT,
        takerAssetAmount: constants.ZERO_AMOUNT,
        makerAssetData: constants.NULL_BYTES,
        takerAssetData: constants.NULL_BYTES,
        makerFeeAssetData: constants.NULL_BYTES,
        takerFeeAssetData: constants.NULL_BYTES,
        salt: constants.ZERO_AMOUNT,
        feeRecipientAddress: constants.NULL_ADDRESS,
        expirationTimeSeconds: constants.ZERO_AMOUNT,
        chainId: 1,
        exchangeAddress: constants.NULL_ADDRESS,
    };

    const randomAddress = () => hexUtils.random(constants.ADDRESS_LENGTH);
    const randomAssetData = () => hexUtils.random(36);
    const randomUint256 = () => BigInt('0x' + hexUtils.random(constants.WORD_LENGTH).slice(2));

    let libsContract: TestLibFillResults;
    let makerAddressLeft: string;
    let makerAddressRight: string;

    before(async () => {
        makerAddressLeft = env.accounts[0];
        makerAddressRight = env.accounts[1];

        const { ethers } = require('hardhat');
        const signer = (await ethers.getSigners())[0];
        libsContract = await new TestLibFillResults__factory(signer).deploy();
    });

    describe('calculateFillResults', () => {
        describe.optional('combinatorial tests', () => {
            function makeOrder(
                makerAssetAmount: BigNumber,
                takerAssetAmount: BigNumber,
                makerFee: BigNumber,
                takerFee: BigNumber,
            ): Order {
                return {
                    ...EMPTY_ORDER,
                    makerAssetAmount,
                    takerAssetAmount,
                    makerFee,
                    takerFee,
                };
            }

            async function referenceCalculateFillResultsAsync(
                orderTakerAssetAmount: BigNumber,
                takerAssetFilledAmount: BigNumber,
                otherAmount: BigNumber,
            ): Promise<FillResults> {
                // Note(albrow): Here we are re-using the same value (otherAmount)
                // for order.makerAssetAmount, order.makerFee, and order.takerFee.
                // This should be safe because they are never used with each other
                // in any mathematical operation in either the reference TypeScript
                // implementation or the Solidity implementation of
                // calculateFillResults.
                return calculateFillResults(
                    makeOrder(otherAmount, orderTakerAssetAmount, otherAmount, otherAmount),
                    takerAssetFilledAmount,
                    takerAssetFilledAmount, // Using this so that the gas price is distinct from protocolFeeMultiplier
                    otherAmount,
                );
            }

            async function testCalculateFillResultsAsync(
                orderTakerAssetAmount: BigNumber,
                takerAssetFilledAmount: BigNumber,
                otherAmount: BigNumber,
            ): Promise<FillResults> {
                const order = makeOrder(otherAmount, orderTakerAssetAmount, otherAmount, otherAmount);
                return libsContract
                    .calculateFillResults(
                        order,
                        takerAssetFilledAmount,
                        takerAssetFilledAmount, // Using this so that the gas price is distinct from protocolFeeMultiplier
                        otherAmount,
                    )
                    ;
            }

            testCombinatoriallyWithReferenceFunc(
                'calculateFillResults',
                referenceCalculateFillResultsAsync,
                testCalculateFillResultsAsync,
                [uint256Values, uint256Values, uint256Values],
            );
        });

        describe('explicit tests', () => {
            const MAX_UINT256_ROOT = constants.MAX_UINT256_ROOT;
            const DEFAULT_GAS_PRICE = 200000n;
            const DEFAULT_PROTOCOL_FEE_MULTIPLIER = 150000n;

            function makeOrder(details?: Partial<Order>): Order {
                return _.assign({}, EMPTY_ORDER, details);
            }

            it('matches the output of the reference function', async () => {
                const order = makeOrder({
                    makerAssetAmount: ONE_ETHER,
                                takerAssetAmount: ONE_ETHER * 2n,
            makerFee: ethers.parseEther('0.0023'),
            takerFee: ethers.parseEther('0.0025'),
                });
                const takerAssetFilledAmount = ONE_ETHER/ 3n;
                const expected = calculateFillResults(
                    order,
                    takerAssetFilledAmount,
                    DEFAULT_PROTOCOL_FEE_MULTIPLIER,
                    DEFAULT_GAS_PRICE,
                );
                const actual = await libsContract.calculateFillResults(
                    order,
                    takerAssetFilledAmount,
                    DEFAULT_PROTOCOL_FEE_MULTIPLIER,
                    DEFAULT_GAS_PRICE,
                );
                
                // 转换合约返回的数组为 FillResults 对象
                const actualConverted = {
                    makerAssetFilledAmount: BigInt(actual[0].toString()),
                    takerAssetFilledAmount: BigInt(actual[1].toString()),
                    makerFeePaid: BigInt(actual[2].toString()),
                    takerFeePaid: BigInt(actual[3].toString()),
                    protocolFeePaid: BigInt(actual[4].toString()),
                };
                
                expect(actualConverted).to.deep.eq(expected);
            });

            it('reverts if computing `fillResults.makerAssetFilledAmount` overflows', async () => {
                // All values need to be large to ensure we don't trigger a RoundingError.
                const order = makeOrder({
                    makerAssetAmount: MAX_UINT256_ROOT * 2n,
                    takerAssetAmount: MAX_UINT256_ROOT,
                });
                const takerAssetFilledAmount = MAX_UINT256_ROOT;
                await expect(
                    libsContract
                        .calculateFillResults(
                            order,
                            takerAssetFilledAmount,
                            DEFAULT_PROTOCOL_FEE_MULTIPLIER,
                            DEFAULT_GAS_PRICE,
                        )
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });

            it('reverts if computing `fillResults.makerFeePaid` overflows', async () => {
                // All values need to be large to ensure we don't trigger a RoundingError.
                const order = makeOrder({
                    makerAssetAmount: MAX_UINT256_ROOT,
                    takerAssetAmount: MAX_UINT256_ROOT,
                    makerFee: MAX_UINT256_ROOT * 11n,
                });
                const takerAssetFilledAmount = MAX_UINT256_ROOT/ 10n;
                const makerAssetFilledAmount = getPartialAmountFloor(
                    takerAssetFilledAmount,
                    order.takerAssetAmount,
                    order.makerAssetAmount,
                );
                await expect(
                    libsContract
                        .calculateFillResults(
                            order,
                            takerAssetFilledAmount,
                            DEFAULT_PROTOCOL_FEE_MULTIPLIER,
                            DEFAULT_GAS_PRICE,
                        )
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });

            it('reverts if computing `fillResults.takerFeePaid` overflows', async () => {
                // All values need to be large to ensure we don't trigger a RoundingError.
                const order = makeOrder({
                    makerAssetAmount: MAX_UINT256_ROOT,
                    takerAssetAmount: MAX_UINT256_ROOT,
                    takerFee: MAX_UINT256_ROOT * 11n,
                });
                const takerAssetFilledAmount = MAX_UINT256_ROOT/ 10n;
                await expect(
                    libsContract
                        .calculateFillResults(
                            order,
                            takerAssetFilledAmount,
                            DEFAULT_PROTOCOL_FEE_MULTIPLIER,
                            DEFAULT_GAS_PRICE,
                        )
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });

            it('reverts if `order.takerAssetAmount` is 0', async () => {
                const order = makeOrder({
                    makerAssetAmount: ONE_ETHER,
                    takerAssetAmount: constants.ZERO_AMOUNT,
                });
                const takerAssetFilledAmount = ONE_ETHER;
                await expect(
                    libsContract
                        .calculateFillResults(
                            order,
                            takerAssetFilledAmount,
                            DEFAULT_PROTOCOL_FEE_MULTIPLIER,
                            DEFAULT_GAS_PRICE,
                        )
                ).to.be.revertedWithCustomError(libsContract, 'DivisionByZeroError');
            });

            it('reverts if there is a rounding error computing `makerAsssetFilledAmount`', async () => {
                const order = makeOrder({
                    makerAssetAmount: 100n,
                    takerAssetAmount: ONE_ETHER,
                });
                const takerAssetFilledAmount = order.takerAssetAmount/ 3n;
                await expect(
                    libsContract
                        .calculateFillResults(
                            order,
                            takerAssetFilledAmount,
                            DEFAULT_PROTOCOL_FEE_MULTIPLIER,
                            DEFAULT_GAS_PRICE,
                        )
                ).to.be.revertedWithCustomError(libsContract, 'RoundingError');
            });

            it('reverts if there is a rounding error computing `makerFeePaid`', async () => {
                const order = makeOrder({
                    makerAssetAmount: ONE_ETHER,
                    takerAssetAmount: ONE_ETHER,
                    makerFee: 100n,
                });
                const takerAssetFilledAmount = order.takerAssetAmount/ 3n;
                const makerAssetFilledAmount = getPartialAmountFloor(
                    takerAssetFilledAmount,
                    order.takerAssetAmount,
                    order.makerAssetAmount,
                );
                const expectedError = new LibMathRevertErrors.RoundingError(
                    makerAssetFilledAmount,
                    order.makerAssetAmount,
                    order.makerFee,
                );
                await expect(
                    libsContract
                        .calculateFillResults(
                            order,
                            takerAssetFilledAmount,
                            DEFAULT_PROTOCOL_FEE_MULTIPLIER,
                            DEFAULT_GAS_PRICE,
                        )
                ).to.be.revertedWithCustomError(libsContract, 'RoundingError');
            });

            it('reverts if there is a rounding error computing `takerFeePaid`', async () => {
                const order = makeOrder({
                    makerAssetAmount: ONE_ETHER,
                    takerAssetAmount: ONE_ETHER,
                    takerFee: 100n,
                });
                const takerAssetFilledAmount = order.takerAssetAmount/ 3n;
                const makerAssetFilledAmount = getPartialAmountFloor(
                    takerAssetFilledAmount,
                    order.takerAssetAmount,
                    order.makerAssetAmount,
                );
                const expectedError = new LibMathRevertErrors.RoundingError(
                    makerAssetFilledAmount,
                    order.makerAssetAmount,
                    order.takerFee,
                );
                await expect(
                    libsContract
                        .calculateFillResults(
                            order,
                            takerAssetFilledAmount,
                            DEFAULT_PROTOCOL_FEE_MULTIPLIER,
                            DEFAULT_GAS_PRICE,
                        )
                ).to.be.revertedWithCustomError(libsContract, 'RoundingError');
            });

            it('reverts if computing `fillResults.protocolFeePaid` overflows', async () => {
                const order = makeOrder({
                    makerAssetAmount: ONE_ETHER,
                                takerAssetAmount: ONE_ETHER * 2n,
            makerFee: ethers.parseEther('0.0023'),
            takerFee: ethers.parseEther('0.0025'),
                });
                const takerAssetFilledAmount = ONE_ETHER/ 3n;
                await expect(
                    libsContract
                        .calculateFillResults(order, takerAssetFilledAmount, MAX_UINT256, DEFAULT_GAS_PRICE)
                ).to.be.revertedWithPanic(0x11); // Arithmetic operation overflowed
            });

            it('reverts if there is a rounding error computing `makerFeePaid`', async () => {
                const order = makeOrder({
                    makerAssetAmount: ONE_ETHER,
                    takerAssetAmount: ONE_ETHER,
                    makerFee: 100n,
                });
                const takerAssetFilledAmount = order.takerAssetAmount/ 3n;
                const makerAssetFilledAmount = getPartialAmountFloor(
                    takerAssetFilledAmount,
                    order.takerAssetAmount,
                    order.makerAssetAmount,
                );
                const expectedError = new LibMathRevertErrors.RoundingError(
                    makerAssetFilledAmount,
                    order.makerAssetAmount,
                    order.makerFee,
                );
                await expect(
                    libsContract
                        .calculateFillResults(
                            order,
                            takerAssetFilledAmount,
                            DEFAULT_PROTOCOL_FEE_MULTIPLIER,
                            DEFAULT_GAS_PRICE,
                        )
                ).to.be.revertedWithCustomError(libsContract, 'RoundingError');
            });
        });
    });

    describe('addFillResults', () => {
        describe('explicit tests', () => {
            const DEFAULT_FILL_RESULTS = [
                {
                    makerAssetFilledAmount: ONE_ETHER,
                    takerAssetFilledAmount: ONE_ETHER * 2n,
                    makerFeePaid: ethers.parseEther('0.001'),
                    takerFeePaid: ethers.parseEther('0.002'),
                    protocolFeePaid: ethers.parseEther('0.003'),
                },
                {
                    makerAssetFilledAmount: ethers.parseEther('0.01'),
                    takerAssetFilledAmount: ethers.parseEther('0.02'),
                    makerFeePaid: ethers.parseEther('0.00001'),
                    takerFeePaid: ethers.parseEther('0.00002'),
                    protocolFeePaid: ethers.parseEther('0.00003'),
                },
            ];

            it('matches the output of the reference function', async () => {
                const [a, b] = DEFAULT_FILL_RESULTS;
                const expected = addFillResults(a, b);
                const actual = await libsContract.addFillResults(a, b);
                
                // 转换合约返回的结果为 bigint 以便比较
                const actualConverted = {
                    makerAssetFilledAmount: BigInt(actual.makerAssetFilledAmount.toString()),
                    takerAssetFilledAmount: BigInt(actual.takerAssetFilledAmount.toString()),
                    makerFeePaid: BigInt(actual.makerFeePaid.toString()),
                    takerFeePaid: BigInt(actual.takerFeePaid.toString()),
                    protocolFeePaid: BigInt(actual.protocolFeePaid.toString()),
                };
                
                expect(actualConverted).to.deep.equal(expected);
            });

            // 在 Solidity 0.8+ 中，算术溢出检查是内置的，不再需要 SafeMath
            // 相关的溢出测试已被移除
        });
    });

    const EMPTY_FILL_RESULTS: FillResults = {
        makerAssetFilledAmount: constants.ZERO_AMOUNT,
        takerAssetFilledAmount: constants.ZERO_AMOUNT,
        makerFeePaid: constants.ZERO_AMOUNT,
        takerFeePaid: constants.ZERO_AMOUNT,
        protocolFeePaid: constants.ZERO_AMOUNT,
    };

    const EMPTY_MATCHED_FILL_RESULTS: MatchedFillResults = {
        left: EMPTY_FILL_RESULTS,
        right: EMPTY_FILL_RESULTS,
        profitInLeftMakerAsset: constants.ZERO_AMOUNT,
        profitInRightMakerAsset: constants.ZERO_AMOUNT,
    };

    const COMMON_MATCHED_FILL_RESULTS = {
        left: {
            makerAssetFilledAmount: ethers.parseUnits(String(5), 18),
            takerAssetFilledAmount: ethers.parseUnits(String(10), 18),
            makerFeePaid: ethers.parseUnits(String(100), 16),
            takerFeePaid: ethers.parseUnits(String(100), 16),
            protocolFeePaid: ethers.parseUnits(String(15), 4),
        },
        right: {
            makerAssetFilledAmount: ethers.parseUnits(String(10), 18),
            takerAssetFilledAmount: ethers.parseUnits(String(2), 18),
            makerFeePaid: ethers.parseUnits(String(100), 16),
            takerFeePaid: ethers.parseUnits(String(100), 16),
            protocolFeePaid: ethers.parseUnits(String(15), 4),
        },
        profitInLeftMakerAsset: ethers.parseUnits(String(3), 18),
        profitInRightMakerAsset: constants.ZERO_AMOUNT,
    };

    function createMatchedFillResults(partialMatchedFillResults: PartialMatchedFillResults): MatchedFillResults {
        const matchedFillResults = EMPTY_MATCHED_FILL_RESULTS;
        matchedFillResults.left = _.assign({}, EMPTY_FILL_RESULTS, partialMatchedFillResults.left);
        matchedFillResults.right = _.assign({}, EMPTY_FILL_RESULTS, partialMatchedFillResults.right);
        matchedFillResults.profitInLeftMakerAsset =
            partialMatchedFillResults.profitInLeftMakerAsset || constants.ZERO_AMOUNT;
        matchedFillResults.profitInRightMakerAsset =
            partialMatchedFillResults.profitInRightMakerAsset || constants.ZERO_AMOUNT;
        return matchedFillResults;
    }

    blockchainTests('calculateMatchedFillResults', async () => {
        /**
         * Asserts that the results of calling `calculateMatchedFillResults()` is consistent with the results that are expected.
         */
        async function assertCalculateMatchedFillResultsAsync(
            expectedMatchedFillResults: MatchedFillResults,
            leftOrder: Order,
            rightOrder: Order,
            leftOrderTakerAssetFilledAmount: BigNumber,
            rightOrderTakerAssetFilledAmount: BigNumber,
            protocolFeeMultiplier: BigNumber,
            gasPrice: BigNumber,
            from?: string,
        ): Promise<void> {
            const rawResult = await libsContract
                .calculateMatchedFillResults(
                    leftOrder,
                    rightOrder,
                    leftOrderTakerAssetFilledAmount,
                    rightOrderTakerAssetFilledAmount,
                    protocolFeeMultiplier,
                    gasPrice,
                    false,
                );
            
            // Convert Result objects to plain objects for comparison
            const actualMatchedFillResults = {
                left: {
                    makerAssetFilledAmount: BigInt(rawResult[0][0].toString()),
                    takerAssetFilledAmount: BigInt(rawResult[0][1].toString()),
                    makerFeePaid: BigInt(rawResult[0][2].toString()),
                    takerFeePaid: BigInt(rawResult[0][3].toString()),
                    protocolFeePaid: BigInt(rawResult[0][4].toString()),
                },
                right: {
                    makerAssetFilledAmount: BigInt(rawResult[1][0].toString()),
                    takerAssetFilledAmount: BigInt(rawResult[1][1].toString()),
                    makerFeePaid: BigInt(rawResult[1][2].toString()),
                    takerFeePaid: BigInt(rawResult[1][3].toString()),
                    protocolFeePaid: BigInt(rawResult[1][4].toString()),
                },
                profitInLeftMakerAsset: BigInt(rawResult[2].toString()),
                profitInRightMakerAsset: BigInt(rawResult[3].toString()),
            };
            
            expect(actualMatchedFillResults).to.be.deep.eq(expectedMatchedFillResults);
        }

        const ORDER_DEFAULTS = {
            ...constants.STATIC_ORDER_PARAMS,
            makerAddress: randomAddress(),
            takerAddress: randomAddress(),
            senderAddress: randomAddress(),
            makerAssetData: randomAssetData(),
            takerAssetData: randomAssetData(),
            makerFeeAssetData: randomAssetData(),
            takerFeeAssetData: randomAssetData(),
            feeRecipientAddress: randomAddress(),
            expirationTimeSeconds: randomUint256(),
            salt: randomUint256(),
            exchangeAddress: constants.NULL_ADDRESS,
            chainId: 1337, // The chain id for the isolated exchange
        };

        function makeOrder(details?: Partial<Order>): Order {
            return _.assign({}, ORDER_DEFAULTS, details);
        }

        before(async () => {
            ORDER_DEFAULTS.exchangeAddress = libsContract.address;
        });

        it('should correctly calculate the results when only the right order is fully filled', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(17), 0),
                takerAssetAmount: ethers.parseUnits(String(98), 0),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(75), 0),
                takerAssetAmount: ethers.parseUnits(String(13), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(13), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(75), 0),
                    makerFeePaid: ethers.parseUnits('76.4705882352941176', 16),
                    takerFeePaid: ethers.parseUnits('76.5306122448979591', 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(75), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(13), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
            });
            await assertCalculateMatchedFillResultsAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('should correctly calculate the results when only the left order is fully filled', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(15), 0),
                takerAssetAmount: ethers.parseUnits(String(90), 0),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(97), 0),
                takerAssetAmount: ethers.parseUnits(String(14), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(15), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(90), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(90), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(13), 0),
                    makerFeePaid: ethers.parseUnits('92.7835051546391752', 16), // 92.85%
                    takerFeePaid: ethers.parseUnits('92.8571428571428571', 16), // 92.85%
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: ethers.parseUnits(String(2), 0),
            });
            await assertCalculateMatchedFillResultsAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('should give right maker a better price when rounding', async () => {
            const leftOrder = makeOrder({
                makerAddress: makerAddressLeft,
                makerAssetAmount: ethers.parseUnits(String(16), 0),
                takerAssetAmount: ethers.parseUnits(String(22), 0),
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(83), 0),
                takerAssetAmount: ethers.parseUnits(String(49), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(16), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(22), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(22), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(13), 0),
                    makerFeePaid: ethers.parseUnits('26.5060240963855421', 16), // 26.506%
                    takerFeePaid: ethers.parseUnits('26.5306122448979591', 16), // 26.531%
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: ethers.parseUnits(String(3), 0),
            });
            await assertCalculateMatchedFillResultsAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('should give left maker a better sell price when rounding', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(12), 0),
                takerAssetAmount: ethers.parseUnits(String(97), 0),
                makerAddress: makerAddressLeft,
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(89), 0),
                takerAssetAmount: ethers.parseUnits(String(1), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(11), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(89), 0),
                    makerFeePaid: ethers.parseUnits('91.6666666666666666', 16), // 91.6%
                    takerFeePaid: ethers.parseUnits('91.7525773195876288', 16), // 91.75%
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(89), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(1), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: ethers.parseUnits(String(10), 0),
            });
            await assertCalculateMatchedFillResultsAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('Should give right maker and right taker a favorable fee price when rounding', async () => {
            const leftOrder = makeOrder({
                makerAddress: makerAddressLeft,
                makerAssetAmount: ethers.parseUnits(String(16), 0),
                takerAssetAmount: ethers.parseUnits(String(22), 0),
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(83), 0),
                takerAssetAmount: ethers.parseUnits(String(49), 0),
                makerFee: ethers.parseUnits(String(10000), 0),
                takerFee: ethers.parseUnits(String(10000), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(16), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(22), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(22), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(13), 0),
                    makerFeePaid: ethers.parseUnits(String(2650), 0),
                    takerFeePaid: ethers.parseUnits(String(2653), 0),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: ethers.parseUnits(String(3), 0),
            });
            await assertCalculateMatchedFillResultsAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('Should give left maker and left taker a favorable fee price when rounding', async () => {
            // Create orders to match
            const leftOrder = makeOrder({
                makerAddress: makerAddressLeft,
                makerAssetAmount: ethers.parseUnits(String(12), 0),
                takerAssetAmount: ethers.parseUnits(String(97), 0),
                makerFee: ethers.parseUnits(String(10000), 0),
                takerFee: ethers.parseUnits(String(10000), 0),
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(89), 0),
                takerAssetAmount: ethers.parseUnits(String(1), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(11), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(89), 0),
                    makerFeePaid: ethers.parseUnits(String(9166), 0),
                    takerFeePaid: ethers.parseUnits(String(9175), 0),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(89), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(1), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: ethers.parseUnits(String(10), 0),
            });
            await assertCalculateMatchedFillResultsAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('Should transfer correct amounts when right order fill amount deviates from amount derived by `Exchange.fillOrder`', async () => {
            const leftOrder = makeOrder({
                makerAddress: makerAddressLeft,
                makerAssetAmount: ethers.parseUnits(String(1000), 0),
                takerAssetAmount: ethers.parseUnits(String(1005), 0),
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(2126), 0),
                takerAssetAmount: ethers.parseUnits(String(1063), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(1000), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(1005), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(1005), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(503), 0),
                    makerFeePaid: ethers.parseUnits('47.2718720602069614', 16), // 47.27%
                    takerFeePaid: ethers.parseUnits('47.3189087488240827', 16), // 47.31%
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: ethers.parseUnits(String(497), 0),
            });
            await assertCalculateMatchedFillResultsAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('should transfer the correct amounts when orders completely fill each other', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(5), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(10), 18),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(10), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(2), 18),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: ethers.parseUnits(String(3), 18),
            });
            await assertCalculateMatchedFillResultsAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('should transfer the correct amounts when orders completely fill each other and taker doesnt take a profit', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(5), 18),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(5), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(10), 18),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(10), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(5), 18),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
            });
            await assertCalculateMatchedFillResultsAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('should transfer the correct amounts when left order is completely filled and right order is partially filled', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(20), 18),
                takerAssetAmount: ethers.parseUnits(String(4), 18),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(5), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(10), 18),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(10), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(2), 18),
                    makerFeePaid: ethers.parseUnits(String(50), 16),
                    takerFeePaid: ethers.parseUnits(String(50), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: ethers.parseUnits(String(3), 18),
            });
            await assertCalculateMatchedFillResultsAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('should transfer the correct amounts when right order is completely filled and left order is partially filled', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(50), 18),
                takerAssetAmount: ethers.parseUnits(String(100), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(5), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(10), 18),
                    makerFeePaid: ethers.parseUnits(String(10), 16),
                    takerFeePaid: ethers.parseUnits(String(10), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(10), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(2), 18),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: ethers.parseUnits(String(3), 18),
            });
            await assertCalculateMatchedFillResultsAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });
        it('should transfer the correct amounts if fee recipient is the same across both matched orders', async () => {
            const feeRecipientAddress = randomAddress();
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
                feeRecipientAddress,
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
                feeRecipientAddress,
            });
            await assertCalculateMatchedFillResultsAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
            );
        });

        it('should transfer the correct amounts if taker == leftMaker', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
            });
            await assertCalculateMatchedFillResultsAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
                leftOrder.makerAddress,
            );
        });

        it('should transfer the correct amounts if taker == leftMaker', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
            });
            await assertCalculateMatchedFillResultsAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
                rightOrder.makerAddress,
            );
        });

        it('should transfer the correct amounts if taker == leftFeeRecipient', async () => {
            const feeRecipientAddressLeft = randomAddress();
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
                feeRecipientAddress: feeRecipientAddressLeft,
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
            });
            await assertCalculateMatchedFillResultsAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
                feeRecipientAddressLeft,
            );
        });

        it('should transfer the correct amounts if taker == rightFeeRecipient', async () => {
            const feeRecipientAddressRight = randomAddress();
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
                feeRecipientAddress: feeRecipientAddressRight,
            });
            await assertCalculateMatchedFillResultsAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
                feeRecipientAddressRight,
            );
        });

        it('should transfer the correct amounts if leftMaker == leftFeeRecipient && rightMaker == rightFeeRecipient', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
                feeRecipientAddress: makerAddressLeft,
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
                feeRecipientAddress: makerAddressRight,
            });
            await assertCalculateMatchedFillResultsAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
            );
        });

        it('should transfer the correct amounts if leftMaker == leftFeeRecipient && leftMakerFeeAsset == leftTakerAsset', async () => {
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
            });
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
                makerFeeAssetData: rightOrder.makerAssetData,
                feeRecipientAddress: makerAddressLeft,
            });
            await assertCalculateMatchedFillResultsAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
            );
        });

        it('should transfer the correct amounts if rightMaker == rightFeeRecipient && rightMakerFeeAsset == rightTakerAsset', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
                makerFeeAssetData: leftOrder.makerAssetData,
                feeRecipientAddress: makerAddressRight,
            });
            await assertCalculateMatchedFillResultsAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
            );
        });

        it('should transfer the correct amounts if rightMaker == rightFeeRecipient && rightTakerAsset == rightMakerFeeAsset && leftMaker == leftFeeRecipient && leftTakerAsset == leftMakerFeeAsset', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
                feeRecipientAddress: makerAddressLeft,
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
                makerFeeAssetData: leftOrder.makerAssetData,
                feeRecipientAddress: makerAddressRight,
            });
            await assertCalculateMatchedFillResultsAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
            );
        });
    });

    blockchainTests('calculateMatchedFillResultsWithMaximalFill', async () => {
        /**
         * Asserts that the results of calling `calculateMatchedFillResults()` is consistent with the results that are expected.
         */
        async function assertCalculateMatchedFillResultsWithMaximalFillAsync(
            expectedMatchedFillResults: MatchedFillResults,
            leftOrder: Order,
            rightOrder: Order,
            leftOrderTakerAssetFilledAmount: BigNumber,
            rightOrderTakerAssetFilledAmount: BigNumber,
            protocolFeeMultiplier: BigNumber,
            gasPrice: BigNumber,
            from?: string,
        ): Promise<void> {
            const rawResult = await libsContract
                .calculateMatchedFillResults(
                    leftOrder,
                    rightOrder,
                    leftOrderTakerAssetFilledAmount,
                    rightOrderTakerAssetFilledAmount,
                    protocolFeeMultiplier,
                    gasPrice,
                    true,
                );
            
            // Convert Result objects to plain objects for comparison
            const actualMatchedFillResults = {
                left: {
                    makerAssetFilledAmount: BigInt(rawResult[0][0].toString()),
                    takerAssetFilledAmount: BigInt(rawResult[0][1].toString()),
                    makerFeePaid: BigInt(rawResult[0][2].toString()),
                    takerFeePaid: BigInt(rawResult[0][3].toString()),
                    protocolFeePaid: BigInt(rawResult[0][4].toString()),
                },
                right: {
                    makerAssetFilledAmount: BigInt(rawResult[1][0].toString()),
                    takerAssetFilledAmount: BigInt(rawResult[1][1].toString()),
                    makerFeePaid: BigInt(rawResult[1][2].toString()),
                    takerFeePaid: BigInt(rawResult[1][3].toString()),
                    protocolFeePaid: BigInt(rawResult[1][4].toString()),
                },
                profitInLeftMakerAsset: BigInt(rawResult[2].toString()),
                profitInRightMakerAsset: BigInt(rawResult[3].toString()),
            };
            
            expect(actualMatchedFillResults).to.be.deep.eq(expectedMatchedFillResults);
        }

        const ORDER_DEFAULTS = {
            ...constants.STATIC_ORDER_PARAMS,
            makerAddress: randomAddress(),
            takerAddress: randomAddress(),
            senderAddress: randomAddress(),
            makerAssetData: randomAssetData(),
            takerAssetData: randomAssetData(),
            makerFeeAssetData: randomAssetData(),
            takerFeeAssetData: randomAssetData(),
            feeRecipientAddress: randomAddress(),
            expirationTimeSeconds: randomUint256(),
            salt: randomUint256(),
            exchangeAddress: constants.NULL_ADDRESS,
            chainId: 1337, // The chain id for the isolated exchange
        };

        function makeOrder(details?: Partial<Order>): Order {
            return _.assign({}, ORDER_DEFAULTS, details);
        }

        before(async () => {
            ORDER_DEFAULTS.exchangeAddress = libsContract.address;
        });

        it('should transfer correct amounts when right order is fully filled', async () => {
            const leftOrder = makeOrder({
                makerAddress: makerAddressLeft,
                makerAssetAmount: ethers.parseUnits(String(17), 0),
                takerAssetAmount: ethers.parseUnits(String(98), 0),
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(75), 0),
                takerAssetAmount: ethers.parseUnits(String(13), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(13), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(75), 0),
                    makerFeePaid: ethers.parseUnits('76.4705882352941176', 16), // 76.47%
                    takerFeePaid: ethers.parseUnits('76.5306122448979591', 16), // 76.53%
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(75), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(13), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                150000n,
                100000n,
            );
        });

        it('Should transfer correct amounts when left order is fully filled', async () => {
            const leftOrder = makeOrder({
                makerAddress: makerAddressLeft,
                makerAssetAmount: ethers.parseUnits(String(15), 0),
                takerAssetAmount: ethers.parseUnits(String(90), 0),
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(196), 0),
                takerAssetAmount: ethers.parseUnits(String(28), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(15), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(90), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(105), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(15), 0),
                    makerFeePaid: ethers.parseUnits('53.5714285714285714', 16), // 53.57%
                    takerFeePaid: ethers.parseUnits('53.5714285714285714', 16), // 53.57%
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: constants.ZERO_AMOUNT,
                profitInRightMakerAsset: ethers.parseUnits(String(15), 0),
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                150000n,
                100000n,
            );
        });

        it('Should transfer correct amounts when left order is fully filled', async () => {
            const leftOrder = makeOrder({
                makerAddress: makerAddressLeft,
                makerAssetAmount: ethers.parseUnits(String(16), 0),
                takerAssetAmount: ethers.parseUnits(String(22), 0),
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(87), 0),
                takerAssetAmount: ethers.parseUnits(String(48), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(16), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(22), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(29), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(16), 0),
                    makerFeePaid: ethers.parseUnits('33.3333333333333333', 16), // 33.33%
                    takerFeePaid: ethers.parseUnits('33.3333333333333333', 16), // 33.33%
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: constants.ZERO_AMOUNT,
                profitInRightMakerAsset: ethers.parseUnits(String(7), 0),
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('should fully fill both orders and pay out profit in both maker assets', async () => {
            const leftOrder = makeOrder({
                makerAddress: makerAddressLeft,
                makerAssetAmount: ethers.parseUnits(String(7), 0),
                takerAssetAmount: ethers.parseUnits(String(4), 0),
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(8), 0),
                takerAssetAmount: ethers.parseUnits(String(6), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(7), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(4), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(8), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(6), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: ethers.parseUnits(String(1), 0),
                profitInRightMakerAsset: ethers.parseUnits(String(4), 0),
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('Should give left maker a better sell price when rounding', async () => {
            const leftOrder = makeOrder({
                makerAddress: makerAddressLeft,
                makerAssetAmount: ethers.parseUnits(String(12), 0),
                takerAssetAmount: ethers.parseUnits(String(97), 0),
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(89), 0),
                takerAssetAmount: ethers.parseUnits(String(1), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(11), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(89), 0),
                    makerFeePaid: ethers.parseUnits('91.6666666666666666', 16), // 91.6%
                    takerFeePaid: ethers.parseUnits('91.7525773195876288', 16), // 91.75%
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(89), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(1), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: ethers.parseUnits(String(10), 0),
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('Should give right maker and right taker a favorable fee price when rounding', async () => {
            const leftOrder = makeOrder({
                makerAddress: makerAddressLeft,
                makerAssetAmount: ethers.parseUnits(String(16), 0),
                takerAssetAmount: ethers.parseUnits(String(22), 0),
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(87), 0),
                takerAssetAmount: ethers.parseUnits(String(48), 0),
                makerFee: ethers.parseUnits(String(10000), 0),
                takerFee: ethers.parseUnits(String(10000), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(16), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(22), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(29), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(16), 0),
                    makerFeePaid: ethers.parseUnits(String(3333), 0),
                    takerFeePaid: ethers.parseUnits(String(3333), 0),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInRightMakerAsset: ethers.parseUnits(String(7), 0),
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('Should give left maker and left taker a favorable fee price when rounding', async () => {
            const leftOrder = makeOrder({
                makerAddress: makerAddressLeft,
                makerAssetAmount: ethers.parseUnits(String(12), 0),
                takerAssetAmount: ethers.parseUnits(String(97), 0),
                makerFee: ethers.parseUnits(String(10000), 0),
                takerFee: ethers.parseUnits(String(10000), 0),
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(89), 0),
                takerAssetAmount: ethers.parseUnits(String(1), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(11), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(89), 0),
                    makerFeePaid: ethers.parseUnits(String(9166), 0),
                    takerFeePaid: ethers.parseUnits(String(9175), 0),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(89), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(1), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInLeftMakerAsset: ethers.parseUnits(String(10), 0),
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('should transfer the correct amounts when consecutive calls are used to completely fill the left order', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(50), 18),
                takerAssetAmount: ethers.parseUnits(String(100), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
            });
            const expectedMatchedFillResults = {
                ...COMMON_MATCHED_FILL_RESULTS,
                left: {
                    ...COMMON_MATCHED_FILL_RESULTS.left,
                    makerFeePaid: ethers.parseUnits(String(10), 16),
                    takerFeePaid: ethers.parseUnits(String(10), 16),
                },
            };
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
            );
            const rightOrder2 = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(100), 18),
                takerAssetAmount: ethers.parseUnits(String(50), 18),
            });
            const expectedMatchedFillResults2 = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(45), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(90), 18),
                    makerFeePaid: ethers.parseUnits(String(90), 16),
                    takerFeePaid: ethers.parseUnits(String(90), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(90), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(45), 18),
                    makerFeePaid: ethers.parseUnits(String(90), 16),
                    takerFeePaid: ethers.parseUnits(String(90), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults2,
                leftOrder,
                rightOrder2,
                ethers.parseUnits(String(10), 18),
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('Should transfer correct amounts when right order fill amount deviates from amount derived by `Exchange.fillOrder`', async () => {
            const leftOrder = makeOrder({
                makerAddress: makerAddressLeft,
                makerAssetAmount: ethers.parseUnits(String(1000), 0),
                takerAssetAmount: ethers.parseUnits(String(1005), 0),
            });
            const rightOrder = makeOrder({
                makerAddress: makerAddressRight,
                makerAssetAmount: ethers.parseUnits(String(2126), 0),
                takerAssetAmount: ethers.parseUnits(String(1063), 0),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(1000), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(1005), 0),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(2000), 0),
                    takerAssetFilledAmount: ethers.parseUnits(String(1000), 0),
                    makerFeePaid: ethers.parseUnits('94.0733772342427093', 16), // 94.07%
                    takerFeePaid: ethers.parseUnits('94.0733772342427093', 16), // 94.07%
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInRightMakerAsset: ethers.parseUnits(String(995), 0),
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('should transfer the correct amounts when orders completely fill each other and taker doesnt take a profit', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(5), 18),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(5), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(10), 18),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(10), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(5), 18),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('should transfer the correct amounts when consecutive calls are used to completely fill the right order', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
            });

            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(50), 18),
                takerAssetAmount: ethers.parseUnits(String(100), 18),
            });
            const expectedMatchedFillResults = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(10), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(2), 18),
                    makerFeePaid: ethers.parseUnits(String(100), 16),
                    takerFeePaid: ethers.parseUnits(String(100), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(5), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(10), 18),
                    makerFeePaid: ethers.parseUnits(String(10), 16),
                    takerFeePaid: ethers.parseUnits(String(10), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                profitInRightMakerAsset: ethers.parseUnits(String(3), 18),
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
            // Create second left order
            // Note: This order needs makerAssetAmount=96/takerAssetAmount=48 to fully fill the right order.
            //       However, we use 100/50 to ensure a partial fill as we want to go down the "right fill"
            //       branch in the contract twice for this test.
            const leftOrder2 = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(100), 18),
                takerAssetAmount: ethers.parseUnits(String(50), 18),
            });
            const expectedMatchedFillResults2 = createMatchedFillResults({
                left: {
                    makerAssetFilledAmount: ethers.parseUnits(String(90), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(45), 18),
                    makerFeePaid: ethers.parseUnits(String(90), 16),
                    takerFeePaid: ethers.parseUnits(String(90), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
                right: {
                    makerAssetFilledAmount: ethers.parseUnits(String(45), 18),
                    takerAssetFilledAmount: ethers.parseUnits(String(90), 18),
                    makerFeePaid: ethers.parseUnits(String(90), 16),
                    takerFeePaid: ethers.parseUnits(String(90), 16),
                    protocolFeePaid: ethers.parseUnits(String(15), 9),
                },
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                expectedMatchedFillResults2,
                leftOrder2,
                rightOrder,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(10), 18),
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 5),
            );
        });

        it('should transfer the correct amounts if fee recipient is the same across both matched orders', async () => {
            const feeRecipientAddress = randomAddress();
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
                feeRecipientAddress,
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
                feeRecipientAddress,
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
            );
        });

        it('should transfer the correct amounts if taker == leftMaker', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
                leftOrder.makerAddress,
            );
        });

        it('should transfer the correct amounts if taker == rightMaker', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
                rightOrder.makerAddress,
            );
        });

        it('should transfer the correct amounts if taker == leftFeeRecipient', async () => {
            const feeRecipientAddress = randomAddress();
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
                feeRecipientAddress,
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
                feeRecipientAddress,
            );
        });

        it('should transfer the correct amounts if taker == rightFeeRecipient', async () => {
            const feeRecipientAddress = randomAddress();
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
                feeRecipientAddress,
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
                feeRecipientAddress,
            );
        });

        it('should transfer the correct amounts if leftMaker == leftFeeRecipient && rightMaker == rightFeeRecipient', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
                feeRecipientAddress: makerAddressLeft,
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
                feeRecipientAddress: makerAddressRight,
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
            );
        });

        it('should transfer the correct amounts if leftMaker == leftFeeRecipient && leftMakerFeeAsset == leftTakerAsset', async () => {
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
            });
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
                makerFeeAssetData: rightOrder.makerAssetData,
                feeRecipientAddress: makerAddressLeft,
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
            );
        });

        it('should transfer the correct amounts if rightMaker == rightFeeRecipient && rightMakerFeeAsset == rightTakerAsset', async () => {
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
                makerFeeAssetData: leftOrder.makerAssetData,
                feeRecipientAddress: makerAddressRight,
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
            );
        });

        it('should transfer the correct amounts if rightMaker == rightFeeRecipient && rightTakerAsset == rightMakerFeeAsset && leftMaker == leftFeeRecipient && leftTakerAsset == leftMakerFeeAsset', async () => {
            const makerFeeAssetData = randomAssetData();
            const leftOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(5), 18),
                takerAssetAmount: ethers.parseUnits(String(10), 18),
                makerFeeAssetData,
                feeRecipientAddress: makerAddressLeft,
            });
            const rightOrder = makeOrder({
                makerAssetAmount: ethers.parseUnits(String(10), 18),
                takerAssetAmount: ethers.parseUnits(String(2), 18),
                makerFeeAssetData: leftOrder.makerAssetData,
                feeRecipientAddress: makerAddressRight,
            });
            await assertCalculateMatchedFillResultsWithMaximalFillAsync(
                COMMON_MATCHED_FILL_RESULTS,
                leftOrder,
                rightOrder,
                constants.ZERO_AMOUNT,
                constants.ZERO_AMOUNT,
                ethers.parseUnits(String(15), 4),
                ethers.parseUnits(String(1), 0),
            );
        });
    });
});
// tslint:disable-line:max-file-line-count
