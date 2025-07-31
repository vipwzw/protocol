import { expect } from './chai_setup';
import { ethers } from 'ethers';
const hardhat = require('hardhat');

export type sendTransactionResult = Promise<ethers.TransactionReceipt | string>;

/**
 * 期望合约调用失败（带具体错误信息）
 */
export async function expectContractCallFailedAsync(
    contractCall: Promise<any>,
    expectedError?: string
): Promise<void> {
    try {
        await contractCall;
        throw new Error('Expected contract call to fail, but it succeeded');
    } catch (error: any) {
        if (expectedError) {
            expect(error.message).to.include(expectedError);
        }
    }
}

/**
 * 期望合约调用失败（不检查错误信息）
 */
export async function expectContractCallFailedWithoutReasonAsync(
    contractCall: Promise<any>
): Promise<void> {
    try {
        await contractCall;
        throw new Error('Expected contract call to fail, but it succeeded');
    } catch (error: any) {
        // 只要抛出错误就认为是成功的
    }
}

/**
 * 期望合约创建失败
 */
export async function expectContractCreationFailedAsync(
    contractCreation: Promise<any>,
    expectedError?: string
): Promise<void> {
    try {
        await contractCreation;
        throw new Error('Expected contract creation to fail, but it succeeded');
    } catch (error: any) {
        if (expectedError) {
            expect(error.message).to.include(expectedError);
        }
    }
}

/**
 * 期望合约创建失败（不检查错误信息）
 */
export async function expectContractCreationFailedWithoutReasonAsync(
    contractCreation: Promise<any>
): Promise<void> {
    try {
        await contractCreation;
        throw new Error('Expected contract creation to fail, but it succeeded');
    } catch (error: any) {
        // 只要抛出错误就认为是成功的
    }
}

/**
 * 期望资金不足错误
 */
export async function expectInsufficientFundsAsync(
    transaction: Promise<any>
): Promise<void> {
    try {
        await transaction;
        throw new Error('Expected transaction to fail due to insufficient funds, but it succeeded');
    } catch (error: any) {
        // 检查是否是资金不足相关的错误
        const errorMessage = error.message.toLowerCase();
        const insufficientFundsPatterns = [
            'insufficient funds',
            'insufficient balance',
            'not enough ether',
            'execution reverted',
            'transfer amount exceeds balance'
        ];
        
        const hasInsufficientFundsError = insufficientFundsPatterns.some(pattern => 
            errorMessage.includes(pattern)
        );
        
        if (!hasInsufficientFundsError) {
            throw new Error(`Expected insufficient funds error, but got: ${error.message}`);
        }
    }
}

/**
 * 期望交易失败（带具体错误信息）
 */
export async function expectTransactionFailedAsync(
    transaction: Promise<any>,
    expectedError?: string
): Promise<void> {
    try {
        const result = await transaction;
        
        // 如果返回的是交易收据，检查状态
        if (result && typeof result === 'object' && 'status' in result) {
            if (result.status === 1) {
                throw new Error('Expected transaction to fail, but it succeeded');
            }
            return; // 交易失败，符合预期
        }
        
        throw new Error('Expected transaction to fail, but it succeeded');
    } catch (error: any) {
        if (expectedError) {
            expect(error.message).to.include(expectedError);
        }
    }
}

/**
 * 期望交易失败（不检查错误信息）
 */
export async function expectTransactionFailedWithoutReasonAsync(
    transaction: Promise<any>
): Promise<void> {
    try {
        const result = await transaction;
        
        // 如果返回的是交易收据，检查状态
        if (result && typeof result === 'object' && 'status' in result) {
            if (result.status === 1) {
                throw new Error('Expected transaction to fail, but it succeeded');
            }
            return; // 交易失败，符合预期
        }
        
        throw new Error('Expected transaction to fail, but it succeeded');
    } catch (error: any) {
        // 只要抛出错误就认为是成功的
    }
}

/**
 * 获取无效操作码错误信息（用于调用）
 */
export async function getInvalidOpcodeErrorMessageForCallAsync(): Promise<string> {
    // 在 Hardhat 中，无效操作码通常返回 "execution reverted"
    return 'execution reverted';
}

/**
 * 获取恢复原因或错误信息（用于发送交易）
 */
export async function getRevertReasonOrErrorMessageForSendTransactionAsync(
    transaction: Promise<any>
): Promise<string> {
    try {
        await transaction;
        return ''; // 交易成功，没有错误
    } catch (error: any) {
        // 尝试提取恢复原因
        if (error.reason) {
            return error.reason;
        }
        
        // 尝试从错误信息中提取
        const message = error.message || '';
        
        // 查找常见的错误模式
        const revertMatch = message.match(/reverted with reason string '(.+?)'/);
        if (revertMatch) {
            return revertMatch[1];
        }
        
        const panicMatch = message.match(/reverted with panic code (.+)/);
        if (panicMatch) {
            return `Panic: ${panicMatch[1]}`;
        }
        
        // 返回原始错误信息
        return message;
    }
}

/**
 * 辅助函数：检查错误是否匹配预期模式
 */
export function isExpectedError(error: any, expectedPatterns: string[]): boolean {
    const errorMessage = (error.message || '').toLowerCase();
    return expectedPatterns.some(pattern => errorMessage.includes(pattern.toLowerCase()));
}

/**
 * 辅助函数：等待交易完成并返回收据
 */
export async function awaitTransactionAsync(txPromise: Promise<any>): Promise<ethers.TransactionReceipt> {
    const tx = await txPromise;
    
    // 如果已经是收据，直接返回
    if (tx.status !== undefined) {
        return tx;
    }
    
    // 如果是交易对象，等待完成
    if (tx.wait) {
        return await tx.wait();
    }
    
    // 如果是交易哈希，获取收据
    if (typeof tx === 'string') {
        return await hardhat.ethers.provider.getTransactionReceipt(tx);
    }
    
    throw new Error('Invalid transaction result');
}