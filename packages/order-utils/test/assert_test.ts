import * as chai from 'chai';
import 'mocha';

import { assert } from '../src/assert';

import { chaiSetup } from './utils/chai_setup';
import { web3Wrapper } from './utils/web3_wrapper';

chaiSetup.configure();
const expect = chai.expect;

describe('Assertion library', () => {
    describe('#isSenderAddressHexAsync', () => {
        it('throws when address is invalid', async () => {
            const address = '0xdeadbeef';
            const varName = 'address';
            try {
                await assert.isSenderAddressAsync(varName, address, web3Wrapper as any);
                expect.fail('Expected function to throw');
            } catch (error) {
                expect((error as Error).message).to.include(`Expected ${varName} to be of type ETHAddressHex, encountered: ${address}`);
            }
        });
        it('throws when address is unavailable', async () => {
            const validUnrelatedAddress = '0x8b0292b11a196601eddce54b665cafeca0347d42';
            const varName = 'address';
            
            try {
                await assert.isSenderAddressAsync(varName, validUnrelatedAddress, web3Wrapper as any);
                expect.fail('Expected function to throw');
            } catch (error) {
                expect((error as Error).message).to.include(`isn't available through the supplied web3 provider`);
            }
        });
        it("doesn't throw if address is available", async () => {
            // 使用 Hardhat 测试账户中的第一个地址
            const accounts = await web3Wrapper.getAccountsAsync();
            const availableAddress = accounts[0]; // 应该是 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
            const varName = 'address';
            // 应该不抛出错误
            const result = await assert.isSenderAddressAsync(varName, availableAddress, web3Wrapper as any);
            expect(result).to.be.undefined;
        });
    });
});
