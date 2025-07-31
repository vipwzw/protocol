import { blockchainTests, constants, expect, randomAddress } from '@0x/test-utils';
import { BigNumber, signTypedDataUtils } from '@0x/utils';
import * as ethUtil from 'ethereumjs-util';

import { TestLibEIP712ExchangeDomain__factory } from '../src/typechain-types';

import { artifacts } from './artifacts';

blockchainTests('LibEIP712ExchangeDomain', env => {
    describe('constructor', () => {
        it('should calculate the correct domain hash when verifyingContractAddressIfExists is set to null', async () => {
            const chainId = 1;
            const { ethers } = require('hardhat');
            const signer = (await ethers.getSigners())[0];
            const libEIP712ExchangeDomainContract = await new TestLibEIP712ExchangeDomain__factory(signer).deploy(
                chainId,
                constants.NULL_ADDRESS,
            );
            const domain = {
                verifyingContract: await libEIP712ExchangeDomainContract.getAddress(),
                chainId,
                name: constants.EIP712_DOMAIN_NAME,
                version: constants.EIP712_DOMAIN_VERSION,
            };
            const expectedDomainHash = ethUtil.bufferToHex(signTypedDataUtils.generateDomainHash(domain));
            const actualDomainHash = await libEIP712ExchangeDomainContract.getDomainHash();
            expect(actualDomainHash).to.be.equal(expectedDomainHash);
        });
        it('should calculate the correct domain hash when verifyingContractAddressIfExists is set to a non-null address', async () => {
            const chainId = 1;
            const verifyingContract = randomAddress();
            const { ethers } = require('hardhat');
            const signer = (await ethers.getSigners())[0];
            const libEIP712ExchangeDomainContract = await new TestLibEIP712ExchangeDomain__factory(signer).deploy(
                chainId,
                verifyingContract,
            );
            const domain = {
                verifyingContract,
                chainId,
                name: constants.EIP712_DOMAIN_NAME,
                version: constants.EIP712_DOMAIN_VERSION,
            };
            const expectedDomainHash = ethUtil.bufferToHex(signTypedDataUtils.generateDomainHash(domain));
            const actualDomainHash = await libEIP712ExchangeDomainContract.getDomainHash();
            expect(actualDomainHash).to.be.equal(expectedDomainHash);
        });
    });
});
