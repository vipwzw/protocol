import { expect } from 'chai';
import { ethers } from 'hardhat';

// 导入现代化的 test-utils，保持原有接口
import {
    blockchainTests,
    constants,
    randomAddress,
    getRandomInteger,
    verifyTransferEvent,
    chaiSetup,
    BlockchainLifecycle,
    increaseTimeAndMineBlockAsync,
    getLatestBlockTimestampAsync
} from '../src/index';

// 配置 Chai
chaiSetup.configure();

describe('🧪 Modern Test-Utils Compatibility Tests', function () {
    let accounts: any[];
    let deployer: any;
    let user1: any;
    let user2: any;

    beforeEach(async function () {
        accounts = await ethers.getSigners();
        [deployer, user1, user2] = accounts;
    });

    describe('📊 Basic Functionality', function () {
        it('✅ should provide constants', function () {
            expect(constants.NULL_ADDRESS).to.equal(ethers.ZeroAddress);
            expect(constants.MAX_UINT256).to.equal(ethers.MaxUint256);
            expect(constants.ONE_ETHER).to.equal(ethers.parseEther('1'));
        });

        it('✅ should generate random addresses', function () {
            const addr1 = randomAddress();
            const addr2 = randomAddress();
            
            expect(ethers.isAddress(addr1)).to.be.true;
            expect(ethers.isAddress(addr2)).to.be.true;
            expect(addr1).to.not.equal(addr2);
        });

        it('✅ should generate random integers', function () {
            const random1 = getRandomInteger(1, 100);
            const random2 = getRandomInteger(1, 100);
            
            expect(random1).to.be.a('bigint');
            expect(random2).to.be.a('bigint');
            expect(random1).to.be.gte(1n);
            expect(random1).to.be.lte(100n);
        });
    });

    describe('⏰ Time Management', function () {
        it('✅ should manage blockchain time', async function () {
            const initialTime = await getLatestBlockTimestampAsync();
            
            await increaseTimeAndMineBlockAsync(3600); // 1 hour
            
            const newTime = await getLatestBlockTimestampAsync();
            expect(newTime).to.be.gte(initialTime + 3600);
        });
    });

    describe('🔄 Blockchain Lifecycle', function () {
        let lifecycle: BlockchainLifecycle;
        let initialBalance: bigint;

        beforeEach(async function () {
            lifecycle = new BlockchainLifecycle();
            initialBalance = await ethers.provider.getBalance(user1.address);
            await lifecycle.startAsync();
        });

        afterEach(async function () {
            await lifecycle.revertAsync();
        });

        it('✅ should revert blockchain state', async function () {
            // 发送一些 ETH 改变状态
            await user1.sendTransaction({
                to: user2.address,
                value: ethers.parseEther('1')
            });

            const balanceAfterSend = await ethers.provider.getBalance(user1.address);
            expect(balanceAfterSend).to.be.lt(initialBalance);

            // 恢复状态
            await lifecycle.revertAsync();
            await lifecycle.startAsync(); // 创建新快照

            const balanceAfterRevert = await ethers.provider.getBalance(user1.address);
            expect(balanceAfterRevert).to.equal(initialBalance);
        });
    });
});

// 使用 blockchainTests 包装器的示例
blockchainTests('🏗️ BlockchainTests Environment', (env) => {
    it('✅ should provide test environment', function () {
        expect(env.accounts).to.be.an('array');
        expect(env.accounts.length).to.be.greaterThan(0);
        expect(env.blockchainLifecycle).to.exist;
        expect(env.web3Wrapper).to.exist;
        expect(env.txDefaults).to.exist;
    });

    it('✅ should have valid accounts', function () {
        env.accounts.forEach(account => {
            expect(ethers.isAddress(account)).to.be.true;
        });
    });
});

describe('🎭 Mock Contract Tests', function () {
    let mockToken: any;
    let testAccounts: any[];
    let testDeployer: any;
    let testUser1: any;

    beforeEach(async function () {
        // 获取测试账户
        testAccounts = await ethers.getSigners();
        [testDeployer, testUser1] = testAccounts;
        
        // 部署一个简单的 ERC20 模拟合约用于测试
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        mockToken = await MockERC20.deploy('Test Token', 'TEST', 18);
        await mockToken.waitForDeployment();
    });

    it('✅ should verify transfer events', async function () {
        const amount = ethers.parseEther('100');
        
        // 铸造一些代币
        await mockToken.mint(testDeployer.address, amount);
        
        // 转账
        const tx = await mockToken.transfer(testUser1.address, amount);
        const receipt = await tx.wait();

        // 使用现代化的事件验证函数
        verifyTransferEvent(receipt, mockToken, testDeployer.address, testUser1.address, amount);
    });
});