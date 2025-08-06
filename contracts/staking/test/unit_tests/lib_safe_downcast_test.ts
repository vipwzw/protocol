import { blockchainTests, expect, Numberish } from '../test_utils';

// SafeMathRevertErrors replacement - simple error classes
export class SafeMathRevertErrors {
    static Uint256Overflow(): Error {
        return new Error('SafeMath: uint256 overflow');
    }
    
    static Uint256Underflow(): Error {
        return new Error('SafeMath: uint256 underflow');
    }
    
    static DowncastErrorCodes = {
        ValueTooLargeToDowncastToUint96: 0,
        ValueTooLargeToDowncastToUint64: 1,
    };
    
    static Uint256DowncastError = class extends Error {
        constructor(errorCode: number, value: bigint) {
            super(`SafeMath: downcast error ${errorCode} for value ${value}`);
            this.name = 'Uint256DowncastError';
        }
    };
}

import { artifacts } from '../artifacts';
import { TestLibSafeDowncastContract } from '../wrappers';

blockchainTests('LibSafeDowncast unit tests', env => {
    let testContract: TestLibSafeDowncastContract;

    before(async () => {
        testContract = await TestLibSafeDowncastContract.deployFrom0xArtifactAsync(
            artifacts.TestLibSafeDowncast,
            env.provider,
            env.txDefaults,
            artifacts,
        );
    });

    const MAX_UINT_64 = (2n ** 64n) - 1n;
    const MAX_UINT_96 = (2n ** 96n) - 1n;
    const MAX_UINT_256 = (2n ** 256n) - 1n;

    describe('downcastToUint96', () => {
        async function verifyCorrectDowncastAsync(n: Numberish): Promise<void> {
            const actual = await testContract.downcastToUint96(BigInt(n)).callAsync();
            expect(Number(actual)).to.equal(Number(n));
        }
        function toDowncastError(n: Numberish): SafeMathRevertErrors.Uint256DowncastError {
            return new SafeMathRevertErrors.Uint256DowncastError(
                SafeMathRevertErrors.DowncastErrorCodes.ValueTooLargeToDowncastToUint96,
                BigInt(n),
            );
        }

        it('correctly downcasts 0', async () => {
            return verifyCorrectDowncastAsync(0);
        });
        it('correctly downcasts 1337', async () => {
            return verifyCorrectDowncastAsync(1337);
        });
        it('correctly downcasts MAX_UINT_96', async () => {
            return verifyCorrectDowncastAsync(MAX_UINT_96);
        });
        it('reverts on MAX_UINT_96 + 1', async () => {
            const n = MAX_UINT_96 + 1n;
            return expect(verifyCorrectDowncastAsync(n)).to.be.revertedWith(toDowncastError(n).message);
        });
        it('reverts on MAX_UINT_256', async () => {
            const n = MAX_UINT_256;
            return expect(verifyCorrectDowncastAsync(n)).to.be.revertedWith(toDowncastError(n).message);
        });
    });

    describe('downcastToUint64', () => {
        async function verifyCorrectDowncastAsync(n: Numberish): Promise<void> {
            const actual = await testContract.downcastToUint64(BigInt(n)).callAsync();
            expect(Number(actual)).to.equal(Number(n));
        }
        function toDowncastError(n: Numberish): SafeMathRevertErrors.Uint256DowncastError {
            return new SafeMathRevertErrors.Uint256DowncastError(
                SafeMathRevertErrors.DowncastErrorCodes.ValueTooLargeToDowncastToUint64,
                BigInt(n),
            );
        }

        it('correctly downcasts 0', async () => {
            return verifyCorrectDowncastAsync(0);
        });
        it('correctly downcasts 1337', async () => {
            return verifyCorrectDowncastAsync(1337);
        });
        it('correctly downcasts MAX_UINT_64', async () => {
            return verifyCorrectDowncastAsync(MAX_UINT_64);
        });
        it('reverts on MAX_UINT_64 + 1', async () => {
            const n = MAX_UINT_64 + 1n;
            return expect(verifyCorrectDowncastAsync(n)).to.be.revertedWith(toDowncastError(n).message);
        });
        it('reverts on MAX_UINT_256', async () => {
            const n = MAX_UINT_256;
            return expect(verifyCorrectDowncastAsync(n)).to.be.revertedWith(toDowncastError(n).message);
        });
    });
});
