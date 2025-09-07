import { ethers } from 'ethers';

// Simple global test hooks for exchange-libs
// Using native Hardhat provider instead of custom subproviders

before('setup test environment', async () => {
    // Basic test setup - Hardhat handles provider management
    // No additional setup needed as we use Hardhat's built-in provider
});

after('cleanup test environment', async () => {
    // Basic cleanup if needed
    // Hardhat handles provider cleanup automatically
});
