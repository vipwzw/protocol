import { ethers } from 'ethers';

export const constants = {
    // Gas and pricing constants
    DEFAULT_GAS_PRICE: ethers.parseUnits('20', 'gwei'),
    NULL_BYTES: '0x',
    NULL_ADDRESS: ethers.ZeroAddress,
    
    // Common values
    UNLIMITED_ALLOWANCE_IN_BASE_UNITS: ethers.MaxUint256,
    ZERO_AMOUNT: 0n,
    MAX_UINT256: ethers.MaxUint256,
    
    // Address and hash lengths
    ADDRESS_LENGTH: 20,
    BYTES32_LENGTH: 32,
    
    // Mathematical constants
    ONE_ETHER: ethers.parseEther('1'),
    PERCENTAGE_DENOMINATOR: 10000n, // 100% = 10000 (for basis points)
    PPM_DENOMINATOR: 1000000n, // Parts per million
    PPM_100_PERCENT: 1000000n,
    
    // Time constants
    SECONDS_IN_DAY: 86400,
    SECONDS_IN_HOUR: 3600,
    SECONDS_IN_MINUTE: 60,
    
    // Gas limits
    DEFAULT_GAS_LIMIT: 6000000,
    MAX_GAS_LIMIT: 8000000,
    
    // Network constants
    CHAIN_ID: {
        MAINNET: 1,
        SEPOLIA: 11155111,
        HARDHAT: 31337,
        LOCALHOST: 31337,
    },
    
    // Token constants
    DECIMALS_DEFAULT: 18,
    
    // Dummy token constants (for testing)
    DUMMY_TOKEN_NAME: 'DummyToken',
    DUMMY_TOKEN_SYMBOL: 'DUM',
    DUMMY_TOKEN_DECIMALS: 18n,
    DUMMY_TOKEN_TOTAL_SUPPLY: ethers.parseEther('1000000000'), // 1 billion tokens
    
    // EIP712 constants
    EIP712_DOMAIN_NAME: '0x Protocol',
    EIP712_DOMAIN_VERSION: '3.0.0',
    
    // Order and trading constants
    MAX_UINT256_ROOT: 340282366920938463463374607431768211455n,
    
    // Static order parameters for testing
    STATIC_ORDER_PARAMS: {
        makerAddress: '0x0000000000000000000000000000000000000000',
        takerAddress: '0x0000000000000000000000000000000000000000',
        feeRecipientAddress: '0x0000000000000000000000000000000000000000',
        senderAddress: '0x0000000000000000000000000000000000000000',
        makerAssetAmount: ethers.parseEther('0'),
        takerAssetAmount: ethers.parseEther('0'),
        makerFee: ethers.parseEther('0'),
        takerFee: ethers.parseEther('0'),
        expirationTimeSeconds: 0n,
        salt: 0n,
        makerAssetData: '0x',
        takerAssetData: '0x',
        makerFeeAssetData: '0x',
        takerFeeAssetData: '0x',
    },
    
    // Common test values
    TEN_UNITS_EIGHTEEN_DECIMALS: ethers.parseEther('10'),
    ONE_THOUSAND_UNITS_EIGHTEEN_DECIMALS: ethers.parseEther('1000'),
    ONE_MILLION_UNITS_EIGHTEEN_DECIMALS: ethers.parseEther('1000000'),
};

// Export individual constants for backward compatibility
export const {
    DEFAULT_GAS_PRICE,
    NULL_BYTES,
    NULL_ADDRESS,
    UNLIMITED_ALLOWANCE_IN_BASE_UNITS,
    ZERO_AMOUNT,
    MAX_UINT256,
    ONE_ETHER,
    ADDRESS_LENGTH,
    PERCENTAGE_DENOMINATOR,
    PPM_DENOMINATOR,
    PPM_100_PERCENT,
    DUMMY_TOKEN_NAME,
    DUMMY_TOKEN_SYMBOL,
    DUMMY_TOKEN_DECIMALS,
    DUMMY_TOKEN_TOTAL_SUPPLY,
} = constants;