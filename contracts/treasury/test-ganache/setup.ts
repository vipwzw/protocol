import Ganache from 'ganache';
import { Web3Wrapper } from '@0x/web3-wrapper';

let ganacheServer: any;
let web3Wrapper: Web3Wrapper | null;

const GANACHE_OPTIONS = {
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
};

export async function startGanache(): Promise<Web3Wrapper> {
    if (ganacheServer && web3Wrapper) {
        return web3Wrapper;
    }

    console.log('🚀 Starting Ganache on port 7545...');
    
    try {
        ganacheServer = Ganache.server(GANACHE_OPTIONS);
        await ganacheServer.listen(7545);
        
        const provider = ganacheServer.provider;
        web3Wrapper = new Web3Wrapper(provider);
        
        // Verify connection
        const accounts = await web3Wrapper.getAvailableAddressesAsync();
        const blockNumber = await web3Wrapper.getBlockNumberAsync();
        
        console.log(`✅ Ganache started successfully`);
        console.log(`   📊 Block Number: ${blockNumber}`);
        console.log(`   👥 Accounts: ${accounts.length}`);
        console.log(`   🌐 Port: 7545`);
        
        return web3Wrapper;
    } catch (error) {
        console.error('❌ Failed to start Ganache:', error);
        throw error;
    }
}

export async function stopGanache(): Promise<void> {
    if (ganacheServer) {
        console.log('⏹️ Stopping Ganache...');
        await ganacheServer.close();
        ganacheServer = null;
        web3Wrapper = null;
        console.log('✅ Ganache stopped');
    }
}

export function getWeb3Wrapper(): Web3Wrapper {
    if (!web3Wrapper) {
        throw new Error('Ganache not started. Call startGanache() first.');
    }
    return web3Wrapper;
}

// Global hooks for mocha
before(async function() {
    this.timeout(30000); // 30 seconds timeout for Ganache startup
    await startGanache();
});

after(async function() {
    this.timeout(10000); // 10 seconds timeout for cleanup
    await stopGanache();
}); 