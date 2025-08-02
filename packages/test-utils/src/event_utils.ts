import { ethers } from 'ethers';
import { expect } from './chai_setup';

// 事件参数类型定义
export interface EventArgs {
    [key: string]: any;
}

export interface ParsedEvent {
    event: string;
    args: EventArgs;
    address: string;
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
}

// 标准 ERC20 事件参数
export interface TransferEventArgs {
    from: string;
    to: string;
    value: bigint;
}

export interface ApprovalEventArgs {
    owner: string;
    spender: string;
    value: bigint;
}

// ERC721 事件参数
export interface ERC721TransferEventArgs {
    from: string;
    to: string;
    tokenId: bigint;
}

export interface ERC721ApprovalEventArgs {
    owner: string;
    approved: string;
    tokenId: bigint;
}

export interface ERC721ApprovalForAllEventArgs {
    owner: string;
    operator: string;
    approved: boolean;
}

// ERC1155 事件参数
export interface ERC1155TransferSingleEventArgs {
    operator: string;
    from: string;
    to: string;
    id: bigint;
    value: bigint;
}

export interface ERC1155TransferBatchEventArgs {
    operator: string;
    from: string;
    to: string;
    ids: bigint[];
    values: bigint[];
}

export interface ERC1155ApprovalForAllEventArgs {
    account: string;
    operator: string;
    approved: boolean;
}

/**
 * 从交易收据中解析指定事件
 */
export function parseEventFromReceipt(
    receipt: ethers.TransactionReceipt,
    contract: ethers.Contract,
    eventName: string
): ParsedEvent | null {
    const events = parseAllEventsFromReceipt(receipt, contract, eventName);
    return events.length > 0 ? events[0] : null;
}

/**
 * 从交易收据中解析所有指定类型的事件
 */
export function parseAllEventsFromReceipt(
    receipt: ethers.TransactionReceipt,
    contract: ethers.Contract,
    eventName?: string
): ParsedEvent[] {
    const events: ParsedEvent[] = [];
    
    for (const log of receipt.logs) {
        try {
            const parsedLog = contract.interface.parseLog({
                topics: log.topics,
                data: log.data
            });
            
            if (!parsedLog) continue;
            
            // 如果指定了事件名，只返回匹配的事件
            if (eventName && parsedLog.name !== eventName) continue;
            
            events.push({
                event: parsedLog.name,
                args: parsedLog.args as EventArgs,
                address: log.address,
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                logIndex: log.index
            });
        } catch (error) {
            // 忽略无法解析的日志（可能来自其他合约）
            continue;
        }
    }
    
    return events;
}

/**
 * 验证交易收据中包含指定事件
 */
export function expectEventInReceipt(
    receipt: ethers.TransactionReceipt,
    contract: ethers.Contract,
    eventName: string,
    expectedArgs?: Partial<EventArgs>
): ParsedEvent {
    const event = parseEventFromReceipt(receipt, contract, eventName);
    
    if (!event) {
        throw new Error(`Expected event '${eventName}' not found in transaction receipt`);
    }
    
    if (expectedArgs) {
        for (const [key, expectedValue] of Object.entries(expectedArgs)) {
            // ethers v6 事件参数访问：尝试名称访问，然后通过索引访问
            let actualValue = event.args[key];
            
            // 如果通过名称访问失败，使用索引映射（ethers v6 兼容性）
            if (actualValue === undefined && event.args) {
                // 常见事件参数的索引映射
                const paramIndexMap: { [eventParam: string]: number } = {
                    // Transfer 事件 (ERC20/ERC721)
                    'from': 0,
                    'to': 1,
                    'value': 2,      // ERC20 Transfer
                    'tokenId': 2,    // ERC721 Transfer
                    // Approval 事件
                    'owner': 0,
                    'spender': 1,
                    'approved': 2,
                    // ERC1155 事件
                    'operator': 0,
                    'id': 3,
                    'ids': 3,
                    'values': 4
                };
                
                const index = paramIndexMap[key];
                if (index !== undefined && event.args[index] !== undefined) {
                    actualValue = event.args[index];
                }
            }
            
            expect(actualValue).to.equal(expectedValue, 
                `Event '${eventName}' argument '${key}' mismatch`);
        }
    }
    
    return event;
}

/**
 * 验证 ERC20 Transfer 事件
 */
export function verifyTransferEvent(
    receipt: ethers.TransactionReceipt,
    token: ethers.Contract,
    from: string,
    to: string,
    value: bigint
): void {
    expectEventInReceipt(receipt, token, 'Transfer', {
        from,
        to,
        value
    });
}

/**
 * 验证 ERC20 Approval 事件
 */
export function verifyApprovalEvent(
    receipt: ethers.TransactionReceipt,
    token: ethers.Contract,
    owner: string,
    spender: string,
    value: bigint
): void {
    expectEventInReceipt(receipt, token, 'Approval', {
        owner,
        spender,
        value
    });
}

/**
 * 验证 ERC721 Transfer 事件
 */
export function verifyERC721TransferEvent(
    receipt: ethers.TransactionReceipt,
    nft: ethers.Contract,
    from: string,
    to: string,
    tokenId: bigint
): void {
    expectEventInReceipt(receipt, nft, 'Transfer', {
        from,
        to,
        tokenId
    });
}

/**
 * 验证 ERC721 Approval 事件
 */
export function verifyERC721ApprovalEvent(
    receipt: ethers.TransactionReceipt,
    nft: ethers.Contract,
    owner: string,
    approved: string,
    tokenId: bigint
): void {
    expectEventInReceipt(receipt, nft, 'Approval', {
        owner,
        approved,
        tokenId
    });
}

/**
 * 验证 ERC721 ApprovalForAll 事件
 */
export function verifyERC721ApprovalForAllEvent(
    receipt: ethers.TransactionReceipt,
    nft: ethers.Contract,
    owner: string,
    operator: string,
    approved: boolean
): void {
    expectEventInReceipt(receipt, nft, 'ApprovalForAll', {
        owner,
        operator,
        approved
    });
}

/**
 * 验证 ERC1155 TransferSingle 事件
 */
export function verifyERC1155TransferSingleEvent(
    receipt: ethers.TransactionReceipt,
    contract: ethers.Contract,
    operator: string,
    from: string,
    to: string,
    id: bigint,
    value: bigint
): void {
    expectEventInReceipt(receipt, contract, 'TransferSingle', {
        operator,
        from,
        to,
        id,
        value
    });
}

/**
 * 验证 ERC1155 TransferBatch 事件
 */
export function verifyERC1155TransferBatchEvent(
    receipt: ethers.TransactionReceipt,
    contract: ethers.Contract,
    operator: string,
    from: string,
    to: string,
    ids: bigint[],
    values: bigint[]
): void {
    expectEventInReceipt(receipt, contract, 'TransferBatch', {
        operator,
        from,
        to,
        ids,
        values
    });
}

/**
 * 验证 ERC1155 ApprovalForAll 事件
 */
export function verifyERC1155ApprovalForAllEvent(
    receipt: ethers.TransactionReceipt,
    contract: ethers.Contract,
    account: string,
    operator: string,
    approved: boolean
): void {
    expectEventInReceipt(receipt, contract, 'ApprovalForAll', {
        account,
        operator,
        approved
    });
}

/**
 * 过滤日志 - 基础版本
 */
export function filterLogs(
    logs: ethers.Log[],
    contract: ethers.Contract,
    eventName?: string
): ParsedEvent[] {
    const events: ParsedEvent[] = [];
    
    for (const log of logs) {
        try {
            const parsedLog = contract.interface.parseLog({
                topics: log.topics,
                data: log.data
            });
            
            if (!parsedLog) continue;
            if (eventName && parsedLog.name !== eventName) continue;
            
            events.push({
                event: parsedLog.name,
                args: parsedLog.args as EventArgs,
                address: log.address,
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                logIndex: log.index
            });
        } catch (error) {
            continue;
        }
    }
    
    return events;
}

/**
 * 过滤日志并返回参数数组
 */
export function filterLogsToArguments(
    logs: ethers.Log[],
    contract: ethers.Contract,
    eventName: string
): EventArgs[] {
    const events = filterLogs(logs, contract, eventName);
    return events.map(event => event.args);
}

/**
 * 验证事件列表
 */
export function verifyEvents(
    events: ParsedEvent[],
    expectedEvents: Array<{ event: string; args?: Partial<EventArgs> }>
): void {
    expect(events.length).to.equal(expectedEvents.length, 'Event count mismatch');
    
    for (let i = 0; i < expectedEvents.length; i++) {
        const actual = events[i];
        const expected = expectedEvents[i];
        
        expect(actual.event).to.equal(expected.event, `Event ${i} name mismatch`);
        
        if (expected.args) {
            for (const [key, expectedValue] of Object.entries(expected.args)) {
                expect(actual.args[key]).to.equal(expectedValue, 
                    `Event ${i} argument '${key}' mismatch`);
            }
        }
    }
}

/**
 * 从日志中验证事件
 */
export function verifyEventsFromLogs(
    logs: ethers.Log[],
    contract: ethers.Contract,
    expectedEvents: Array<{ event: string; args?: Partial<EventArgs> }>
): void {
    const events = filterLogs(logs, contract);
    verifyEvents(events, expectedEvents);
}

/**
 * 简单过滤日志，返回指定事件名的所有日志
 */
export function filterLogsSimple(
    logs: ethers.Log[],
    eventName: string
): ethers.Log[] {
    return logs.filter(log => {
        try {
            // 检查主题是否匹配事件签名
            const eventSignature = ethers.id(eventName);
            return log.topics[0] === eventSignature;
        } catch {
            return false;
        }
    });
}

/**
 * 检查日志中是否包含指定事件
 */
export function hasEvent(
    logs: ethers.Log[],
    contract: ethers.Contract,
    eventName: string
): boolean {
    const events = filterLogs(logs, contract, eventName);
    return events.length > 0;
}

/**
 * 获取指定事件的数量
 */
export function getEventCount(
    logs: ethers.Log[],
    contract: ethers.Contract,
    eventName: string
): number {
    const events = filterLogs(logs, contract, eventName);
    return events.length;
}

/**
 * 获取第一个指定事件的参数
 */
export function getFirstEventArgs(
    logs: ethers.Log[],
    contract: ethers.Contract,
    eventName: string
): EventArgs | null {
    const events = filterLogs(logs, contract, eventName);
    return events.length > 0 ? events[0].args : null;
}

/**
 * 验证事件存在
 */
export function expectEvent(
    logs: ethers.Log[],
    contract: ethers.Contract,
    eventName: string,
    expectedArgs?: Partial<EventArgs>
): ParsedEvent {
    const events = filterLogs(logs, contract, eventName);
    
    if (events.length === 0) {
        throw new Error(`Expected event '${eventName}' not found in logs`);
    }
    
    const event = events[0];
    
    if (expectedArgs) {
        for (const [key, expectedValue] of Object.entries(expectedArgs)) {
            let actualValue = event.args[key];
            
            // ethers v6 兼容性处理
            if (actualValue === undefined && event.args) {
                const paramIndexMap: { [eventParam: string]: number } = {
                    'from': 0,
                    'to': 1,
                    'value': 2,
                    'tokenId': 2,
                    'owner': 0,
                    'spender': 1,
                    'approved': 2,
                    'operator': 0,
                    'id': 3,
                    'ids': 3,
                    'values': 4
                };
                
                const index = paramIndexMap[key];
                if (index !== undefined && event.args[index] !== undefined) {
                    actualValue = event.args[index];
                }
            }
            
            expect(actualValue).to.equal(expectedValue, 
                `Event '${eventName}' argument '${key}' mismatch`);
        }
    }
    
    return event;
}

/**
 * 验证事件不存在
 */
export function expectNoEvent(
    logs: ethers.Log[],
    contract: ethers.Contract,
    eventName: string
): void {
    const events = filterLogs(logs, contract, eventName);
    
    if (events.length > 0) {
        throw new Error(`Expected no event '${eventName}' but found ${events.length}`);
    }
}

/**
 * 验证事件数量
 */
export function expectEventCount(
    logs: ethers.Log[],
    contract: ethers.Contract,
    eventName: string,
    expectedCount: number
): void {
    const events = filterLogs(logs, contract, eventName);
    
    if (events.length !== expectedCount) {
        throw new Error(
            `Expected ${expectedCount} '${eventName}' events but found ${events.length}`
        );
    }
}