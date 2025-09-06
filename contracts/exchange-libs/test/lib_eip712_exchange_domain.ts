import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as ethUtil from 'ethereumjs-util';

import { TestLibEIP712ExchangeDomain__factory } from '../src/typechain-types';

import { artifacts } from './artifacts';

// 本地常量和工具函数
const constants = {
    NULL_ADDRESS: '0x0000000000000000000000000000000000000000',
    EIP712_DOMAIN_NAME: '0x Protocol',
    EIP712_DOMAIN_VERSION: '3.0.0',
};

const randomAddress = (): string => {
    return ethers.Wallet.createRandom().address;
};

// 简化的 signTypedDataUtils 功能
const signTypedDataUtils = {
    generateDomainHash: (domain: any): Buffer => {
        const domainData = {
            name: domain.name,
            version: domain.version,
            chainId: domain.chainId,
            verifyingContract: domain.verifyingContract,
        };
        const domainHash = ethers.TypedDataEncoder.hashDomain(domainData);
        return Buffer.from(domainHash.slice(2), 'hex');
    },
};

describe('LibEIP712ExchangeDomain', () => {
    describe('constructor', () => {
        it('should calculate the correct domain hash when verifyingContractAddressIfExists is set to null', async () => {
            const chainId = 1;
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
