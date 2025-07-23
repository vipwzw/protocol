import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { randomBytes } from 'crypto';

// Import chai-as-promised for proper async error handling
import 'chai-as-promised';

describe('FundRecovery Feature - Modern Tests', function() {
    // Extended timeout for fund recovery operations
    this.timeout(180000);
    
    let owner: any;
    let notOwner: any;
    let zeroEx: any;
    let token: any;
    
    const INITIAL_ERC20_BALANCE = ethers.parseEther('10000');
    const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const MAX_UINT256 = ethers.MaxUint256;
    
    before(async function() {
        console.log('🚀 Setting up FundRecovery Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [owner, notOwner] = signers;
        
        console.log('👤 Owner:', owner.address);
        console.log('👤 Not Owner:', notOwner.address);
        
        await deployContractsAsync();
        
        console.log('✅ FundRecovery test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying FundRecovery contracts...');
        
        // For now, deploy a mock ZeroEx contract that implements fund recovery
        const MockZeroExFactory = await ethers.getContractFactory('TestZeroExWithFundRecovery');
        zeroEx = await MockZeroExFactory.connect(owner).deploy();
        await zeroEx.waitForDeployment();
        console.log(`✅ MockZeroEx: ${await zeroEx.getAddress()}`);
        
        // Deploy test token
        const TestTokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        token = await TestTokenFactory.deploy('TestToken', 'TT', 18);
        await token.waitForDeployment();
        console.log(`✅ TestToken: ${await token.getAddress()}`);
        
        // Mint tokens to ZeroEx contract
        await token.mint(await zeroEx.getAddress(), INITIAL_ERC20_BALANCE);
        console.log(`💰 Minted ${ethers.formatEther(INITIAL_ERC20_BALANCE)} tokens to ZeroEx`);
    }

    function generateRandomAddress(): string {
        return '0x' + randomBytes(20).toString('hex');
    }

    describe('transferTrappedTokensTo', function() {
        let recipientAddress: string;
        
        beforeEach(function() {
            recipientAddress = generateRandomAddress();
            console.log(`📍 Test recipient: ${recipientAddress}`);
        });

        it('transfers an arbitrary ERC-20 Token', async function() {
            const amountOut = ethers.parseEther('100');
            
            await zeroEx.connect(owner).transferTrappedTokensTo(
                await token.getAddress(),
                amountOut,
                recipientAddress
            );
            
            const recipientBalance = await token.balanceOf(recipientAddress);
            expect(recipientBalance).to.equal(amountOut);
            
            console.log(`✅ Transferred ${ethers.formatEther(amountOut)} tokens to recipient`);
        });

        it('Amount MAX_UINT256 transfers entire balance of ERC-20', async function() {
            const balanceOwner = await token.balanceOf(await zeroEx.getAddress());
            
            await zeroEx.connect(owner).transferTrappedTokensTo(
                await token.getAddress(),
                MAX_UINT256,
                recipientAddress
            );
            
            const recipientBalance = await token.balanceOf(recipientAddress);
            expect(recipientBalance).to.equal(balanceOwner);
            
            console.log(`✅ Transferred entire balance ${ethers.formatEther(balanceOwner)} tokens`);
        });

        it('Amount MAX_UINT256 transfers entire balance of ETH', async function() {
            const amountToSend = ethers.parseEther('0.02');
            
            // Send ETH to ZeroEx contract
            await owner.sendTransaction({
                to: await zeroEx.getAddress(),
                value: amountToSend
            });
            
            const balanceOwner = await ethers.provider.getBalance(await zeroEx.getAddress());
            
            await zeroEx.connect(owner).transferTrappedTokensTo(
                ETH_TOKEN_ADDRESS,
                MAX_UINT256,
                recipientAddress
            );
            
            const recipientBalance = await ethers.provider.getBalance(recipientAddress);
            expect(recipientBalance).to.equal(balanceOwner);
            
            console.log(`✅ Transferred entire ETH balance ${ethers.formatEther(balanceOwner)} ETH`);
        });

        it('transfers ETH', async function() {
            const amountToSend = ethers.parseEther('0.02');
            const amountToTransfer = amountToSend - 1n;
            
            // Send ETH to ZeroEx contract
            await owner.sendTransaction({
                to: await zeroEx.getAddress(),
                value: amountToSend
            });
            
            const initialRecipientBalance = await ethers.provider.getBalance(recipientAddress);
            
            await zeroEx.connect(owner).transferTrappedTokensTo(
                ETH_TOKEN_ADDRESS,
                amountToTransfer,
                recipientAddress
            );
            
            const finalRecipientBalance = await ethers.provider.getBalance(recipientAddress);
            const transferredAmount = finalRecipientBalance - initialRecipientBalance;
            
            expect(transferredAmount).to.equal(amountToTransfer);
            
            console.log(`✅ Transferred ${ethers.formatEther(transferredAmount)} ETH`);
        });

        it('feature transferTrappedTokensTo can only be called by owner', async function() {
            await expect(
                zeroEx.connect(notOwner).transferTrappedTokensTo(
                    ETH_TOKEN_ADDRESS,
                    MAX_UINT256,
                    recipientAddress
                )
            ).to.be.rejectedWith('OnlyOwnerError');
            
            console.log(`✅ Non-owner correctly rejected`);
        });
    });
}); 