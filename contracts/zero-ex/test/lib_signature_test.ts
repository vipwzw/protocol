import { blockchainTests, expect } from '@0x/test-utils';
import { hexUtils } from '@0x/utils';
import * as ethjs from 'ethereumjs-util';
import { ethers } from 'ethers';

import { eip712SignHashWithKey, ethSignHashWithKey, RevertErrors, SignatureType } from '@0x/protocol-utils';

import { artifacts } from './artifacts';
import { TestLibSignature__factory } from '../src/typechain-types/factories/contracts/test';
import type { TestLibSignature } from '../src/typechain-types/contracts/test/TestLibSignature';

const EMPTY_REVERT = 'reverted with no data';

blockchainTests('LibSignature library', env => {
    let testLib: TestLibSignature;
    let signerKey: string;
    let signer: string;

    before(async () => {
        signerKey = hexUtils.random();
        signer = ethjs.bufferToHex(ethjs.privateToAddress(ethjs.toBuffer(signerKey)));
        
        // 使用测试环境中的 provider 和账户
        const accounts = await env.getAccountAddressesAsync();
        const ethersProvider = await env.provider.getSigner(accounts[0]);
        
        const factory = new TestLibSignature__factory(ethersProvider);
        testLib = await factory.deploy();
        await testLib.waitForDeployment();
    });

    describe('getSignerOfHash()', () => {
        it('can recover the signer of an EIP712 signature', async () => {
            const hash = hexUtils.random();
            const sig = eip712SignHashWithKey(hash, signerKey);
            const recovered = await testLib.getSignerOfHash(hash, sig);
            expect(recovered.toLowerCase()).to.eq(signer.toLowerCase());
        });

        it('can recover the signer of an EthSign signature', async () => {
            const hash = hexUtils.random();
            const sig = ethSignHashWithKey(hash, signerKey);
            const recovered = await testLib.getSignerOfHash(hash, sig);
            expect(recovered.toLowerCase()).to.eq(signer.toLowerCase());
        });

        it('throws if the signature type is out of range', async () => {
            const hash = hexUtils.random();
            const badType = (Object.values(SignatureType).slice(-1)[0] as number) + 1;
            const sig = {
                ...ethSignHashWithKey(hash, signerKey),
                signatureType: badType,
            };
            return expect(testLib.getSignerOfHash(hash, sig)).to.be.reverted;
        });

        it('throws if the signature data is malformed', async () => {
            const hash = hexUtils.random();
            const sig = {
                ...ethSignHashWithKey(hash, signerKey),
                v: 1,
            };
            return expect(testLib.getSignerOfHash(hash, sig)).to.be.reverted;
        });

        it('throws if an EC value is out of range', async () => {
            const hash = hexUtils.random();
            const sig = {
                ...ethSignHashWithKey(hash, signerKey),
                r: '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
            };
            return expect(testLib.getSignerOfHash(hash, sig)).to.be.reverted;
        });

        it('throws if the type is Illegal', async () => {
            const hash = hexUtils.random();
            const sig = {
                ...ethSignHashWithKey(hash, signerKey),
                signatureType: SignatureType.Illegal,
            };
            return expect(testLib.getSignerOfHash(hash, sig)).to.be.reverted;
        });

        it('throws if the type is Invalid', async () => {
            const hash = hexUtils.random();
            const sig = {
                ...ethSignHashWithKey(hash, signerKey),
                signatureType: SignatureType.Invalid,
            };
            return expect(testLib.getSignerOfHash(hash, sig)).to.be.reverted;
        });
    });
});
