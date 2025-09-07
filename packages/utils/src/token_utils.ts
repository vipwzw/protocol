import { toBigInt, pow } from './configured_bigint';
import { Numberish } from './types';

/**
 * Converts token units to the base unit (wei) by multiplying by 10^decimals
 * @param units The amount in token units (e.g., ETH, DAI)
 * @param decimals The number of decimal places for the token (default: 18)
 * @return The amount in base units (wei) as bigint
 */
export function fromTokenUnitAmount(units: Numberish, decimals: number = 18): bigint {
    const unitsBigInt = toBigInt(units);
    const multiplier = pow(10n, BigInt(decimals));
    return unitsBigInt * multiplier;
}

/**
 * Converts base units (wei) to token units by dividing by 10^decimals
 * @param weis The amount in base units (wei)
 * @param decimals The number of decimal places for the token (default: 18)
 * @return The amount in token units as bigint (rounded down)
 */
export function toTokenUnitAmount(weis: Numberish, decimals: number = 18): bigint {
    const weisBigInt = toBigInt(weis);
    const divisor = pow(10n, BigInt(decimals));
    return weisBigInt / divisor;
}

/**
 * Converts base units (wei) to token units as a string with decimal places
 * @param weis The amount in base units (wei)
 * @param decimals The number of decimal places for the token (default: 18)
 * @param precision The number of decimal places to show in the result (default: 6)
 * @return The amount in token units as a decimal string
 */
export function toTokenUnitAmountString(weis: Numberish, decimals: number = 18, precision: number = 6): string {
    const weisBigInt = toBigInt(weis);
    const divisor = pow(10n, BigInt(decimals));

    const integerPart = weisBigInt / divisor;
    const remainder = weisBigInt % divisor;

    if (remainder === 0n || precision === 0) {
        return integerPart.toString();
    }

    // Calculate fractional part
    const fractionalMultiplier = pow(10n, BigInt(precision));
    const fractionalPart = (remainder * fractionalMultiplier) / divisor;

    // Format with leading zeros if needed
    const fractionalStr = fractionalPart.toString().padStart(precision, '0');

    // Remove trailing zeros
    const trimmedFractional = fractionalStr.replace(/0+$/, '');

    if (trimmedFractional === '') {
        return integerPart.toString();
    }

    return `${integerPart}.${trimmedFractional}`;
}

/**
 * Formats a token amount with proper decimal places for display
 * @param amount The amount in base units
 * @param symbol The token symbol (e.g., 'ETH', 'DAI')
 * @param decimals The number of decimal places for the token
 * @param precision The number of decimal places to show
 * @return Formatted string like "1.234567 ETH"
 */
export function formatTokenAmount(
    amount: Numberish,
    symbol: string,
    decimals: number = 18,
    precision: number = 6,
): string {
    const formattedAmount = toTokenUnitAmountString(amount, decimals, precision);
    return `${formattedAmount} ${symbol}`;
}

/**
 * Validates that a token amount is within valid bounds
 * @param amount The amount to validate
 * @param maxValue Optional maximum value (default: 2^256 - 1)
 * @return True if valid, false otherwise
 */
export function isValidTokenAmount(amount: Numberish, maxValue?: bigint): boolean {
    try {
        const amountBigInt = toBigInt(amount);

        if (amountBigInt < 0n) {
            return false;
        }

        if (maxValue !== undefined && amountBigInt > maxValue) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}
