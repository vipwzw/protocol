import { blockchainTests, describe, expect } from '@0x/test-utils';
import { ethers } from 'ethers';

import { artifacts } from './artifacts';
import { getRandomLimitOrder, getRandomRfqOrder } from './utils/orders';
import { TestLibNativeOrder__factory } from '../src/typechain-types/factories/contracts/test';
import type { TestLibNativeOrder } from '../src/typechain-types/contracts/test/TestLibNativeOrder';

blockchainTests('LibLimitOrder tests', env => {
    let testContract: TestLibNativeOrder;

    before(async () => {
        // 使用测试环境中的 provider 和账户
        const accounts = await env.getAccountAddressesAsync();
        const signer = await env.provider.getSigner(accounts[0]);
        
        const factory = new TestLibNativeOrder__factory(signer);
        testContract = await factory.deploy();
        await testContract.waitForDeployment();
    });

    describe('getLimitOrderStructHash()', () => {
        it('returns the correct hash', async () => {
            const order = getRandomLimitOrder();
            
            // 转换订单字段为 ethers v6 兼容格式
            const orderStruct = {
                makerToken: order.makerToken,
                takerToken: order.takerToken,
                makerAmount: order.makerAmount.toString(),
                takerAmount: order.takerAmount.toString(),
                takerTokenFeeAmount: order.takerTokenFeeAmount.toString(),
                maker: order.maker,
                taker: order.taker,
                sender: order.sender,
                feeRecipient: order.feeRecipient,
                pool: order.pool,
                expiry: order.expiry.toString(),
                salt: order.salt.toString(),
            };
            
            const structHash = await testContract.getLimitOrderStructHash(orderStruct);
            expect(structHash).to.eq(order.getStructHash());
        });
    });

    describe('getRfqOrderStructHash()', () => {
        it('returns the correct hash', async () => {
            const order = getRandomRfqOrder();
            
            // 转换订单字段为 ethers v6 兼容格式
            const orderStruct = {
                makerToken: order.makerToken,
                takerToken: order.takerToken,
                makerAmount: order.makerAmount.toString(),
                takerAmount: order.takerAmount.toString(),
                maker: order.maker,
                taker: order.taker, // RFQ 订单的 taker 字段
                txOrigin: order.txOrigin,
                pool: order.pool,
                expiry: order.expiry.toString(),
                salt: order.salt.toString(),
            };
            
            const structHash = await testContract.getRfqOrderStructHash(orderStruct);
            expect(structHash).to.eq(order.getStructHash());
        });
    });
});
