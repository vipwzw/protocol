import { expect } from 'chai';
import '@nomicfoundation/hardhat-chai-matchers';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { artifacts } from './artifacts';

describe('Treasury Governance with Real Staking Integration', function () {
    // Extended timeout for complex staking operations
    this.timeout(180000);

    let admin: any;
    let poolOperator: any;
    let delegator: any;
    let relayer: any;

    // Real contracts
    let zrx: Contract;
    let weth: Contract;
    let stakingContract: Contract;
    let treasury: Contract;
    let defaultPoolOperator: Contract;

    // Pool and governance parameters
    let defaultPoolId: string;
    let nonDefaultPoolId: string;

    const VOTING_PERIOD = 3 * 24 * 3600; // 3 days
    const PROPOSAL_THRESHOLD = ethers.parseEther('100'); // 100 ZRX
    const QUORUM_THRESHOLD = ethers.parseEther('1000'); // 1000 ZRX
    const TREASURY_BALANCE = ethers.parseEther('1000000'); // 1M ZRX
    const STAKE_AMOUNT = ethers.parseEther('500'); // 500 ZRX to stake

    before(async function () {
        console.log('🚀 Setting up Real Staking Integration Test...');

        // Get signers
        const signers = await ethers.getSigners();
        [admin, poolOperator, delegator, relayer] = signers;

        console.log('👤 Admin:', admin.address);
        console.log('👤 Pool Operator:', poolOperator.address);
        console.log('👤 Delegator:', delegator.address);
        console.log('👤 Relayer:', relayer.address);

        await deployContractsAsync();
        await setupBalancesAsync();
        await setupStakingPoolsAsync();
        await setupGovernanceAsync();

        console.log('✅ Real staking integration test environment ready!');
    });

    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying real contracts...');

        // Deploy ZRX token using Hardhat artifacts
        const ZrxFactory = new ethers.ContractFactory(
            artifacts.DummyERC20Token.abi,
            artifacts.DummyERC20Token.bytecode,
            admin,
        );

        zrx = await ZrxFactory.deploy(
            'ZRX Token',
            'ZRX',
            18,
            ethers.parseEther('1000000000'), // 1B ZRX
        );
        await zrx.waitForDeployment();

        // Deploy WETH token
        weth = await ZrxFactory.deploy(
            'Wrapped Ether',
            'WETH',
            18,
            ethers.parseEther('1000000000'), // 1B WETH
        );
        await weth.waitForDeployment();

        // Deploy TreasuryStaking contract
        const StakingFactory = new ethers.ContractFactory(
            artifacts.TreasuryStaking.abi,
            artifacts.TreasuryStaking.bytecode,
            admin,
        );

        stakingContract = await StakingFactory.deploy(await zrx.getAddress());
        await (stakingContract as any).waitForDeployment();

        // Deploy DefaultPoolOperator
        const PoolOperatorFactory = new ethers.ContractFactory(
            artifacts.DefaultPoolOperator.abi,
            artifacts.DefaultPoolOperator.bytecode,
            admin,
        );

        defaultPoolOperator = await PoolOperatorFactory.deploy(
            await (stakingContract as any).getAddress(),
            await weth.getAddress(),
        );
        await defaultPoolOperator.waitForDeployment();

        // Get default pool ID
        defaultPoolId = await defaultPoolOperator.poolId();

        // Deploy Treasury
        const TreasuryFactory = new ethers.ContractFactory(
            artifacts.ZrxTreasury.abi,
            artifacts.ZrxTreasury.bytecode,
            admin,
        );

        const treasuryParams = {
            votingPeriod: VOTING_PERIOD,
            proposalThreshold: PROPOSAL_THRESHOLD,
            quorumThreshold: QUORUM_THRESHOLD,
            defaultPoolId: defaultPoolId,
        };

        treasury = await TreasuryFactory.deploy(await (stakingContract as any).getAddress(), treasuryParams);
        await (treasury as any).waitForDeployment();

        console.log('✅ ZRX:', await zrx.getAddress());
        console.log('✅ WETH:', await weth.getAddress());
        console.log('✅ TreasuryStaking:', await (stakingContract as any).getAddress());
        console.log('✅ DefaultPoolOperator:', await defaultPoolOperator.getAddress());
        console.log('✅ Treasury:', await (treasury as any).getAddress());
        console.log('✅ Default Pool ID:', defaultPoolId);
    }

    async function setupBalancesAsync(): Promise<void> {
        console.log('💰 Setting up initial balances...');

        // Mint ZRX to participants
        await zrx.mint(admin.address, ethers.parseEther('10000'));
        await zrx.mint(poolOperator.address, ethers.parseEther('10000'));
        await zrx.mint(delegator.address, ethers.parseEther('10000'));
        await zrx.mint(relayer.address, ethers.parseEther('10000'));

        // Mint tokens to treasury
        await zrx.mint(await (treasury as any).getAddress(), TREASURY_BALANCE);
        await weth.mint(await (treasury as any).getAddress(), ethers.parseEther('10000'));

        // Approve staking contract to spend ZRX
        await ((zrx as any).connect(admin) as any).approve(
            await (stakingContract as any).getAddress(),
            ethers.parseEther('10000'),
        );
        await ((zrx as any).connect(poolOperator) as any).approve(
            await (stakingContract as any).getAddress(),
            ethers.parseEther('10000'),
        );
        await ((zrx as any).connect(delegator) as any).approve(
            await (stakingContract as any).getAddress(),
            ethers.parseEther('10000'),
        );
        await ((zrx as any).connect(relayer) as any).approve(
            await (stakingContract as any).getAddress(),
            ethers.parseEther('10000'),
        );

        console.log('✅ Balances and approvals configured');
    }

    async function setupStakingPoolsAsync(): Promise<void> {
        console.log('🏊 Setting up real staking pools...');

        // Create a non-default staking pool
        const tx = await ((stakingContract as any).connect(poolOperator) as any).createStakingPool(100000, false); // 10% operator share
        const receipt = await tx.wait();
        if (!receipt) throw new Error('Transaction receipt is null');

        // Get the pool ID from events
        const createPoolEvent = receipt.logs.find((log: any) => {
            try {
                const parsed = stakingContract.interface.parseLog(log);
                return parsed && parsed.name === 'StakingPoolCreated';
            } catch {
                return false;
            }
        });

        if (createPoolEvent) {
            const parsed = stakingContract.interface.parseLog(createPoolEvent);
            nonDefaultPoolId = (parsed as any)?.args?.poolId || (parsed as any)?.values?.poolId;
        } else {
            // Fallback: get pool by operator
            const pools = await (stakingContract as any).getPoolsByOperator(poolOperator.address);
            nonDefaultPoolId = pools[0];
        }

        console.log('✅ Default Pool ID:', defaultPoolId);
        console.log('✅ Non-Default Pool ID:', nonDefaultPoolId);
    }

    async function setupGovernanceAsync(): Promise<void> {
        console.log('🏛️ Setting up governance with real staking...');

        // Stake tokens for delegator (for proposal creation)
        await ((stakingContract as any).connect(delegator) as any).stake(PROPOSAL_THRESHOLD);
        console.log(`✅ Delegator staked ${ethers.formatEther(PROPOSAL_THRESHOLD)} ZRX`);

        // Stake tokens for pool operator (for voting) - increase to ensure quorum
        const poolOperatorStake = QUORUM_THRESHOLD * BigInt(2); // 2000 ZRX to ensure enough voting power
        await ((stakingContract as any).connect(poolOperator) as any).stake(poolOperatorStake);
        console.log(`✅ Pool operator staked ${ethers.formatEther(poolOperatorStake)} ZRX`);

        // Delegate stakes to get voting power - delegate to default pool for full voting power
        await ((stakingContract as any).connect(delegator) as any).moveStakeToPool(defaultPoolId, PROPOSAL_THRESHOLD);
        await ((stakingContract as any).connect(poolOperator) as any).moveStakeToPool(defaultPoolId, poolOperatorStake);

        console.log('✅ Stakes delegated to pools');
    }

    // ============ Time Control Utilities ============

    async function advanceTimeAsync(seconds: number): Promise<void> {
        await ethers.provider.send('evm_increaseTime', [seconds]);
        await ethers.provider.send('evm_mine', []);
    }

    async function fastForwardToNextEpochAsync(): Promise<void> {
        const epochEndTime = await (stakingContract as any).currentEpochStartTimeInSeconds();
        const epochDuration = await (stakingContract as any).epochDurationInSeconds();
        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        const timeToWait = Math.max(0, Number(epochEndTime + epochDuration - currentTime));

        if (timeToWait > 0) {
            console.log(`⏰ Fast forwarding ${timeToWait} seconds to next epoch...`);
            await advanceTimeAsync(timeToWait + 1);
        }

        // Force advance epoch for testing
        await (stakingContract as any).forceAdvanceEpoch();
        const newEpoch = await (stakingContract as any).currentEpoch();
        console.log(`✅ Advanced to epoch: ${newEpoch}`);
    }

    // ============ Test Suites ============

    describe('🏗️ Real Contract Deployment', function () {
        it('should have all real contracts deployed successfully', async function () {
            expect(await zrx.getAddress()).to.have.lengthOf(42);
            expect(await weth.getAddress()).to.have.lengthOf(42);
            expect(await (stakingContract as any).getAddress()).to.have.lengthOf(42);
            expect(await (treasury as any).getAddress()).to.have.lengthOf(42);
            expect(await defaultPoolOperator.getAddress()).to.have.lengthOf(42);
        });

        it('should have correct staking contract configuration', async function () {
            const currentEpoch = await (stakingContract as any).currentEpoch();
            const epochDuration = await (stakingContract as any).epochDurationInSeconds();
            const zrxTokenAddress = await (stakingContract as any).zrxToken();

            expect(Number(currentEpoch)).to.be.greaterThan(0);
            expect(Number(epochDuration)).to.be.greaterThan(0);
            expect(zrxTokenAddress).to.equal(await zrx.getAddress());
        });

        it('should have correct treasury configuration', async function () {
            const votingPeriod = await (treasury as any).votingPeriod();
            const proposalThreshold = await (treasury as any).proposalThreshold();
            const quorumThreshold = await (treasury as any).quorumThreshold();
            const stakingProxy = await (treasury as any).stakingProxy();

            expect(Number(votingPeriod)).to.equal(VOTING_PERIOD);
            expect(proposalThreshold).to.equal(PROPOSAL_THRESHOLD);
            expect(quorumThreshold).to.equal(QUORUM_THRESHOLD);
            expect(stakingProxy).to.equal(await (stakingContract as any).getAddress());
        });
    });

    describe('⚡ Real Staking Operations', function () {
        it('should allow real staking of ZRX tokens', async function () {
            const initialBalance = await (stakingContract as any).getTotalStakedByOwner(relayer.address);
            const stakeAmount = ethers.parseEther('200');

            await ((stakingContract as any).connect(relayer) as any).stake(stakeAmount);

            const finalBalance = await (stakingContract as any).getTotalStakedByOwner(relayer.address);
            expect(finalBalance - initialBalance).to.equal(stakeAmount);

            console.log(`✅ Relayer staked ${ethers.formatEther(stakeAmount)} ZRX`);
        });

        it('should allow delegation to real staking pools', async function () {
            const stakeAmount = ethers.parseEther('200');

            // Check undelegated balance before
            const undelegatedBefore = await (stakingContract as any).getOwnerStakeByStatus(relayer.address, 0); // UNDELEGATED = 0

            // Delegate to pool
            await ((stakingContract as any).connect(relayer) as any).moveStakeToPool(defaultPoolId, stakeAmount);

            // Check delegated balance after
            const delegatedAfter = await (stakingContract as any).getStakeDelegatedToPoolByOwner(
                relayer.address,
                defaultPoolId,
            );

            expect(delegatedAfter.nextEpochBalance).to.equal(stakeAmount);
            console.log(`✅ Delegated ${ethers.formatEther(stakeAmount)} ZRX to default pool`);
        });

        it('should track pool-specific delegations correctly', async function () {
            const poolStakeBefore = await (stakingContract as any).getTotalStakeDelegatedToPool(defaultPoolId);
            const poolInfo = await (stakingContract as any).getStakingPool(defaultPoolId);

            expect(poolInfo.operator).to.have.lengthOf(42);
            expect(Number(poolStakeBefore.nextEpochBalance)).to.be.greaterThan(0);

            console.log('✅ Pool delegation tracking verified');
        });

        it('should handle epoch advancement correctly', async function () {
            const epochBefore = await (stakingContract as any).currentEpoch();

            await fastForwardToNextEpochAsync();

            const epochAfter = await (stakingContract as any).currentEpoch();
            expect(Number(epochAfter)).to.be.greaterThan(Number(epochBefore));

            console.log(`✅ Epoch advanced from ${epochBefore} to ${epochAfter}`);
        });
    });

    describe('🗳️ Real Governance Integration', function () {
        let proposalId: bigint;

        it('should create proposals with real staking power validation', async function () {
            // Advance epoch to activate delegated stakes
            await fastForwardToNextEpochAsync();

            // Get voting power
            const votingPower = await (treasury as any).getVotingPower(delegator.address, []);
            expect(votingPower >= PROPOSAL_THRESHOLD).to.be.true;

            // Create proposal actions - simple token transfer from treasury
            const transferAmount = ethers.parseEther('100');
            const transferData = ethers.concat([
                ethers.id('transfer(address,uint256)').slice(0, 10),
                ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [delegator.address, transferAmount]),
            ]);

            const proposalActions = [
                {
                    target: await weth.getAddress(),
                    data: transferData,
                    value: 0,
                },
            ];

            // Create proposal
            const currentEpoch = await (stakingContract as any).currentEpoch();
            const executionEpoch = currentEpoch + BigInt(2);

            const tx = await (treasury as any)
                .connect(delegator)
                .propose(proposalActions, executionEpoch, 'Real Staking Integration Test Proposal', []);

            const receipt = await tx.wait();
            if (!receipt) throw new Error('Transaction receipt is null');
            const proposalCount = await (treasury as any).proposalCount();
            proposalId = proposalCount - BigInt(1);

            expect(Number(receipt.status)).to.equal(1);
            console.log(`✅ Created proposal ${proposalId} with real staking validation`);
        });

        it('should allow voting with real delegated stake', async function () {
            // Advance to voting period
            await fastForwardToNextEpochAsync();
            await fastForwardToNextEpochAsync();

            // Check voting power before voting
            const delegatorVotingPower = await (treasury as any).getVotingPower(delegator.address, []);
            const poolOperatorVotingPower = await (treasury as any).getVotingPower(poolOperator.address, []);

            console.log(`Delegator voting power: ${ethers.formatEther(delegatorVotingPower)} ZRX`);
            console.log(`Pool operator voting power: ${ethers.formatEther(poolOperatorVotingPower)} ZRX`);

            // Vote with delegator
            const voteTx1 = await (treasury as any).connect(delegator).castVote(proposalId, true, []);
            expect(voteTx1.hash).to.have.lengthOf(66);

            // Vote with pool operator
            const voteTx2 = await (treasury as any).connect(poolOperator).castVote(proposalId, true, []);
            expect(voteTx2.hash).to.have.lengthOf(66);

            console.log('✅ Votes cast with real staking power');
        });

        it('should execute proposals with real treasury effects', async function () {
            // First, ensure voting period has completely ended
            // Wait for voting period to end completely
            await advanceTimeAsync(VOTING_PERIOD + 1);

            // Get current state
            let currentEpoch = await (stakingContract as any).currentEpoch();
            const proposal = await (treasury as any).proposals(proposalId);
            const targetExecutionEpoch = Number(proposal.executionEpoch);

            console.log(`Current epoch: ${currentEpoch}`);
            console.log(`Target execution epoch: ${targetExecutionEpoch}`);

            // Advance to the correct execution epoch if needed
            while (Number(currentEpoch) !== targetExecutionEpoch) {
                if (Number(currentEpoch) < targetExecutionEpoch) {
                    await fastForwardToNextEpochAsync();
                    currentEpoch = await (stakingContract as any).currentEpoch();
                } else {
                    throw new Error(
                        `Already passed execution epoch! Current: ${currentEpoch}, Target: ${targetExecutionEpoch}`,
                    );
                }
            }

            // Check proposal status before execution
            console.log(`Proposal votes for: ${ethers.formatEther(proposal.votesFor)} ZRX`);
            console.log(`Proposal votes against: ${ethers.formatEther(proposal.votesAgainst)} ZRX`);
            console.log(`Quorum threshold: ${ethers.formatEther(QUORUM_THRESHOLD)} ZRX`);

            // Check initial balances
            const initialTreasuryWeth = await weth.balanceOf(await (treasury as any).getAddress());
            const initialDelegatorWeth = await weth.balanceOf(delegator.address);

            // Execute proposal - must match the original proposal actions exactly
            const transferAmount = ethers.parseEther('100');
            const transferData = ethers.concat([
                ethers.id('transfer(address,uint256)').slice(0, 10),
                ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [delegator.address, transferAmount]),
            ]);

            const proposalActions = [
                {
                    target: await weth.getAddress(),
                    data: transferData,
                    value: 0,
                },
            ];

            const executeTx = await (treasury as any).execute(proposalId, proposalActions);
            await executeTx.wait();

            // Verify execution effects
            const finalTreasuryWeth = await weth.balanceOf(await (treasury as any).getAddress());
            const finalDelegatorWeth = await weth.balanceOf(delegator.address);

            const treasuryChange = initialTreasuryWeth - finalTreasuryWeth;
            const delegatorChange = finalDelegatorWeth - initialDelegatorWeth;

            expect(treasuryChange).to.equal(ethers.parseEther('100'));
            expect(delegatorChange).to.equal(ethers.parseEther('100'));

            console.log(`✅ Proposal executed: ${ethers.formatEther(treasuryChange)} WETH transferred`);
        });
    });

    describe('📊 Real Staking Analytics', function () {
        it('should provide accurate staking metrics', async function () {
            const globalUndelegated = await (stakingContract as any).getGlobalStakeByStatus(0); // UNDELEGATED
            const globalDelegated = await (stakingContract as any).getGlobalStakeByStatus(1); // DELEGATED

            console.log('📊 Real Staking Metrics:');
            console.log(`   Global Undelegated: ${ethers.formatEther(globalUndelegated.currentEpochBalance)} ZRX`);
            console.log(`   Global Delegated: ${ethers.formatEther(globalDelegated.currentEpochBalance)} ZRX`);

            expect(Number(globalDelegated.currentEpochBalance)).to.be.greaterThan(0);
        });

        it('should track individual staker metrics', async function () {
            const delegatorTotalStaked = await (stakingContract as any).getTotalStakedByOwner(delegator.address);
            const operatorTotalStaked = await (stakingContract as any).getTotalStakedByOwner(poolOperator.address);

            console.log('👤 Individual Staking:');
            console.log(`   Delegator: ${ethers.formatEther(delegatorTotalStaked)} ZRX`);
            console.log(`   Pool Operator: ${ethers.formatEther(operatorTotalStaked)} ZRX`);

            expect(delegatorTotalStaked >= PROPOSAL_THRESHOLD).to.be.true;
            expect(operatorTotalStaked >= QUORUM_THRESHOLD).to.be.true;
        });

        it('should provide pool-specific analytics', async function () {
            const defaultPoolStake = await (stakingContract as any).getTotalStakeDelegatedToPool(defaultPoolId);
            const nonDefaultPoolStake = await (stakingContract as any).getTotalStakeDelegatedToPool(nonDefaultPoolId);

            console.log('🏊 Pool Analytics:');
            console.log(`   Default Pool: ${ethers.formatEther(defaultPoolStake.currentEpochBalance)} ZRX`);
            console.log(`   Non-Default Pool: ${ethers.formatEther(nonDefaultPoolStake.currentEpochBalance)} ZRX`);

            expect(Number(defaultPoolStake.currentEpochBalance)).to.be.greaterThan(0);
        });
    });

    describe('🔧 Real Staking Edge Cases', function () {
        it('should handle unstaking correctly', async function () {
            const stakingAmount = ethers.parseEther('50');

            // Stake first
            await ((stakingContract as any).connect(relayer) as any).stake(stakingAmount);

            const totalBefore = await (stakingContract as any).getTotalStakedByOwner(relayer.address);

            // Unstake
            await ((stakingContract as any).connect(relayer) as any).unstake(stakingAmount);

            const totalAfter = await (stakingContract as any).getTotalStakedByOwner(relayer.address);
            expect(totalBefore - totalAfter).to.equal(stakingAmount);

            console.log(`✅ Successfully unstaked ${ethers.formatEther(stakingAmount)} ZRX`);
        });

        it('should handle pool switching correctly', async function () {
            const switchAmount = ethers.parseEther('30');

            // First stake and delegate to default pool
            await ((stakingContract as any).connect(relayer) as any).stake(switchAmount);
            await ((stakingContract as any).connect(relayer) as any).moveStakeToPool(defaultPoolId, switchAmount);

            // Move from default pool to non-default pool
            await ((stakingContract as any).connect(relayer) as any).moveStakeFromPool(defaultPoolId, switchAmount);
            await ((stakingContract as any).connect(relayer) as any).moveStakeToPool(nonDefaultPoolId, switchAmount);

            const finalDelegation = await (stakingContract as any).getStakeDelegatedToPoolByOwner(
                relayer.address,
                nonDefaultPoolId,
            );
            expect(finalDelegation.nextEpochBalance >= switchAmount).to.be.true;

            console.log(`✅ Successfully switched ${ethers.formatEther(switchAmount)} ZRX between pools`);
        });
    });
});
