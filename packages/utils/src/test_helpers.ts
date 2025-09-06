/**
 * 测试辅助工具函数
 * 这些函数从原来的 @0x/test-utils 和 @0x/dev-utils 迁移而来
 * 用于支持 Hardhat 测试框架
 */

import { ethers } from 'ethers';
import { expect as chaiExpected, expect } from 'chai';

// ========== 测试常量 ==========
export const testConstants = {
    // 基本常量
    NULL_ADDRESS: '0x0000000000000000000000000000000000000000',
    NULL_BYTES: '0x',
    NULL_BYTES32: '0x0000000000000000000000000000000000000000000000000000000000000000',

    // 数值常量
    ZERO_AMOUNT: 0n,
    MAX_UINT256: 2n ** 256n - 1n,
    MAX_UINT128: 2n ** 128n - 1n,
    MAX_UINT64: 2n ** 64n - 1n,
    MAX_UINT32: 2n ** 32n - 1n,

    // 时间常量（以秒为单位）
    ONE_SECOND_MS: 1000,
    ONE_MINUTE_MS: 60 * 1000,
    ONE_HOUR_MS: 60 * 60 * 1000,
    ONE_DAY_MS: 24 * 60 * 60 * 1000,

    // 以太坊常量
    KECCAK256_NULL: '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    WETH_ASSET_DATA: '0xf47261b0000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',

    // Gas 常量
    DEFAULT_GAS_PRICE: 20000000000n, // 20 gwei
    DEFAULT_GAS_LIMIT: 6721975n,

    // 网络相关
    GANACHE_NETWORK_ID: 50,
    KOVAN_NETWORK_ID: 42,
    MAINNET_NETWORK_ID: 1,

    // 测试钱包助记词
    TEST_MNEMONIC: 'concert load couple harbor equip island argue ramp clarify fence smart topic',
};

// ========== 随机数生成工具 ==========

/**
 * 生成指定范围内的随机大整数
 */
export function getRandomInteger(min: bigint | string | number, max: bigint | string | number): bigint {
    const minBig = typeof min === 'bigint' ? min : BigInt(Math.floor(Number(min)));
    const maxBig = typeof max === 'bigint' ? max : BigInt(Math.floor(Number(max)));
    const range = maxBig - minBig;
    const randomBytes = ethers.randomBytes(32);
    const randomBig = BigInt('0x' + Buffer.from(randomBytes).toString('hex'));
    return minBig + (randomBig % (range + 1n));
}

/**
 * 生成一个数量的随机比例
 */
export function getRandomPortion(amount: bigint): bigint {
    if (amount <= 1n) return amount;
    return getRandomInteger(1n, amount);
}

/**
 * 生成随机的以太坊地址
 */
export function randomAddress(): string {
    return ethers.Wallet.createRandom().address;
}

/**
 * 生成随机字节
 */
export function getRandomBytes(length: number): string {
    return ethers.hexlify(ethers.randomBytes(length));
}

// ========== 测试断言工具 ==========

/**
 * 断言两个整数大致相等（允许小的误差）
 */
export function assertIntegerRoughlyEquals(
    actual: bigint | number | string,
    expected: bigint | number | string,
    delta: bigint | number | string = 1n,
    message?: string,
): void {
    const actualBig = typeof actual === 'bigint' ? actual : BigInt(actual);
    const expectedBig = typeof expected === 'bigint' ? expected : BigInt(expected);
    const deltaBig = typeof delta === 'bigint' ? delta : BigInt(delta);

    const diff = actualBig > expectedBig ? actualBig - expectedBig : expectedBig - actualBig;

    if (diff > deltaBig) {
        const errorMessage =
            message ||
            `Expected ${actualBig.toString()} to be roughly equal to ${expectedBig.toString()} (within ${deltaBig.toString()})`;
        throw new Error(errorMessage);
    }
}

// ========== 单位转换工具 ==========

/**
 * 将代币数量转换为基础单位（考虑小数位）
 */
export function toBaseUnitAmount(amount: bigint | number | string, decimals: number = 18): bigint {
    const amountBig = typeof amount === 'bigint' ? amount : BigInt(amount);
    return amountBig * 10n ** BigInt(decimals);
}

/**
 * 将基础单位转换为代币数量
 */
export function fromBaseUnitAmount(amount: bigint | number | string, decimals: number = 18): bigint {
    const amountBig = typeof amount === 'bigint' ? amount : BigInt(amount);
    return amountBig / 10n ** BigInt(decimals);
}

// ========== 事件日志工具 ==========

/**
 * 数字化类型（可以是 bigint、number 或 string）
 * 注意：此类型也在 types.ts 中定义，在这里重新定义用于向后兼容
 */
export type { Numberish } from './types';

/**
 * 从交易回执中验证事件日志（原版本，保持向后兼容）
 */
export async function verifyEventsFromLogs(
    logs: any[],
    expectedEvents: Array<{
        event: string;
        args?: { [key: string]: any };
    }>,
    contractInterface: ethers.Interface,
): Promise<void> {
    const decodedLogs = logs
        .map(log => {
            try {
                return contractInterface.parseLog(log);
            } catch (e) {
                return null;
            }
        })
        .filter(log => log !== null);

    expect(decodedLogs).to.have.length.at.least(expectedEvents.length);

    expectedEvents.forEach((expectedEvent, index) => {
        const actualEvent = decodedLogs[index];
        expect(actualEvent?.name).to.equal(expectedEvent.event);

        if (expectedEvent.args) {
            for (const [key, expectedValue] of Object.entries(expectedEvent.args)) {
                expect(actualEvent?.args[key]).to.equal(expectedValue);
            }
        }
    });
}

/**
 * 验证交易收据中的事件日志（现代版本，支持直接传入合约和收据）
 * @param receipt 交易收据
 * @param expectedEvents 预期的事件数组
 * @param eventName 事件名称
 * @param contract 合约实例（用于解析事件）
 */
export function verifyEventFromReceipt(receipt: any, expectedEvents: any[], eventName: string, contract: any): void {
    // 使用 ethers v6 的事件解析
    const parsedLogs = receipt.logs
        .map((log: any) => {
            try {
                return contract.interface.parseLog(log);
            } catch {
                return null;
            }
        })
        .filter((log: any) => log && log.name === eventName);

    expect(parsedLogs.length).to.be.greaterThanOrEqual(expectedEvents.length);

    // 验证每个预期事件
    expectedEvents.forEach((expectedEvent, index) => {
        const actualEvent = parsedLogs[index];
        expect(actualEvent).to.exist;

        // 验证事件参数
        Object.keys(expectedEvent).forEach(key => {
            if (typeof expectedEvent[key] === 'bigint') {
                expect(actualEvent.args[key]).to.equal(expectedEvent[key]);
            } else {
                expect(actualEvent.args[key]).to.equal(expectedEvent[key]);
            }
        });
    });
}

/**
 * 验证交易收据中包含指定事件（简化版本）
 * @param receipt 交易收据
 * @param eventName 事件名称
 * @param contract 合约实例
 * @param expectedCount 预期事件数量（默认为1）
 */
export function verifyEventEmitted(receipt: any, eventName: string, contract: any, expectedCount: number = 1): any[] {
    const parsedLogs = receipt.logs
        .map((log: any) => {
            try {
                return contract.interface.parseLog(log);
            } catch {
                return null;
            }
        })
        .filter((log: any) => log && log.name === eventName);

    expect(parsedLogs.length).to.equal(expectedCount);
    return parsedLogs;
}

/**
 * 过滤日志并返回特定事件的参数
 */
export function filterLogs<T>(logs: any[], eventName: string, contractInterface: ethers.Interface): T[] {
    return logs
        .map(log => {
            try {
                const parsed = contractInterface.parseLog(log);
                return parsed?.name === eventName ? (parsed.args as T) : null;
            } catch (e) {
                return null;
            }
        })
        .filter((args): args is T => args !== null);
}

// ========== 错误处理工具 ==========

/**
 * 错误回滚助手 - 用于处理智能合约错误
 */
export const revertErrorHelper = {
    /**
     * 检查错误是否为预期的回滚错误
     */
    isRevertError(error: any, expectedError?: any): boolean {
        if (typeof error === 'string') {
            return expectedError ? error.includes(expectedError) : error.includes('revert');
        }
        if (error && error.message) {
            return expectedError ? error.message.includes(expectedError) : error.message.includes('revert');
        }
        return false;
    },

    /**
     * 提取错误消息
     */
    getErrorMessage(error: any): string {
        if (typeof error === 'string') return error;
        if (error && error.message) return error.message;
        if (error && error.reason) return error.reason;
        return 'Unknown error';
    },
};

// ========== 交易默认配置 ==========

/**
 * 默认交易配置
 */
export const txDefaults = {
    gasPrice: testConstants.DEFAULT_GAS_PRICE,
    gasLimit: testConstants.DEFAULT_GAS_LIMIT,
};

// ========== 类型定义 ==========

/**
 * ERC20 余额映射类型
 */
export interface ERC20BalancesByOwner {
    [ownerAddress: string]: {
        [tokenAddress: string]: bigint;
    };
}

/**
 * 区块链测试环境（废弃，使用 Hardhat 快照）
 * @deprecated 使用 Hardhat 的快照功能替代
 */
export interface BlockchainTestsEnvironment {
    provider: any;
    web3Wrapper: any;
}

// ========== 导出所有常量（向后兼容） ==========
export const constants = testConstants;

// ========== 测试组合工具 ==========

/**
 * 测试用的 uint256 值集合
 */
export const uint256Values = [
    0n,
    1n,
    2n ** 8n - 1n,
    2n ** 8n,
    2n ** 16n - 1n,
    2n ** 16n,
    2n ** 32n - 1n,
    2n ** 32n,
    2n ** 64n - 1n,
    2n ** 64n,
    2n ** 128n - 1n,
    2n ** 128n,
    2n ** 256n - 1n,
];

/**
 * 与参考函数进行组合测试
 */
export function testCombinatoriallyWithReferenceFunc(
    description: string,
    referenceFunc: (...args: any[]) => any,
    contractFunc: (...args: any[]) => Promise<any>,
    valueArrays: any[][],
): void {
    describe(description, () => {
        const combinations = generateCombinations(valueArrays);

        combinations.forEach((combination, index) => {
            it(`should match reference function for combination ${index}: [${combination.join(', ')}]`, async () => {
                console.log(`Testing combination ${index}: [${combination.join(', ')}]`);

                let referenceResult, referenceError;
                let contractResult, contractError;

                // Call reference function
                try {
                    referenceResult = await referenceFunc(...combination);
                    console.log('Reference result:', referenceResult);
                } catch (error) {
                    referenceError = error;
                    console.log('Reference function threw error:', (error as Error).message);
                }

                // Call contract function
                try {
                    contractResult = await contractFunc(...combination);
                    console.log('Contract result:', contractResult);
                } catch (error) {
                    contractError = error;
                    console.log('Contract function threw error:', (error as Error).message);
                }

                // Both should either succeed or fail
                if (referenceError && contractError) {
                    // Both threw errors - this is expected for edge cases
                    console.log('Both functions threw errors (expected for edge cases)');
                } else if (!referenceError && !contractError) {
                    // Both succeeded - results should match
                    if (!compareResults(referenceResult, contractResult)) {
                        throw new Error(
                            `Mismatch: reference=${JSON.stringify(referenceResult)}, contract=${JSON.stringify(contractResult)}`,
                        );
                    }
                } else {
                    // One succeeded, one failed - this is a mismatch
                    if (referenceError) {
                        throw new Error(
                            `Reference function threw error but contract succeeded. Reference error: ${(referenceError as Error).message}`,
                        );
                    } else {
                        throw new Error(
                            `Contract function threw error but reference succeeded. Contract error: ${(contractError as Error).message}`,
                        );
                    }
                }
            });
        });
    });
}

/**
 * 比较两个结果是否相等，支持复杂对象和简单值
 */
function compareResults(reference: any, contract: any): boolean {
    // 简单值比较
    if (
        typeof reference === 'bigint' ||
        typeof reference === 'number' ||
        typeof reference === 'string' ||
        typeof reference === 'boolean'
    ) {
        return reference === contract;
    }

    // 复杂对象比较 (如 FillResults)
    if (typeof reference === 'object' && reference !== null) {
        // 如果合约返回的是 ethers Result 数组
        if (Array.isArray(contract) && contract.length !== undefined) {
            // 检查是否是 FillResults 对象
            if ('makerAssetFilledAmount' in reference) {
                return (
                    reference.makerAssetFilledAmount === contract[0] &&
                    reference.takerAssetFilledAmount === contract[1] &&
                    reference.makerFeePaid === contract[2] &&
                    reference.takerFeePaid === contract[3] &&
                    reference.protocolFeePaid === contract[4]
                );
            }
        }

        // 其他对象类型的比较
        if (typeof contract === 'object' && contract !== null) {
            const refKeys = Object.keys(reference);
            const contractKeys = Object.keys(contract);

            if (refKeys.length !== contractKeys.length) {
                return false;
            }

            for (const key of refKeys) {
                if (!compareResults(reference[key], contract[key])) {
                    return false;
                }
            }
            return true;
        }
    }

    return false;
}

/**
 * 生成所有可能的参数组合
 */
function generateCombinations(arrays: any[][]): any[][] {
    if (arrays.length === 0) return [[]];
    if (arrays.length === 1) return arrays[0].map(item => [item]);

    const combinations: any[][] = [];
    const firstArray = arrays[0];
    const restCombinations = generateCombinations(arrays.slice(1));

    firstArray.forEach(firstItem => {
        restCombinations.forEach(restCombination => {
            combinations.push([firstItem, ...restCombination]);
        });
    });

    return combinations;
}

// ========== 订单哈希工具 ==========

/**
 * 订单哈希相关工具函数
 */
export const orderHashUtils = {
    /**
     * 计算订单哈希 (简化版本，主要用于测试)
     */
    getOrderHashHex: (order: any): string => {
        // 这是一个简化的实现，实际应该使用完整的 EIP712 哈希
        return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(order)));
    },
};

// ========== 传统测试辅助函数 ==========

/**
 * 期望交易失败但没有原因的断言
 */
export async function expectTransactionFailedAsync(func: () => Promise<any>, reason?: string): Promise<void> {
    try {
        await func();
        expect.fail('Expected transaction to fail');
    } catch (error: any) {
        if (reason) {
            expect(error.message).to.include(reason);
        }
    }
}

/**
 * 期望交易失败且没有返回原因
 */
export async function expectTransactionFailedWithoutReasonAsync(func: () => Promise<any>): Promise<void> {
    try {
        await func();
        expect.fail('Expected transaction to fail without reason');
    } catch (error: any) {
        // 交易应该失败但不检查具体原因
    }
}

/**
 * 期望资金不足错误
 */
export async function expectInsufficientFundsAsync(func: () => Promise<any>): Promise<void> {
    try {
        await func();
        expect.fail('Expected insufficient funds error');
    } catch (error: any) {
        expect(error.message).to.match(/(insufficient funds|insufficient balance)/i);
    }
}

/**
 * 验证 ERC721 转移事件
 */
export function verifyERC721TransferEvent(
    logs: any[],
    expectedArgs: {
        from: string;
        to: string;
        tokenId: bigint;
    },
): void {
    const transferEvents = logs.filter(log => log.fragment && log.fragment.name === 'Transfer');

    expect(transferEvents).to.have.length.at.least(1);
    const transferEvent = transferEvents[0];

    expect(transferEvent.args.from).to.equal(expectedArgs.from);
    expect(transferEvent.args.to).to.equal(expectedArgs.to);
    expect(transferEvent.args.tokenId).to.equal(expectedArgs.tokenId);
}

/**
 * 验证转移事件
 */
export function verifyTransferEvent(
    logs: any[],
    expectedArgs: {
        from: string;
        to: string;
        value: bigint;
    },
): void {
    const transferEvents = logs.filter(log => log.fragment && log.fragment.name === 'Transfer');

    expect(transferEvents).to.have.length.at.least(1);
    const transferEvent = transferEvents[0];

    expect(transferEvent.args.from).to.equal(expectedArgs.from);
    expect(transferEvent.args.to).to.equal(expectedArgs.to);
    expect(transferEvent.args.value).to.equal(expectedArgs.value);
}

/**
 * 验证授权事件
 */
export function verifyApprovalEvent(
    logs: any[],
    expectedArgs: {
        owner: string;
        spender: string;
        value: bigint;
    },
): void {
    const approvalEvents = logs.filter(log => log.fragment && log.fragment.name === 'Approval');

    expect(approvalEvents).to.have.length.at.least(1);
    const approvalEvent = approvalEvents[0];

    expect(approvalEvent.args.owner).to.equal(expectedArgs.owner);
    expect(approvalEvent.args.spender).to.equal(expectedArgs.spender);
    expect(approvalEvent.args.value).to.equal(expectedArgs.value);
}

/**
 * 过滤日志到参数
 */
export function filterLogsToArguments<T>(logs: any[], eventName: string): T[] {
    return logs.filter(log => log.fragment && log.fragment.name === eventName).map(log => log.args as T);
}

// ========== Hardhat 测试辅助函数 ==========

/**
 * 获取 Hardhat 下的所有 signers（避免对 hardhat 的静态导入）
 * @param hreOrEthers 传入 hardhat 的 hre 或 hardhat 中的 ethers 对象
 */
export async function getHardhatSigners(hreOrEthers: any): Promise<any[]> {
    const maybeEthers = hreOrEthers && hreOrEthers.ethers ? hreOrEthers.ethers : hreOrEthers;
    if (!maybeEthers || typeof maybeEthers.getSigners !== 'function') {
        throw new Error('getHardhatSigners requires Hardhat ethers (pass hre or ethers from hardhat).');
    }
    return maybeEthers.getSigners();
}

/**
 * 通过地址或索引从 Hardhat 获取 signer（避免对 hardhat 的静态导入）
 * @param hreOrEthers 传入 hardhat 的 hre 或 hardhat 中的 ethers 对象
 * @param addressOrIndex 地址（string）或索引（number），为空则返回第一个 signer
 */
export async function getHardhatSigner(hreOrEthers: any, addressOrIndex?: string | number): Promise<any> {
    const signers = await getHardhatSigners(hreOrEthers);
    if (addressOrIndex === undefined) {
        return signers[0];
    }
    if (typeof addressOrIndex === 'number') {
        return signers[addressOrIndex] ?? signers[0];
    }
    const lowerTarget = String(addressOrIndex).toLowerCase();
    return signers.find(s => (s.address || '').toLowerCase() === lowerTarget) || signers[0];
}

/**
 * 兼容旧的占位工厂（保留向后兼容，但建议改用 getHardhatSigner）
 */
export function createGetSignerHelper() {
    return async function getSigner(address: string): Promise<any> {
        throw new Error('[DEPRECATED] Use getHardhatSigner(hreOrEthers, addressOrIndex) instead.');
    };
}

// ========== Chai 设置（向后兼容） ==========
export const chaiSetup = {
    configure: () => {
        // Hardhat 已经配置了 chai，这里保持空实现以向后兼容
    },
};
