// Global hooks for asset-proxy tests
// Note: Provider management is handled automatically by Hardhat

before('setup test environment', () => {
    // Hardhat automatically manages the provider
    console.log('Test environment setup');
});

after('cleanup test environment', async () => {
    // Cleanup if needed
    console.log('Test environment cleanup');
});
