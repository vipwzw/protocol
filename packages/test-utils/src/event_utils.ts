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

// =============================================================================
// ERC1155 事件类型定义和验证函数
// =============================================================================

export interface ERC1155TransferSingleEventArgs extends EventArgs {
    0: string; // operator
    1: string; // from
    2: string; // to
    3: bigint; // id
    4: bigint; // value
}

export interface ERC1155TransferBatchEventArgs extends EventArgs {
    0: string; // operator
    1: string; // from
    2: string; // to
    3: bigint[]; // ids
    4: bigint[]; // values
}

export interface ERC1155ApprovalForAllEventArgs extends EventArgs {
    0: string; // account
    1: string; // operator
    2: boolean; // approved
}

/**
 * 验证 ERC1155 TransferSingle 事件的所有参数
 * @param receipt 交易回执
 * @param contract 合约实例
 * @param expectedOperator 期望的 operator 地址
 * @param expectedFrom 期望的 from 地址
 * @param expectedTo 期望的 to 地址
 * @param expectedId 期望的 token ID
 * @param expectedValue 期望的 value 数量
 */
export function verifyERC1155TransferSingleEvent(
    receipt: ethers.ContractTransactionReceipt,
    contract: ethers.Contract,
    expectedOperator: string,
    expectedFrom: string,
    expectedTo: string,
    expectedId: bigint,
    expectedValue: bigint
): void {
    const transferEvent = parseEventFromReceipt<ERC1155TransferSingleEventArgs>(receipt, contract, 'TransferSingle');
    
    if (!transferEvent) {
        throw new Error('TransferSingle event not found in transaction receipt');
    }
    
    if (transferEvent.args[0] !== expectedOperator) {
        throw new Error(`Expected operator address ${expectedOperator}, got ${transferEvent.args[0]}`);
    }
    
    if (transferEvent.args[1] !== expectedFrom) {
        throw new Error(`Expected from address ${expectedFrom}, got ${transferEvent.args[1]}`);
    }
    
    if (transferEvent.args[2] !== expectedTo) {
        throw new Error(`Expected to address ${expectedTo}, got ${transferEvent.args[2]}`);
    }
    
    if (transferEvent.args[3] !== expectedId) {
        throw new Error(`Expected token ID ${expectedId}, got ${transferEvent.args[3]}`);
    }
    
    if (transferEvent.args[4] !== expectedValue) {
        throw new Error(`Expected value ${expectedValue}, got ${transferEvent.args[4]}`);
    }
}

/**
 * 验证 ERC1155 TransferBatch 事件的所有参数
 * @param receipt 交易回执
 * @param contract 合约实例
 * @param expectedOperator 期望的 operator 地址
 * @param expectedFrom 期望的 from 地址
 * @param expectedTo 期望的 to 地址
 * @param expectedIds 期望的 token IDs 数组
 * @param expectedValues 期望的 values 数组
 */
export function verifyERC1155TransferBatchEvent(
    receipt: ethers.ContractTransactionReceipt,
    contract: ethers.Contract,
    expectedOperator: string,
    expectedFrom: string,
    expectedTo: string,
    expectedIds: bigint[],
    expectedValues: bigint[]
): void {
    const transferEvent = parseEventFromReceipt<ERC1155TransferBatchEventArgs>(receipt, contract, 'TransferBatch');
    
    if (!transferEvent) {
        throw new Error('TransferBatch event not found in transaction receipt');
    }
    
    if (transferEvent.args[0] !== expectedOperator) {
        throw new Error(`Expected operator address ${expectedOperator}, got ${transferEvent.args[0]}`);
    }
    
    if (transferEvent.args[1] !== expectedFrom) {
        throw new Error(`Expected from address ${expectedFrom}, got ${transferEvent.args[1]}`);
    }
    
    if (transferEvent.args[2] !== expectedTo) {
        throw new Error(`Expected to address ${expectedTo}, got ${transferEvent.args[2]}`);
    }
    
    // 验证 IDs 数组
    const actualIds = transferEvent.args[3];
    if (actualIds.length !== expectedIds.length) {
        throw new Error(`Expected ${expectedIds.length} token IDs, got ${actualIds.length}`);
    }
    for (let i = 0; i < expectedIds.length; i++) {
        if (actualIds[i] !== expectedIds[i]) {
            throw new Error(`Expected token ID[${i}] ${expectedIds[i]}, got ${actualIds[i]}`);
        }
    }
    
    // 验证 Values 数组
    const actualValues = transferEvent.args[4];
    if (actualValues.length !== expectedValues.length) {
        throw new Error(`Expected ${expectedValues.length} values, got ${actualValues.length}`);
    }
    for (let i = 0; i < expectedValues.length; i++) {
        if (actualValues[i] !== expectedValues[i]) {
            throw new Error(`Expected value[${i}] ${expectedValues[i]}, got ${actualValues[i]}`);
        }
    }
}

/**
 * 验证 ERC1155 ApprovalForAll 事件的所有参数
 * @param receipt 交易回执
 * @param contract 合约实例
 * @param expectedAccount 期望的 account 地址
 * @param expectedOperator 期望的 operator 地址
 * @param expectedApproved 期望的 approved 状态
 */
export function verifyERC1155ApprovalForAllEvent(
    receipt: ethers.ContractTransactionReceipt,
    contract: ethers.Contract,
    expectedAccount: string,
    expectedOperator: string,
    expectedApproved: boolean
): void {
    const approvalForAllEvent = parseEventFromReceipt<ERC1155ApprovalForAllEventArgs>(receipt, contract, 'ApprovalForAll');
    
    if (!approvalForAllEvent) {
        throw new Error('ApprovalForAll event not found in transaction receipt');
    }
    
    if (approvalForAllEvent.args[0] !== expectedAccount) {
        throw new Error(`Expected account address ${expectedAccount}, got ${approvalForAllEvent.args[0]}`);
    }
    
    if (approvalForAllEvent.args[1] !== expectedOperator) {
        throw new Error(`Expected operator address ${expectedOperator}, got ${approvalForAllEvent.args[1]}`);
    }
    
    if (approvalForAllEvent.args[2] !== expectedApproved) {
        throw new Error(`Expected approved status ${expectedApproved}, got ${approvalForAllEvent.args[2]}`);
    }
}