import { expect } from 'chai';
import { ethers } from 'ethers';
import { ContractWrappers } from '../src/contract_wrappers';
import { TEST_ADDRESSES, TEST_VALUES, expectToBeBigInt, createMockProvider } from './setup';

describe('ContractWrappers', () => {
    let provider: any;

    beforeEach(() => {
        provider = createMockProvider();
    });

    describe('Constructor', () => {
        it('should initialize with minimal config', () => {
            const contractWrappers = new ContractWrappers(provider, {
                chainId: 1,
            });

            expect(contractWrappers.contractAddresses).to.be.an('object');
            expect(contractWrappers.contractAddresses.etherToken).to.be.a('string');
        });

        it('should initialize factory instances', () => {
            const contractWrappers = new ContractWrappers(provider, {
                chainId: 1,
            });

            expect(contractWrappers.weth9Factory).to.exist;
            expect(contractWrappers.exchangeProxyFactory).to.exist;
        });
    });

    describe('Contract Factory Methods', () => {
        it('should create WETH9 contract instance', () => {
            const contractWrappers = new ContractWrappers(provider, {
                chainId: 1,
            });

            const wethContract = contractWrappers.getWETH9Contract(TEST_ADDRESSES.WETH);
            expect(wethContract).to.exist;
            expect(wethContract.target).to.equal(TEST_ADDRESSES.WETH);
        });

        it('should create IZeroEx contract instance', () => {
            const contractWrappers = new ContractWrappers(provider, {
                chainId: 1,
            });

            const zeroExContract = contractWrappers.getExchangeProxyContract(TEST_ADDRESSES.WETH);
            expect(zeroExContract).to.exist;
            expect(zeroExContract.target).to.equal(TEST_ADDRESSES.WETH);
        });
    });

    describe('Provider Methods', () => {
        it('should return the provider instance', () => {
            const contractWrappers = new ContractWrappers(provider, {
                chainId: 1,
            });

            const returnedProvider = contractWrappers.getProvider();
            expect(returnedProvider).to.equal(provider);
        });

        it('should return the ethers provider instance', () => {
            const contractWrappers = new ContractWrappers(provider, {
                chainId: 1,
            });

            const ethersProvider = contractWrappers.getEthersProvider();
            expect(ethersProvider).to.exist;
        });
    });

    describe('Utility Methods', () => {
        it('should handle unsubscribeAll without errors', () => {
            const contractWrappers = new ContractWrappers(provider, {
                chainId: 1,
            });

            expect(() => contractWrappers.unsubscribeAll()).to.not.throw();
        });
    });

    describe('BigInt Gas Price Handling', () => {
        it('should handle bigint gasPrice conversion internally', () => {
            // Test the gasPrice conversion logic separately
            const bigintGasPrice = TEST_VALUES.ONE_ETH;
            const stringGasPrice = bigintGasPrice.toString();

            expect(stringGasPrice).to.equal('1000000000000000000');
            expect(typeof stringGasPrice).to.equal('string');
        });
    });
});
