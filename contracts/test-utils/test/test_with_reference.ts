import { AnyRevertError, StringRevertError } from '@0x/utils';

import { expect } from '../src/chai_setup';

import { testWithReferenceFuncAsync } from '../src/test_with_reference';

async function divAsync(x: number, y: number): Promise<number> {
    if (y === 0) {
        throw new Error('MathError: divide by zero');
    }
    return x / y;
}

// returns an async function that always returns the given value.
function alwaysValueFunc(value: number): (x: number, y: number) => Promise<number> {
    return async (x: number, y: number) => value;
}

// returns an async function which always throws/rejects with the given error.
function alwaysFailFunc(error: Error): (x: number, y: number) => Promise<number> {
    return async (x: number, y: number) => {
        throw error;
    };
}

describe('testWithReferenceFuncAsync', () => {
    it('passes when both succeed and actual == expected', async () => {
        return testWithReferenceFuncAsync(alwaysValueFunc(0.5), divAsync, [1, 2]);
    });

    it('fails when both succeed and actual != expected', async () => {
        try {
            await testWithReferenceFuncAsync(alwaysValueFunc(3), divAsync, [1, 2]);
            expect.fail('Expected testWithReferenceFuncAsync to throw');
        } catch (err: any) {
            expect(err.message).to.include('expected 0.5 to deeply equal 3');
        }
    });

    it('passes when both fail and error messages are the same', async () => {
        const errMessage = 'woopsie';
        return testWithReferenceFuncAsync(alwaysFailFunc(new Error(errMessage)), alwaysFailFunc(new Error(errMessage)), [1, 2]);
    });

    it('fails when both fail and error messages are not identical', async () => {
        const referenceErr = new Error('woopsie');
        const testErr = new Error('not identical');
        try {
            await testWithReferenceFuncAsync(alwaysFailFunc(referenceErr), alwaysFailFunc(testErr), [1, 2]);
            expect.fail('Expected testWithReferenceFuncAsync to throw');
        } catch (err: any) {
            expect(err.message).to.include(`expected error message`);
        }
    });

    it('passes when both fail with compatible RevertErrors', async () => {
        const revertError = new StringRevertError('whoopsie');
        return testWithReferenceFuncAsync(alwaysFailFunc(revertError), alwaysFailFunc(revertError), [1, 2]);
    });

    it('fails when both fail with incompatible RevertErrors', async () => {
        const referenceErr = new StringRevertError('whoopsie');
        const testErr = new StringRevertError('different');
        try {
            await testWithReferenceFuncAsync(alwaysFailFunc(referenceErr), alwaysFailFunc(testErr), [1, 2]);
            expect.fail('Expected testWithReferenceFuncAsync to throw');
        } catch (err: any) {
            expect(err.message).to.include('expected error');
        }
    });

    it('fails when reference function fails with a RevertError but test function fails with a regular Error', async () => {
        const referenceErr = new StringRevertError('whoopsie');
        const testErr = new Error('not a revert error');
        try {
            await testWithReferenceFuncAsync(alwaysFailFunc(referenceErr), alwaysFailFunc(testErr), [1, 2]);
            expect.fail('Expected testWithReferenceFuncAsync to throw');
        } catch (err: any) {
            expect(err.message).to.include('expected a RevertError but received an Error');
        }
    });

    it('fails when referenceFunc succeeds and testFunc fails', async () => {
        try {
            await testWithReferenceFuncAsync(alwaysValueFunc(0.5), alwaysFailFunc(new Error('moop')), [1, 2]);
            expect.fail('Expected testWithReferenceFuncAsync to throw');
        } catch (err: any) {
            expect(err.message).to.include('expected success but instead failed');
        }
    });

    it('fails when referenceFunc fails and testFunc succeeds', async () => {
        try {
            await testWithReferenceFuncAsync(alwaysFailFunc(new Error('moop')), alwaysValueFunc(0.5), [1, 2]);
            expect.fail('Expected testWithReferenceFuncAsync to throw');
        } catch (err: any) {
            expect(err.message).to.include('expected failure but instead succeeded');
        }
    });
});
