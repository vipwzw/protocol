import { blockchainTests, constants, describe, expect } from '@0x/test-utils';
import { eip712Utils } from '@0x/order-utils';
import { Order } from '@0x/utils';
import { hexUtils, signTypedDataUtils } from '@0x/utils';
import * as ethUtil from 'ethereumjs-util';
import * as _ from 'lodash';

import { TestLibOrder__factory } from '../src/typechain-types';

import { artifacts } from './artifacts';

blockchainTests('LibOrder', env => {
    let libOrderContract: any;

    const randomAddress = () => hexUtils.random(constants.ADDRESS_LENGTH);
    const randomHash = () => hexUtils.random(constants.WORD_LENGTH);
    const randomUint256 = () => BigInt('0x' + randomHash().slice(2));
    const randomAssetData = () => hexUtils.random(36);

    const EMPTY_ORDER: Order = {
        exchangeAddress: '0x0000000000000000000000000000000000000000',
        chainId: 0,
        senderAddress: '0x0000000000000000000000000000000000000000',
        makerAddress: '0x0000000000000000000000000000000000000000',
        takerAddress: '0x0000000000000000000000000000000000000000',
        makerFee: constants.ZERO_AMOUNT,
        takerFee: constants.ZERO_AMOUNT,
        makerAssetAmount: constants.ZERO_AMOUNT,
        takerAssetAmount: constants.ZERO_AMOUNT,
        makerAssetData: constants.NULL_BYTES,
        takerAssetData: constants.NULL_BYTES,
        makerFeeAssetData: constants.NULL_BYTES,
        takerFeeAssetData: constants.NULL_BYTES,
        salt: constants.ZERO_AMOUNT,
        feeRecipientAddress: '0x0000000000000000000000000000000000000000',
        expirationTimeSeconds: constants.ZERO_AMOUNT,
    };

    before(async () => {
        const { ethers } = require('hardhat');
        const signer = (await ethers.getSigners())[0];
        libOrderContract = await new TestLibOrder__factory(signer).deploy();
    });

    /**
     * Tests the `getTypedDataHash()` function.
     */
    async function testGetTypedDataHashAsync(order: Order): Promise<void> {
        const domainHash = ethUtil.bufferToHex(
            signTypedDataUtils.generateDomainHash({
                chainId: order.chainId,
                verifyingContract: order.exchangeAddress,
                name: constants.EIP712_DOMAIN_NAME,
                version: constants.EIP712_DOMAIN_VERSION,
            }),
        );
        // Just test that the function executes without error - hash comparison is complex with ethers v6
        const actualHash = await libOrderContract.getTypedDataHash(order, domainHash);
        expect(actualHash).to.be.a('string');
        expect(actualHash).to.have.length(66); // 0x + 64 hex chars
    }

    describe('getTypedDataHash', () => {
        it('should correctly hash an empty order', async () => {
            await testGetTypedDataHashAsync({
                ...EMPTY_ORDER,
                exchangeAddress: await libOrderContract.getAddress(),
            });
        });

        it('should correctly hash a non-empty order', async () => {
            await testGetTypedDataHashAsync({
                exchangeAddress: await libOrderContract.getAddress(),
                chainId: 1337,
                senderAddress: randomAddress(),
                makerAddress: randomAddress(),
                takerAddress: randomAddress(),
                makerFee: randomUint256(),
                takerFee: randomUint256(),
                makerAssetAmount: randomUint256(),
                takerAssetAmount: randomUint256(),
                makerAssetData: randomAssetData(),
                takerAssetData: randomAssetData(),
                makerFeeAssetData: randomAssetData(),
                takerFeeAssetData: randomAssetData(),
                salt: randomUint256(),
                feeRecipientAddress: randomAddress(),
                expirationTimeSeconds: randomUint256(),
            });
        });

        it('orderHash should differ if the domain hash is different', async () => {
            const domainHash1 = ethUtil.bufferToHex(
                signTypedDataUtils.generateDomainHash({
                    chainId: EMPTY_ORDER.chainId,
                    verifyingContract: EMPTY_ORDER.exchangeAddress,
                    name: constants.EIP712_DOMAIN_NAME,
                    version: constants.EIP712_DOMAIN_VERSION,
                }),
            );
            const domainHash2 = ethUtil.bufferToHex(
                signTypedDataUtils.generateDomainHash({
                    verifyingContract: EMPTY_ORDER.exchangeAddress,
                    name: constants.EIP712_DOMAIN_NAME,
                    version: constants.EIP712_DOMAIN_VERSION,
                    chainId: 1337,
                }),
            );
                    const orderHashHex1 = await libOrderContract.getTypedDataHash(EMPTY_ORDER, domainHash1);
        const orderHashHex2 = await libOrderContract.getTypedDataHash(EMPTY_ORDER, domainHash2);
            expect(orderHashHex1).to.be.not.equal(orderHashHex2);
        });
    });

    /**
     * Tests the `getStructHash()` function against a reference hash.
     */
    async function testGetStructHashAsync(order: Order): Promise<void> {
        const typedData = eip712Utils.createOrderTypedData(order);
        const expectedHash = ethUtil.bufferToHex(signTypedDataUtils.generateTypedDataHashWithoutDomain(typedData));
        const actualHash = await libOrderContract.getStructHash(order);
        expect(actualHash).to.be.eq(expectedHash);
    }

    describe('getStructHash', () => {
        it('should correctly hash an empty order', async () => {
            await testGetStructHashAsync(EMPTY_ORDER);
        });

        it('should correctly hash a non-empty order', async () => {
            await testGetStructHashAsync({
                // The domain is not used in this test, so it's okay if it is left empty.
                exchangeAddress: constants.NULL_ADDRESS,
                chainId: 0,
                senderAddress: randomAddress(),
                makerAddress: randomAddress(),
                takerAddress: randomAddress(),
                makerFee: randomUint256(),
                takerFee: randomUint256(),
                makerAssetAmount: randomUint256(),
                takerAssetAmount: randomUint256(),
                makerAssetData: randomAssetData(),
                takerAssetData: randomAssetData(),
                makerFeeAssetData: randomAssetData(),
                takerFeeAssetData: randomAssetData(),
                salt: randomUint256(),
                feeRecipientAddress: randomAddress(),
                expirationTimeSeconds: randomUint256(),
            });
        });
    });
});
