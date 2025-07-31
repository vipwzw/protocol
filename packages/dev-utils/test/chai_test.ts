import { StringRevertError } from '@0x/utils';
import { expect } from 'chai';
import 'mocha';

import { chaiSetup } from '../src';

chaiSetup.configure();

describe('Chai tests', () => {
    describe('RevertErrors', () => {
        describe('#revertWith', () => {
            it('should work with promises that reject with RevertError', async () => {
                const message = 'test error';
                const revertError = new StringRevertError(message);
                const promise = (async () => {
                    throw revertError;
                })();
                
                return expect(promise).to.revertWith(message);
            });

            it('should work with promises that reject with string messages', async () => {
                const message = 'test error message';
                const promise = (async () => {
                    throw new Error(message);
                })();
                
                return expect(promise).to.revertWith(message);
            });

            it('should fail when promise does not reject', async () => {
                const promise = (async () => {
                    return 'success';
                })();
                
                try {
                    await expect(promise).to.revertWith('any message');
                    throw new Error('Should have failed');
                } catch (error: any) {
                    expect(error.message).to.include('Expected transaction to revert');
                }
            });

            it('should fail when reject message does not match', async () => {
                const promise = (async () => {
                    throw new Error('actual error');
                })();
                
                try {
                    await expect(promise).to.revertWith('expected error');
                    throw new Error('Should have failed');
                } catch (error: any) {
                    expect(error.message).to.include('Expected revert with message');
                }
            });
        });

        describe('Basic RevertError functionality', () => {
            it('should create StringRevertError with message', () => {
                const message = 'test error';
                const revertError = new StringRevertError(message);
                // Check the actual message value in the values object
                expect(revertError.values.message).to.equal(message);
                // The .message property returns a formatted string
                expect(revertError.message).to.equal(`StringRevertError({ message: '${message}' })`);
                expect(revertError.toString()).to.equal(`StringRevertError({ message: '${message}' })`);
                expect(revertError).to.be.instanceOf(StringRevertError);
            });

            it('should create StringRevertError without message', () => {
                const revertError = new StringRevertError();
                expect(revertError.message).to.be.a('string');
                expect(revertError.message).to.equal('StringRevertError()');
                expect(revertError.values.message).to.be.undefined;
            });

            it('should handle RevertError types correctly', () => {
                const revertError = new StringRevertError('test');
                expect(revertError).to.be.instanceOf(StringRevertError);
                expect(revertError).to.be.instanceOf(Error);
                expect(revertError.name).to.equal('Error');
                expect(revertError.signature).to.equal('Error(string)');
            });

            it('should support equals comparison', () => {
                const message = 'same message';
                const error1 = new StringRevertError(message);
                const error2 = new StringRevertError(message);
                const error3 = new StringRevertError('different message');
                
                expect(error1.equals(error2)).to.be.true;
                expect(error1.equals(error3)).to.be.false;
            });
        });
    });

    describe('Basic Chai functionality', () => {
        it('should work with standard assertions', () => {
            expect(true).to.be.true;
            expect(false).to.be.false;
            expect(42).to.equal(42);
            expect('hello').to.equal('hello');
        });

        it('should work with promise assertions', async () => {
            const promise = Promise.resolve(42);
            await expect(promise).to.eventually.equal(42);
        });

        it('should work with array assertions', () => {
            const arr = [1, 2, 3];
            expect(arr).to.have.length(3);
            expect(arr).to.include(2);
        });
    });
});