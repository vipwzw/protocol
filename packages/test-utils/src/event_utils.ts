import { ethers } from 'ethers';

// 通用事件解析函数
export interface EventArgs {
    [key: string]: any;
}

export interface ParsedEvent<T extends EventArgs> {
    args: T;
    eventName: string;
    blockNumber?: number;
    transactionHash?: string;
}

/**
 * 从交易回执中解析指定的事件
 * @param receipt 交易回执
 * @param contract 合约实例
 * @param eventName 事件名称
 * @returns 解析后的事件，如果未找到则返回 null
 */
export function parseEventFromReceipt<T extends EventArgs>(
    receipt: ethers.ContractTransactionReceipt,
    contract: ethers.Contract,
    eventName: string
): ParsedEvent<T> | null {
    if (!receipt.logs) return null;
    
    for (const log of receipt.logs) {
        try {
            const parsedLog = contract.interface.parseLog(log);
            if (parsedLog && parsedLog.name === eventName) {
                return {
                    args: parsedLog.args as unknown as T,
                    eventName: parsedLog.name,
                    blockNumber: receipt.blockNumber,
                    transactionHash: receipt.hash
                };
            }
        } catch (e) {
            // 如果解析失败，可能是其他合约的日志，继续处理下一个
            continue;
        }
    }
    return null;
}

/**
 * 从交易回执中解析所有指定名称的事件
 * @param receipt 交易回执
 * @param contract 合约实例
 * @param eventName 事件名称
 * @returns 解析后的事件数组
 */
export function parseAllEventsFromReceipt<T extends EventArgs>(
    receipt: ethers.ContractTransactionReceipt,
    contract: ethers.Contract,
    eventName: string
): Array<ParsedEvent<T>> {
    const events: Array<ParsedEvent<T>> = [];
    
    if (!receipt.logs) return events;
    
    for (const log of receipt.logs) {
        try {
            const parsedLog = contract.interface.parseLog(log);
            if (parsedLog && parsedLog.name === eventName) {
                events.push({
                    args: parsedLog.args as unknown as T,
                    eventName: parsedLog.name,
                    blockNumber: receipt.blockNumber,
                    transactionHash: receipt.hash
                });
            }
        } catch (e) {
            // 如果解析失败，可能是其他合约的日志，继续处理下一个
            continue;
        }
    }
    
    return events;
}

/**
 * 验证交易回执中是否包含指定的事件
 * @param receipt 交易回执
 * @param contract 合约实例
 * @param eventName 事件名称
 * @param expectedCount 期望的事件数量（可选，默认至少1个）
 */
export function expectEventInReceipt(
    receipt: ethers.ContractTransactionReceipt,
    contract: ethers.Contract,
    eventName: string,
    expectedCount: number = 1
): void {
    const events = parseAllEventsFromReceipt(receipt, contract, eventName);
    
    if (expectedCount === 0) {
        if (events.length !== 0) {
            throw new Error(`Expected 0 ${eventName} events, but found ${events.length}`);
        }
    } else {
        if (events.length < expectedCount) {
            throw new Error(`Expected at least ${expectedCount} ${eventName} event(s), but found ${events.length}`);
        }
    }
}

// =============================================================================
// ERC20 事件类型定义和验证函数
// =============================================================================

export interface TransferEventArgs extends EventArgs {
    0: string; // from
    1: string; // to
    2: bigint; // value
}

export interface ApprovalEventArgs extends EventArgs {
    0: string; // owner
    1: string; // spender
    2: bigint; // value
}

/**
 * 验证 ERC20 Transfer 事件的所有参数
 * @param receipt 交易回执
 * @param contract 合约实例
 * @param expectedFrom 期望的 from 地址
 * @param expectedTo 期望的 to 地址
 * @param expectedValue 期望的 value 数量
 */
export function verifyTransferEvent(
    receipt: ethers.ContractTransactionReceipt,
    contract: ethers.Contract,
    expectedFrom: string,
    expectedTo: string,
    expectedValue: bigint
): void {
    const transferEvent = parseEventFromReceipt<TransferEventArgs>(receipt, contract, 'Transfer');
    
    if (!transferEvent) {
        throw new Error('Transfer event not found in transaction receipt');
    }
    
    if (transferEvent.args[0] !== expectedFrom) {
        throw new Error(`Expected from address ${expectedFrom}, got ${transferEvent.args[0]}`);
    }
    
    if (transferEvent.args[1] !== expectedTo) {
        throw new Error(`Expected to address ${expectedTo}, got ${transferEvent.args[1]}`);
    }
    
    if (transferEvent.args[2] !== expectedValue) {
        throw new Error(`Expected value ${expectedValue}, got ${transferEvent.args[2]}`);
    }
}

/**
 * 验证 ERC20 Approval 事件的所有参数
 * @param receipt 交易回执
 * @param contract 合约实例
 * @param expectedOwner 期望的 owner 地址
 * @param expectedSpender 期望的 spender 地址
 * @param expectedValue 期望的 value 数量
 */
export function verifyApprovalEvent(
    receipt: ethers.ContractTransactionReceipt,
    contract: ethers.Contract,
    expectedOwner: string,
    expectedSpender: string,
    expectedValue: bigint
): void {
    const approvalEvent = parseEventFromReceipt<ApprovalEventArgs>(receipt, contract, 'Approval');
    
    if (!approvalEvent) {
        throw new Error('Approval event not found in transaction receipt');
    }
    
    if (approvalEvent.args[0] !== expectedOwner) {
        throw new Error(`Expected owner address ${expectedOwner}, got ${approvalEvent.args[0]}`);
    }
    
    if (approvalEvent.args[1] !== expectedSpender) {
        throw new Error(`Expected spender address ${expectedSpender}, got ${approvalEvent.args[1]}`);
    }
    
    if (approvalEvent.args[2] !== expectedValue) {
        throw new Error(`Expected value ${expectedValue}, got ${approvalEvent.args[2]}`);
    }
}

// =============================================================================
// ERC721 事件类型定义和验证函数
// =============================================================================

export interface ERC721TransferEventArgs extends EventArgs {
    0: string; // from
    1: string; // to
    2: bigint; // tokenId
}

export interface ERC721ApprovalEventArgs extends EventArgs {
    0: string; // owner
    1: string; // approved
    2: bigint; // tokenId
}

export interface ERC721ApprovalForAllEventArgs extends EventArgs {
    0: string; // owner
    1: string; // operator
    2: boolean; // approved
}

/**
 * 验证 ERC721 Transfer 事件的所有参数
 * @param receipt 交易回执
 * @param contract 合约实例
 * @param expectedFrom 期望的 from 地址
 * @param expectedTo 期望的 to 地址
 * @param expectedTokenId 期望的 tokenId
 */
export function verifyERC721TransferEvent(
    receipt: ethers.ContractTransactionReceipt,
    contract: ethers.Contract,
    expectedFrom: string,
    expectedTo: string,
    expectedTokenId: bigint
): void {
    const transferEvent = parseEventFromReceipt<ERC721TransferEventArgs>(receipt, contract, 'Transfer');
    
    if (!transferEvent) {
        throw new Error('Transfer event not found in transaction receipt');
    }
    
    // 支持两种访问方式：索引访问和名称访问
    const from = transferEvent.args[0] || (transferEvent.args as any)._from;
    const to = transferEvent.args[1] || (transferEvent.args as any)._to;
    const tokenId = transferEvent.args[2] || (transferEvent.args as any)._tokenId;
    
    if (from !== expectedFrom) {
        throw new Error(`Expected from address ${expectedFrom}, got ${from}`);
    }
    
    if (to !== expectedTo) {
        throw new Error(`Expected to address ${expectedTo}, got ${to}`);
    }
    
    if (tokenId !== expectedTokenId) {
        throw new Error(`Expected tokenId ${expectedTokenId}, got ${tokenId}`);
    }
}

/**
 * 验证 ERC721 Approval 事件的所有参数
 * @param receipt 交易回执
 * @param contract 合约实例
 * @param expectedOwner 期望的 owner 地址
 * @param expectedApproved 期望的 approved 地址
 * @param expectedTokenId 期望的 tokenId
 */
export function verifyERC721ApprovalEvent(
    receipt: ethers.ContractTransactionReceipt,
    contract: ethers.Contract,
    expectedOwner: string,
    expectedApproved: string,
    expectedTokenId: bigint
): void {
    const approvalEvent = parseEventFromReceipt<ERC721ApprovalEventArgs>(receipt, contract, 'Approval');
    
    if (!approvalEvent) {
        throw new Error('Approval event not found in transaction receipt');
    }
    
    if (approvalEvent.args[0] !== expectedOwner) {
        throw new Error(`Expected owner address ${expectedOwner}, got ${approvalEvent.args[0]}`);
    }
    
    if (approvalEvent.args[1] !== expectedApproved) {
        throw new Error(`Expected approved address ${expectedApproved}, got ${approvalEvent.args[1]}`);
    }
    
    if (approvalEvent.args[2] !== expectedTokenId) {
        throw new Error(`Expected tokenId ${expectedTokenId}, got ${approvalEvent.args[2]}`);
    }
}

/**
 * 验证 ERC721 ApprovalForAll 事件的所有参数
 * @param receipt 交易回执
 * @param contract 合约实例
 * @param expectedOwner 期望的 owner 地址
 * @param expectedOperator 期望的 operator 地址
 * @param expectedApproved 期望的 approved 状态
 */
export function verifyERC721ApprovalForAllEvent(
    receipt: ethers.ContractTransactionReceipt,
    contract: ethers.Contract,
    expectedOwner: string,
    expectedOperator: string,
    expectedApproved: boolean
): void {
    const approvalForAllEvent = parseEventFromReceipt<ERC721ApprovalForAllEventArgs>(receipt, contract, 'ApprovalForAll');
    
    if (!approvalForAllEvent) {
        throw new Error('ApprovalForAll event not found in transaction receipt');
    }
    
    if (approvalForAllEvent.args[0] !== expectedOwner) {
        throw new Error(`Expected owner address ${expectedOwner}, got ${approvalForAllEvent.args[0]}`);
    }
    
    if (approvalForAllEvent.args[1] !== expectedOperator) {
        throw new Error(`Expected operator address ${expectedOperator}, got ${approvalForAllEvent.args[1]}`);
    }
    
    if (approvalForAllEvent.args[2] !== expectedApproved) {
        throw new Error(`Expected approved status ${expectedApproved}, got ${approvalForAllEvent.args[2]}`);
    }
}