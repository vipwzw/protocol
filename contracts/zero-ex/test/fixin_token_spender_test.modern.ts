import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { randomBytes } from 'crypto';

// Import chai-as-promised for proper async error handling
import 'chai-as-promised';

describe('FixinTokenSpender - Modern Tests', function() {
    // Extended timeout for token operations
    this.timeout(180000);
    
    let admin: any;
    let tokenSpender: Contract;
    let token: Contract;
    let greedyToken: Contract;
    
    // Test constants
    const EMPTY_RETURN_AMOUNT = 1337;
    const FALSE_RETURN_AMOUNT = 1338;
    const REVERT_RETURN_AMOUNT = 1339;
    const EXTRA_RETURN_TRUE_AMOUNT = 1341;
    const EXTRA_RETURN_FALSE_AMOUNT = 1342;
    
    before(async function() {
        console.log('🚀 Setting up FixinTokenSpender Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [admin] = signers;
        
        console.log('👤 Admin:', admin.address);
        
        await deployContractsAsync();
        
        console.log('✅ FixinTokenSpender test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying FixinTokenSpender contracts...');
        
        // Deploy test tokens
        const TestTokenFactory = await ethers.getContractFactory('TestTokenSpenderERC20Token');
        
        token = await TestTokenFactory.deploy();
        await token.waitForDeployment();
        console.log(`✅ TestToken: ${await token.getAddress()}`);
        
        greedyToken = await TestTokenFactory.deploy();
        await greedyToken.waitForDeployment();
        await greedyToken.setGreedyRevert(true);
        console.log(`✅ GreedyToken: ${await greedyToken.getAddress()}`);
        
        // Deploy FixinTokenSpender
        const TokenSpenderFactory = await ethers.getContractFactory('TestFixinTokenSpender');
        tokenSpender = await TokenSpenderFactory.deploy();
        await tokenSpender.waitForDeployment();
        console.log(`✅ TestFixinTokenSpender: ${await tokenSpender.getAddress()}`);
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

    describe('transferERC20TokensFrom()', function() {
        it('successfully calls compliant ERC20 token', async function() {
            const tokenFrom = generateRandomAddress();
            const tokenTo = generateRandomAddress();
            const tokenAmount = ethers.parseEther('123.456');
            
            const tx = await tokenSpender.transferERC20TokensFrom(
                await token.getAddress(),
                tokenFrom,
                tokenTo,
                tokenAmount
            );
            
            const receipt = await tx.wait();
            
            // Check event was emitted
            const transferEvent = receipt.logs.find((log: any) => log.fragment?.name === 'TransferFromCalled');
            expect(transferEvent).to.not.be.undefined;
            
            if (transferEvent) {
                expect(transferEvent.args.sender).to.equal(await tokenSpender.getAddress());
                expect(transferEvent.args.from).to.equal(tokenFrom);
                expect(transferEvent.args.to).to.equal(tokenTo);
                expect(transferEvent.args.amount).to.equal(tokenAmount);
            }
        });

        it('successfully calls non-compliant ERC20 token', async function() {
            const tokenFrom = generateRandomAddress();
            const tokenTo = generateRandomAddress();
            const tokenAmount = BigInt(EMPTY_RETURN_AMOUNT);
            
            const tx = await tokenSpender.transferERC20TokensFrom(
                await token.getAddress(),
                tokenFrom,
                tokenTo,
                tokenAmount
            );
            
            const receipt = await tx.wait();
            
            // Check event was emitted
            const transferEvent = receipt.logs.find((log: any) => log.fragment?.name === 'TransferFromCalled');
            expect(transferEvent).to.not.be.undefined;
            
            if (transferEvent) {
                expect(transferEvent.args.sender).to.equal(await tokenSpender.getAddress());
                expect(transferEvent.args.from).to.equal(tokenFrom);
                expect(transferEvent.args.to).to.equal(tokenTo);
                expect(transferEvent.args.amount).to.equal(tokenAmount);
            }
        });

        it('reverts if ERC20 token reverts', async function() {
            const tokenFrom = generateRandomAddress();
            const tokenTo = generateRandomAddress();
            const tokenAmount = BigInt(REVERT_RETURN_AMOUNT);
            
            await expect(
                tokenSpender.transferERC20TokensFrom(
                    await token.getAddress(),
                    tokenFrom,
                    tokenTo,
                    tokenAmount
                )
            ).to.be.rejectedWith('TestTokenSpenderERC20Token/Revert');
        });

        it('reverts if ERC20 token returns false', async function() {
            const tokenFrom = generateRandomAddress();
            const tokenTo = generateRandomAddress();
            const tokenAmount = BigInt(FALSE_RETURN_AMOUNT);
            
            await expect(
                tokenSpender.transferERC20TokensFrom(
                    await token.getAddress(),
                    tokenFrom,
                    tokenTo,
                    tokenAmount
                )
            ).to.be.rejected; // Raw revert with padded 0
        });

        it('allows extra data after true', async function() {
            const tokenFrom = generateRandomAddress();
            const tokenTo = generateRandomAddress();
            const tokenAmount = BigInt(EXTRA_RETURN_TRUE_AMOUNT);
            
            const tx = await tokenSpender.transferERC20TokensFrom(
                await token.getAddress(),
                tokenFrom,
                tokenTo,
                tokenAmount
            );
            
            const receipt = await tx.wait();
            
            // Check event was emitted
            const transferEvent = receipt.logs.find((log: any) => log.fragment?.name === 'TransferFromCalled');
            expect(transferEvent).to.not.be.undefined;
            
            if (transferEvent) {
                expect(transferEvent.args.sender).to.equal(await tokenSpender.getAddress());
                expect(transferEvent.args.from).to.equal(tokenFrom);
                expect(transferEvent.args.to).to.equal(tokenTo);
                expect(transferEvent.args.amount).to.equal(tokenAmount);
            }
        });

        it("reverts when there's extra data after false", async function() {
            const tokenFrom = generateRandomAddress();
            const tokenTo = generateRandomAddress();
            const tokenAmount = BigInt(EXTRA_RETURN_FALSE_AMOUNT);
            
            await expect(
                tokenSpender.transferERC20TokensFrom(
                    await token.getAddress(),
                    tokenFrom,
                    tokenTo,
                    tokenAmount
                )
            ).to.be.rejected; // Raw revert with padded amount
        });

        it('cannot call self', async function() {
            const tokenFrom = generateRandomAddress();
            const tokenTo = generateRandomAddress();
            const tokenAmount = ethers.parseEther('123.456');
            
            await expect(
                tokenSpender.transferERC20TokensFrom(
                    await tokenSpender.getAddress(),
                    tokenFrom,
                    tokenTo,
                    tokenAmount
                )
            ).to.be.rejectedWith('FixinTokenSpender/CANNOT_INVOKE_SELF');
        });
    });

    describe('getSpendableERC20BalanceOf()', function() {
        it("returns the minimum of the owner's balance and allowance", async function() {
            const balance = getRandomInteger('1', '10');
            const allowance = getRandomInteger('1', '10');
            const tokenOwner = generateRandomAddress();
            
            // Set balance and allowance
            await token.setBalanceAndAllowanceOf(
                tokenOwner,
                balance,
                await tokenSpender.getAddress(),
                allowance
            );
            
            // Get spendable balance
            const spendableBalance = await tokenSpender.getSpendableERC20BalanceOf(
                await token.getAddress(),
                tokenOwner
            );
            
            // Should be minimum of balance and allowance
            const expectedBalance = balance < allowance ? balance : allowance;
            expect(spendableBalance).to.equal(expectedBalance);
            
            console.log(`✅ Balance: ${ethers.formatEther(balance.toString())} ETH`);
            console.log(`✅ Allowance: ${ethers.formatEther(allowance.toString())} ETH`);
            console.log(`✅ Spendable: ${ethers.formatEther(spendableBalance.toString())} ETH`);
        });
    });
}); 