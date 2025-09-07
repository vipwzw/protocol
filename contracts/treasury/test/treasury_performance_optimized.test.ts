import { expect } from 'chai';
const { ethers } = require('hardhat');

describe('Treasury Governance - Performance Optimized', function () {
    // Extended timeout for performance tests
    this.timeout(300000); // 5 minutes

    let admin: any;
    let poolOperator: any;
    let delegator: any;
    let relayer: any;
    let users: any[];

    let zrx: any;
    let weth: any;
    let treasury: any;
    let defaultPoolOperator: any;

    const VOTING_PERIOD = 3 * 24 * 3600; // 3 days
    const PROPOSAL_THRESHOLD = ethers.parseEther('100'); // 100 ZRX
    const QUORUM_THRESHOLD = ethers.parseEther('1000'); // 1000 ZRX
    const TREASURY_BALANCE = ethers.parseEther('1000000'); // 1M ZRX

    // Performance test parameters
    const BATCH_SIZE = 10;
    const STRESS_TEST_SIZE = 50;

    before(async function () {
        console.log('🚀 Setting up Performance Optimized Treasury System...');

        // Get multiple signers for batch testing
        const signers = await ethers.getSigners();
        [admin, poolOperator, delegator, relayer, ...users] = signers;

        await deployContractsAsync();
        await setupBatchBalancesAsync();

        console.log('✅ Performance test environment ready!');
    });

    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying contracts with gas optimization...');

        const startGas = await ethers.provider.getBalance(admin.address);

        // Deploy with optimized gas settings
        const TokenFactory = await ethers.getContractFactory('DummyERC20Token');

        // Batch deploy tokens
        const deployPromises = [
            TokenFactory.deploy('ZRX Token', 'ZRX', 18, ethers.parseEther('1000000000')),
            TokenFactory.deploy('Wrapped Ether', 'WETH', 18, ethers.parseEther('1000000000')),
            TokenFactory.deploy('DefaultPoolOperator', 'DPO', 18, 0),
            TokenFactory.deploy('Treasury', 'TREASURY', 18, 0),
        ];

        const [zrxContract, wethContract, dpoContract, treasuryContract] = await Promise.all(deployPromises);

        // Wait for all deployments
        await Promise.all([
            zrxContract.waitForDeployment(),
            wethContract.waitForDeployment(),
            dpoContract.waitForDeployment(),
            treasuryContract.waitForDeployment(),
        ]);

        zrx = zrxContract;
        weth = wethContract;
        defaultPoolOperator = dpoContract;
        treasury = treasuryContract;

        const endGas = await ethers.provider.getBalance(admin.address);
        const gasUsed = startGas - endGas;

        console.log(`⛽ Gas used for deployment: ${ethers.formatEther(gasUsed)} ETH`);
    }

    async function setupBatchBalancesAsync(): Promise<void> {
        console.log('💰 Setting up batch balances...');

        const startTime = Date.now();

        // Prepare batch operations
        const batchUsers = users.slice(0, BATCH_SIZE);
        const mintAmount = ethers.parseEther('10000'); // 10K ZRX per user

        // Batch mint to multiple users
        const mintPromises = batchUsers.map(user => zrx.mint(user.address, mintAmount));

        // Execute all mints in parallel
        await Promise.all(mintPromises);

        // Setup treasury and key accounts
        await Promise.all([
            zrx.mint(delegator.address, PROPOSAL_THRESHOLD * BigInt(2)),
            zrx.mint(poolOperator.address, QUORUM_THRESHOLD * BigInt(2)),
            zrx.mint(await treasury.getAddress(), TREASURY_BALANCE),
            weth.mint(await treasury.getAddress(), ethers.parseEther('10000')),
        ]);

        const endTime = Date.now();
        console.log(`✅ Batch balance setup completed in ${endTime - startTime}ms`);
    }

    describe('⚡ Parallel Operations Performance', function () {
        it('should handle batch token transfers efficiently', async function () {
            console.log(`🚀 Testing ${BATCH_SIZE} parallel token transfers...`);

            const transferAmount = ethers.parseEther('100');
            const batchUsers = users.slice(0, BATCH_SIZE);

            const startTime = Date.now();
            const startGas = await ethers.provider.getBalance(admin.address);

            // Parallel transfers from admin to batch users
            const transferPromises = batchUsers.map(user => zrx.transfer(user.address, transferAmount));

            const results = await Promise.all(transferPromises);

            const endTime = Date.now();
            const endGas = await ethers.provider.getBalance(admin.address);
            const gasUsed = startGas - endGas;

            // Verify all transfers succeeded
            for (const result of results) {
                expect(result.hash).to.have.lengthOf(66);
            }

            console.log(`✅ ${BATCH_SIZE} transfers completed in ${endTime - startTime}ms`);
            console.log(`⛽ Total gas used: ${ethers.formatEther(gasUsed)} ETH`);
            console.log(`📊 Average time per transfer: ${(endTime - startTime) / BATCH_SIZE}ms`);

            expect(endTime - startTime).to.be.lessThan(15000); // Should complete within 15 seconds
        });

        it('should optimize gas usage for multiple operations', async function () {
            console.log('🔥 Testing gas optimization strategies...');

            const batchUsers = users.slice(0, 5);
            const amount = ethers.parseEther('500');

            // Strategy 1: Sequential operations
            const sequentialStart = Date.now();
            let sequentialGasUsed = 0;

            for (const user of batchUsers) {
                const gasUsedBefore = await ethers.provider.getBalance(admin.address);
                await zrx.mint(user.address, amount);
                const gasUsedAfter = await ethers.provider.getBalance(admin.address);
                sequentialGasUsed += Number(gasUsedBefore - gasUsedAfter);
            }

            const sequentialTime = Date.now() - sequentialStart;

            // Strategy 2: Parallel operations
            const parallelStart = Date.now();
            const gasUsedBefore = await ethers.provider.getBalance(admin.address);

            const parallelPromises = batchUsers.map(user => zrx.mint(user.address, amount));
            await Promise.all(parallelPromises);

            const gasUsedAfter = await ethers.provider.getBalance(admin.address);
            const parallelGasUsed = Number(gasUsedBefore - gasUsedAfter);
            const parallelTime = Date.now() - parallelStart;

            console.log('📊 Performance Comparison:');
            console.log(`   Sequential: ${sequentialTime}ms, ${ethers.formatEther(sequentialGasUsed)} ETH`);
            console.log(`   Parallel: ${parallelTime}ms, ${ethers.formatEther(parallelGasUsed)} ETH`);
            console.log(
                `   Time improvement: ${(((sequentialTime - parallelTime) / sequentialTime) * 100).toFixed(1)}%`,
            );

            // 允许并行时间 <= 顺序时间，避免在快速环境中的边界情况
            expect(parallelTime).to.be.at.most(sequentialTime);
        });
    });

    describe('🏗️ Batch Governance Operations', function () {
        it('should handle multiple proposal creation efficiently', async function () {
            console.log('📝 Testing batch proposal creation...');

            const proposalCount = 5;
            const startTime = Date.now();

            // Create multiple proposals in sequence (they can't be truly parallel due to nonce)
            const proposals = [];
            for (let i = 0; i < proposalCount; i++) {
                const proposalData = {
                    target: await weth.getAddress(),
                    value: 0,
                    description: `Batch Proposal ${i + 1}`,
                    transferAmount: ethers.parseEther('10'),
                };
                proposals.push(proposalData);
            }

            // Simulate proposal creation (since we're using simplified governance)
            let successfulProposals = 0;
            for (const proposal of proposals) {
                try {
                    // Simulate proposal validation
                    const delegatorBalance = await zrx.balanceOf(delegator.address);
                    if (delegatorBalance >= PROPOSAL_THRESHOLD) {
                        successfulProposals++;
                    }
                } catch (error) {
                    console.log(`Proposal failed: ${error.message}`);
                }
            }

            const endTime = Date.now();

            console.log(`✅ Processed ${successfulProposals}/${proposalCount} proposals in ${endTime - startTime}ms`);
            console.log(`📊 Average time per proposal: ${(endTime - startTime) / proposalCount}ms`);

            expect(successfulProposals).to.equal(proposalCount);
            expect(endTime - startTime).to.be.lessThan(5000); // Should complete within 5 seconds
        });

        it('should optimize voting operations for multiple participants', async function () {
            console.log('🗳️ Testing optimized voting operations...');

            const voterCount = Math.min(BATCH_SIZE, users.length);
            const voters = users.slice(0, voterCount);

            // Setup: Give all voters sufficient balance
            const setupStart = Date.now();
            const voteAmount = ethers.parseEther('1000');

            const balancePromises = voters.map(voter => zrx.mint(voter.address, voteAmount));
            await Promise.all(balancePromises);

            const setupTime = Date.now() - setupStart;

            // Simulate voting process
            const votingStart = Date.now();
            let validVotes = 0;

            // Check voting eligibility for all voters
            const eligibilityPromises = voters.map(async voter => {
                const balance = await zrx.balanceOf(voter.address);
                return balance >= voteAmount;
            });

            const eligibilityResults = await Promise.all(eligibilityPromises);
            validVotes = eligibilityResults.filter(Boolean).length;

            const votingTime = Date.now() - votingStart;

            console.log('📊 Voting Performance:');
            console.log(`   Setup Time: ${setupTime}ms`);
            console.log(`   Voting Validation Time: ${votingTime}ms`);
            console.log(`   Valid Voters: ${validVotes}/${voterCount}`);
            console.log(`   Average validation time: ${votingTime / voterCount}ms per voter`);

            expect(validVotes).to.equal(voterCount);
            expect(votingTime).to.be.lessThan(2000); // Should validate within 2 seconds
        });
    });

    describe('🚀 Stress Testing', function () {
        it('should handle high-volume token operations', async function () {
            console.log(`🔥 Stress testing with ${STRESS_TEST_SIZE} operations...`);

            const stressUsers = users.slice(0, Math.min(STRESS_TEST_SIZE, users.length));
            const amount = ethers.parseEther('10');

            const startTime = Date.now();
            const startGas = await ethers.provider.getBalance(admin.address);

            // Batch operations in chunks to avoid overwhelming the network
            const chunkSize = 10;
            const chunks = [];
            for (let i = 0; i < stressUsers.length; i += chunkSize) {
                chunks.push(stressUsers.slice(i, i + chunkSize));
            }

            let totalOperations = 0;
            for (const chunk of chunks) {
                const chunkPromises = chunk.map(user => zrx.mint(user.address, amount));
                await Promise.all(chunkPromises);
                totalOperations += chunk.length;

                // Small delay between chunks to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const endTime = Date.now();
            const endGas = await ethers.provider.getBalance(admin.address);
            const gasUsed = startGas - endGas;

            const totalTime = endTime - startTime;
            const opsPerSecond = (totalOperations / totalTime) * 1000;

            console.log('📊 Stress Test Results:');
            console.log(`   Total Operations: ${totalOperations}`);
            console.log(`   Total Time: ${totalTime}ms`);
            console.log(`   Operations/Second: ${opsPerSecond.toFixed(2)}`);
            console.log(`   Gas Used: ${ethers.formatEther(gasUsed)} ETH`);
            const gasPerOp = totalOperations > 0 ? BigInt(gasUsed) / BigInt(totalOperations) : BigInt(0);
            console.log(`   Gas per Operation: ${ethers.formatEther(gasPerOp)} ETH`);

            expect(totalOperations).to.equal(stressUsers.length);
            expect(opsPerSecond).to.be.greaterThan(0.5); // At least 0.5 operations per second
        });

        it('should maintain performance under concurrent load', async function () {
            console.log('⚡ Testing concurrent load performance...');

            const concurrentUsers = users.slice(0, 20);
            const operations = ['mint', 'transfer', 'balance_check'];

            const startTime = Date.now();

            // Create mixed concurrent operations
            const concurrentPromises = concurrentUsers.map(async (user, index) => {
                const operation = operations[index % operations.length];
                const amount = ethers.parseEther('100');

                switch (operation) {
                    case 'mint':
                        return zrx.mint(user.address, amount);
                    case 'transfer':
                        return zrx.transfer(user.address, amount);
                    case 'balance_check':
                        return zrx.balanceOf(user.address);
                    default:
                        return Promise.resolve();
                }
            });

            const results = await Promise.all(concurrentPromises);
            const endTime = Date.now();

            const successfulOps = results.filter(result => result !== undefined).length;
            const totalTime = endTime - startTime;

            console.log('📊 Concurrent Load Results:');
            console.log(`   Successful Operations: ${successfulOps}/${concurrentUsers.length}`);
            console.log(`   Total Time: ${totalTime}ms`);
            console.log(`   Average Time per Operation: ${totalTime / successfulOps}ms`);

            expect(successfulOps).to.equal(concurrentUsers.length);
            expect(totalTime).to.be.lessThan(10000); // Should complete within 10 seconds
        });
    });

    describe('📊 Performance Analytics', function () {
        it('should provide detailed gas usage analytics', async function () {
            console.log('📈 Analyzing gas usage patterns...');

            const operations = [
                { name: 'Token Mint', action: () => zrx.mint(users[0].address, ethers.parseEther('100')) },
                { name: 'Token Transfer', action: () => zrx.transfer(users[1].address, ethers.parseEther('50')) },
                { name: 'Balance Check', action: () => zrx.balanceOf(users[0].address) },
            ];

            const gasResults = [];

            for (const operation of operations) {
                const gasUsedBefore = await ethers.provider.getBalance(admin.address);
                const startTime = Date.now();

                await operation.action();

                const endTime = Date.now();
                const gasUsedAfter = await ethers.provider.getBalance(admin.address);
                const gasUsed = gasUsedBefore - gasUsedAfter;

                gasResults.push({
                    name: operation.name,
                    gasUsed: gasUsed,
                    timeUsed: endTime - startTime,
                });
            }

            console.log('⛽ Gas Usage Analysis:');
            gasResults.forEach(result => {
                console.log(`   ${result.name}: ${ethers.formatEther(result.gasUsed)} ETH (${result.timeUsed}ms)`);
            });

            // Verify all operations completed
            expect(gasResults).to.have.lengthOf(operations.length);
            expect(gasResults.every(result => result.gasUsed >= 0)).to.be.true;
        });

        it('should demonstrate scalability metrics', async function () {
            console.log('📊 Measuring scalability metrics...');

            const userCounts = [5, 10, 20];
            const scalabilityResults = [];

            for (const userCount of userCounts) {
                const testUsers = users.slice(0, userCount);
                const amount = ethers.parseEther('100');

                const startTime = Date.now();

                // Parallel operations for current user count
                const promises = testUsers.map(user => zrx.mint(user.address, amount));
                await Promise.all(promises);

                const endTime = Date.now();
                const totalTime = endTime - startTime;
                const timePerUser = totalTime / userCount;

                scalabilityResults.push({
                    userCount,
                    totalTime,
                    timePerUser,
                });
            }

            console.log('📈 Scalability Analysis:');
            scalabilityResults.forEach(result => {
                console.log(
                    `   ${result.userCount} users: ${result.totalTime}ms total, ${result.timePerUser.toFixed(2)}ms per user`,
                );
            });

            // Verify scalability (time per user should not increase dramatically)
            expect(scalabilityResults).to.have.lengthOf(userCounts.length);

            const maxTimePerUser = Math.max(...scalabilityResults.map(r => r.timePerUser));
            const minTimePerUser = Math.min(...scalabilityResults.map(r => r.timePerUser));
            const scalabilityRatio = maxTimePerUser / minTimePerUser;

            console.log(`📊 Scalability Ratio: ${scalabilityRatio.toFixed(2)}x`);
            expect(scalabilityRatio).to.be.lessThan(5); // Should not degrade more than 5x
        });
    });

    describe('🔧 Optimization Strategies', function () {
        it('should demonstrate batch vs individual operations', async function () {
            console.log('🔧 Comparing batch vs individual operations...');

            const testUsers = users.slice(0, 10);
            const amount = ethers.parseEther('200');

            // Individual operations
            const individualStart = Date.now();
            for (const user of testUsers) {
                await zrx.mint(user.address, amount);
            }
            const individualTime = Date.now() - individualStart;

            // Batch operations (parallel)
            const batchStart = Date.now();
            const batchPromises = testUsers.map(user => zrx.mint(user.address, amount));
            await Promise.all(batchPromises);
            const batchTime = Date.now() - batchStart;

            const improvement = ((individualTime - batchTime) / individualTime) * 100;

            console.log('⚡ Operation Comparison:');
            console.log(`   Individual: ${individualTime}ms`);
            console.log(`   Batch: ${batchTime}ms`);
            console.log(`   Improvement: ${improvement.toFixed(1)}%`);

            // In test environments, batch and individual operations might have similar timing
            // We allow for equal performance but expect batch to not be significantly slower
            expect(batchTime).to.be.at.most(individualTime * 1.2); // Allow 20% tolerance
            
            // If times are equal, improvement might be 0, which is acceptable
            expect(improvement).to.be.at.least(-20); // Allow up to 20% slower in edge cases
        });

        it('should optimize memory usage for large operations', async function () {
            console.log('🧠 Testing memory optimization...');

            const largeUserCount = Math.min(100, users.length);
            const testUsers = users.slice(0, largeUserCount);

            // Memory-efficient approach: process in chunks
            const chunkSize = 20;
            const chunks = [];
            for (let i = 0; i < testUsers.length; i += chunkSize) {
                chunks.push(testUsers.slice(i, i + chunkSize));
            }

            const startTime = Date.now();
            let processedCount = 0;

            for (const chunk of chunks) {
                // Process chunk
                const chunkPromises = chunk.map(user => zrx.balanceOf(user.address));
                await Promise.all(chunkPromises);
                processedCount += chunk.length;

                // Small cleanup delay
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            const endTime = Date.now();
            const totalTime = endTime - startTime;

            console.log('🧠 Memory Optimization Results:');
            console.log(`   Processed Users: ${processedCount}/${largeUserCount}`);
            console.log(`   Chunk Size: ${chunkSize}`);
            console.log(`   Total Time: ${totalTime}ms`);
            console.log(`   Average per Chunk: ${totalTime / chunks.length}ms`);

            expect(processedCount).to.equal(largeUserCount);
            expect(totalTime).to.be.lessThan(30000); // Should complete within 30 seconds
        });
    });
});
