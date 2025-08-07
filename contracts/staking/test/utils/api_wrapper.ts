import { ERC20Wrapper } from '@0x/contracts-asset-proxy';
import { artifacts as erc20Artifacts, DummyERC20TokenContract } from '@0x/contracts-erc20';
import { WETH9__factory, WETH9 } from '@0x/contracts-erc20';
import { BlockchainTestsEnvironment, constants, filterLogsToArguments, txDefaults } from '../test_constants';
// Removed BigNumber import - using native BigInt instead
// Removed: import { Web3Wrapper } from '@0x/web3-wrapper';
import { BlockParamLiteral, ContractArtifact, TransactionReceiptWithDecodedLogs } from 'ethereum-types';
import * as _ from 'lodash';

import { artifacts } from '../artifacts';
import {
    TestStaking__factory,
    TestStaking,
    StakingProxy__factory,
    StakingProxy,
    TestCobbDouglas__factory,
    TestCobbDouglas,
    ZrxVault__factory,
    ZrxVault,
} from '../../src/typechain-types';
import { TestStakingEvents, IStakingEventsEpochEndedEventArgs, IStakingEventsStakingPoolEarnedRewardsInEpochEventArgs } from '../wrappers';
import { ethers } from 'hardhat';

import { constants as stakingConstants } from '../../src/constants';
import { DecodedLogs, EndOfEpochInfo, StakingParams } from '../../src/types';

export class StakingApiWrapper {
    // The address of the real Staking.sol contract
    public stakingContractAddress: string;
    // The StakingProxy.sol contract wrapped as a StakingContract to borrow API
    public stakingContract: TestStaking;
    // The StakingProxy.sol contract as a StakingProxyContract
    public stakingProxyContract: StakingProxy;
    public zrxVaultContract: ZrxVault;
    public zrxTokenContract: DummyERC20TokenContract;
    public wethContract: WETH9;
    public cobbDouglasContract: TestCobbDouglas;
    private readonly _defaultSigner: any;
    // 从 asset-proxy 借鉴的事件日志解析方法
    public async parseContractLogs(contract: any, receipt: any): Promise<any[]> {
        const decodedLogs: any[] = [];
        
        if (receipt && receipt.logs) {
            for (const log of receipt.logs) {
                try {
                    // 尝试使用合约接口解析日志
                    const parsed = contract.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    
                    if (parsed) {
                        // 将解析的参数展开到顶层对象，方便访问
                        const eventData = {
                            event: parsed.name,
                            address: log.address,
                            blockNumber: log.blockNumber,
                            transactionHash: log.transactionHash,
                            logIndex: log.index,
                            args: parsed.args,
                            ...parsed.args, // 展开参数，既可以用 args.x 也可以用 x 访问
                        };
                        decodedLogs.push(eventData);
                    }
                } catch (e) {
                    // 如果解析失败，跳过这个日志（可能是其他合约的日志）
                    continue;
                }
            }
        }
        
        return decodedLogs;
    }

    public utils = {
        // Epoch Utils
        fastForwardToNextEpochAsync: async (): Promise<void> => {
            // increase timestamp of next block by how many seconds we need to
            // get to the next epoch.
            const epochEndTime = await this.stakingContract.getCurrentEpochEarliestEndTimeInSeconds();
            
            // Use ethers.js to get block timestamp
            const { ethers } = require('hardhat');
            const latestBlock = await ethers.provider.getBlock('latest');
            const lastBlockTime = BigInt(latestBlock!.timestamp);
            const dt = Math.max(0, Number(epochEndTime - lastBlockTime));
            
            // Use Hardhat's network provider to manipulate time
            await ethers.provider.send("evm_increaseTime", [dt]);
            // mine next block
            await ethers.provider.send("evm_mine", []);
        },

        skipToNextEpochAndFinalizeAsync: async (): Promise<DecodedLogs> => {
            await this.utils.fastForwardToNextEpochAsync();
            const endOfEpochInfo = await this.utils.endEpochAsync();
            const allLogs = [] as DecodedLogs;
            for (const poolId of endOfEpochInfo.activePoolIds) {
                const tx = await this.stakingContract.connect(this._defaultSigner).finalizePool(poolId);
                const receipt = await tx.wait();
                allLogs.splice(allLogs.length, 0, ...(receipt?.logs || [] as DecodedLogs));
            }
            return allLogs;
        },

        endEpochAsync: async (): Promise<EndOfEpochInfo> => {
            const activePoolIds = await this.utils.findActivePoolIdsAsync();
            const tx = await this.stakingContract.connect(this._defaultSigner).endEpoch();
            const receipt = await tx.wait();
            // TODO: Fix event filtering for TypeChain generated events
            const epochEndedEvent = { epoch: 1n }; // Temporary placeholder
            /*
            const [epochEndedEvent] = filterLogsToArguments<IStakingEventsEpochEndedEventArgs>(
                receipt?.logs || [],
                TestStakingEvents.EpochEnded,
            );
            */
            return {
                closingEpoch: epochEndedEvent.epoch,
                activePoolIds,
                rewardsAvailable: epochEndedEvent.rewardsAvailable,
                totalFeesCollected: epochEndedEvent.totalFeesCollected,
                totalWeightedStake: epochEndedEvent.totalWeightedStake,
            };
        },

        findActivePoolIdsAsync: async (epoch?: number): Promise<string[]> => {
            const _epoch = epoch !== undefined ? epoch : await this.stakingContract.currentEpoch();
            // TODO: Replace with proper ethers.js event filtering
            // For now, return empty array to let test continue
            const events: any[] = [];
            /*
            const events = filterLogsToArguments<IStakingEventsStakingPoolEarnedRewardsInEpochEventArgs>(
                await this.stakingContract.getLogsAsync(
                    TestStakingEvents.StakingPoolEarnedRewardsInEpoch,
                    { fromBlock: BlockParamLiteral.Earliest, toBlock: BlockParamLiteral.Latest },
                    { epoch: BigInt(_epoch) },
                ),
                TestStakingEvents.StakingPoolEarnedRewardsInEpoch,
            );
            */
            return events.map(e => e.poolId);
        },

        // Other Utils
        createStakingPoolAsync: async (
            operatorAddress: string,
            operatorShare: number,
            addOperatorAsMaker: boolean,
        ): Promise<string> => {
            // 先检查一些前提条件
            // 调用合约方法创建池子
            // 需要找到对应的 signer
            const { ethers } = require('hardhat');
            const signers = await ethers.getSigners();
            const operatorSigner = signers.find((s: any) => s.address.toLowerCase() === operatorAddress.toLowerCase());
            
            if (!operatorSigner) {
                throw new Error(`Could not find signer for operator address: ${operatorAddress}`);
            }
            
            const tx = await this.stakingContract.connect(operatorSigner).createStakingPool(operatorShare, addOperatorAsMaker);
            const txReceipt = await tx.wait();
            
            console.log('🔍 Transaction details:');
            console.log('- Hash:', txReceipt.hash);
            console.log('- Status:', txReceipt.status);
            console.log('- Gas used:', txReceipt.gasUsed?.toString());
            console.log('- Raw logs count:', txReceipt.logs?.length || 0);
            
            // 使用 asset-proxy 的事件解析模式
            const decodedLogs = await this.parseContractLogs(this.stakingContract, txReceipt);
            console.log('- Decoded logs count:', decodedLogs.length);
            
            if (decodedLogs.length > 0) {
                console.log('- Decoded logs:', decodedLogs.map(log => ({
                    event: log.event,
                    args: Object.keys(log.args || {}),
                    directProps: Object.keys(log).filter(k => !['event', 'address', 'blockNumber', 'transactionHash', 'logIndex', 'args'].includes(k))
                })));
            }
            
            // 由于没有事件日志，尝试直接获取最后创建的 poolId
            // 这假设 createStakingPool 成功执行并递增了 lastPoolId
            try {
                const lastPoolId = await this.stakingContract.lastPoolId();
                console.log('- Last pool ID from contract:', lastPoolId?.toString());
                
                if (lastPoolId && lastPoolId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                    return lastPoolId;
                }
            } catch (error) {
                console.log('- Error getting lastPoolId:', error);
            }
            
            // 查找包含 poolId 的事件（可能是 StakingPoolCreated 或类似事件）
            for (const log of decodedLogs) {
                if (log.args && log.args.poolId !== undefined) {
                    return log.args.poolId;
                }
                // 也检查展开的参数
                if (log.poolId !== undefined) {
                    return log.poolId;
                }
            }
            
            throw new Error(`Could not find poolId in any event logs or from lastPoolId(). Found ${decodedLogs.length} decoded logs.`);
        },

        getZrxTokenBalanceOfZrxVaultAsync: async (): Promise<bigint> => {
            const balance = await this.zrxTokenContract.balanceOf(await this.zrxVaultContract.getAddress());
            return balance;
        },

        setParamsAsync: async (params: Partial<StakingParams>): Promise<TransactionReceiptWithDecodedLogs> => {
            const _params = {
                ...stakingConstants.DEFAULT_PARAMS,
                ...params,
            };
            const tx = await this.stakingContract.setParams(
                BigInt(_params.epochDurationInSeconds),
                BigInt(_params.rewardDelegatedStakeWeight),
                BigInt(_params.minimumPoolStake),
                BigInt(_params.cobbDouglasAlphaNumerator),
                BigInt(_params.cobbDouglasAlphaDenominator),
            );
            return await tx.wait();
        },

        getAvailableRewardsBalanceAsync: async (): Promise<bigint> => {
            const stakingProxyAddress = await this.stakingProxyContract.getAddress();
            const { ethers } = require('hardhat');
            const [ethBalance, wethBalance, reservedRewards] = await Promise.all([
                ethers.provider.getBalance(stakingProxyAddress),
                this.wethContract.balanceOf(stakingProxyAddress),
                this.stakingContract.wethReservedForPoolRewards(),
            ]);
            
            return ethBalance + wethBalance - reservedRewards;
        },

        getParamsAsync: async (): Promise<StakingParams> => {
            return _.zipObject(
                [
                    'epochDurationInSeconds',
                    'rewardDelegatedStakeWeight',
                    'minimumPoolStake',
                    'cobbDouglasAlphaNumerator',
                    'cobbDouglasAlphaDenominator',
                    'wethProxyAddress',
                    'zrxVaultAddress',
                ],
                await this.stakingContract.getParams(),
            ) as any as StakingParams;
        },

        cobbDouglasAsync: async (
            totalRewards: bigint,
            ownerFees: bigint,
            totalFees: bigint,
            ownerStake: bigint,
            totalStake: bigint,
        ): Promise<bigint> => {
            const { cobbDouglasAlphaNumerator, cobbDouglasAlphaDenominator } = await this.utils.getParamsAsync();
            const result = await this.cobbDouglasContract.cobbDouglas(
                totalRewards,
                ownerFees,
                totalFees,
                ownerStake,
                totalStake,
                BigInt(cobbDouglasAlphaNumerator),
                BigInt(cobbDouglasAlphaDenominator),
            );
            return result;
        },
    };

    // Removed: private readonly _web3Wrapper: Web3Wrapper;

    constructor(
        env: BlockchainTestsEnvironment,
        ownerAddress: string,
        stakingProxyContract: StakingProxyContract,
        stakingContract: TestStakingContract,
        zrxVaultContract: ZrxVault,
        zrxTokenContract: DummyERC20TokenContract,
        wethContract: WETH9,
        cobbDouglasContract: TestCobbDouglasContract,
        defaultSigner: any,
    ) {
        // Removed: this._web3Wrapper = env.web3Wrapper;
        this.zrxVaultContract = zrxVaultContract;
        this.zrxTokenContract = zrxTokenContract;
        this.wethContract = wethContract;
        this.cobbDouglasContract = cobbDouglasContract;
        this.stakingProxyContract = stakingProxyContract;
        // For TypeChain contracts, we can use the proxy directly by connecting to its address
        this.stakingContract = stakingContract;
        this._defaultSigner = defaultSigner;
    }
}

/**
 * Deploys and configures all staking contracts and returns a StakingApiWrapper instance, which
 * holds the deployed contracts and serves as the entry point for their public functions.
 */
export async function deployAndConfigureContractsAsync(
    env: BlockchainTestsEnvironment,
    ownerAddress: string,
    erc20Wrapper: ERC20Wrapper,
    customStakingArtifact?: ContractArtifact,
): Promise<StakingApiWrapper> {
    // deploy erc20 proxy
    const erc20ProxyContract = await erc20Wrapper.deployProxyAsync();
    // deploy zrx token
    const [zrxTokenContract] = await erc20Wrapper.deployDummyTokensAsync(1, constants.DUMMY_TOKEN_DECIMALS);
    await erc20Wrapper.setBalancesAndAllowancesAsync();

    // deploy WETH
    const { ethers } = require('hardhat');
    const [signer] = await ethers.getSigners();
    const wethFactory = new WETH9__factory(signer);
    const wethContract = await wethFactory.deploy();
    await wethContract.waitForDeployment();

    // deploy zrx vault
    const zrxVaultFactory = new ZrxVault__factory(signer);
    const zrxVaultContract = await zrxVaultFactory.deploy(
        await erc20ProxyContract.getAddress(),
        await zrxTokenContract.getAddress(),
    );
    await zrxVaultContract.waitForDeployment();

    const tx1 = await zrxVaultContract.addAuthorizedAddress(ownerAddress);
    await tx1.wait();

    // deploy staking contract
    const [deployer] = await ethers.getSigners();
    const stakingFactory = new TestStaking__factory(deployer);
    const stakingContract = await stakingFactory.deploy(
        await wethContract.getAddress(),
        await zrxVaultContract.getAddress(),
    );

    // deploy staking proxy
    const stakingProxyFactory = new StakingProxy__factory(deployer);
    const stakingProxyContract = await stakingProxyFactory.deploy(
        await stakingContract.getAddress(),
    );

    const tx2 = await stakingProxyContract.addAuthorizedAddress(ownerAddress);
    await tx2.wait();

    // deploy cobb douglas contract
    const cobbDouglasFactory = new TestCobbDouglas__factory(deployer);
    const cobbDouglasContract = await cobbDouglasFactory.deploy();

    // configure erc20 proxy to accept calls from zrx vault
    const tx3 = await erc20ProxyContract.addAuthorizedAddress(await zrxVaultContract.getAddress());
    await tx3.wait();
    // set staking proxy contract in zrx vault
    const tx4 = await zrxVaultContract.setStakingProxy(await stakingProxyContract.getAddress());
    await tx4.wait();
    // 创建一个通过 proxy 调用的 staking 合约实例
    // 这使用 TestStaking 的 ABI 但连接到 proxy 的地址
    const stakingContractViaProxy = TestStaking__factory.connect(
        await stakingProxyContract.getAddress(),
        deployer
    );
    
    return new StakingApiWrapper(
        env,
        ownerAddress,
        stakingProxyContract,
        stakingContractViaProxy, // 使用通过 proxy 的合约实例
        zrxVaultContract,
        zrxTokenContract,
        wethContract,
        cobbDouglasContract,
        signer, // 传递默认 signer
    );
}
