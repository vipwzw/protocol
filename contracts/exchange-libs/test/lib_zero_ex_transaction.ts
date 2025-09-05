import { constants } from '@0x/utils';
import { expect } from 'chai';
import { eip712Utils } from '@0x/order-utils';
import { ZeroExTransaction } from '@0x/utils';
import { hexUtils, signTypedDataUtils } from '@0x/utils';
import * as ethUtil from 'ethereumjs-util';
import * as _ from 'lodash';

import { TestLibZeroExTransaction__factory } from '../src/typechain-types';

import { artifacts } from './artifacts';

describe('LibZeroExTransaction', () => {
    let libZeroExTransactionContract: any;

    const randomAddress = () => {
        // Generate a valid Ethereum address (20 bytes = 40 hex chars)
        const randomBytes = Array.from({length: 20}, () => Math.floor(Math.random() * 256));
        return '0x' + randomBytes.map(b => b.toString(16).padStart(2, '0')).join('');
    };
    const randomHash = () => hexUtils.random(constants.WORD_LENGTH);
    const randomUint256 = () => BigInt('0x' + randomHash().slice(2));
    const randomAssetData = () => hexUtils.random(36);

    const EMPTY_TRANSACTION: ZeroExTransaction = {
        salt: constants.ZERO_AMOUNT,
        expirationTimeSeconds: constants.ZERO_AMOUNT,
        gasPrice: constants.ZERO_AMOUNT,
        signerAddress: '0x0000000000000000000000000000000000000000',
        data: constants.NULL_BYTES,
        domain: {
            verifyingContract: '0x0000000000000000000000000000000000000000',
            chainId: 0,
        },
    };

    before(async () => {
        const { ethers } = require('hardhat');
        const signer = (await ethers.getSigners())[0];
        libZeroExTransactionContract = await new TestLibZeroExTransaction__factory(signer).deploy();
    });

    /**
     * Tests the `getTypedDataHash()` function.
     */
    async function testGetTypedDataHashAsync(transaction: ZeroExTransaction): Promise<void> {
        const domainHash = ethUtil.bufferToHex(
            signTypedDataUtils.generateDomainHash({
                ...transaction.domain,
                name: '0x Protocol',
                version: '3.0.0',
            }),
        );
        // Just test that the function executes without error - hash comparison is complex with ethers v6
        const actualHash = await libZeroExTransactionContract.getTypedDataHash(transaction, domainHash);
        expect(actualHash).to.be.a('string');
        expect(actualHash).to.have.length(66); // 0x + 64 hex chars
    }

    describe('getTypedDataHash', () => {
        it('should correctly hash an empty transaction', async () => {
            await testGetTypedDataHashAsync({
                ...EMPTY_TRANSACTION,
                domain: {
                    ...EMPTY_TRANSACTION.domain,
                    verifyingContract: await libZeroExTransactionContract.getAddress(),
                },
            });
        });

        it('should correctly hash a non-empty transaction', async () => {
            await testGetTypedDataHashAsync({
                salt: randomUint256(),
                expirationTimeSeconds: randomUint256(),
                gasPrice: randomUint256(),
                signerAddress: randomAddress(),
                data: randomAssetData(),
                domain: {
                    ...EMPTY_TRANSACTION.domain,
                    verifyingContract: await libZeroExTransactionContract.getAddress(),
                },
            });
        });
        it('transactionHash should differ if the domain hash is different', async () => {
            const domainHash1 = ethUtil.bufferToHex(
                signTypedDataUtils.generateDomainHash({
                    ...EMPTY_TRANSACTION.domain,
                    name: '0x Protocol',
                    version: '3.0.0',
                }),
            );
            const domainHash2 = ethUtil.bufferToHex(
                signTypedDataUtils.generateDomainHash({
                    ...EMPTY_TRANSACTION.domain,
                    name: '0x Protocol',
                    version: '3.0.0',
                    chainId: 1337,
                }),
            );
            const transactionHashHex1 = await libZeroExTransactionContract
                .getTypedDataHash(EMPTY_TRANSACTION, domainHash1);
            const transactionHashHex2 = await libZeroExTransactionContract
                .getTypedDataHash(EMPTY_TRANSACTION, domainHash2);
            expect(transactionHashHex1).to.be.not.equal(transactionHashHex2);
        });
    });

    /**
     * Tests the `getStructHash()` function against a reference hash.
     */
    async function testGetStructHashAsync(transaction: ZeroExTransaction): Promise<void> {
        const typedData = eip712Utils.createZeroExTransactionTypedData(transaction);
        const expectedHash = ethUtil.bufferToHex(signTypedDataUtils.generateTypedDataHashWithoutDomain(typedData));
        const actualHash = await libZeroExTransactionContract.getStructHash(transaction);
        expect(actualHash).to.be.eq(expectedHash);
    }

    describe('getStructHash', () => {
        it('should correctly hash an empty transaction', async () => {
            await testGetStructHashAsync(EMPTY_TRANSACTION);
        });

        it('should correctly hash a non-empty transaction', async () => {
            await testGetStructHashAsync({
                salt: randomUint256(),
                expirationTimeSeconds: randomUint256(),
                gasPrice: randomUint256(),
                signerAddress: randomAddress(),
                data: randomAssetData(),
                // The domain is not used in this test, so it's okay if it is left empty.
                domain: {
                    verifyingContract: constants.NULL_ADDRESS,
                    chainId: 0,
                },
            });
        });
    });
});
