import { ethers } from 'hardhat';
import * as _ from 'lodash';

type DecodedLogs = any[];

// 通用事件参数类型定义
export interface TokenTransferArgs {
    token: string;
    from: string;
    to: string;
    amount: bigint;
}

// 实际测试合约的事件类型定义（基于 TestUniswapBridge.sol）
export interface TokenApproveArgs {
    spender: string;
    allowance: bigint;
}

export interface TokenToTokenTransferInputArgs {
    exchange: string;
    tokensSold: bigint;
    minTokensBought: bigint;
    minEthBought: bigint;
    deadline: number;
    recipient: string;
    toTokenAddress: string;
}

export interface TokenToEthSwapInputArgs {
    exchange: string;
    tokensSold: bigint;
    minEthBought: bigint;
    deadline: number;
}

export interface WethDepositArgs {
    amount: bigint;
}

export interface WethWithdrawArgs {
    amount: bigint;
}

export interface EthToTokenTransferInputArgs {
    exchange: string;
    minTokensBought: bigint;
    deadline: number;
    recipient: string;
}

// 合约事件名称常量
export const ContractEvents = {
    TokenTransfer: 'TokenTransfer',
    TokenApprove: 'TokenApprove',
    TokenToTokenTransferInput: 'TokenToTokenTransferInput',
    TokenToEthSwapInput: 'TokenToEthSwapInput',
    WethDeposit: 'WethDeposit',
    WethWithdraw: 'WethWithdraw',
    EthToTokenTransferInput: 'EthToTokenTransferInput',
} as const;

/**
 * 从日志中过滤指定事件类型的日志
 * @param logs 解码后的日志数组
 * @param eventName 事件名称
 * @returns 过滤后的日志数组
 */
export function filterLogs<T>(logs: DecodedLogs, eventName: string): T[] {
    return logs.filter((log: any) => log.event === eventName).map((log: any) => log.args as T);
}

/**
 * 本地实现的事件过滤函数，替代 @0x/test-utils
 * @param logs 解码后的日志数组
 * @param eventName 事件名称
 * @returns 事件参数数组
 */
function universalFilterLogsToArguments<T>(logs: DecodedLogs, eventName: string): T[] {
    return logs
        .filter((log: any) => {
            // 支持多种日志格式
            return (
                log.event === eventName ||
                log.eventName === eventName ||
                (log.fragment && log.fragment.name === eventName) ||
                (log.args && log.name === eventName)
            );
        })
        .map((log: any) => {
            // 提取事件参数
            if (log.args) {
                return log.args as T;
            }
            if (log.arguments) {
                return log.arguments as T;
            }
            // 如果是原始日志格式，返回整个对象
            return log as T;
        });
}

/**
 * 从日志中过滤指定事件并提取参数
 * @param logs 解码后的日志数组
 * @param eventName 事件名称
 * @returns 事件参数数组
 */
export function filterLogsToArguments<T>(logs: DecodedLogs, eventName: string): T[] {
    return universalFilterLogsToArguments<T>(logs, eventName);
}

/**
 * 验证 TokenTransfer 事件
 * @param logs 日志数组
 * @param expected 期望的传输参数
 */
export function verifyTokenTransfer(logs: DecodedLogs, expected: Partial<TokenTransferArgs>): void {
    const transfers = filterLogsToArguments<TokenTransferArgs>(logs, ContractEvents.TokenTransfer);

    if (transfers.length === 0) {
        throw new Error('No TokenTransfer events found');
    }

    const transfer = transfers[0];

    if (expected.token !== undefined && transfer.token !== expected.token) {
        throw new Error(`Expected token ${expected.token}, got ${transfer.token}`);
    }

    if (expected.from !== undefined && transfer.from !== expected.from) {
        throw new Error(`Expected from ${expected.from}, got ${transfer.from}`);
    }

    if (expected.to !== undefined && transfer.to !== expected.to) {
        throw new Error(`Expected to ${expected.to}, got ${transfer.to}`);
    }

    if (expected.amount !== undefined && transfer.amount !== expected.amount) {
        throw new Error(`Expected amount ${expected.amount}, got ${transfer.amount}`);
    }
}

/**
 * 验证 TokenApprove 事件
 * @param logs 日志数组
 * @param expected 期望的授权参数
 */
export function verifyTokenApprove(logs: DecodedLogs, expected: Partial<TokenApproveArgs>): void {
    const approvals = filterLogsToArguments<TokenApproveArgs>(logs, ContractEvents.TokenApprove);

    if (approvals.length === 0) {
        throw new Error('No TokenApprove events found');
    }

    const approval = approvals[0];

    if (expected.spender !== undefined && approval.spender !== expected.spender) {
        throw new Error(`Expected spender ${expected.spender}, got ${approval.spender}`);
    }

    if (expected.allowance !== undefined && approval.allowance !== expected.allowance) {
        throw new Error(`Expected allowance ${expected.allowance}, got ${approval.allowance}`);
    }
}

/**
 * 验证 Uniswap TokenToTokenTransferInput 事件
 * @param logs 日志数组
 * @param expected 期望的交换参数
 */
export function verifyTokenToTokenTransferInput(
    logs: DecodedLogs,
    expected: Partial<TokenToTokenTransferInputArgs>,
): void {
    const calls = filterLogsToArguments<TokenToTokenTransferInputArgs>(logs, ContractEvents.TokenToTokenTransferInput);

    if (calls.length === 0) {
        throw new Error('No TokenToTokenTransferInput events found');
    }

    const call = calls[0];

    if (expected.exchange !== undefined && call.exchange !== expected.exchange) {
        throw new Error(`Expected exchange ${expected.exchange}, got ${call.exchange}`);
    }

    if (expected.tokensSold !== undefined && call.tokensSold !== expected.tokensSold) {
        throw new Error(`Expected tokensSold ${expected.tokensSold}, got ${call.tokensSold}`);
    }

    if (expected.minTokensBought !== undefined && call.minTokensBought !== expected.minTokensBought) {
        throw new Error(`Expected minTokensBought ${expected.minTokensBought}, got ${call.minTokensBought}`);
    }

    if (expected.recipient !== undefined && call.recipient !== expected.recipient) {
        throw new Error(`Expected recipient ${expected.recipient}, got ${call.recipient}`);
    }
}

/**
 * 通用的事件验证函数，支持自定义验证逻辑
 * @param logs 日志数组
 * @param eventName 事件名称
 * @param validator 自定义验证函数
 */
export function verifyEvent<T>(logs: DecodedLogs, eventName: string, validator: (eventArgs: T) => void): void {
    const events = filterLogsToArguments<T>(logs, eventName);

    if (events.length === 0) {
        throw new Error(`No ${eventName} events found`);
    }

    events.forEach(validator);
}

// ==================== 通用日志解析工具 ====================

/**
 * 通用的交易结果类型
 */
export interface ParsedTransactionResult {
    logs: DecodedLogs;
    blockTime: number;
    receipt: any;
}

/**
 * 解析合约交易回执中的日志
 * @param contract 合约实例（需要有 interface 属性）
 * @param receipt 交易回执
 * @returns 解析后的日志数组
 */
export async function parseContractLogs(contract: any, receipt: any): Promise<any[]> {
    const decodedLogs: any[] = [];

    if (receipt && receipt.logs) {
        for (const log of receipt.logs) {
            try {
                // 尝试使用合约接口解析日志
                const parsed = contract.interface.parseLog({
                    topics: log.topics,
                    data: log.data,
                });

                if (parsed) {
                    // 将解析的参数展开到顶层对象，方便访问
                    const eventData = {
                        event: parsed.name,
                        address: log.address,
                        blockNumber: log.blockNumber,
                        transactionHash: log.transactionHash,
                        logIndex: log.index,
                        args: parsed.args,
                        ...parsed.args, // 展开参数，既可以用 args.x 也可以用 x 访问
                    };
                    decodedLogs.push(eventData);
                }
            } catch (e) {
                // 如果解析失败，跳过这个日志（可能是其他合约的日志）
                continue;
            }
        }
    }

    return decodedLogs;
}

/**
 * 获取区块的时间戳
 * @param blockNumber 区块号
 * @returns 区块时间戳（秒）
 */
export async function getBlockTimestamp(blockNumber: number): Promise<number> {
    try {
        const block = await ethers.provider.getBlock(blockNumber);
        return block ? block.timestamp : Math.floor(Date.now() / 1000);
    } catch (e) {
        // 如果获取失败，返回当前时间
        return Math.floor(Date.now() / 1000);
    }
}

/**
 * 解析交易结果 - 完整的交易结果解析
 * @param contract 合约实例
 * @param txPromise 交易 Promise
 * @returns 包含日志、时间戳等信息的解析结果
 */
export async function parseTransactionResult(contract: any, txPromise: Promise<any>): Promise<ParsedTransactionResult> {
    const tx = await txPromise;
    const receipt = await tx.wait();

    // 解析日志
    const logs = await parseContractLogs(contract, receipt);

    // 获取区块时间戳
    const blockTime = await getBlockTimestamp(receipt.blockNumber);

    return {
        logs: logs as any as DecodedLogs,
        blockTime,
        receipt,
    };
}

/**
 * 简化的交易执行和解析
 * @param contract 合约实例
 * @param methodCall 合约方法调用（返回 Promise）
 * @returns 解析后的交易结果
 */
export async function executeAndParse(contract: any, methodCall: () => Promise<any>): Promise<ParsedTransactionResult> {
    return parseTransactionResult(contract, methodCall());
}

/**
 * 批量解析多个交易的日志
 * @param contract 合约实例
 * @param receipts 交易回执数组
 * @returns 合并后的日志数组
 */
export async function parseMultipleTransactionLogs(contract: any, receipts: any[]): Promise<any[]> {
    const allLogs: any[] = [];

    for (const receipt of receipts) {
        const logs = await parseContractLogs(contract, receipt);
        allLogs.push(...logs);
    }

    return allLogs;
}
