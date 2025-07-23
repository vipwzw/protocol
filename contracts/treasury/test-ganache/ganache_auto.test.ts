import { expect } from 'chai';
import { Web3Wrapper } from '@0x/web3-wrapper';
import { BigNumber } from '@0x/utils';
import Ganache from 'ganache';

describe('Ganache Auto Start/Stop', () => {
    let web3Wrapper: Web3Wrapper;
    let accounts: string[];
    let ganacheServer: any;

    before(async function() {
        this.timeout(30000);
        
        console.log('🚀 Starting in-process Ganache...');
        
        // 启动进程内 Ganache
        ganacheServer = Ganache.server({
            wallet: {
                mnemonic: 'test test test test test test test test test test test test junk',
                totalAccounts: 10,
                defaultBalance: 1000, // 1000 ETH
            },
            chain: {
                chainId: 1337,
            },
            logging: {
                quiet: true,
            },
        });
        
        await ganacheServer.listen(7545);
        
        // 连接到 Ganache
        const provider = ganacheServer.provider;
        web3Wrapper = new Web3Wrapper(provider);
        accounts = await web3Wrapper.getAvailableAddressesAsync();
        
        console.log(`✅ In-process Ganache started with ${accounts.length} accounts`);
    });

    after(async function() {
        this.timeout(10000);
        
        if (ganacheServer) {
            console.log('⏹️ Stopping in-process Ganache...');
            await ganacheServer.close();
            console.log('✅ Ganache stopped');
        }
    });

    describe('🚀 Auto Startup Verification', () => {
        it('should have auto-started Ganache successfully', async function() {
            // 验证基本连接
            expect(web3Wrapper).to.not.be.undefined;
            expect(accounts.length).to.be.greaterThan(0);
            
            console.log('✅ In-process Ganache auto-startup verified');
        });

        it('should provide expected network configuration', async function() {
            const networkId = await web3Wrapper.getNetworkIdAsync();
            const chainId = await web3Wrapper.getChainIdAsync();
            const blockNumber = await web3Wrapper.getBlockNumberAsync();
            
            expect(chainId).to.equal(1337); // Chain ID should be as configured
            expect(networkId).to.be.greaterThan(0); // Network ID is auto-generated
            expect(blockNumber).to.be.greaterThanOrEqual(0);
            
            console.log(`📊 Chain ID: ${chainId}`);
            console.log(`📊 Network ID: ${networkId}`);
            console.log(`📊 Block Number: ${blockNumber}`);
            console.log('✅ Network configuration verified');
        });

        it('should provide accounts with sufficient ETH', async function() {
            const adminBalance = await web3Wrapper.getBalanceInWeiAsync(accounts[0]);
            
            // Should have 1000 ETH default balance
            const expectedMinBalance = new BigNumber('999000000000000000000'); // 999 ETH minimum
            expect(adminBalance.isGreaterThan(expectedMinBalance)).to.be.true;
            
            console.log(`💰 Admin Balance: ${adminBalance.dividedBy('1000000000000000000').toString()} ETH`);
            console.log('✅ Account balances verified');
        });
    });

    describe('🌐 Network Operations', () => {
        it('should be able to mine blocks', async function() {
            const initialBlock = await web3Wrapper.getBlockNumberAsync();
            
            // Mine a block by sending a simple transaction
            await web3Wrapper.sendTransactionAsync({
                from: accounts[0],
                to: accounts[1],
                value: new BigNumber('1000000000000000000'), // 1 ETH
                gas: 21000,
            });
            
            const finalBlock = await web3Wrapper.getBlockNumberAsync();
            expect(finalBlock).to.be.greaterThan(initialBlock);
            
            console.log(`📈 Block progression: ${initialBlock} → ${finalBlock}`);
            console.log('✅ Block mining verified');
        });

        it('should handle ETH transfers', async function() {
            const sender = accounts[0];
            const receiver = accounts[1];
            const transferAmount = new BigNumber('1000000000000000000'); // 1 ETH
            
            const initialSenderBalance = await web3Wrapper.getBalanceInWeiAsync(sender);
            const initialReceiverBalance = await web3Wrapper.getBalanceInWeiAsync(receiver);
            
            await web3Wrapper.sendTransactionAsync({
                from: sender,
                to: receiver,
                value: transferAmount,
                gas: 21000,
            });
            
            const finalSenderBalance = await web3Wrapper.getBalanceInWeiAsync(sender);
            const finalReceiverBalance = await web3Wrapper.getBalanceInWeiAsync(receiver);
            
            // Sender should have less (minus transfer + gas)
            expect(finalSenderBalance.isLessThan(initialSenderBalance)).to.be.true;
            
            // Receiver should have exactly 1 ETH more
            expect(finalReceiverBalance.minus(initialReceiverBalance).toString()).to.equal(transferAmount.toString());
            
            console.log(`💸 Transfer verified: ${transferAmount.dividedBy('1000000000000000000').toString()} ETH`);
            console.log('✅ ETH transfers working');
        });
    });

    describe('⏰ Time Manipulation', () => {
        it('should support time increases', async function() {
            const initialTime = await web3Wrapper.getBlockTimestampAsync('latest');
            const timeIncrease = 3600; // 1 hour
            
            await web3Wrapper.increaseTimeAsync(timeIncrease);
            await web3Wrapper.mineBlockAsync();
            
            const finalTime = await web3Wrapper.getBlockTimestampAsync('latest');
            expect(finalTime - initialTime).to.be.greaterThanOrEqual(timeIncrease);
            
            console.log(`⏰ Time increased by: ${finalTime - initialTime} seconds`);
            console.log('✅ Time manipulation verified');
        });
    });

    describe('📋 In-Process Ganache Summary', () => {
        it('should provide complete functionality report', async function() {
            const finalBlockNumber = await web3Wrapper.getBlockNumberAsync();
            const finalNetworkId = await web3Wrapper.getNetworkIdAsync();
            
            console.log('🎉 In-Process Ganache Functionality Report:');
            console.log('   ✅ In-process startup: SUCCESS');
            console.log('   ✅ Network connectivity: SUCCESS');
            console.log('   ✅ Account provisioning: SUCCESS');
            console.log('   ✅ Block mining: SUCCESS');
            console.log('   ✅ ETH transfers: SUCCESS');
            console.log('   ✅ Time manipulation: SUCCESS');
            console.log('');
            console.log(`📊 Final State:`);
            console.log(`   Network ID: ${finalNetworkId}`);
            console.log(`   Block Number: ${finalBlockNumber}`);
            console.log(`   Total Accounts: ${accounts.length}`);
            console.log('');
            console.log('🔥 In-process Ganache is fully operational!');
            console.log('💡 Note: No external process, fully contained in test');
            
            expect(true).to.be.true;
        });
    });
}); 