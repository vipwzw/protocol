import { ethers } from "hardhat";
import { constants, getRandomInteger, randomAddress } from '@0x/utils';
import { encodePayTakerTransformerData, ETH_TOKEN_ADDRESS } from '@0x/protocol-utils';
import { expect } from 'chai';
import * as _ from 'lodash';

import { artifacts } from '../artifacts';
import { PayTakerTransformerContract, TestMintableERC20TokenContract, TestTransformerHostContract } from '../wrappers';

const { MAX_UINT256, ZERO_AMOUNT } = constants;

describe('PayTakerTransformer', () => {
    const env = {
        provider: ethers.provider,
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
    };
    
    const taker = randomAddress();
    let caller: string;
    let token: TestMintableERC20TokenContract;
    let transformer: PayTakerTransformerContract;
    let host: TestTransformerHostContract;

    before(async () => {
        [caller] = await env.getAccountAddressesAsync();
        
        const TokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        token = await TokenFactory.deploy() as TestMintableERC20TokenContract;
        
        const TransformerFactory = await ethers.getContractFactory('PayTakerTransformer');
        transformer = await TransformerFactory.deploy() as PayTakerTransformerContract;
        
        const HostFactory = await ethers.getContractFactory('TestTransformerHost');
        host = await HostFactory.deploy() as TestTransformerHostContract;
    });

    // 🔧 状态重置机制：防止测试间干扰
    let snapshotId: string;
    
    before(async () => {
        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });
    
    beforeEach(async () => {
        await ethers.provider.send("evm_revert", [snapshotId]);
        snapshotId = await ethers.provider.send("evm_snapshot", []);
        
        // 重新获取账户地址
        [caller] = await env.getAccountAddressesAsync();
        
        // 重新创建合约实例
        const TokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        token = await TokenFactory.attach(await token.getAddress()) as TestMintableERC20TokenContract;
        
        const TransformerFactory = await ethers.getContractFactory('PayTakerTransformer');
        transformer = await TransformerFactory.attach(await transformer.getAddress()) as PayTakerTransformerContract;
        
        const HostFactory = await ethers.getContractFactory('TestTransformerHost');
        host = await HostFactory.attach(await host.getAddress()) as TestTransformerHostContract;
    });

    interface Balances {
        ethBalance: bigint;
        tokenBalance: bigint;
    }

    const ZERO_BALANCES = {
        ethBalance: ZERO_AMOUNT,
        tokenBalance: ZERO_AMOUNT,
    };

    async function getBalancesAsync(owner: string): Promise<Balances> {
        return {
            ethBalance: await ethers.provider.getBalance(owner),
            tokenBalance: await token.balanceOf(owner),
        };
    }

    async function mintHostTokensAsync(amount: bigint): Promise<void> {
        await token.mint(await host.getAddress(), amount);
    }

    async function sendEtherAsync(to: string, amount: bigint): Promise<void> {
        const [signer] = await ethers.getSigners();
        await signer.sendTransaction({
            to,
            value: amount,
        });
    }

    it('can transfer a token and ETH', async () => {
        const amounts = [BigInt(getRandomInteger(1, '1e18')), BigInt(getRandomInteger(1, '1e18'))];
        const data = encodePayTakerTransformerData({
            amounts,
            tokens: [await token.getAddress(), ETH_TOKEN_ADDRESS],
        });
        await mintHostTokensAsync(amounts[0]);
        await sendEtherAsync(await host.getAddress(), amounts[1]);
        await host.rawExecuteTransform(await transformer.getAddress(), {
            data,
            recipient: taker,
            sender: randomAddress(),
        });
        
        // 🎯 使用精确的余额检查：分别验证ETH和代币余额
        const hostBalances = await getBalancesAsync(await host.getAddress());
        expect(hostBalances.ethBalance).to.be.closeTo(ZERO_BALANCES.ethBalance, ethers.parseEther('0.0001'));
        expect(hostBalances.tokenBalance).to.be.closeTo(ZERO_BALANCES.tokenBalance, 100n);
        
        const takerBalances = await getBalancesAsync(taker);
        expect(takerBalances.tokenBalance).to.be.closeTo(amounts[0], 100n);
        expect(takerBalances.ethBalance).to.be.closeTo(amounts[1], ethers.parseEther('0.0001'));
    });

    it('can transfer all of a token and ETH', async () => {
        const amounts = [BigInt(getRandomInteger(1, '1e18')), BigInt(getRandomInteger(1, '1e18'))];
        const data = encodePayTakerTransformerData({
            amounts: [MAX_UINT256, MAX_UINT256],
            tokens: [await token.getAddress(), ETH_TOKEN_ADDRESS],
        });
        await mintHostTokensAsync(amounts[0]);
        await sendEtherAsync(await host.getAddress(), amounts[1]);
        await host.rawExecuteTransform(await transformer.getAddress(), {
            data,
            recipient: taker,
            sender: randomAddress(),
        });
        // 🎯 使用精确的余额检查：分别验证ETH和代币余额
        const hostBalances = await getBalancesAsync(await host.getAddress());
        expect(hostBalances.ethBalance).to.be.closeTo(ZERO_BALANCES.ethBalance, ethers.parseEther('0.0001'));
        expect(hostBalances.tokenBalance).to.be.closeTo(ZERO_BALANCES.tokenBalance, 100n);
        
        const takerBalances = await getBalancesAsync(taker);
        expect(takerBalances.tokenBalance).to.be.closeTo(amounts[0], 100n);
        expect(takerBalances.ethBalance).to.be.closeTo(amounts[1], ethers.parseEther('0.0001'));
    });

    it('can transfer all of a token and ETH (empty amounts)', async () => {
        const amounts = [BigInt(getRandomInteger(1, '1e18')), BigInt(getRandomInteger(1, '1e18'))];
        const data = encodePayTakerTransformerData({
            amounts: [],
            tokens: [await token.getAddress(), ETH_TOKEN_ADDRESS],
        });
        await mintHostTokensAsync(amounts[0]);
        await sendEtherAsync(await host.getAddress(), amounts[1]);
        await host.rawExecuteTransform(await transformer.getAddress(), {
            data,
            recipient: taker,
            sender: randomAddress(),
        });
        // 🎯 使用精确的余额检查：分别验证ETH和代币余额
        const hostBalances = await getBalancesAsync(await host.getAddress());
        expect(hostBalances.ethBalance).to.be.closeTo(ZERO_BALANCES.ethBalance, ethers.parseEther('0.0001'));
        expect(hostBalances.tokenBalance).to.be.closeTo(ZERO_BALANCES.tokenBalance, 100n);
        
        const takerBalances = await getBalancesAsync(taker);
        expect(takerBalances.tokenBalance).to.be.closeTo(amounts[0], 100n);
        expect(takerBalances.ethBalance).to.be.closeTo(amounts[1], ethers.parseEther('0.0001'));
    });

    it('can transfer less than the balance of a token and ETH', async () => {
        const amounts = [BigInt(getRandomInteger(1, '1e18')), BigInt(getRandomInteger(1, '1e18'))];
        const data = encodePayTakerTransformerData({
            amounts: amounts.map(a => a / 2n),
            tokens: [await token.getAddress(), ETH_TOKEN_ADDRESS],
        });
        await mintHostTokensAsync(amounts[0]);
        await sendEtherAsync(await host.getAddress(), amounts[1]);
        await host.rawExecuteTransform(await transformer.getAddress(), {
            data,
            recipient: taker,
            sender: randomAddress(),
        });
        // 🎯 使用精确的余额检查：分别验证ETH和代币余额
        const hostBalances = await getBalancesAsync(await host.getAddress());
        expect(hostBalances.tokenBalance).to.be.closeTo(amounts[0] - (amounts[0] / 2n), 100n);
        expect(hostBalances.ethBalance).to.be.closeTo(amounts[1] - (amounts[1] / 2n), ethers.parseEther('0.0001'));
        
        const takerBalances = await getBalancesAsync(taker);
        expect(takerBalances.tokenBalance).to.be.closeTo(amounts[0] / 2n, 100n);
        expect(takerBalances.ethBalance).to.be.closeTo(amounts[1] / 2n, ethers.parseEther('0.0001'));
    });
});
