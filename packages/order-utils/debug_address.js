const { ethers } = require('ethers');

async function debugAddress() {
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    try {
        const accounts = await provider.send('eth_accounts', []);
        console.log('Available accounts:', accounts);
        if (accounts && accounts.length > 0) {
            console.log('Using makerAddress:', accounts[0]);
        }
    } catch (error) {
        console.log('No local provider, using default address');
        // 使用一个确定性的测试地址
        const wallet = ethers.Wallet.createRandom();
        console.log('Random wallet address:', wallet.address);
    }
}

debugAddress().catch(console.error);
