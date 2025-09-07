import { chaiSetup } from './chai_setup';
import { web3Factory } from './web3_factory';
import { JsonRpcProvider } from 'ethers';

import { expect } from 'chai';
import * as ethjs from 'ethereumjs-util';

import { MetaTransaction } from '../src/meta_transactions';
import { SignatureType } from '../src/signature_utils';

chaiSetup.configure();

describe('meta_transactions', () => {
    let provider: any;
    let providerMaker: string;
    const key = '0xee094b79aa0315914955f2f09be9abe541dcdc51f0aae5bec5453e9f73a471a6';
    const keyMaker = ethjs.bufferToHex(ethjs.privateToAddress(ethjs.toBuffer(key)));

    before(async () => {
        provider = web3Factory.getRpcProvider();
        // Use a test address from Hardhat's default accounts
        providerMaker = '0x5409ED021D9299bf6814279A6A1411A7e866A631';
    });

    describe('MetaTransaction', () => {
        const mtx = new MetaTransaction({
            signer: '0x349e8d89e8b37214d9ce3949fc5754152c525bc3',
            sender: '0x83c62b2e67dea0df2a27be0def7a22bd7102642c',
            minGasPrice: 1234n,
            maxGasPrice: 5678n,
            expirationTimeSeconds: 9101112n,
            salt: 2001n,
            callData: '0x12345678',
            value: 1001n,
            feeToken: '0xcc3c7ea403427154ec908203ba6c418bd699f7ce',
            feeAmount: 9101112n,
            chainId: 8008,
            verifyingContract: '0x6701704d2421c64ee9aa93ec7f96ede81c4be77d',
        });

        it('can get the struct hash', () => {
            const actual = mtx.getStructHash();
            const expected = '0x164b8bfaed3718d233d4cc87501d0d8fa0a72ed7deeb8e591524133f17867180';
            expect(actual).to.eq(expected);
        });

        it('can get the EIP712 hash', () => {
            const actual = mtx.getHash();
            const expected = '0x068f2f98836e489070608461768bfd3331128787d09278d38869c2b56bfc34a4';
            expect(actual).to.eq(expected);
        });

        it('can get an EthSign signature with a provider', async () => {
            const actual = await mtx.clone({ signer: providerMaker }).getSignatureWithProviderAsync(provider);
            const expected = {
                signatureType: SignatureType.EthSign,
                r: '0xbb831776a2d6639d4e4d1641f158773ce202881bac74dddb2672d5ff5521ef5c',
                s: '0x746a61ccfdfee3afae15f4a3bd67ded2ce555d89d482940a844eeffaede2ee8a',
                v: 27,
            };
            expect(actual).to.deep.eq(expected);
        });

        it('can get an EthSign signature with a private key', () => {
            const actual = mtx.clone({ signer: keyMaker }).getSignatureWithKey(key);
            const expected = {
                signatureType: SignatureType.EthSign,
                r: '0xbf19b5ef62df8c8315727087e9d8562e3b88d32452ac8193e3ed9f5354a220ef',
                s: '0x512387e81b2c03e4bc4cf72ee5293c86498c17fde3ae89f18dd0705076a7f472',
                v: 28,
            };
            expect(actual).to.deep.eq(expected);
        });

        it('can get an EIP712 signature with a private key', () => {
            const actual = mtx.clone({ signer: keyMaker }).getSignatureWithKey(key, SignatureType.EIP712);
            const expected = {
                signatureType: SignatureType.EIP712,
                r: '0x050c6b80a3fafa1b816fdfd646f3e90862a21d3fbf3ed675eaf9c89e092ec405',
                s: '0x179600bd412820233598628b85b58f1e9f6da4555421f45266ec2ebf94153d1d',
                v: 27,
            };
            expect(actual).to.deep.eq(expected);
        });
    });
});
