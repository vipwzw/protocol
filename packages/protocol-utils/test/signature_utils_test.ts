import { chaiSetup } from './chai_setup';
import { web3Factory, Web3Wrapper } from './web3_factory';
import { Web3ProviderEngine } from '@0x/subproviders';
import { expect } from 'chai';

import {
    ecSignHashWithKey,
    eip712SignHashWithKey,
    ethSignHashWithKey,
    ethSignHashWithProviderAsync,
    SignatureType,
} from '../src/signature_utils';

chaiSetup.configure();

describe('signature_utils', () => {
    let provider: Web3ProviderEngine;
    let signer: string;
    const hash = '0x38a8da1ec749de4220312ce7fa62aaf01a6e8c1342cbce81278ae7c8885c2475';
    const key = '0xee094b79aa0315914955f2f09be9abe541dcdc51f0aae5bec5453e9f73a471a6';

    before(async () => {
        provider = web3Factory.getRpcProvider();
        [signer] = await new Web3Wrapper(provider).getAvailableAddressesAsync();
    });

    describe('ethSignHashWithProviderAsync()', () => {
        it('can sign a hash', async () => {
            const actual = await ethSignHashWithProviderAsync(hash, signer, provider);
            const expected = {
                signatureType: SignatureType.EthSign,
                r: '0xb88b49ba6418464f9b1e703ea0fbba5f9d72576a4d9819e45d4ede7a34afbe73',
                s: '0x6c81693f439942eb8c6ac943fab6b9fcc4b48615fcedcede93298f6dc3087ead',
                v: 28,
            };
            expect(actual).to.deep.eq(expected);
        });
    });

    describe('ethSignHashWithKey()', () => {
        it('can sign a hash', async () => {
            const actual = ethSignHashWithKey(hash, key);
            const expected = {
                signatureType: SignatureType.EthSign,
                r: '0xb88b49ba6418464f9b1e703ea0fbba5f9d72576a4d9819e45d4ede7a34afbe73',
                s: '0x6c81693f439942eb8c6ac943fab6b9fcc4b48615fcedcede93298f6dc3087ead',
                v: 28,
            };
            expect(actual).to.deep.eq(expected);
        });
    });

    describe('eip712SignHashWithKey()', () => {
        it('can sign a hash', async () => {
            const actual = eip712SignHashWithKey(hash, key);
            const expected = {
                signatureType: SignatureType.EIP712,
                r: '0x1a01dba0f97d151f696f689e618a8ef6c4e7610a71c2607e18b0d96c741b3e8d',
                s: '0x28fd463b90fd20cf17f16ab6831d712e9bce29619db1bef6e7802318d1de09ed',
                v: 27,
            };
            expect(actual).to.deep.eq(expected);
        });
    });

    describe('ecSignHashWithKey()', () => {
        it('can sign a hash', async () => {
            const actual = ecSignHashWithKey(hash, key);
            const expected = {
                r: '0x1a01dba0f97d151f696f689e618a8ef6c4e7610a71c2607e18b0d96c741b3e8d',
                s: '0x28fd463b90fd20cf17f16ab6831d712e9bce29619db1bef6e7802318d1de09ed',
                v: 27,
            };
            expect(actual).to.deep.eq(expected);
        });
    });
});
