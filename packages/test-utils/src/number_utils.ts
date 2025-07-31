import { ethers } from 'ethers';
import * as crypto from 'crypto';

export type Numberish = string | number | bigint;

/**
 * 将各种数值类型转换为 bigint
 */
function toBigInt(x: Numberish): bigint {
    if (typeof x === 'bigint') {
        return x;
    }
    if (typeof x === 'number') {
        return BigInt(Math.floor(x));
    }
    if (typeof x === 'string') {
        return BigInt(x);
    }
    throw new Error(`Cannot convert ${typeof x} to bigint`);
}

/**
 * 生成指定范围内的随机整数
 */
export function getRandomInteger(min: Numberish, max: Numberish): bigint {
    const minBig = toBigInt(min);
    const maxBig = toBigInt(max);
    const range = maxBig - minBig + 1n;
    
    // 使用 crypto 生成随机数
    const randomBytes = crypto.randomBytes(32);
    const randomBig = BigInt('0x' + randomBytes.toString('hex'));
    
    return minBig + (randomBig % range);
}

/**
 * 生成随机部分，用于百分比计算
 */
export function getRandomPortion(total: Numberish): bigint {
    const totalBig = toBigInt(total);
    // 生成 0 到 total 之间的随机数
    const randomBytes = crypto.randomBytes(32);
    const randomBig = BigInt('0x' + randomBytes.toString('hex'));
    const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    
    return (totalBig * randomBig) / maxUint256;
}

/**
 * 生成高精度随机浮点数（以 bigint 表示，缩放 1e18）
 */
export function getRandomFloat(min: Numberish, max: Numberish): bigint {
    const minBig = toBigInt(min);
    const maxBig = toBigInt(max);
    const range = maxBig - minBig;
    
    const randomBytes = crypto.randomBytes(32);
    const randomBig = BigInt('0x' + randomBytes.toString('hex'));
    const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    
    return minBig + (randomBig * range) / maxUint256;
}

/**
 * 将数值转换为基础单位（乘以 10^decimals）
 */
export function toBaseUnitAmount(amount: Numberish, decimals: number = 18): bigint {
    const amountBig = toBigInt(amount);
    const multiplier = BigInt(10) ** BigInt(decimals);
    return amountBig * multiplier;
}

/**
 * 从基础单位转换为小数表示
 */
export function fromBaseUnitAmount(amount: Numberish, decimals: number = 18): string {
    const amountBig = toBigInt(amount);
    return ethers.formatUnits(amountBig, decimals);
}

/**
 * 固定点数学基础值
 */
export const FIXED_POINT_BASE = BigInt('0x80000000000000000000000000000000'); // 2^127

/**
 * 转换为固定点表示
 */
export function toFixed(value: Numberish): bigint {
    const valueBig = toBigInt(value);
    return valueBig * FIXED_POINT_BASE;
}

/**
 * 从固定点转换为普通数值
 */
export function fromFixed(value: Numberish): bigint {
    const valueBig = toBigInt(value);
    return valueBig / FIXED_POINT_BASE;
}

/**
 * 转换为十进制字符串
 */
export function toDecimal(value: Numberish, decimals: number = 18): string {
    return fromBaseUnitAmount(value, decimals);
}

/**
 * 计算百分比值
 */
export function getPercentageOfValue(value: Numberish, percentage: Numberish): bigint {
    const valueBig = toBigInt(value);
    const percentageBig = toBigInt(percentage);
    return (valueBig * percentageBig) / 100n;
}

/**
 * 断言两个整数大致相等（允许小误差）
 */
export function assertIntegerRoughlyEquals(
    actual: Numberish,
    expected: Numberish,
    tolerance: Numberish = 1n
): void {
    const actualBig = toBigInt(actual);
    const expectedBig = toBigInt(expected);
    const toleranceBig = toBigInt(tolerance);
    
    const diff = actualBig > expectedBig ? actualBig - expectedBig : expectedBig - actualBig;
    
    if (diff > toleranceBig) {
        throw new Error(`Expected ${actualBig} to be roughly equal to ${expectedBig} (tolerance: ${toleranceBig}), but difference was ${diff}`);
    }
}

/**
 * 断言两个数值大致相等（支持浮点数比较）
 */
export function assertRoughlyEquals(
    actual: Numberish,
    expected: Numberish,
    tolerancePercentage: number = 0.01 // 1% tolerance
): void {
    const actualBig = toBigInt(actual);
    const expectedBig = toBigInt(expected);
    
    if (expectedBig === 0n) {
        if (actualBig === 0n) return;
        throw new Error(`Expected ${actualBig} to equal ${expectedBig}`);
    }
    
    const diff = actualBig > expectedBig ? actualBig - expectedBig : expectedBig - actualBig;
    const toleranceAmount = (expectedBig * BigInt(Math.floor(tolerancePercentage * 10000))) / 10000n;
    
    if (diff > toleranceAmount) {
        throw new Error(`Expected ${actualBig} to be roughly equal to ${expectedBig} (tolerance: ${tolerancePercentage * 100}%), but difference was ${diff}`);
    }
}

/**
 * 计算数值差异百分比
 */
export function getNumericalDivergence(value1: Numberish, value2: Numberish): number {
    const val1 = toBigInt(value1);
    const val2 = toBigInt(value2);
    
    if (val2 === 0n) {
        return val1 === 0n ? 0 : Infinity;
    }
    
    const diff = val1 > val2 ? val1 - val2 : val2 - val1;
    const percentage = Number((diff * 10000n) / val2) / 100; // 转换为百分比
    
    return percentage;
}