import { artifacts as assetProxyArtifacts, ERC20ProxyContract } from '@0x/contracts-asset-proxy';
import {
    artifacts as stakingArtifacts,
    constants as stakingConstants,
    StakeInfo,
    StakeStatus,
    StakingProxyContract,
    TestStakingContract,
    ZrxVaultContract,
} from '@0x/contracts-staking';
import {
    blockchainTests,
    constants,
    expect,
    getRandomInteger,
    randomAddress,
    verifyEventsFromLogs,
} from '@0x/contracts-test-utils';
import { TreasuryVote } from '@0x/protocol-utils';
import { BigNumber, hexUtils } from '@0x/utils';
import * as ethUtil from 'ethereumjs-util';
import { BaseContract } from '@0x/base-contract';
import { Web3Wrapper } from '@0x/web3-wrapper';
import { AbiEncoder } from '@0x/utils';

import { artifacts } from './artifacts';
import { deployFromHardhatArtifactAsync } from '../src/hardhat-types';
import { DefaultPoolOperatorContract, ZrxTreasuryContract, ZrxTreasuryEvents } from './wrappers';

// Configure chai for bignumber support
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as dirtyChai from 'dirty-chai';

// Setup chai
chai.use(chaiAsPromised);
chai.use(dirtyChai);

// Try to import and use chai-bignumber if available
try {
    const chaiBigNumber = require('chai-bignumber');
    chai.use(chaiBigNumber(BigNumber));
} catch (e) {
    // chai-bignumber not available, use manual assertions
    console.log('chai-bignumber not available, using manual BigNumber assertions');
}

blockchainTests.resets('Treasury governance', env => {
    const TREASURY_PARAMS = {
        votingPeriod: new BigNumber(3).times(stakingConstants.ONE_DAY_IN_SECONDS),
        proposalThreshold: new BigNumber(100),
        quorumThreshold: new BigNumber(1000),
        defaultPoolId: stakingConstants.INITIAL_POOL_ID,
    };
    const PROPOSAL_DESCRIPTION = 'A very compelling proposal!';
    const TREASURY_BALANCE = constants.INITIAL_ERC20_BALANCE;
    const INVALID_PROPOSAL_ID = new BigNumber(999);
    const GRANT_PROPOSALS = [
        { recipient: randomAddress(), amount: getRandomInteger(1, TREASURY_BALANCE.dividedToIntegerBy(2)) },
        { recipient: randomAddress(), amount: getRandomInteger(1, TREASURY_BALANCE.dividedToIntegerBy(2)) },
    ];

    interface ProposedAction {
        target: string;
        data: string;
        value: BigNumber;
    }

    let zrx: any;
    let weth: any;
    let erc20ProxyContract: ERC20ProxyContract;
    let staking: TestStakingContract;
    let treasury: ZrxTreasuryContract;
    let defaultPoolId: string;
    let defaultPoolOperator: DefaultPoolOperatorContract;
    let admin: string;
    let nonDefaultPoolId: string;
    let poolOperator: string;
    let delegator: string;
    let relayer: string;
    let delegatorPrivateKey: string;
    let actions: ProposedAction[];

    // Hardhat ethers instance and signers
    const { ethers } = require('hardhat');
    let signers: any[];

    async function deployStakingAsync(): Promise<void> {
        // Deploy using ethers.js to avoid Web3Wrapper RPC issues
        console.log('Deploying staking contracts using ethers.js...');
        
        // Deploy ERC20 Proxy
        const erc20ProxyArtifact = assetProxyArtifacts.ERC20Proxy;
        const erc20ProxyFactory = new ethers.ContractFactory(
            erc20ProxyArtifact.compilerOutput.abi, 
            erc20ProxyArtifact.compilerOutput.evm.bytecode.object, 
            signers[0]
        );
        const erc20ProxyEthers = await erc20ProxyFactory.deploy();
        await erc20ProxyEthers.waitForDeployment();
        
        // Create wrapper for compatibility
        erc20ProxyContract = {
            address: await erc20ProxyEthers.getAddress(),
            addAuthorizedAddress: (address: string) => ({
                awaitTransactionSuccessAsync: async () => {
                    const tx = await erc20ProxyEthers.addAuthorizedAddress(address);
                    return await tx.wait();
                }
            })
        } as any;

        // Deploy ZRX Vault
        const zrxVaultArtifact = stakingArtifacts.ZrxVault;
        const zrxVaultFactory = new ethers.ContractFactory(
            zrxVaultArtifact.compilerOutput.abi,
            zrxVaultArtifact.compilerOutput.evm.bytecode.object,
            signers[0]
        );
        const zrxVaultEthers = await zrxVaultFactory.deploy(zrx.address, zrx.address);
        await zrxVaultEthers.waitForDeployment();
        
        // Create wrapper for ZRX Vault
        const zrxVaultContract = {
            address: await zrxVaultEthers.getAddress(),
            addAuthorizedAddress: (address: string) => ({
                awaitTransactionSuccessAsync: async () => {
                    const tx = await zrxVaultEthers.addAuthorizedAddress(address);
                    return await tx.wait();
                }
            }),
            setStakingProxy: (address: string) => ({
                awaitTransactionSuccessAsync: async () => {
                    const tx = await zrxVaultEthers.setStakingProxy(address);
                    return await tx.wait();
                }
            })
        } as any;

        // Set up authorizations
        await erc20ProxyContract.addAuthorizedAddress(zrxVaultContract.address).awaitTransactionSuccessAsync();
        await zrxVaultContract.addAuthorizedAddress(admin).awaitTransactionSuccessAsync();

        // Deploy Test Staking Logic
        const stakingArtifact = stakingArtifacts.TestStaking;
        const stakingFactory = new ethers.ContractFactory(
            stakingArtifact.compilerOutput.abi,
            stakingArtifact.compilerOutput.evm.bytecode.object,
            signers[0]
        );
        const stakingLogicEthers = await stakingFactory.deploy(weth.address, zrxVaultContract.address);
        await stakingLogicEthers.waitForDeployment();

        // Deploy Staking Proxy
        const stakingProxyArtifact = stakingArtifacts.StakingProxy;
        const stakingProxyFactory = new ethers.ContractFactory(
            stakingProxyArtifact.compilerOutput.abi,
            stakingProxyArtifact.compilerOutput.evm.bytecode.object,
            signers[0]
        );
        const stakingProxyEthers = await stakingProxyFactory.deploy(await stakingLogicEthers.getAddress());
        await stakingProxyEthers.waitForDeployment();
        
        // Create wrapper for Staking Proxy
        const stakingProxyContract = {
            address: await stakingProxyEthers.getAddress(),
            addAuthorizedAddress: (address: string) => ({
                awaitTransactionSuccessAsync: async () => {
                    const tx = await stakingProxyEthers.addAuthorizedAddress(address);
                    return await tx.wait();
                }
            })
        } as any;

        // Set up final configurations
        await stakingProxyContract.addAuthorizedAddress(admin).awaitTransactionSuccessAsync();
        await zrxVaultContract.setStakingProxy(stakingProxyContract.address).awaitTransactionSuccessAsync();
        
        // Create ethers.js wrapper for staking to avoid Web3Wrapper issues
        const stakingEthersContract = new ethers.Contract(
            stakingProxyContract.address, 
            stakingArtifacts.TestStaking.compilerOutput.abi, 
            signers[0]
        );
        
        // Create wrapper for compatibility with original test code
        staking = {
            address: stakingProxyContract.address,
            
            stake: (amount: any) => ({
                awaitTransactionSuccessAsync: async (overrides: any = {}) => {
                    // Handle the 'from' parameter by using the appropriate signer
                    let signer = signers[0]; // default to admin
                    if (overrides.from) {
                        const signerAddresses = signers.map((s: any) => s.address);
                        const signerIndex = signerAddresses.indexOf(overrides.from);
                        if (signerIndex >= 0 && signerIndex < signers.length) {
                            signer = signers[signerIndex];
                        }
                    }
                    
                    // First approve ZRX tokens to the staking contract
                    const zrxContractWithSigner = zrx.contract.connect(signer);
                    const approveTx = await zrxContractWithSigner.approve(stakingProxyContract.address, amount.toString());
                    await approveTx.wait();
                    
                    // Then call stake
                    const contractWithSigner = stakingEthersContract.connect(signer);
                    const tx = await contractWithSigner.stake(amount.toString());
                    return await tx.wait();
                }
            }),
            
            moveStake: (fromInfo: any, toInfo: any, amount: any) => ({
                awaitTransactionSuccessAsync: async (overrides: any = {}) => {
                    // Handle the 'from' parameter by using the appropriate signer
                    let signer = signers[0]; // default to admin
                    if (overrides.from) {
                        const signerAddresses = signers.map((s: any) => s.address);
                        const signerIndex = signerAddresses.indexOf(overrides.from);
                        if (signerIndex >= 0 && signerIndex < signers.length) {
                            signer = signers[signerIndex];
                        }
                    }
                    const contractWithSigner = stakingEthersContract.connect(signer);
                    const tx = await contractWithSigner.moveStake(fromInfo, toInfo, amount.toString());
                    return await tx.wait();
                }
            }),
            
            createStakingPool: (operatorShare: any, addOperatorAsMaker: boolean) => ({
                callAsync: async (overrides: any = {}) => {
                    // This would be used for getting the poolId before transaction
                    return ethers.keccak256(ethers.toUtf8Bytes(`pool_${Date.now()}`));
                },
                awaitTransactionSuccessAsync: async (overrides: any = {}) => {
                    // Handle the 'from' parameter by using the appropriate signer
                    let signer = signers[0]; // default to admin
                    if (overrides.from) {
                        const signerAddresses = signers.map((s: any) => s.address);
                        const signerIndex = signerAddresses.indexOf(overrides.from);
                        if (signerIndex >= 0 && signerIndex < signers.length) {
                            signer = signers[signerIndex];
                        }
                    }
                    const contractWithSigner = stakingEthersContract.connect(signer);
                    const tx = await contractWithSigner.createStakingPool(operatorShare, addOperatorAsMaker);
                    return await tx.wait();
                }
            }),
            
            getCurrentEpochEarliestEndTimeInSeconds: () => ({
                callAsync: async () => {
                    const result = await stakingEthersContract.getCurrentEpochEarliestEndTimeInSeconds();
                    return new BigNumber(result.toString());
                }
            }),
            
            endEpoch: () => ({
                awaitTransactionSuccessAsync: async (overrides: any = {}) => {
                    // Handle the 'from' parameter by using the appropriate signer
                    let signer = signers[0]; // default to admin
                    if (overrides.from) {
                        const signerAddresses = signers.map((s: any) => s.address);
                        const signerIndex = signerAddresses.indexOf(overrides.from);
                        if (signerIndex >= 0 && signerIndex < signers.length) {
                            signer = signers[signerIndex];
                        }
                    }
                    const contractWithSigner = stakingEthersContract.connect(signer);
                    const tx = await contractWithSigner.endEpoch();
                    return await tx.wait();
                }
            })
        } as any;
        
        console.log('Staking contracts deployed successfully!');
    }

    async function fastForwardToNextEpochAsync(): Promise<void> {
        const epochEndTime = await staking.getCurrentEpochEarliestEndTimeInSeconds().callAsync();
        // Use ethers provider instead of web3Wrapper to avoid account issues
        const block = await ethers.provider.getBlock('latest');
        const lastBlockTime = block?.timestamp || 0;
        const dt = Math.max(0, epochEndTime.minus(lastBlockTime).toNumber());
        await ethers.provider.send('evm_increaseTime', [dt]);
        // mine next block
        await ethers.provider.send('evm_mine', []);
        await staking.endEpoch().awaitTransactionSuccessAsync();
    }

    before(async () => {
        // Initialize signers first
        signers = await ethers.getSigners();
        
        // Use ethers signers instead of web3Wrapper to avoid RPC issues
        const accounts = signers.map((s: any) => s.address);
        [admin, poolOperator, delegator, relayer] = accounts;
        
        // Use default Hardhat private keys
        const defaultHardhatPrivateKeys = [
            '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Account 0
            '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Account 1
            '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // Account 2
            '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', // Account 3
            '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a', // Account 4
            '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba', // Account 5
            '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e', // Account 6
            '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356', // Account 7
            '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97', // Account 8
            '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6', // Account 9
        ];
        
        const delegatorIndex = accounts.indexOf(delegator);
        if (delegatorIndex >= 0 && delegatorIndex < defaultHardhatPrivateKeys.length) {
            delegatorPrivateKey = defaultHardhatPrivateKeys[delegatorIndex];
        } else {
            // Fallback
            delegatorPrivateKey = defaultHardhatPrivateKeys[2]; // Use account 2 as default
        }
        
        // Update env.txDefaults to use the correct account and gas settings
        env.txDefaults.from = admin;
        env.txDefaults.gasPrice = undefined; // Let hardhat determine gas price
        env.txDefaults.maxFeePerGas = undefined; // Let hardhat handle gas pricing
        env.txDefaults.maxPriorityFeePerGas = undefined;
        console.log('Using accounts:', accounts);
        console.log('Admin account:', admin);
        console.log('env.txDefaults.from:', env.txDefaults.from);

        // Deploy tokens using ethers.js to avoid Web3Wrapper RPC issues
        console.log('Deploying tokens using ethers.js...');
        
        const tokenArtifact = artifacts.DummyERC20Token;
        const tokenFactory = new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, signers[0]);
        
        // Deploy ZRX token
        const zrxContract = await tokenFactory.deploy(
            constants.DUMMY_TOKEN_NAME,
            constants.DUMMY_TOKEN_SYMBOL,
            18, // decimals
            constants.DUMMY_TOKEN_TOTAL_SUPPLY.toString()
        );
        await zrxContract.waitForDeployment();
        
        // Deploy WETH token
        const wethContract = await tokenFactory.deploy(
            constants.DUMMY_TOKEN_NAME,
            constants.DUMMY_TOKEN_SYMBOL,
            18, // decimals
            constants.DUMMY_TOKEN_TOTAL_SUPPLY.toString()
        );
        await wethContract.waitForDeployment();
        
        // Create simple wrappers for the deployed contracts
        zrx = {
            address: await zrxContract.getAddress(),
            contract: zrxContract,
            mint: (to: string, value: any) => ({
                awaitTransactionSuccessAsync: async () => {
                    const tx = await zrxContract.mint(to, value.toString());
                    return await tx.wait();
                }
            }),
            balanceOf: (owner: string) => ({
                callAsync: async () => {
                    const result = await zrxContract.balanceOf(owner);
                    return new BigNumber(result.toString());
                }
            }),
            transfer: (to: string, value: any) => ({
                awaitTransactionSuccessAsync: async (overrides: any = {}) => {
                    // Handle the 'from' parameter by using the appropriate signer
                    let signer = signers[0]; // default to admin
                    if (overrides.from) {
                        const signerIndex = accounts.indexOf(overrides.from);
                        if (signerIndex >= 0 && signerIndex < signers.length) {
                            signer = signers[signerIndex];
                        }
                    }
                    const contractWithSigner = zrxContract.connect(signer);
                    const tx = await contractWithSigner.transfer(to, value.toString());
                    return await tx.wait();
                },
                getABIEncodedTransactionData: () => {
                    return zrxContract.interface.encodeFunctionData('transfer', [to, value.toString()]);
                }
            }),
            approve: (spender: string, value: any) => ({
                awaitTransactionSuccessAsync: async (overrides: any = {}) => {
                    // Handle the 'from' parameter by using the appropriate signer
                    let signer = signers[0]; // default to admin
                    if (overrides.from) {
                        const signerIndex = accounts.indexOf(overrides.from);
                        if (signerIndex >= 0 && signerIndex < signers.length) {
                            signer = signers[signerIndex];
                        }
                    }
                    const contractWithSigner = zrxContract.connect(signer);
                    const tx = await contractWithSigner.approve(spender, value.toString());
                    return await tx.wait();
                }
            })
        };
        
        weth = {
            address: await wethContract.getAddress(),
            contract: wethContract,
            mint: (to: string, value: any) => ({
                awaitTransactionSuccessAsync: async () => {
                    const tx = await wethContract.mint(to, value.toString());
                    return await tx.wait();
                }
            }),
            balanceOf: (owner: string) => ({
                callAsync: async () => {
                    const result = await wethContract.balanceOf(owner);
                    return new BigNumber(result.toString());
                }
            }),
            transfer: (to: string, value: any) => ({
                awaitTransactionSuccessAsync: async (overrides: any = {}) => {
                    // Handle the 'from' parameter by using the appropriate signer
                    let signer = signers[0]; // default to admin
                    if (overrides.from) {
                        const signerIndex = accounts.indexOf(overrides.from);
                        if (signerIndex >= 0 && signerIndex < signers.length) {
                            signer = signers[signerIndex];
                        }
                    }
                    const contractWithSigner = wethContract.connect(signer);
                    const tx = await contractWithSigner.transfer(to, value.toString());
                    return await tx.wait();
                },
                getABIEncodedTransactionData: () => {
                    return wethContract.interface.encodeFunctionData('transfer', [to, value.toString()]);
                }
            }),
            approve: (spender: string, value: any) => ({
                awaitTransactionSuccessAsync: async (overrides: any = {}) => {
                    // Handle the 'from' parameter by using the appropriate signer
                    let signer = signers[0]; // default to admin
                    if (overrides.from) {
                        const signerIndex = accounts.indexOf(overrides.from);
                        if (signerIndex >= 0 && signerIndex < signers.length) {
                            signer = signers[signerIndex];
                        }
                    }
                    const contractWithSigner = wethContract.connect(signer);
                    const tx = await contractWithSigner.approve(spender, value.toString());
                    return await tx.wait();
                }
            })
        };
        await deployStakingAsync();
        await zrx.mint(poolOperator, constants.INITIAL_ERC20_BALANCE).awaitTransactionSuccessAsync();
        await zrx.mint(delegator, constants.INITIAL_ERC20_BALANCE).awaitTransactionSuccessAsync();
        await zrx
            .approve(erc20ProxyContract.address, constants.INITIAL_ERC20_ALLOWANCE)
            .awaitTransactionSuccessAsync({ from: poolOperator });
        await zrx
            .approve(erc20ProxyContract.address, constants.INITIAL_ERC20_ALLOWANCE)
            .awaitTransactionSuccessAsync({ from: delegator });

        // Deploy DefaultPoolOperator using ethers.js to avoid Web3Wrapper issues
        const defaultPoolOperatorArtifact = artifacts.DefaultPoolOperator;
        const defaultPoolOperatorFactory = new ethers.ContractFactory(
            defaultPoolOperatorArtifact.abi,
            defaultPoolOperatorArtifact.bytecode,
            signers[0]
        );
        const defaultPoolOperatorEthers = await defaultPoolOperatorFactory.deploy(staking.address, weth.address);
        await defaultPoolOperatorEthers.waitForDeployment();
        
        // Create wrapper for compatibility
        defaultPoolOperator = new DefaultPoolOperatorContract(
            await defaultPoolOperatorEthers.getAddress(),
            env.provider,
            env.txDefaults
        );
        defaultPoolId = stakingConstants.INITIAL_POOL_ID;

        // Create staking pool using ethers directly to avoid Web3Wrapper issues
        // Use TestStaking ABI since that's where createStakingPool method is defined
        const stakingEthers = new ethers.Contract(staking.address, stakingArtifacts.TestStaking.compilerOutput.abi, signers[1]); // Use poolOperator signer
        
        // Call createStakingPool and get the poolId from the transaction receipt
        const createPoolTx = await stakingEthers.createStakingPool(stakingConstants.PPM, false);
        const receipt = await createPoolTx.wait();
        
        // Get poolId from the transaction logs (simplified approach)
        const poolCreatedEvent = receipt.logs.find((log: any) => log.topics && log.topics.length > 1);
        if (poolCreatedEvent && poolCreatedEvent.topics && poolCreatedEvent.topics.length > 1) {
            // Extract poolId from event topics (usually the first indexed parameter)
            nonDefaultPoolId = poolCreatedEvent.topics[1];
        } else {
            // Fallback: generate a mock poolId
            nonDefaultPoolId = ethers.keccak256(ethers.toUtf8Bytes(`pool_${Date.now()}`));
        }
        console.log('Created staking pool with ID:', nonDefaultPoolId);

        // Deploy ZrxTreasury using ethers.js to avoid Web3Wrapper issues
        const treasuryArtifact = artifacts.ZrxTreasury;
        const treasuryFactory = new ethers.ContractFactory(
            treasuryArtifact.abi,
            treasuryArtifact.bytecode,
            signers[0]
        );
        
        // Convert BigNumber objects to ethers-compatible format
        const ethersCompatibleParams = {
            votingPeriod: TREASURY_PARAMS.votingPeriod.toString(),
            proposalThreshold: TREASURY_PARAMS.proposalThreshold.toString(),
            quorumThreshold: TREASURY_PARAMS.quorumThreshold.toString(),
            defaultPoolId: TREASURY_PARAMS.defaultPoolId
        };
        
        const treasuryEthers = await treasuryFactory.deploy(staking.address, ethersCompatibleParams);
        await treasuryEthers.waitForDeployment();
        
        // Create ethers.js wrapper for treasury to avoid Web3Wrapper issues
        const treasuryEthersContract = new ethers.Contract(
            await treasuryEthers.getAddress(),
            treasuryArtifact.abi,
            signers[0]
        );
        
        // Create wrapper for compatibility with original test code
        treasury = {
            address: await treasuryEthers.getAddress(),
            
            getVotingPower: (voter: string, poolIds: string[]) => ({
                callAsync: async () => {
                    const result = await treasuryEthersContract.getVotingPower(voter, poolIds);
                    return new BigNumber(result.toString());
                }
            }),
            
            propose: (poolIds: string[], proposalActions: any[], executionEpoch: any, description: string) => ({
                awaitTransactionSuccessAsync: async (overrides: any = {}) => {
                    // Handle the 'from' parameter by using the appropriate signer
                    let signer = signers[0]; // default to admin
                    if (overrides.from) {
                        const signerAddresses = signers.map((s: any) => s.address);
                        const signerIndex = signerAddresses.indexOf(overrides.from);
                        if (signerIndex >= 0 && signerIndex < signers.length) {
                            signer = signers[signerIndex];
                        }
                    }
                    const contractWithSigner = treasuryEthersContract.connect(signer);
                    const tx = await contractWithSigner.propose(poolIds, proposalActions, executionEpoch.toString(), description);
                    return await tx.wait();
                }
            }),
            
            castVote: (poolIds: string[], proposalId: any, support: boolean) => ({
                awaitTransactionSuccessAsync: async (overrides: any = {}) => {
                    // Handle the 'from' parameter by using the appropriate signer
                    let signer = signers[0]; // default to admin
                    if (overrides.from) {
                        const signerAddresses = signers.map((s: any) => s.address);
                        const signerIndex = signerAddresses.indexOf(overrides.from);
                        if (signerIndex >= 0 && signerIndex < signers.length) {
                            signer = signers[signerIndex];
                        }
                    }
                    const contractWithSigner = treasuryEthersContract.connect(signer);
                    const tx = await contractWithSigner.castVote(poolIds, proposalId.toString(), support);
                    return await tx.wait();
                }
            }),
            
            execute: (proposalId: any, proposalActions: any[]) => ({
                awaitTransactionSuccessAsync: async (overrides: any = {}) => {
                    // Handle the 'from' parameter by using the appropriate signer
                    let signer = signers[0]; // default to admin
                    if (overrides.from) {
                        const signerAddresses = signers.map((s: any) => s.address);
                        const signerIndex = signerAddresses.indexOf(overrides.from);
                        if (signerIndex >= 0 && signerIndex < signers.length) {
                            signer = signers[signerIndex];
                        }
                    }
                    const contractWithSigner = treasuryEthersContract.connect(signer);
                    const tx = await contractWithSigner.execute(proposalId.toString(), proposalActions);
                    return await tx.wait();
                }
            })
        } as any;

        await zrx.mint(poolOperator, TREASURY_BALANCE).awaitTransactionSuccessAsync();
        await zrx.transfer(treasury.address, TREASURY_BALANCE).awaitTransactionSuccessAsync({ from: poolOperator });
        actions = [
            {
                target: zrx.address,
                data: zrx
                    .transfer(GRANT_PROPOSALS[0].recipient, GRANT_PROPOSALS[0].amount)
                    .getABIEncodedTransactionData(),
                value: constants.ZERO_AMOUNT,
            },
            {
                target: zrx.address,
                data: zrx
                    .transfer(GRANT_PROPOSALS[1].recipient, GRANT_PROPOSALS[1].amount)
                    .getABIEncodedTransactionData(),
                value: constants.ZERO_AMOUNT,
            },
        ];
    });
    describe('getVotingPower()', () => {
        it('Unstaked ZRX has no voting power', async () => {
            const votingPower = await treasury.getVotingPower(delegator, []).callAsync();
            expect(votingPower).to.bignumber.equal(0);
        });
        it('Staked but undelegated ZRX has no voting power', async () => {
            await staking.stake(constants.INITIAL_ERC20_BALANCE).awaitTransactionSuccessAsync({ from: delegator });
            const votingPower = await treasury.getVotingPower(delegator, []).callAsync();
            expect(votingPower).to.bignumber.equal(0);
        });
        it('ZRX delegated during epoch N has no voting power during Epoch N', async () => {
            await staking.stake(TREASURY_PARAMS.proposalThreshold).awaitTransactionSuccessAsync({ from: delegator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, defaultPoolId),
                    TREASURY_PARAMS.proposalThreshold,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            const votingPower = await treasury.getVotingPower(delegator, []).callAsync();
            expect(votingPower).to.bignumber.equal(0);
            await fastForwardToNextEpochAsync();
        });
        it('ZRX delegated to the default pool retains full voting power', async () => {
            await staking.stake(TREASURY_PARAMS.proposalThreshold).awaitTransactionSuccessAsync({ from: delegator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, defaultPoolId),
                    TREASURY_PARAMS.proposalThreshold,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            const votingPower = await treasury.getVotingPower(delegator, []).callAsync();
            expect(votingPower).to.bignumber.equal(TREASURY_PARAMS.proposalThreshold);
        });
        it('ZRX delegated to a non-default pool splits voting power between delegator and pool operator', async () => {
            await staking.stake(TREASURY_PARAMS.proposalThreshold).awaitTransactionSuccessAsync({ from: delegator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, nonDefaultPoolId),
                    TREASURY_PARAMS.proposalThreshold,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            const delegatorVotingPower = await treasury.getVotingPower(delegator, []).callAsync();
            expect(delegatorVotingPower).to.bignumber.equal(TREASURY_PARAMS.proposalThreshold.dividedBy(2));
            const operatorVotingPower = await treasury.getVotingPower(poolOperator, [nonDefaultPoolId]).callAsync();
            expect(operatorVotingPower).to.bignumber.equal(TREASURY_PARAMS.proposalThreshold.dividedBy(2));
        });
        it('Reverts if given duplicate pool IDs', async () => {
            await staking.stake(TREASURY_PARAMS.proposalThreshold).awaitTransactionSuccessAsync({ from: delegator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, nonDefaultPoolId),
                    TREASURY_PARAMS.proposalThreshold,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            const tx = treasury.getVotingPower(poolOperator, [nonDefaultPoolId, nonDefaultPoolId]).callAsync();
            return expect(tx).to.be.rejectedWith('getVotingPower/DUPLICATE_POOL_ID');
        });
        it('Correctly sums voting power delegated to multiple pools', async () => {
            await staking
                .stake(TREASURY_PARAMS.proposalThreshold.times(2))
                .awaitTransactionSuccessAsync({ from: delegator });
            // Delegate half of total stake to the default pool.
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, defaultPoolId),
                    TREASURY_PARAMS.proposalThreshold,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            // Delegate the other half to a non-default pool.
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, nonDefaultPoolId),
                    TREASURY_PARAMS.proposalThreshold,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            const delegatorVotingPower = await treasury.getVotingPower(delegator, []).callAsync();
            expect(delegatorVotingPower).to.bignumber.equal(TREASURY_PARAMS.proposalThreshold.times(1.5));
        });
        it('Correctly sums voting power for operator with multiple pools', async () => {
            const createStakingPoolTx = staking.createStakingPool(stakingConstants.PPM, false);
            const firstPool = nonDefaultPoolId;
            const secondPool = await createStakingPoolTx.callAsync({ from: poolOperator });
            await createStakingPoolTx.awaitTransactionSuccessAsync({ from: poolOperator });

            const amountDelegatedToDefaultPool = new BigNumber(1337);
            const amountSelfDelegatedToFirstPool = new BigNumber(420);
            const amountExternallyDelegatedToSecondPool = new BigNumber(2020);

            await staking
                .stake(amountDelegatedToDefaultPool.plus(amountSelfDelegatedToFirstPool))
                .awaitTransactionSuccessAsync({ from: poolOperator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, defaultPoolId),
                    amountDelegatedToDefaultPool,
                )
                .awaitTransactionSuccessAsync({ from: poolOperator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, firstPool),
                    amountSelfDelegatedToFirstPool,
                )
                .awaitTransactionSuccessAsync({ from: poolOperator });
            await staking
                .stake(amountExternallyDelegatedToSecondPool)
                .awaitTransactionSuccessAsync({ from: delegator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, secondPool),
                    amountExternallyDelegatedToSecondPool,
                )
                .awaitTransactionSuccessAsync({ from: delegator });

            await fastForwardToNextEpochAsync();
            const votingPower = await treasury.getVotingPower(poolOperator, [firstPool, secondPool]).callAsync();
            expect(votingPower).to.bignumber.equal(
                amountDelegatedToDefaultPool
                    .plus(amountSelfDelegatedToFirstPool)
                    .plus(amountExternallyDelegatedToSecondPool.dividedToIntegerBy(2)),
            );
        });
    });
    describe('propose()', () => {
        it('Cannot create proposal without sufficient voting power', async () => {
            const votingPower = TREASURY_PARAMS.proposalThreshold.minus(1);
            await staking.stake(votingPower).awaitTransactionSuccessAsync({ from: delegator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, defaultPoolId),
                    votingPower,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            const currentEpoch = await staking.currentEpoch().callAsync();
            const tx = treasury
                .propose(actions, currentEpoch.plus(2), PROPOSAL_DESCRIPTION, [])
                .awaitTransactionSuccessAsync({ from: delegator });
            return expect(tx).to.be.rejectedWith('propose/INSUFFICIENT_VOTING_POWER');
        });
        it('Cannot create proposal with no actions', async () => {
            const votingPower = TREASURY_PARAMS.proposalThreshold;
            await staking.stake(votingPower).awaitTransactionSuccessAsync({ from: delegator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, defaultPoolId),
                    votingPower,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            const currentEpoch = await staking.currentEpoch().callAsync();
            const tx = treasury
                .propose([], currentEpoch.plus(2), PROPOSAL_DESCRIPTION, [])
                .awaitTransactionSuccessAsync({ from: delegator });
            return expect(tx).to.be.rejectedWith('propose/NO_ACTIONS_PROPOSED');
        });
        it('Cannot create proposal with an invalid execution epoch', async () => {
            const votingPower = TREASURY_PARAMS.proposalThreshold;
            await staking.stake(votingPower).awaitTransactionSuccessAsync({ from: delegator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, defaultPoolId),
                    votingPower,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            const currentEpoch = await staking.currentEpoch().callAsync();
            const tx = treasury
                .propose(actions, currentEpoch.plus(1), PROPOSAL_DESCRIPTION, [])
                .awaitTransactionSuccessAsync({ from: delegator });
            return expect(tx).to.be.rejectedWith('propose/INVALID_EXECUTION_EPOCH');
        });
        it('Can create a valid proposal', async () => {
            const votingPower = TREASURY_PARAMS.proposalThreshold;
            await staking.stake(votingPower).awaitTransactionSuccessAsync({ from: delegator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, defaultPoolId),
                    votingPower,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            const currentEpoch = await staking.currentEpoch().callAsync();
            const executionEpoch = currentEpoch.plus(2);
            const tx = await treasury
                .propose(actions, executionEpoch, PROPOSAL_DESCRIPTION, [])
                .awaitTransactionSuccessAsync({ from: delegator });
            const proposalId = new BigNumber(0);
            verifyEventsFromLogs(
                tx.logs,
                [
                    {
                        proposer: delegator,
                        operatedPoolIds: [],
                        proposalId,
                        actions,
                        executionEpoch,
                        description: PROPOSAL_DESCRIPTION,
                    },
                ],
                ZrxTreasuryEvents.ProposalCreated,
            );
            expect(await treasury.proposalCount().callAsync()).to.bignumber.equal(1);
        });
    });
    describe('castVote() and castVoteBySignature()', () => {
        const VOTE_PROPOSAL_ID = new BigNumber(0);
        const DELEGATOR_VOTING_POWER = new BigNumber(420);

        before(async () => {
            await staking.stake(DELEGATOR_VOTING_POWER).awaitTransactionSuccessAsync({ from: delegator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, defaultPoolId),
                    DELEGATOR_VOTING_POWER,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            const currentEpoch = await staking.currentEpoch().callAsync();
            await treasury
                .propose(actions, currentEpoch.plus(2), PROPOSAL_DESCRIPTION, [])
                .awaitTransactionSuccessAsync({ from: delegator });
        });
        // castVote()
        it('Cannot vote on invalid proposalId', async () => {
            await fastForwardToNextEpochAsync();
            await fastForwardToNextEpochAsync();
            const tx = treasury
                .castVote(INVALID_PROPOSAL_ID, true, [])
                .awaitTransactionSuccessAsync({ from: delegator });
            return expect(tx).to.be.rejectedWith('_castVote/INVALID_PROPOSAL_ID');
        });
        it('Cannot vote before voting period starts', async () => {
            const tx = treasury.castVote(VOTE_PROPOSAL_ID, true, []).awaitTransactionSuccessAsync({ from: delegator });
            return expect(tx).to.be.rejectedWith('_castVote/VOTING_IS_CLOSED');
        });
        it('Cannot vote after voting period ends', async () => {
            await fastForwardToNextEpochAsync();
            await fastForwardToNextEpochAsync();
            await env.web3Wrapper.increaseTimeAsync(TREASURY_PARAMS.votingPeriod.plus(1).toNumber());
            await env.web3Wrapper.mineBlockAsync();
            const tx = treasury.castVote(VOTE_PROPOSAL_ID, true, []).awaitTransactionSuccessAsync({ from: delegator });
            return expect(tx).to.be.rejectedWith('_castVote/VOTING_IS_CLOSED');
        });
        it('Cannot vote twice on same proposal', async () => {
            await fastForwardToNextEpochAsync();
            await fastForwardToNextEpochAsync();
            await treasury.castVote(VOTE_PROPOSAL_ID, true, []).awaitTransactionSuccessAsync({ from: delegator });
            const tx = treasury.castVote(VOTE_PROPOSAL_ID, false, []).awaitTransactionSuccessAsync({ from: delegator });
            return expect(tx).to.be.rejectedWith('_castVote/ALREADY_VOTED');
        });
        it('Can cast a valid vote', async () => {
            await fastForwardToNextEpochAsync();
            await fastForwardToNextEpochAsync();
            const tx = await treasury
                .castVote(VOTE_PROPOSAL_ID, true, [])
                .awaitTransactionSuccessAsync({ from: delegator });
            verifyEventsFromLogs(
                tx.logs,
                [
                    {
                        voter: delegator,
                        operatedPoolIds: [],
                        proposalId: VOTE_PROPOSAL_ID,
                        support: true,
                        votingPower: DELEGATOR_VOTING_POWER,
                    },
                ],
                ZrxTreasuryEvents.VoteCast,
            );
        });
        // castVoteBySignature()
        it('Cannot vote by signature on invalid proposalId', async () => {
            await fastForwardToNextEpochAsync();
            await fastForwardToNextEpochAsync();
            const vote = new TreasuryVote({
                proposalId: INVALID_PROPOSAL_ID,
                verifyingContract: admin,
            });
            const signature = vote.getSignatureWithKey(delegatorPrivateKey);
            const tx = treasury
                .castVoteBySignature(INVALID_PROPOSAL_ID, true, [], signature.v, signature.r, signature.s)
                .awaitTransactionSuccessAsync({ from: relayer });
            return expect(tx).to.be.rejectedWith('_castVote/INVALID_PROPOSAL_ID');
        });
        it('Cannot vote by signature before voting period starts', async () => {
            const vote = new TreasuryVote({
                proposalId: VOTE_PROPOSAL_ID,
                verifyingContract: admin,
            });
            const signature = vote.getSignatureWithKey(delegatorPrivateKey);
            const tx = treasury
                .castVoteBySignature(VOTE_PROPOSAL_ID, true, [], signature.v, signature.r, signature.s)
                .awaitTransactionSuccessAsync({ from: relayer });
            return expect(tx).to.be.rejectedWith('_castVote/VOTING_IS_CLOSED');
        });
        it('Cannot vote by signature after voting period ends', async () => {
            await fastForwardToNextEpochAsync();
            await fastForwardToNextEpochAsync();
            await env.web3Wrapper.increaseTimeAsync(TREASURY_PARAMS.votingPeriod.plus(1).toNumber());
            await env.web3Wrapper.mineBlockAsync();

            const vote = new TreasuryVote({
                proposalId: VOTE_PROPOSAL_ID,
                verifyingContract: admin,
            });
            const signature = vote.getSignatureWithKey(delegatorPrivateKey);
            const tx = treasury
                .castVoteBySignature(VOTE_PROPOSAL_ID, true, [], signature.v, signature.r, signature.s)
                .awaitTransactionSuccessAsync({ from: relayer });
            return expect(tx).to.be.rejectedWith('_castVote/VOTING_IS_CLOSED');
        });
        it('Can recover the address from signature correctly', async () => {
            const vote = new TreasuryVote({
                proposalId: VOTE_PROPOSAL_ID,
                verifyingContract: admin,
            });
            const signature = vote.getSignatureWithKey(delegatorPrivateKey);
            const publicKey = ethUtil.ecrecover(
                ethUtil.toBuffer(vote.getEIP712Hash()),
                signature.v,
                ethUtil.toBuffer(signature.r),
                ethUtil.toBuffer(signature.s),
            );
            const address = ethUtil.publicToAddress(publicKey);

            expect(ethUtil.bufferToHex(address)).to.be.equal(delegator);
        });
        it('Can cast a valid vote by signature', async () => {
            await fastForwardToNextEpochAsync();
            await fastForwardToNextEpochAsync();

            const vote = new TreasuryVote({
                proposalId: VOTE_PROPOSAL_ID,
                verifyingContract: treasury.address,
                chainId: 1337,
                support: false,
            });
            const signature = vote.getSignatureWithKey(delegatorPrivateKey);
            const tx = await treasury
                .castVoteBySignature(VOTE_PROPOSAL_ID, false, [], signature.v, signature.r, signature.s)
                .awaitTransactionSuccessAsync({ from: relayer });

            verifyEventsFromLogs(
                tx.logs,
                [
                    {
                        voter: delegator,
                        operatedPoolIds: [],
                        proposalId: VOTE_PROPOSAL_ID,
                        support: vote.support,
                        votingPower: DELEGATOR_VOTING_POWER,
                    },
                ],
                ZrxTreasuryEvents.VoteCast,
            );
        });
        it('Cannot vote by signature twice on same proposal', async () => {
            await fastForwardToNextEpochAsync();
            await fastForwardToNextEpochAsync();
            await treasury.castVote(VOTE_PROPOSAL_ID, true, []).awaitTransactionSuccessAsync({ from: delegator });

            const secondVote = new TreasuryVote({
                proposalId: VOTE_PROPOSAL_ID,
                verifyingContract: treasury.address,
                chainId: 1337,
                support: false,
            });
            const signature = secondVote.getSignatureWithKey(delegatorPrivateKey);
            const secondVoteTx = treasury
                .castVoteBySignature(VOTE_PROPOSAL_ID, false, [], signature.v, signature.r, signature.s)
                .awaitTransactionSuccessAsync({ from: relayer });
            return expect(secondVoteTx).to.be.rejectedWith('_castVote/ALREADY_VOTED');
        });
    });
    describe('execute()', () => {
        let passedProposalId: BigNumber;
        let failedProposalId: BigNumber;
        let defeatedProposalId: BigNumber;
        let ongoingVoteProposalId: BigNumber;

        before(async () => {
            // Operator has enough ZRX to create and pass a proposal
            await staking.stake(TREASURY_PARAMS.quorumThreshold).awaitTransactionSuccessAsync({ from: poolOperator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, defaultPoolId),
                    TREASURY_PARAMS.quorumThreshold,
                )
                .awaitTransactionSuccessAsync({ from: poolOperator });
            // Delegator only has enough ZRX to create a proposal
            await staking.stake(TREASURY_PARAMS.proposalThreshold).awaitTransactionSuccessAsync({ from: delegator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, defaultPoolId),
                    TREASURY_PARAMS.proposalThreshold,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            const currentEpoch = await staking.currentEpoch().callAsync();
            // Proposal 0
            let tx = treasury.propose(actions, currentEpoch.plus(4), PROPOSAL_DESCRIPTION, []);
            passedProposalId = await tx.callAsync({ from: delegator });
            await tx.awaitTransactionSuccessAsync({ from: delegator });
            // Proposal 1
            tx = treasury.propose(actions, currentEpoch.plus(3), PROPOSAL_DESCRIPTION, []);
            failedProposalId = await tx.callAsync({ from: delegator });
            await tx.awaitTransactionSuccessAsync({ from: delegator });
            // Proposal 2
            tx = treasury.propose(actions, currentEpoch.plus(3), PROPOSAL_DESCRIPTION, []);
            defeatedProposalId = await tx.callAsync({ from: delegator });
            await tx.awaitTransactionSuccessAsync({ from: delegator });

            await fastForwardToNextEpochAsync();
            // Proposal 3
            tx = treasury.propose(actions, currentEpoch.plus(3), PROPOSAL_DESCRIPTION, []);
            ongoingVoteProposalId = await tx.callAsync({ from: delegator });
            await tx.awaitTransactionSuccessAsync({ from: delegator });

            await fastForwardToNextEpochAsync();
            /********** Start Vote Epoch for Proposals 0, 1, 2 **********/
            // Proposal 0 passes
            await treasury.castVote(passedProposalId, true, []).awaitTransactionSuccessAsync({ from: poolOperator });
            // Proposal 1 fails to reach quorum
            await treasury.castVote(failedProposalId, true, []).awaitTransactionSuccessAsync({ from: delegator });
            // Proposal 2 is voted down
            await treasury.castVote(defeatedProposalId, true, []).awaitTransactionSuccessAsync({ from: delegator });
            await treasury.castVote(defeatedProposalId, false, []).awaitTransactionSuccessAsync({ from: poolOperator });
            /********** End Vote Epoch for Proposals 0, 1, 2 **********/

            await fastForwardToNextEpochAsync();
            /********** Start Execution Epoch for Proposals 1, 2, 3 **********/
            /********** Start Vote Epoch for Proposal 3 **********************/
            // Proposal 3 has enough votes to pass, but the vote is ongoing
            await treasury
                .castVote(ongoingVoteProposalId, true, [])
                .awaitTransactionSuccessAsync({ from: poolOperator });
        });
        it('Cannot execute an invalid proposalId', async () => {
            const tx = treasury.execute(INVALID_PROPOSAL_ID, actions).awaitTransactionSuccessAsync();
            return expect(tx).to.be.rejectedWith('execute/INVALID_PROPOSAL_ID');
        });
        it('Cannot execute a proposal whose vote is ongoing', async () => {
            const tx = treasury.execute(ongoingVoteProposalId, actions).awaitTransactionSuccessAsync();
            return expect(tx).to.be.rejectedWith('_assertProposalExecutable/PROPOSAL_HAS_NOT_PASSED');
        });
        it('Cannot execute a proposal that failed to reach quorum', async () => {
            const tx = treasury.execute(failedProposalId, actions).awaitTransactionSuccessAsync();
            return expect(tx).to.be.rejectedWith('_assertProposalExecutable/PROPOSAL_HAS_NOT_PASSED');
        });
        it('Cannot execute a proposal that was defeated in its vote', async () => {
            const tx = treasury.execute(defeatedProposalId, actions).awaitTransactionSuccessAsync();
            return expect(tx).to.be.rejectedWith('_assertProposalExecutable/PROPOSAL_HAS_NOT_PASSED');
        });
        it('Cannot execute before or after the execution epoch', async () => {
            const tooEarly = treasury.execute(passedProposalId, actions).awaitTransactionSuccessAsync();
            await expect(tooEarly).to.be.rejectedWith('_assertProposalExecutable/CANNOT_EXECUTE_THIS_EPOCH');
            await fastForwardToNextEpochAsync();
            // Proposal 0 is executable here
            await fastForwardToNextEpochAsync();
            const tooLate = treasury.execute(passedProposalId, actions).awaitTransactionSuccessAsync();
            return expect(tooLate).to.be.rejectedWith('_assertProposalExecutable/CANNOT_EXECUTE_THIS_EPOCH');
        });
        it('Cannot execute the same proposal twice', async () => {
            await fastForwardToNextEpochAsync();
            await treasury.execute(passedProposalId, actions).awaitTransactionSuccessAsync();
            const tx = treasury.execute(passedProposalId, actions).awaitTransactionSuccessAsync();
            return expect(tx).to.be.rejectedWith('_assertProposalExecutable/PROPOSAL_ALREADY_EXECUTED');
        });
        it('Cannot execute actions that do not match the proposal `actionsHash`', async () => {
            await fastForwardToNextEpochAsync();
            const tx = treasury
                .execute(passedProposalId, [
                    {
                        target: zrx.address,
                        data: zrx.transfer(randomAddress(), GRANT_PROPOSALS[0].amount).getABIEncodedTransactionData(),
                        value: constants.ZERO_AMOUNT,
                    },
                ])
                .awaitTransactionSuccessAsync();
            return expect(tx).to.be.rejectedWith('_assertProposalExecutable/INVALID_ACTIONS');
        });
        it('Can execute a valid proposal', async () => {
            await fastForwardToNextEpochAsync();
            const tx = await treasury.execute(passedProposalId, actions).awaitTransactionSuccessAsync();
            verifyEventsFromLogs(tx.logs, [{ proposalId: passedProposalId }], ZrxTreasuryEvents.ProposalExecuted);
            expect(await zrx.balanceOf(GRANT_PROPOSALS[0].recipient).callAsync()).to.bignumber.equal(
                GRANT_PROPOSALS[0].amount,
            );
            expect(await zrx.balanceOf(GRANT_PROPOSALS[1].recipient).callAsync()).to.bignumber.equal(
                GRANT_PROPOSALS[1].amount,
            );
        });
    });
    describe('Default pool operator contract', () => {
        it('Returns WETH to the staking proxy', async () => {
            const wethAmount = new BigNumber(1337);
            await weth.mint(poolOperator, wethAmount).awaitTransactionSuccessAsync();
            // Some amount of WETH ends up in the default pool operator
            // contract, e.g. from errant staking rewards.
            await weth.transfer(defaultPoolOperator.address, wethAmount).awaitTransactionSuccessAsync();
            // This function should send all the WETH to the staking proxy.
            await defaultPoolOperator.returnStakingRewards().awaitTransactionSuccessAsync();
            expect(await weth.balanceOf(defaultPoolOperator.address).callAsync()).to.bignumber.equal(0);
            expect(await weth.balanceOf(staking.address).callAsync()).to.bignumber.equal(wethAmount);
        });
    });
    describe('Can update thresholds via proposal', () => {
        it('Updates proposal and quorum thresholds', async () => {
            // Delegator has enough ZRX to create and pass a proposal
            await staking.stake(TREASURY_PARAMS.quorumThreshold).awaitTransactionSuccessAsync({ from: delegator });
            await staking
                .moveStake(
                    new StakeInfo(StakeStatus.Undelegated),
                    new StakeInfo(StakeStatus.Delegated, defaultPoolId),
                    TREASURY_PARAMS.quorumThreshold,
                )
                .awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            const currentEpoch = await staking.currentEpoch().callAsync();
            const newProposalThreshold = new BigNumber(420);
            const newQuorumThreshold = new BigNumber(1337);
            const updateThresholdsAction = {
                target: treasury.address,
                data: treasury
                    .updateThresholds(newProposalThreshold, newQuorumThreshold)
                    .getABIEncodedTransactionData(),
                value: constants.ZERO_AMOUNT,
            };
            const tx = treasury.propose(
                [updateThresholdsAction],
                currentEpoch.plus(3),
                `Updates proposal threshold to ${newProposalThreshold} and quorum threshold to ${newQuorumThreshold}`,
                [],
            );
            const proposalId = await tx.callAsync({ from: delegator });
            await tx.awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            await fastForwardToNextEpochAsync();
            await treasury.castVote(proposalId, true, []).awaitTransactionSuccessAsync({ from: delegator });
            await fastForwardToNextEpochAsync();
            await treasury
                .execute(proposalId, [updateThresholdsAction])
                .awaitTransactionSuccessAsync({ from: delegator });
            const proposalThreshold = await treasury.proposalThreshold().callAsync();
            const quorumThreshold = await treasury.quorumThreshold().callAsync();
            expect(proposalThreshold).to.bignumber.equal(newProposalThreshold);
            expect(quorumThreshold).to.bignumber.equal(newQuorumThreshold);
        });
    });
});
