import { expect } from 'chai';
import 'mocha';
import { BaseContract, Contract } from '../src/index';

// Test that we properly re-export Ethers v6 Contract as BaseContract

describe('BaseContract Exports', () => {
    describe('Re-exports', () => {
        it('should export BaseContract as an alias to Contract', () => {
            expect(BaseContract).to.equal(Contract);
        });

        it('should export Contract', () => {
            expect(Contract).to.be.a('function');
        });

        it('BaseContract should be the same as Ethers Contract', () => {
            // BaseContract should reference the same constructor as ethers Contract
            expect(BaseContract.name).to.equal('Contract');
        });
    });
});
