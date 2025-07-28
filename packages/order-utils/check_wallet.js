const { ethers } = require('ethers');

const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const testWallet = ethers.Wallet.fromPhrase(testMnemonic);

console.log('Test wallet address:', testWallet.address);
console.log('Test wallet private key:', testWallet.privateKey);
