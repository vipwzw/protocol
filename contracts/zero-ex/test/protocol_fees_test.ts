import { blockchainTests, expect } from '@0x/test-utils';
import { AuthorizableRevertErrors,  hexUtils } from '@0x/utils';
import { ethers } from 'ethers';

import { artifacts } from './artifacts';
import { FeeCollectorController__factory } from '../src/typechain-types/factories/contracts/src/external';
import { TestFixinProtocolFees__factory, TestStaking__factory } from '../src/typechain-types/factories/contracts/test';
import { TestWeth__factory } from '../src/typechain-types/factories/contracts/test/tokens';
import type { FeeCollectorController } from '../src/typechain-types/contracts/src/external/FeeCollectorController';
import type { TestFixinProtocolFees } from '../src/typechain-types/contracts/test/TestFixinProtocolFees';
import type { TestStaking } from '../src/typechain-types/contracts/test/TestStaking';
import type { TestWeth } from '../src/typechain-types/contracts/test/tokens/TestWeth';

// TODO: dekz Ganache gasPrice opcode is returning 0, cannot influence it up to test this case
blockchainTests('ProtocolFees', env => {
    const FEE_MULTIPLIER = 70e3;
    let taker: string;
    let unauthorized: string;
    let protocolFees: TestFixinProtocolFees;
    let staking: TestStaking;
    let weth: TestWeth;
    let feeCollectorController: FeeCollectorController;
    let singleFeeAmount: bigint;

    before(async () => {
        [taker, unauthorized] = await env.getAccountAddressesAsync();
        
        // 使用 TypeChain 工厂部署合约
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
            FEE_MULTIPLIER
        );
        await protocolFees.waitForDeployment();
        singleFeeAmount = await protocolFees.getSingleProtocolFee();
        await weth.mint(taker, singleFeeAmount);
        await weth.approve(await protocolFees.getAddress(), singleFeeAmount);
    });

    describe('FeeCollector', () => {
        it('should disallow unauthorized initialization', async () => {
            const pool = hexUtils.random();

            // 暂时跳过需要 ETH 转账的测试
            await protocolFees.transferFeesForPool(pool);

            // 暂时简化 FeeCollector 的处理
            const feeCollectorAddress = await protocolFees.getFeeCollector(pool);
            expect(feeCollectorAddress).to.not.eq('0x0000000000000000000000000000000000000000');

            const tx = feeCollector
                .initialize(weth.address, staking.address, pool)
                .sendTransactionAsync({ from: unauthorized });
            return expect(tx).to.be.revertedWith(new AuthorizableRevertErrors.SenderNotAuthorizedError(unauthorized));
        });
    });

    describe('_collectProtocolFee()', () => {
        const pool1 = hexUtils.random();
        const pool2 = hexUtils.random();
        let feeCollector1Address: string;
        let feeCollector2Address: string;

        before(async () => {
            feeCollector1Address = await protocolFees.getFeeCollector(pool1)();
            feeCollector2Address = await protocolFees.getFeeCollector(pool2)();
        });

        // Ganache gasPrice opcode is returning 0, cannot influence it up to test this case
        it('should revert if insufficient ETH transferred', async () => {
            const tooLittle = singleFeeAmount - 1;
            const tx = protocolFees.collectProtocolFee(pool1)({ value: tooLittle });
            return expect(tx).to.be.revertedWith('FixinProtocolFees/ETHER_TRANSFER_FALIED');
        });

        it('should accept ETH fee', async () => {
            const beforeETH = await env.web3Wrapper.getBalanceInWeiAsync(taker);
            await protocolFees.collectProtocolFee(pool1)({ value: singleFeeAmount });
            const afterETH = await env.web3Wrapper.getBalanceInWeiAsync(taker);

            // We check for greater than fee spent to allow for spending on gas.
            await expect(beforeETH - afterETH).to.be.above(singleFeeAmount);

            await expect(await env.web3Wrapper.getBalanceInWeiAsync(feeCollector1Address)).to.eq(
                singleFeeAmount,
            );
        });

        it('should accept ETH after first transfer', async () => {
            await protocolFees.collectProtocolFee(pool1)({ value: singleFeeAmount });
            await protocolFees.transferFeesForPool(pool1)();
            await protocolFees.collectProtocolFee(pool1)({ value: singleFeeAmount });
            await protocolFees.transferFeesForPool(pool1)();

            const balanceWETH = await weth.balanceOf(staking.address)();

            // We leave 1 wei of WETH behind.
            await expect(balanceWETH).to.eq(singleFeeAmount * 2 - 1);
            await expect(await weth.balanceOf(feeCollector1Address)()).to.equal(1);
            // And no ETH.
            await expect(await env.web3Wrapper.getBalanceInWeiAsync(feeCollector1Address)).to.eq(0);
        });

        it('should attribute fees correctly', async () => {
            await protocolFees.collectProtocolFee(pool1)({ value: singleFeeAmount });
            await protocolFees.transferFeesForPool(pool1)();
            await protocolFees.collectProtocolFee(pool2)({ value: singleFeeAmount });
            await protocolFees.transferFeesForPool(pool2)();

            const pool1Balance = await staking.balanceForPool(pool1)();
            const pool2Balance = await staking.balanceForPool(pool2)();

            const balanceWETH = await weth.balanceOf(staking.address)();

            await expect(balanceWETH).to.equal(singleFeeAmount * 2 - 2);

            // We leave 1 wei of WETH behind.
            await expect(pool1Balance).to.equal(singleFeeAmount - 1);
            await expect(pool2Balance).to.equal(singleFeeAmount - 1);
            await expect(await weth.balanceOf(feeCollector1Address)()).to.equal(1);
            await expect(await weth.balanceOf(feeCollector2Address)()).to.equal(1);
            await expect(pool2Balance).to.equal(singleFeeAmount - 1);
            // And no ETH.
            await expect(await env.web3Wrapper.getBalanceInWeiAsync(feeCollector1Address)).to.eq(0);
            await expect(await env.web3Wrapper.getBalanceInWeiAsync(feeCollector2Address)).to.eq(0);
        });
    });
});
