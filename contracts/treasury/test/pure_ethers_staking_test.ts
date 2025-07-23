import { expect } from 'chai';
import { artifacts } from './artifacts';
import { 
    artifacts as stakingArtifacts
} from '@0x/contracts-staking';
import { 
    artifacts as assetProxyArtifacts
} from '@0x/contracts-asset-proxy';

const { ethers } = require('hardhat');

describe('Pure Ethers Staking Deployment Tests', () => {
    let deployer: any;
    let accounts: any[];
    let zrxToken: any;
    let wethToken: any;

    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        console.log('Deployer address:', await deployer.getAddress());
        
        // Deploy ZRX and WETH tokens first using ethers
        const tokenArtifact = artifacts.DummyERC20Token;
        const factory = new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, deployer);
        
        zrxToken = await factory.deploy('ZRX Token', 'ZRX', 18, ethers.parseUnits('1000000000', 18).toString());
        await zrxToken.waitForDeployment();
        
        wethToken = await factory.deploy('Wrapped Ether', 'WETH', 18, ethers.parseUnits('1000000', 18).toString());
        await wethToken.waitForDeployment();
        
        console.log('ZRX deployed at:', await zrxToken.getAddress());
        console.log('WETH deployed at:', await wethToken.getAddress());
    });

    it('should deploy staking contracts using pure ethers.js', async () => {
        try {
            console.log('Deploying ERC20 Proxy using ethers...');
            const erc20ProxyArtifact = assetProxyArtifacts.ERC20Proxy;
            const erc20ProxyFactory = new ethers.ContractFactory(
                erc20ProxyArtifact.compilerOutput.abi, 
                erc20ProxyArtifact.compilerOutput.evm.bytecode.object, 
                deployer
            );
            const erc20Proxy = await erc20ProxyFactory.deploy();
            await erc20Proxy.waitForDeployment();
            console.log('ERC20 Proxy deployed at:', await erc20Proxy.getAddress());

            console.log('Deploying ZRX Vault using ethers...');
            const zrxVaultArtifact = stakingArtifacts.ZrxVault;
            const zrxVaultFactory = new ethers.ContractFactory(
                zrxVaultArtifact.compilerOutput.abi,
                zrxVaultArtifact.compilerOutput.evm.bytecode.object,
                deployer
            );
            const zrxVault = await zrxVaultFactory.deploy(
                await zrxToken.getAddress(),
                await zrxToken.getAddress()
            );
            await zrxVault.waitForDeployment();
            console.log('ZRX Vault deployed at:', await zrxVault.getAddress());

            console.log('Setting up ERC20 Proxy authorization...');
            await erc20Proxy.addAuthorizedAddress(await zrxVault.getAddress());
            await zrxVault.addAuthorizedAddress(await deployer.getAddress());

            console.log('Deploying Test Staking using ethers...');
            const stakingArtifact = stakingArtifacts.TestStaking;
            const stakingFactory = new ethers.ContractFactory(
                stakingArtifact.compilerOutput.abi,
                stakingArtifact.compilerOutput.evm.bytecode.object,
                deployer
            );
            const stakingLogic = await stakingFactory.deploy(
                await wethToken.getAddress(),
                await zrxVault.getAddress()
            );
            await stakingLogic.waitForDeployment();
            console.log('Test Staking deployed at:', await stakingLogic.getAddress());

            console.log('Deploying Staking Proxy using ethers...');
            const stakingProxyArtifact = stakingArtifacts.StakingProxy;
            const stakingProxyFactory = new ethers.ContractFactory(
                stakingProxyArtifact.compilerOutput.abi,
                stakingProxyArtifact.compilerOutput.evm.bytecode.object,
                deployer
            );
            const stakingProxy = await stakingProxyFactory.deploy(await stakingLogic.getAddress());
            await stakingProxy.waitForDeployment();
            console.log('Staking Proxy deployed at:', await stakingProxy.getAddress());

            console.log('Setting up final configurations...');
            await stakingProxy.addAuthorizedAddress(await deployer.getAddress());
            await zrxVault.setStakingProxy(await stakingProxy.getAddress());

            console.log('Staking system deployed successfully!');
            
            expect(await stakingProxy.getAddress()).to.have.lengthOf(42);
            expect(await erc20Proxy.getAddress()).to.have.lengthOf(42);
            expect(await zrxVault.getAddress()).to.have.lengthOf(42);
            expect(await stakingLogic.getAddress()).to.have.lengthOf(42);
            
        } catch (error) {
            console.log('Staking deployment error:', error.message);
            console.log('Error stack:', error.stack);
            throw error;
        }
    });
}); 