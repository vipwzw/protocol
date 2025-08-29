import { ethers } from "hardhat";
import { constants, getRandomInteger, randomAddress, ZeroExRevertErrors } from '@0x/utils';
import { encodeWethTransformerData, ETH_TOKEN_ADDRESS } from '@0x/protocol-utils';
import { expect } from 'chai';
import * as _ from 'lodash';

import { artifacts } from '../artifacts';
import { TestWethContract, TestWethTransformerHostContract, WethTransformerContract } from '../wrappers';

const { MAX_UINT256, ZERO_AMOUNT } = constants;

describe('WethTransformer', () => {
    const env = {
        provider: ethers.provider,
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
    };

    let weth: TestWethContract;
    let transformer: WethTransformerContract;
    let host: TestWethTransformerHostContract;

    before(async () => {
        const WethFactory = await ethers.getContractFactory('TestWeth');
        weth = await WethFactory.deploy() as TestWethContract;
        
        const TransformerFactory = await ethers.getContractFactory('WethTransformer');
        transformer = await TransformerFactory.deploy(await weth.getAddress()) as WethTransformerContract;
        
        const HostFactory = await ethers.getContractFactory('TestWethTransformerHost');
        host = await HostFactory.deploy(await weth.getAddress()) as TestWethTransformerHostContract;
    });

    interface Balances {
        ethBalance: bigint;
        wethBalance: bigint;
    }

    async function getHostBalancesAsync(): Promise<Balances> {
        return {
            ethBalance: await ethers.provider.getBalance(await host.getAddress()),
            wethBalance: await weth.balanceOf(await host.getAddress()),
        };
    }

    it('fails if the token is neither ETH or WETH', async () => {
        const amount = BigInt(getRandomInteger(1, '1e18'));
        const data = encodeWethTransformerData({
            amount,
            token: randomAddress(),
        });
        const tx = host.executeTransform(amount, await transformer.getAddress(), data);
        return expect(tx).to.be.rejected;
    });

    it('can unwrap WETH', async () => {
        const amount = BigInt(getRandomInteger(1, '1e18'));
        const data = encodeWethTransformerData({
            amount,
            token: await weth.getAddress(),
        });
        await host.executeTransform(amount, await transformer.getAddress(), data);
        expect(await getHostBalancesAsync()).to.deep.eq({
            ethBalance: amount,
            wethBalance: ZERO_AMOUNT,
        });
    });

    it('can unwrap all WETH', async () => {
        const amount = BigInt(getRandomInteger(1, '1e18'));
        const data = encodeWethTransformerData({
            amount: MAX_UINT256,
            token: await weth.getAddress(),
        });
        await host.executeTransform(amount, await transformer.getAddress(), data);
        expect(await getHostBalancesAsync()).to.deep.eq({
            ethBalance: amount,
            wethBalance: ZERO_AMOUNT,
        });
    });

    it('can unwrap some WETH', async () => {
        const amount = BigInt(getRandomInteger(1, '1e18'));
        const data = encodeWethTransformerData({
            amount: amount / 2n,
            token: await weth.getAddress(),
        });
        await host.executeTransform(amount, await transformer.getAddress(), data);
        expect(await getHostBalancesAsync()).to.deep.eq({
            ethBalance: amount / 2n,
            wethBalance: amount - (amount / 2n),
        });
    });

    it('can wrap ETH', async () => {
        const amount = BigInt(getRandomInteger(1, '1e18'));
        const data = encodeWethTransformerData({
            amount,
            token: ETH_TOKEN_ADDRESS,
        });
        await host.executeTransform(ZERO_AMOUNT, await transformer.getAddress(), data);
        expect(await getHostBalancesAsync()).to.deep.eq({
            ethBalance: ZERO_AMOUNT,
            wethBalance: amount,
        });
    });

    it('can wrap all ETH', async () => {
        const amount = BigInt(getRandomInteger(1, '1e18'));
        const data = encodeWethTransformerData({
            amount: MAX_UINT256,
            token: ETH_TOKEN_ADDRESS,
        });
        await host.executeTransform(ZERO_AMOUNT, await transformer.getAddress(), data);
        expect(await getHostBalancesAsync()).to.deep.eq({
            ethBalance: ZERO_AMOUNT,
            wethBalance: amount,
        });
    });

    it('can wrap some ETH', async () => {
        const amount = BigInt(getRandomInteger(1, '1e18'));
        const data = encodeWethTransformerData({
            amount: amount / 2n,
            token: ETH_TOKEN_ADDRESS,
        });
        await host.executeTransform(ZERO_AMOUNT, await transformer.getAddress(), data);
        expect(await getHostBalancesAsync()).to.deep.eq({
            ethBalance: amount - (amount / 2n),
            wethBalance: amount / 2n,
        });
    });
});
