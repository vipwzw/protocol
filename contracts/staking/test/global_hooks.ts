// Global test setup for Hardhat environment
// No need for provider management in Hardhat

// Optional: Add any global test setup here if needed
before('initialize test environment', async () => {
    // Hardhat manages the provider automatically
    console.log('Test environment initialized');
});

after('cleanup test environment', async () => {
    // Any cleanup code can go here
    console.log('Test environment cleaned up');
});
