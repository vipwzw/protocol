import { expect } from 'chai';
import { artifacts } from './artifacts';
import { 
    artifacts as stakingArtifacts,
    TestStakingContract,
    ZrxVaultContract,
    StakingProxyContract 
} from '@0x/contracts-staking';
import { 
    artifacts as assetProxyArtifacts,
    ERC20ProxyContract 
} from '@0x/contracts-asset-proxy';
import { 
    blockchainTests
} from '@0x/contracts-test-utils';

const { ethers } = require('hardhat');

describe('Simplified Staking Deployment Tests', () => {
    let deployer: any;
    let accounts: any[];
    let zrxToken: any;
    let wethToken: any;

    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        console.log('Deployer address:', await deployer.getAddress());
        
        // Deploy ZRX and WETH tokens first
        const tokenArtifact = artifacts.DummyERC20Token;
        const factory = new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, deployer);
        
        zrxToken = await factory.deploy('ZRX Token', 'ZRX', 18, ethers.parseUnits('1000000000', 18).toString());
        await zrxToken.waitForDeployment();
        
        wethToken = await factory.deploy('Wrapped Ether', 'WETH', 18, ethers.parseUnits('1000000', 18).toString());
        await wethToken.waitForDeployment();
        
        console.log('ZRX deployed at:', await zrxToken.getAddress());
        console.log('WETH deployed at:', await wethToken.getAddress());
    });

    it('should deploy staking system using contracts-staking library', async () => {
        try {
            // Create simple provider and txDefaults for 0x contracts
            const provider = ethers.provider;
            const txDefaults = {
                from: await deployer.getAddress(),
                gas: 6000000
            };
            
            console.log('Deploying ERC20 Proxy...');
            const erc20Proxy = await ERC20ProxyContract.deployFrom0xArtifactAsync(
                assetProxyArtifacts.ERC20Proxy,
                provider,
                txDefaults,
                assetProxyArtifacts,
            );
            console.log('ERC20 Proxy deployed at:', erc20Proxy.address);

            console.log('Deploying ZRX Vault...');
            const zrxVault = await ZrxVaultContract.deployFrom0xArtifactAsync(
                stakingArtifacts.ZrxVault,
                provider,
                txDefaults,
                stakingArtifacts,
                await zrxToken.getAddress(),
                await zrxToken.getAddress(),
            );
            console.log('ZRX Vault deployed at:', zrxVault.address);

            console.log('Setting up ERC20 Proxy authorization...');
            await erc20Proxy.addAuthorizedAddress(zrxVault.address).awaitTransactionSuccessAsync();
            await zrxVault.addAuthorizedAddress(await deployer.getAddress()).awaitTransactionSuccessAsync();

            console.log('Deploying Test Staking...');
            const stakingLogic = await TestStakingContract.deployFrom0xArtifactAsync(
                stakingArtifacts.TestStaking,
                provider,
                txDefaults,
                stakingArtifacts,
                await wethToken.getAddress(),
                zrxVault.address,
            );
            console.log('Test Staking deployed at:', stakingLogic.address);

            console.log('Deploying Staking Proxy...');
            const stakingProxy = await StakingProxyContract.deployFrom0xArtifactAsync(
                stakingArtifacts.StakingProxy,
                provider,
                txDefaults,
                stakingArtifacts,
                stakingLogic.address,
            );
            console.log('Staking Proxy deployed at:', stakingProxy.address);

            console.log('Setting up final configurations...');
            await stakingProxy.addAuthorizedAddress(await deployer.getAddress()).awaitTransactionSuccessAsync();
            await zrxVault.setStakingProxy(stakingProxy.address).awaitTransactionSuccessAsync();

            // Create TestStakingContract instance through proxy
            const staking = new TestStakingContract(stakingProxy.address, provider, txDefaults);
            
            console.log('Staking system deployed successfully!');
            console.log('Final Staking Contract:', staking.address);
            
            expect(staking.address).to.have.lengthOf(42);
            expect(erc20Proxy.address).to.have.lengthOf(42);
            expect(zrxVault.address).to.have.lengthOf(42);
            
        } catch (error) {
            console.log('Staking deployment error:', error.message);
            console.log('Error stack:', error.stack);
            throw error;
        }
    });
}); 