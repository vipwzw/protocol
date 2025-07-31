const { ethers } = require('hardhat');

/**
 * 获取最新区块的时间戳
 */
export async function getLatestBlockTimestampAsync(): Promise<number> {
    const latestBlock = await ethers.provider.getBlock('latest');
    return latestBlock.timestamp;
}

/**
 * 增加区块链时间并挖掘新区块
 */
export async function increaseTimeAndMineBlockAsync(seconds: number): Promise<void> {
    // 增加时间
    await ethers.provider.send('evm_increaseTime', [seconds]);
    // 挖掘新区块
    await ethers.provider.send('evm_mine', []);
}

/**
 * 设置下一个区块的时间戳
 */
export async function setNextBlockTimestampAsync(timestamp: number): Promise<void> {
    await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp]);
}

/**
 * 挖掘指定数量的区块
 */
export async function mineBlocksAsync(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
        await ethers.provider.send('evm_mine', []);
    }
}

/**
 * 获取指定区块的时间戳
 */
export async function getBlockTimestampAsync(blockNumber: number | string): Promise<number> {
    const block = await ethers.provider.getBlock(blockNumber);
    return block.timestamp;
}

/**
 * 等待指定时间（秒）
 */
export async function waitAsync(seconds: number): Promise<void> {
    await increaseTimeAndMineBlockAsync(seconds);
}

/**
 * 跳转到指定时间戳
 */
export async function jumpToTimestampAsync(timestamp: number): Promise<void> {
    const currentTime = await getLatestBlockTimestampAsync();
    if (timestamp > currentTime) {
        const timeDiff = timestamp - currentTime;
        await increaseTimeAndMineBlockAsync(timeDiff);
    } else {
        // 如果目标时间在过去，直接设置下一个区块时间
        await setNextBlockTimestampAsync(timestamp);
        await ethers.provider.send('evm_mine', []);
    }
}

/**
 * 时间相关的常量
 */
export const TIME_CONSTANTS = {
    SECOND: 1,
    MINUTE: 60,
    HOUR: 60 * 60,
    DAY: 24 * 60 * 60,
    WEEK: 7 * 24 * 60 * 60,
    MONTH: 30 * 24 * 60 * 60, // 近似值
    YEAR: 365 * 24 * 60 * 60, // 近似值
};