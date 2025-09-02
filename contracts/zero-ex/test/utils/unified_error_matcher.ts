import { ethers } from "ethers";
import { ZeroExRevertErrors, RevertError } from '@0x/utils';
import { RevertErrors } from '@0x/protocol-utils';

/**
 * 统一的错误匹配工具
 * 
 * 这个工具解决了 0x Protocol 中两种不同错误处理机制的匹配问题：
 * 
 * 1. **Rich Errors (LibRichErrors.rrevert)**:
 *    - 使用 ABI 编码的错误数据
 *    - 通过 LibRichErrors.rrevert() 抛出
 *    - Hardhat chai-matchers 无法直接识别
 *    - 需要自定义匹配逻辑
 * 
 * 2. **RevertError 对象**:
 *    - 来自 @0x/protocol-utils 包
 *    - 有 .encode() 方法
 *    - 可以直接与 error.data 比较
 * 
 * 3. **传统 require() 错误**:
 *    - 使用字符串错误消息
 *    - Hardhat chai-matchers 可以直接处理
 */
export class UnifiedErrorMatcher {
    
    /**
     * 通用错误匹配方法
     * 自动检测错误类型并使用适当的匹配策略
     */
    static async expectError(
        txPromise: Promise<any>,
        expectedError: any,
        options: {
            skipParameterValidation?: boolean;
            allowedBlockNumberDiff?: number;
        } = {}
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error("交易应该失败但没有失败");
        } catch (error: any) {
            // 检测错误类型并使用适当的匹配策略
            if (expectedError instanceof RevertError) {
                return this.matchZeroExRevertError(error, expectedError, options);
            } else if (expectedError.encode && typeof expectedError.encode === 'function') {
                return this.matchRevertErrorObject(error, expectedError);
            } else if (typeof expectedError === 'string') {
                return this.matchStringError(error, expectedError);
            } else {
                throw new Error(`不支持的错误类型: ${typeof expectedError}`);
            }
        }
    }

    /**
     * 匹配 ZeroExRevertErrors (Rich Errors)
     * 用于 MetaTransactions 等使用 LibRichErrors.rrevert() 的场景
     */
    private static async matchZeroExRevertError(
        error: any,
        expectedError: RevertError,
        options: {
            skipParameterValidation?: boolean;
            allowedBlockNumberDiff?: number;
        }
    ): Promise<void> {
        if (!error.data) {
            throw new Error(`未找到错误数据，实际错误: ${error.message}`);
        }

        const expectedEncoded = expectedError.encode();
        const expectedSelector = expectedEncoded.slice(0, 10);
        
        if (!error.data.startsWith(expectedSelector)) {
            throw new Error(`错误选择器不匹配。期望: ${expectedSelector}, 实际: ${error.data.slice(0, 10)}`);
        }

        if (options.skipParameterValidation) {
            return; // 只检查选择器，跳过参数验证
        }

        // 对于包含动态参数的错误，需要特殊处理
        if (this.isDynamicParameterError(expectedError)) {
            return this.matchDynamicParameterError(error, expectedError, options);
        }

        // 完整匹配
        if (error.data !== expectedEncoded) {
            throw new Error(`错误编码不完全匹配。期望: ${expectedEncoded}, 实际: ${error.data}`);
        }
    }

    /**
     * 匹配 RevertError 对象 (来自 @0x/protocol-utils)
     * 用于 Native Orders 等场景
     */
    private static async matchRevertErrorObject(
        error: any,
        expectedError: any
    ): Promise<void> {
        if (!error.data) {
            throw new Error(`未找到错误数据，实际错误: ${error.message}`);
        }

        const expectedEncoded = expectedError.encode();
        if (error.data !== expectedEncoded) {
            throw new Error(`错误编码不匹配。期望: ${expectedEncoded}, 实际: ${error.data}`);
        }
    }

    /**
     * 匹配字符串错误 (传统 require() 错误)
     */
    private static async matchStringError(
        error: any,
        expectedMessage: string
    ): Promise<void> {
        if (!error.message.includes(expectedMessage)) {
            throw new Error(`错误消息不匹配。期望包含: ${expectedMessage}, 实际: ${error.message}`);
        }
    }

    /**
     * 检查是否是包含真正动态参数的错误
     * 
     * 重要原则：只有真正无法从业务逻辑预测的参数才是动态的
     * - block.timestamp, block.number 等区块链状态
     * - 不是业务逻辑计算结果（如 BatchFillIncompleteError 的填充数量）
     */
    private static isDynamicParameterError(error: RevertError): boolean {
        const errorName = error.constructor.name;
        const trueDynamicErrorTypes = [
            'MetaTransactionExpiredError',        // block.timestamp 是真正动态的
            'MetaTransactionAlreadyExecutedError' // block.number 是真正动态的
        ];
        return trueDynamicErrorTypes.includes(errorName);
    }

    /**
     * 处理包含动态参数的错误匹配
     */
    private static async matchDynamicParameterError(
        error: any,
        expectedError: RevertError,
        options: {
            allowedBlockNumberDiff?: number;
        }
    ): Promise<void> {
        const errorName = expectedError.constructor.name;
        
        switch (errorName) {
            case 'MetaTransactionExpiredError':
                return this.matchMetaTransactionExpiredError(error, expectedError as any);
            case 'MetaTransactionAlreadyExecutedError':
                return this.matchMetaTransactionAlreadyExecutedError(error, expectedError as any, options);
            case 'MetaTransactionCallFailedError':
                return this.matchMetaTransactionCallFailedError(error, expectedError as any);
            case 'SignatureValidationError':
                return this.matchSignatureValidationError(error, expectedError as any);
            default:
                throw new Error(`不支持的动态参数错误类型: ${errorName}`);
        }
    }

    /**
     * 匹配 MetaTransactionExpiredError
     * 动态解析 block.timestamp
     */
    private static async matchMetaTransactionExpiredError(
        error: any,
        expectedError: ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError
    ): Promise<void> {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const errorParams = '0x' + error.data.slice(10);
        const decoded = abiCoder.decode(['bytes32', 'uint256', 'uint256'], errorParams);
        
        const actualMtxHash = decoded[0];
        const actualBlockTimestamp = decoded[1];
        const actualExpirationTime = decoded[2];
        
        // 使用实际参数重构预期错误
        const reconstructedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
            actualMtxHash,
            actualBlockTimestamp,
            actualExpirationTime
        );
        
        if (error.data !== reconstructedError.encode()) {
            throw new Error(`MetaTransactionExpiredError 编码不匹配`);
        }
    }

    /**
     * 匹配 MetaTransactionAlreadyExecutedError
     * 支持灵活的 blockNumber 验证
     */
    private static async matchMetaTransactionAlreadyExecutedError(
        error: any,
        expectedError: ZeroExRevertErrors.MetaTransactions.MetaTransactionAlreadyExecutedError,
        options: { allowedBlockNumberDiff?: number } = {}
    ): Promise<void> {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const errorParams = '0x' + error.data.slice(10);
        const decoded = abiCoder.decode(['bytes32', 'uint256'], errorParams);
        
        const actualMtxHash = decoded[0];
        const actualBlockNumber = decoded[1];
        
        // 如果允许块号差异，则跳过块号验证
        if (options.allowedBlockNumberDiff !== undefined) {
            const reconstructedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionAlreadyExecutedError(
                actualMtxHash,
                actualBlockNumber
            );
            
            if (error.data !== reconstructedError.encode()) {
                throw new Error(`MetaTransactionAlreadyExecutedError 编码不匹配`);
            }
            return;
        }
        
        // 完整匹配（包括块号）
        const reconstructedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionAlreadyExecutedError(
            actualMtxHash,
            actualBlockNumber
        );
        
        if (error.data !== reconstructedError.encode()) {
            throw new Error(`MetaTransactionAlreadyExecutedError 编码不匹配`);
        }
    }

    /**
     * 匹配 MetaTransactionCallFailedError
     * 处理复杂的 callData 和 returnData
     */
    private static async matchMetaTransactionCallFailedError(
        error: any,
        expectedError: ZeroExRevertErrors.MetaTransactions.MetaTransactionCallFailedError
    ): Promise<void> {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const errorParams = '0x' + error.data.slice(10);
        const decoded = abiCoder.decode(['bytes32', 'bytes', 'bytes'], errorParams);
        
        const actualMtxHash = decoded[0];
        const actualCallData = decoded[1];
        const actualReturnData = decoded[2];
        
        const reconstructedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionCallFailedError(
            actualMtxHash,
            actualCallData,
            actualReturnData
        );
        
        if (error.data !== reconstructedError.encode()) {
            throw new Error(`MetaTransactionCallFailedError 编码不匹配`);
        }
    }

    /**
     * 匹配 SignatureValidationError
     * 处理签名验证错误
     */
    private static async matchSignatureValidationError(
        error: any,
        expectedError: ZeroExRevertErrors.SignatureValidator.SignatureValidationError
    ): Promise<void> {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const errorParams = '0x' + error.data.slice(10);
        const decoded = abiCoder.decode(['uint8', 'bytes32', 'address', 'bytes'], errorParams);
        
        const actualCode = decoded[0];
        const actualHash = decoded[1];
        const actualSignerAddress = decoded[2];
        const actualSignature = decoded[3];
        
        const reconstructedError = new ZeroExRevertErrors.SignatureValidator.SignatureValidationError(
            actualCode,
            actualHash,
            actualSignerAddress,
            actualSignature
        );
        
        if (error.data !== reconstructedError.encode()) {
            throw new Error(`SignatureValidationError 编码不匹配`);
        }
    }

    // === 便捷方法 ===

    /**
     * 期望 Native Orders 错误 (RevertError 对象)
     */
    static async expectNativeOrdersError(
        txPromise: Promise<any>,
        expectedError: any
    ): Promise<void> {
        return this.expectError(txPromise, expectedError);
    }

    /**
     * 期望 MetaTransactions 错误 (Rich Error)
     */
    static async expectMetaTransactionsError(
        txPromise: Promise<any>,
        expectedError: RevertError,
        options?: {
            skipParameterValidation?: boolean;
            allowedBlockNumberDiff?: number;
        }
    ): Promise<void> {
        return this.expectError(txPromise, expectedError, options);
    }

    /**
     * 期望字符串错误消息
     */
    static async expectStringError(
        txPromise: Promise<any>,
        expectedMessage: string
    ): Promise<void> {
        return this.expectError(txPromise, expectedMessage);
    }
}

// 导出便捷别名
export const expectError = UnifiedErrorMatcher.expectError.bind(UnifiedErrorMatcher);
export const expectNativeOrdersError = UnifiedErrorMatcher.expectNativeOrdersError.bind(UnifiedErrorMatcher);
export const expectMetaTransactionsError = UnifiedErrorMatcher.expectMetaTransactionsError.bind(UnifiedErrorMatcher);
export const expectStringError = UnifiedErrorMatcher.expectStringError.bind(UnifiedErrorMatcher);
