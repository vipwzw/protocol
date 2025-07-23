import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { randomBytes } from 'crypto';

// Import chai-as-promised for proper async error handling
import 'chai-as-promised';

describe('PayTakerTransformer - Modern Tests', function() {
    // Extended timeout for transformer operations
    this.timeout(180000);
    
    let caller: any;
    let token: any;
    let transformer: any;
    let host: any;
    
    const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const MAX_UINT256 = ethers.MaxUint256;
    const ZERO_AMOUNT = 0n;
    
    before(async function() {
        console.log('🚀 Setting up PayTakerTransformer Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [caller] = signers;
        
        console.log('👤 Caller:', caller.address);
        
        await deployContractsAsync();
        
        console.log('✅ PayTakerTransformer test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying PayTakerTransformer contracts...');
        
        // Deploy test token
        const TestTokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        token = await TestTokenFactory.deploy('TestToken', 'TT', 18);
        await token.waitForDeployment();
        console.log(`✅ TestToken: ${await token.getAddress()}`);
        
        // Deploy PayTakerTransformer
        const TransformerFactory = await ethers.getContractFactory('PayTakerTransformer');
        transformer = await TransformerFactory.deploy();
        await transformer.waitForDeployment();
        console.log(`✅ PayTakerTransformer: ${await transformer.getAddress()}`);
        
        // Deploy TestTransformerHost
        const HostFactory = await ethers.getContractFactory('TestTransformerHost');
        host = await HostFactory.connect(caller).deploy();
        await host.waitForDeployment();
        console.log(`✅ TestTransformerHost: ${await host.getAddress()}`);
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
        tokenBalance: bigint;
    }

    const ZERO_BALANCES: Balances = {
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
        await caller.sendTransaction({
            to,
            value: amount,
        });
    }

    function encodePayTakerTransformerData(params: {
        amounts: bigint[];
        tokens: string[];
    }): string {
        // Simplified encoding for test purposes
        // In real implementation, this would use the actual encoding logic
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        return abiCoder.encode(
            ['uint256[]', 'address[]'],
            [params.amounts, params.tokens]
        );
    }

    it('can transfer a token and ETH', async function() {
        const taker = generateRandomAddress();
        const amounts = [
            getRandomInteger('1', '10'),
            getRandomInteger('1', '10')
        ];
        
        const data = encodePayTakerTransformerData({
            amounts,
            tokens: [await token.getAddress(), ETH_TOKEN_ADDRESS],
        });
        
        await mintHostTokensAsync(amounts[0]);
        await sendEtherAsync(await host.getAddress(), amounts[1]);
        
        await host.rawExecuteTransform(await transformer.getAddress(), {
            data,
            recipient: taker,
            sender: generateRandomAddress(),
        });
        
        const hostBalances = await getBalancesAsync(await host.getAddress());
        const takerBalances = await getBalancesAsync(taker);
        
        expect(hostBalances.ethBalance).to.equal(ZERO_BALANCES.ethBalance);
        expect(hostBalances.tokenBalance).to.equal(ZERO_BALANCES.tokenBalance);
        expect(takerBalances.tokenBalance).to.equal(amounts[0]);
        expect(takerBalances.ethBalance).to.equal(amounts[1]);
        
        console.log(`✅ Transferred ${ethers.formatEther(amounts[0])} tokens and ${ethers.formatEther(amounts[1])} ETH`);
    });

    it('can transfer all of a token and ETH', async function() {
        const taker = generateRandomAddress();
        const amounts = [
            getRandomInteger('1', '10'),
            getRandomInteger('1', '10')
        ];
        
        const data = encodePayTakerTransformerData({
            amounts: [MAX_UINT256, MAX_UINT256],
            tokens: [await token.getAddress(), ETH_TOKEN_ADDRESS],
        });
        
        await mintHostTokensAsync(amounts[0]);
        await sendEtherAsync(await host.getAddress(), amounts[1]);
        
        await host.rawExecuteTransform(await transformer.getAddress(), {
            data,
            recipient: taker,
            sender: generateRandomAddress(),
        });
        
        const hostBalances = await getBalancesAsync(await host.getAddress());
        const takerBalances = await getBalancesAsync(taker);
        
        expect(hostBalances.ethBalance).to.equal(ZERO_BALANCES.ethBalance);
        expect(hostBalances.tokenBalance).to.equal(ZERO_BALANCES.tokenBalance);
        expect(takerBalances.tokenBalance).to.equal(amounts[0]);
        expect(takerBalances.ethBalance).to.equal(amounts[1]);
        
        console.log(`✅ Transferred all tokens and ETH using MAX_UINT256`);
    });

    it('can transfer all of a token and ETH (empty amounts)', async function() {
        const taker = generateRandomAddress();
        const amounts = [
            getRandomInteger('1', '10'),
            getRandomInteger('1', '10')
        ];
        
        const data = encodePayTakerTransformerData({
            amounts: [], // Empty amounts array means transfer all
            tokens: [await token.getAddress(), ETH_TOKEN_ADDRESS],
        });
        
        await mintHostTokensAsync(amounts[0]);
        await sendEtherAsync(await host.getAddress(), amounts[1]);
        
        await host.rawExecuteTransform(await transformer.getAddress(), {
            data,
            recipient: taker,
            sender: generateRandomAddress(),
        });
        
        const hostBalances = await getBalancesAsync(await host.getAddress());
        const takerBalances = await getBalancesAsync(taker);
        
        expect(hostBalances.ethBalance).to.equal(ZERO_BALANCES.ethBalance);
        expect(hostBalances.tokenBalance).to.equal(ZERO_BALANCES.tokenBalance);
        expect(takerBalances.tokenBalance).to.equal(amounts[0]);
        expect(takerBalances.ethBalance).to.equal(amounts[1]);
        
        console.log(`✅ Transferred all tokens and ETH using empty amounts array`);
    });

    it('can transfer less than the balance of a token and ETH', async function() {
        const taker = generateRandomAddress();
        const amounts = [
            getRandomInteger('2', '10'),
            getRandomInteger('2', '10')
        ];
        
        const transferAmounts = [amounts[0] / 2n, amounts[1] / 2n];
        
        const data = encodePayTakerTransformerData({
            amounts: transferAmounts,
            tokens: [await token.getAddress(), ETH_TOKEN_ADDRESS],
        });
        
        await mintHostTokensAsync(amounts[0]);
        await sendEtherAsync(await host.getAddress(), amounts[1]);
        
        await host.rawExecuteTransform(await transformer.getAddress(), {
            data,
            recipient: taker,
            sender: generateRandomAddress(),
        });
        
        const hostBalances = await getBalancesAsync(await host.getAddress());
        const takerBalances = await getBalancesAsync(taker);
        
        expect(hostBalances.tokenBalance).to.equal(amounts[0] - transferAmounts[0]);
        expect(hostBalances.ethBalance).to.equal(amounts[1] - transferAmounts[1]);
        expect(takerBalances.tokenBalance).to.equal(transferAmounts[0]);
        expect(takerBalances.ethBalance).to.equal(transferAmounts[1]);
        
        console.log(`✅ Transferred partial amounts: ${ethers.formatEther(transferAmounts[0])} tokens, ${ethers.formatEther(transferAmounts[1])} ETH`);
    });
}); 