// Global hooks for asset-proxy tests
// Note: Hardhat chai matchers are automatically imported via hardhat.config.ts
// Modern @nomicfoundation/hardhat-chai-matchers provides all necessary assertions

before('setup test environment', () => {
    // Hardhat automatically manages the provider
    console.log('✅ Test environment setup with modern chai matchers');
});

after('cleanup test environment', async () => {
    // Cleanup if needed
    console.log('🧹 Test environment cleanup');
});
