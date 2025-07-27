import { expect } from 'chai';
import '@nomicfoundation/hardhat-chai-matchers';
const { ethers } = require('hardhat');
import { Contract, MaxUint256 } from 'ethers';
import { randomBytes } from 'crypto';

describe('WethTransformer - Modern Tests', function() {
    // Extended timeout for transformer operations
    this.timeout(180000);
    
    let weth: any;
    let transformer: any;
    let host: any;
    
    const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const MAX_UINT256 = MaxUint256;
    const ZERO_AMOUNT = 0n;
    
    before(async function() {
        console.log('🚀 Setting up WethTransformer Test...');
        
        await deployContractsAsync();
        
        console.log('✅ WethTransformer test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying WethTransformer contracts...');
        
        // Deploy WETH
        const WethFactory = await ethers.getContractFactory('TestWeth');
        weth = await WethFactory.deploy();
        await weth.waitForDeployment();
        console.log(`✅ TestWeth: ${await weth.getAddress()}`);
        
        // Deploy WethTransformer
        const TransformerFactory = await ethers.getContractFactory('WethTransformer');
        transformer = await TransformerFactory.deploy(await weth.getAddress());
        await transformer.waitForDeployment();
        console.log(`✅ WethTransformer: ${await transformer.getAddress()}`);
        
        // Deploy TestWethTransformerHost
        const HostFactory = await ethers.getContractFactory('TestWethTransformerHost');
        host = await HostFactory.deploy(await weth.getAddress());
        await host.waitForDeployment();
        console.log(`✅ TestWethTransformerHost: ${await host.getAddress()}`);
    }

    function generateRandomAddress(): string {
        return '0x' + randomBytes(20).toString('hex');
    }

    function getRandomInteger(min: string, max: string): bigint {
        const minBig = ethers.parseEther(min);
        const maxBig = ethers.parseEther(max);
        const range = maxBig - minBig;
        const randomValue = BigInt(Math.floor(Math.random() * Number(range.toString())));
        return minBig + randomValue;
    }

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

    function encodeWethTransformerData(params: {
        amount: bigint;
        token: string;
    }): string {
        // Simplified encoding for test purposes
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        return abiCoder.encode(
            ['uint256', 'address'],
            [params.amount, params.token]
        );
    }

    it('fails if the token is neither ETH or WETH', async function() {
        const amount = getRandomInteger('1', '10');
        const invalidToken = generateRandomAddress();
        
        const data = encodeWethTransformerData({
            amount,
            token: invalidToken,
        });
        
        await expect(
            host.executeTransform(amount, await transformer.getAddress(), data, { value: amount })
        ).to.be.revertedWith('InvalidTransformDataError');
        
        console.log(`✅ Correctly rejected invalid token: ${invalidToken}`);
    });

    it('can unwrap WETH', async function() {
        const amount = getRandomInteger('1', '10');
        
        const data = encodeWethTransformerData({
            amount,
            token: await weth.getAddress(),
        });
        
        await host.executeTransform(amount, await transformer.getAddress(), data, { value: amount });
        
        const balances = await getHostBalancesAsync();
        expect(Number(balances.ethBalance)).to.equal(Number(amount));
        expect(Number(balances.wethBalance)).to.equal(Number(ZERO_AMOUNT));
        
        console.log(`✅ Unwrapped ${ethers.formatEther(amount)} WETH to ETH`);
    });

    it('can unwrap all WETH', async function() {
        const amount = getRandomInteger('1', '10');
        
        const data = encodeWethTransformerData({
            amount: MAX_UINT256,
            token: await weth.getAddress(),
        });
        
        await host.executeTransform(amount, await transformer.getAddress(), data, { value: amount });
        
        const balances = await getHostBalancesAsync();
        expect(Number(balances.ethBalance)).to.equal(Number(amount));
        expect(Number(balances.wethBalance)).to.equal(Number(ZERO_AMOUNT));
        
        console.log(`✅ Unwrapped all WETH (${ethers.formatEther(amount)}) to ETH`);
    });

    it('can unwrap some WETH', async function() {
        const amount = getRandomInteger('2', '10');
        const unwrapAmount = amount / 2n;
        
        const data = encodeWethTransformerData({
            amount: unwrapAmount,
            token: await weth.getAddress(),
        });
        
        await host.executeTransform(amount, await transformer.getAddress(), data, { value: amount });
        
        const balances = await getHostBalancesAsync();
        expect(Number(balances.ethBalance)).to.equal(Number(unwrapAmount));
        expect(Number(balances.wethBalance)).to.equal(Number(amount - unwrapAmount));
        
        console.log(`✅ Unwrapped ${ethers.formatEther(unwrapAmount)} WETH, ${ethers.formatEther(amount - unwrapAmount)} WETH remaining`);
    });

    it('can wrap ETH', async function() {
        const amount = getRandomInteger('1', '10');
        
        const data = encodeWethTransformerData({
            amount,
            token: ETH_TOKEN_ADDRESS,
        });
        
        await host.executeTransform(ZERO_AMOUNT, await transformer.getAddress(), data, { value: amount });
        
        const balances = await getHostBalancesAsync();
        expect(Number(balances.ethBalance)).to.equal(Number(ZERO_AMOUNT));
        expect(Number(balances.wethBalance)).to.equal(Number(amount));
        
        console.log(`✅ Wrapped ${ethers.formatEther(amount)} ETH to WETH`);
    });

    it('can wrap all ETH', async function() {
        const amount = getRandomInteger('1', '10');
        
        const data = encodeWethTransformerData({
            amount: MAX_UINT256,
            token: ETH_TOKEN_ADDRESS,
        });
        
        await host.executeTransform(ZERO_AMOUNT, await transformer.getAddress(), data, { value: amount });
        
        const balances = await getHostBalancesAsync();
        expect(Number(balances.ethBalance)).to.equal(Number(ZERO_AMOUNT));
        expect(Number(balances.wethBalance)).to.equal(Number(amount));
        
        console.log(`✅ Wrapped all ETH (${ethers.formatEther(amount)}) to WETH`);
    });

    it('can wrap some ETH', async function() {
        const amount = getRandomInteger('2', '10');
        const wrapAmount = amount / 2n;
        
        const data = encodeWethTransformerData({
            amount: wrapAmount,
            token: ETH_TOKEN_ADDRESS,
        });
        
        await host.executeTransform(ZERO_AMOUNT, await transformer.getAddress(), data, { value: amount });
        
        const balances = await getHostBalancesAsync();
        expect(Number(balances.ethBalance)).to.equal(Number(amount - wrapAmount));
        expect(Number(balances.wethBalance)).to.equal(Number(wrapAmount));
        
        console.log(`✅ Wrapped ${ethers.formatEther(wrapAmount)} ETH, ${ethers.formatEther(amount - wrapAmount)} ETH remaining`);
    });
}); 