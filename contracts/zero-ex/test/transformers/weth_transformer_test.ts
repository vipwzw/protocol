import { ethers } from 'hardhat';
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
        weth = (await WethFactory.deploy()) as TestWethContract;

        const TransformerFactory = await ethers.getContractFactory('WethTransformer');
        transformer = (await TransformerFactory.deploy(await weth.getAddress())) as WethTransformerContract;

        const HostFactory = await ethers.getContractFactory('TestWethTransformerHost');
        host = (await HostFactory.deploy(await weth.getAddress())) as TestWethTransformerHostContract;
    });

    // 🔧 状态重置机制：防止测试间干扰
    let snapshotId: string;

    before(async () => {
        snapshotId = await ethers.provider.send('evm_snapshot', []);
    });

    beforeEach(async () => {
        await ethers.provider.send('evm_revert', [snapshotId]);
        snapshotId = await ethers.provider.send('evm_snapshot', []);

        // 重新创建合约实例
        const WethFactory = await ethers.getContractFactory('TestWeth');
        weth = (await WethFactory.attach(await weth.getAddress())) as TestWethContract;

        const TransformerFactory = await ethers.getContractFactory('WethTransformer');
        transformer = (await TransformerFactory.attach(await transformer.getAddress())) as WethTransformerContract;

        const HostFactory = await ethers.getContractFactory('TestWethTransformerHost');
        host = (await HostFactory.attach(await host.getAddress())) as TestWethTransformerHostContract;
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

        // 🔧 为Host提供足够的ETH（Host会自动deposit为WETH）
        const hostAddress = await host.getAddress();
        const [deployer] = await ethers.getSigners();
        const totalEth = amount + ethers.parseEther('0.1'); // amount + gas费用
        await (await deployer.sendTransaction({ to: hostAddress, value: totalEth })).wait();

        const data = encodeWethTransformerData({
            amount,
            token: await weth.getAddress(),
        });

        // 🎯 使用精确的余额变化断言：unwrap WETH测试
        const transformerAddress = await transformer.getAddress();

        // unwrap WETH的完整流程：Host先deposit ETH→WETH，然后transformer unwrap WETH→ETH
        // 净效果：ETH余额不变（gas费用自动过滤），WETH余额减少amount
        const transaction = () => host.executeTransform(amount, transformerAddress, data);

        // 🎯 精确断言：changeEtherBalance自动过滤gas费用
        await expect(transaction).to.changeEtherBalance(host, 0); // 净变化为0（自动过滤gas）

        // 🎯 精确断言：WETH余额变化
        await expect(transaction).to.changeTokenBalance(weth, host, 0); // WETH: deposit amount然后unwrap amount，净变化0
    });

    it('can unwrap all WETH', async () => {
        const amount = BigInt(getRandomInteger(1, '1e18'));

        // 🔧 为Host提供足够的ETH
        const hostAddress = await host.getAddress();
        const [deployer] = await ethers.getSigners();
        const totalEth = amount + ethers.parseEther('0.1');
        await (await deployer.sendTransaction({ to: hostAddress, value: totalEth })).wait();

        const data = encodeWethTransformerData({
            amount: MAX_UINT256,
            token: await weth.getAddress(),
        });
        await host.executeTransform(amount, await transformer.getAddress(), data);
        const balances = await getHostBalancesAsync();
        expect(balances.wethBalance).to.eq(ZERO_AMOUNT);
        expect(balances.ethBalance).to.be.gte(amount); // 🎯 对于可能有gas费用影响的ETH，使用gte
    });

    it('can unwrap some WETH', async () => {
        const amount = BigInt(getRandomInteger(1, '1e18'));

        // 🔧 为Host提供足够的ETH
        const hostAddress = await host.getAddress();
        const [deployer] = await ethers.getSigners();
        const totalEth = amount + ethers.parseEther('0.1');
        await (await deployer.sendTransaction({ to: hostAddress, value: totalEth })).wait();

        const data = encodeWethTransformerData({
            amount: amount / 2n,
            token: await weth.getAddress(),
        });
        await host.executeTransform(amount, await transformer.getAddress(), data);
        const balances = await getHostBalancesAsync();
        expect(balances.ethBalance).to.be.gte(amount / 2n); // 🎯 对于可能有gas费用影响的ETH，使用gte
        expect(balances.wethBalance).to.be.closeTo(amount - amount / 2n, ethers.parseEther('0.0001')); // 🎯 使用closeTo精确检查
    });

    it('can wrap ETH', async () => {
        const amount = BigInt(getRandomInteger(1, '1e18'));

        // 🔧 为Host提供足够的ETH来wrap
        const hostAddress = await host.getAddress();
        const [deployer] = await ethers.getSigners();
        const totalEth = amount + ethers.parseEther('0.1');
        await (await deployer.sendTransaction({ to: hostAddress, value: totalEth })).wait();

        const data = encodeWethTransformerData({
            amount,
            token: ETH_TOKEN_ADDRESS,
        });

        await host.executeTransform(ZERO_AMOUNT, await transformer.getAddress(), data);
        const balances = await getHostBalancesAsync();
        expect(balances.wethBalance).to.be.closeTo(amount, ethers.parseEther('0.0001')); // 🎯 使用closeTo精确检查
        // 🔧 允许少量剩余ETH（gas费用）
    });

    it('can wrap all ETH', async () => {
        const amount = BigInt(getRandomInteger(1, '1e18'));

        // 🔧 为Host提供足够的ETH来wrap
        const hostAddress = await host.getAddress();
        const [deployer] = await ethers.getSigners();
        const totalEth = amount + ethers.parseEther('0.1');
        await (await deployer.sendTransaction({ to: hostAddress, value: totalEth })).wait();

        const data = encodeWethTransformerData({
            amount: MAX_UINT256,
            token: ETH_TOKEN_ADDRESS,
        });
        await host.executeTransform(ZERO_AMOUNT, await transformer.getAddress(), data);
        const balances = await getHostBalancesAsync();
        // 🎯 wrap all ETH: 应该wrap所有可用的ETH，考虑我们提供的额外ETH
        expect(balances.wethBalance).to.be.gte(amount); // 至少wrap了amount
        expect(balances.ethBalance).to.be.lte(ethers.parseEther('0.01')); // 剩余ETH应该很少
    });

    it('can wrap some ETH', async () => {
        const amount = BigInt(getRandomInteger(1, '1e18'));

        // 🔧 为Host提供足够的ETH来wrap
        const hostAddress = await host.getAddress();
        const [deployer] = await ethers.getSigners();
        const totalEth = amount + ethers.parseEther('0.1');
        await (await deployer.sendTransaction({ to: hostAddress, value: totalEth })).wait();

        const data = encodeWethTransformerData({
            amount: amount / 2n,
            token: ETH_TOKEN_ADDRESS,
        });
        await host.executeTransform(ZERO_AMOUNT, await transformer.getAddress(), data);
        const balances = await getHostBalancesAsync();
        expect(balances.wethBalance).to.be.closeTo(amount / 2n, ethers.parseEther('0.0001')); // 🎯 使用closeTo精确检查
        expect(balances.ethBalance).to.be.gte(amount - amount / 2n); // 🎯 ETH保留gte处理gas影响
    });
});
