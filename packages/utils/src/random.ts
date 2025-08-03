import { MAX_UINT256 } from './configured_bigint';
import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure pseudo-random 256-bit number.
 * @return A pseudo-random 256-bit number as bigint.
 */
export function generatePseudoRandom256BitNumber(): bigint {
    // Generate 32 random bytes (256 bits)
    const randomBuffer = randomBytes(32);
    
    // Convert bytes to bigint
    let result = 0n;
    for (let i = 0; i < randomBuffer.length; i++) {
        result = (result << 8n) | BigInt(randomBuffer[i]);
    }
    
    // Ensure the result is within the valid uint256 range
    return result & MAX_UINT256;
}

/**
 * Generates a pseudo-random number between 0 and max (exclusive).
 * @param max The upper bound (exclusive)
 * @return A pseudo-random number between 0 and max
 */
export function generatePseudoRandomNumber(max: bigint): bigint {
    if (max <= 0n) {
        throw new Error('Max must be greater than 0');
    }
    
    // Calculate how many bytes we need
    const bitLength = max.toString(2).length;
    const byteLength = Math.ceil(bitLength / 8);
    
    let result: bigint;
    do {
        // Generate random bytes
        const randomBuffer = randomBytes(byteLength);
        
        // Convert to bigint
        result = 0n;
        for (let i = 0; i < randomBuffer.length; i++) {
            result = (result << 8n) | BigInt(randomBuffer[i]);
        }
        
        // Mask to the required bit length to avoid bias
        const mask = (1n << BigInt(bitLength)) - 1n;
        result = result & mask;
        
    } while (result >= max); // Rejection sampling to avoid bias
    
    return result;
}

/**
 * Generates a pseudo-random boolean value.
 * @return A pseudo-random boolean
 */
export function generatePseudoRandomBoolean(): boolean {
    const randomByte = randomBytes(1)[0];
    return (randomByte & 1) === 1;
}

/**
 * Generates a pseudo-random hex string of specified length.
 * @param length The number of bytes in the output (hex string will be 2x this length)
 * @return A pseudo-random hex string with 0x prefix
 */
export function generatePseudoRandomHex(length: number): string {
    if (length <= 0) {
        throw new Error('Length must be greater than 0');
    }
    
    const randomBuffer = randomBytes(length);
    return '0x' + randomBuffer.toString('hex');
}