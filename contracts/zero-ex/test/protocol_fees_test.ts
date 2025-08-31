import { expect } from 'chai';
import { AuthorizableRevertErrors,  hexUtils } from '@0x/utils';
import { ethers } from 'hardhat';

import { artifacts } from './artifacts';
import { FeeCollectorController__factory, FeeCollector__factory } from '../src/typechain-types/factories/contracts/src/external';
import { TestFixinProtocolFees__factory, TestStaking__factory } from '../src/typechain-types/factories/contracts/test';
import { TestWeth__factory } from '../src/typechain-types/factories/contracts/test/tokens';
import type { FeeCollectorController } from '../src/typechain-types/contracts/src/external/FeeCollectorController';
import type { TestFixinProtocolFees } from '../src/typechain-types/contracts/test/TestFixinProtocolFees';
import type { TestStaking } from '../src/typechain-types/contracts/test/TestStaking';
import type { TestWeth } from '../src/typechain-types/contracts/test/tokens/TestWeth';

// TODO: ganache 时代依赖 gasPrice=0 的用例已不再适用；改为显式基于当前 baseFee 计算有效 gas price
describe('ProtocolFees', () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
    } as any;
    let taker: string;
    let unauthorized: string;
    let protocolFees: TestFixinProtocolFees;
    let staking: TestStaking;
    let weth: TestWeth;
    let feeCollectorController: FeeCollectorController;
    let protocolFeeMultiplier: bigint;

    async function getEffectiveGasPriceAndParams() {
        const block = await env.provider.getBlock('latest');
        const base: bigint = BigInt(block.baseFeePerGas ?? 0);
        const priority: bigint = 2n;
        const effective = base + priority;
        return {
            effective,
            params: { maxFeePerGas: effective, maxPriorityFeePerGas: priority },
        } as const;
    }

    before(async () => {
        const accounts = await env.getAccountAddressesAsync();
        env.txDefaults.from = accounts[0];
        [taker, unauthorized] = await env.getAccountAddressesAsync();
        const signer = await env.provider.getSigner(taker);
        
        const wethFactory = new TestWeth__factory(signer);
        weth = await wethFactory.deploy();
        await weth.waitForDeployment();
        
        const stakingFactory = new TestStaking__factory(signer);
        staking = await stakingFactory.deploy(await weth.getAddress());
        await staking.waitForDeployment();
        
        const feeCollectorControllerFactory = new FeeCollectorController__factory(signer);
        feeCollectorController = await feeCollectorControllerFactory.deploy(
            await weth.getAddress(),
            await staking.getAddress()
        );
        await feeCollectorController.waitForDeployment();
        
        const protocolFeesFactory = new TestFixinProtocolFees__factory(signer);
        protocolFees = await protocolFeesFactory.deploy(
            await weth.getAddress(),
            await staking.getAddress(),
            await feeCollectorController.getAddress(),
            70_000
        );
        await protocolFees.waitForDeployment();

        // 读取乘数用于后续计算
        protocolFeeMultiplier = BigInt(await protocolFees.PROTOCOL_FEE_MULTIPLIER());

        // 预先大量铸造并授权 WETH（_transferFeesForPool 使用）
        await weth.mint(taker, 10_000000000000000000n);
        await weth.approve(await protocolFees.getAddress(), 10_000000000000000000n);
    });

    describe('FeeCollector', () => {
        it('should disallow unauthorized initialization', async () => {
            const pool = hexUtils.random();

            // 触发创建并初始化 FeeCollector
            await protocolFees.transferFeesForPool(pool);

            const feeCollectorAddress = await protocolFees.getFeeCollector(pool);
            expect(feeCollectorAddress).to.not.eq('0x0000000000000000000000000000000000000000');

            // 未授权账户尝试调用 FeeCollector.initialize，应当 revert
            const unauthorizedSigner = await env.provider.getSigner(unauthorized);
            const feeCollector = FeeCollector__factory.connect(feeCollectorAddress, unauthorizedSigner);
            const tx = feeCollector.initialize(await weth.getAddress(), await staking.getAddress(), pool);
            await expect(tx).to.be.reverted;
        });
    });

    describe('_collectProtocolFee()', () => {
        const pool1 = hexUtils.random();
        const pool2 = hexUtils.random();
        let feeCollector1Address: string;
        let feeCollector2Address: string;

        before(async () => {
            feeCollector1Address = await protocolFees.getFeeCollector(pool1);
            feeCollector2Address = await protocolFees.getFeeCollector(pool2);
        });

        it('should revert if insufficient ETH transferred', async () => {
            const { params } = await getEffectiveGasPriceAndParams();
            // 不提供任何 ETH，必然不足额
            const tx = protocolFees.collectProtocolFee(pool1, { value: 0n, ...params });
            return expect(tx).to.be.reverted; // 余额不足应当 revert
        });

        it('should accept ETH fee', async () => {
            const { params } = await getEffectiveGasPriceAndParams();
            const before = await env.provider.getBalance(feeCollector1Address);

            // 提供充足的 ETH（例如 1 ETH），确保可支付
            await protocolFees.collectProtocolFee(pool1, { value: ethers.parseEther('1'), ...params });

            const after = await env.provider.getBalance(feeCollector1Address);
            await expect(after - before).to.be.greaterThan(0n);
        });

        it('should accept ETH after first transfer', async () => {
            // 第一次：收取 -> 转移到 Staking（转换为 WETH）
            {
                const { effective, params } = await getEffectiveGasPriceAndParams();
                const expectedFee = protocolFeeMultiplier * effective;
                await protocolFees.collectProtocolFee(pool1, { value: expectedFee, ...params });
                await protocolFees.transferFeesForPool(pool1);
            }

            // 第二次：再次收取 -> 转移
            {
                const { effective, params } = await getEffectiveGasPriceAndParams();
                const expectedFee = protocolFeeMultiplier * effective;
                await protocolFees.collectProtocolFee(pool1, { value: expectedFee, ...params });
                await protocolFees.transferFeesForPool(pool1);
            }

            const stakingAddress = await staking.getAddress();
            const balanceWETH = await weth.balanceOf(stakingAddress);

            // 合约逻辑会在每次转移后在 FeeCollector 留 1 wei 的 WETH
            await expect(await weth.balanceOf(feeCollector1Address)).to.equal(1n);
            expect(await env.provider.getBalance(feeCollector1Address)).to.be.closeTo(0n, ethers.parseEther('0.0001')); // 🎯 使用closeTo检查
            await expect(balanceWETH).to.be.greaterThan(0n);
        });

        it('should attribute fees correctly', async () => {
            // pool1
            {
                const { effective, params } = await getEffectiveGasPriceAndParams();
                const expectedFee = protocolFeeMultiplier * effective;
                await protocolFees.collectProtocolFee(pool1, { value: expectedFee, ...params });
                await protocolFees.transferFeesForPool(pool1);
            }
            // pool2
            {
                const { effective, params } = await getEffectiveGasPriceAndParams();
                const expectedFee = protocolFeeMultiplier * effective;
                await protocolFees.collectProtocolFee(pool2, { value: expectedFee, ...params });
                await protocolFees.transferFeesForPool(pool2);
            }

            const stakingAddress = await staking.getAddress();
            const pool1Balance = await staking.balanceForPool(pool1);
            const pool2Balance = await staking.balanceForPool(pool2);
            const balanceWETH = await weth.balanceOf(stakingAddress);

            // 断言两个池都有入账，且 FeeCollector 各留 1 wei，ETH 余额为 0
            await expect(balanceWETH).to.be.greaterThan(0n);
            await expect(pool1Balance).to.be.greaterThan(0n);
            await expect(pool2Balance).to.be.greaterThan(0n);
            await expect(await weth.balanceOf(feeCollector1Address)).to.equal(1n);
            await expect(await weth.balanceOf(feeCollector2Address)).to.equal(1n);
            expect(await env.provider.getBalance(feeCollector1Address)).to.be.closeTo(0n, ethers.parseEther('0.0001')); // 🎯 使用closeTo检查
            expect(await env.provider.getBalance(feeCollector2Address)).to.be.closeTo(0n, ethers.parseEther('0.0001')); // 🎯 使用closeTo检查
        });
    });
});
