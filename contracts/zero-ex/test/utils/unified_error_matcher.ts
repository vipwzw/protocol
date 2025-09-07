import { ethers } from 'ethers';
import { ZeroExRevertErrors, RevertError } from '@0x/utils';
import { RevertErrors } from '@0x/protocol-utils';

/**
 * 统一的错误匹配工具 - 基于业务逻辑的错误验证
 *
 * 🎯 **核心原则：业务逻辑优先，禁止循环验证**
 *
 * ❌ **错误做法**：
 * - 解析系统返回的错误数据
 * - 用解析出的参数构造期望错误
 * - 进行"循环验证"
 *
 * ✅ **正确做法**：
 * - 基于测试的业务逻辑构造完整的期望错误
 * - 直接比较错误编码
 * - 所有参数都来自测试中已知的业务数据
 *
 * 支持的错误类型：
 * 1. **RevertError 对象** (来自 @0x/utils)
 * 2. **RevertError 对象** (来自 @0x/protocol-utils)
 * 3. **字符串错误消息**
 */
export class UnifiedErrorMatcher {
    /**
     * 通用错误匹配方法 - 基于业务逻辑的完整错误验证
     *
     * ✅ **正确用法**：
     * ```typescript
     * // 基于业务逻辑构造完整错误
     * const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
     *     mtxHash,           // 来自测试中的 MetaTransaction
     *     blockTimestamp,    // 来自 provider.getBlock()
     *     expirationTime     // 来自测试中的 MetaTransaction
     * );
     * await UnifiedErrorMatcher.expectError(tx, expectedError);
     * ```
     */
    static async expectError(txPromise: Promise<any>, expectedError: any): Promise<void> {
        try {
            await txPromise;
            throw new Error('交易应该失败但没有失败');
        } catch (error: any) {
            // 检测错误类型并使用适当的匹配策略
            if (expectedError instanceof RevertError) {
                return this.matchRevertError(error, expectedError);
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
     * 匹配 ZeroExRevertErrors (Rich Errors) - 基于业务逻辑的完整验证
     *
     * ✅ **要求**：调用者必须基于业务逻辑提供完整的期望错误
     * ❌ **禁止**：解析系统返回的错误数据进行循环验证
     */
    private static async matchRevertError(error: any, expectedError: RevertError): Promise<void> {
        if (!error.data) {
            throw new Error(`未找到错误数据，实际错误: ${error.message}`);
        }

        const expectedEncoded = expectedError.encode();

        // 直接进行完整的字节比较
        if (error.data !== expectedEncoded) {
            throw new Error(`错误编码不匹配。期望: ${expectedEncoded}, 实际: ${error.data}`);
        }
    }

    /**
     * 匹配 RevertError 对象 (来自 @0x/protocol-utils) - 基于业务逻辑的完整验证
     *
     * ✅ **要求**：调用者必须基于业务逻辑提供完整的期望错误
     */
    private static async matchRevertErrorObject(error: any, expectedError: any): Promise<void> {
        if (!error.data) {
            throw new Error(`未找到错误数据，实际错误: ${error.message}`);
        }

        const expectedEncoded = expectedError.encode();
        if (error.data !== expectedEncoded) {
            throw new Error(`错误编码不匹配。期望: ${expectedEncoded}, 实际: ${error.data}`);
        }
    }

    /**
     * 匹配字符串错误消息
     */
    private static async matchStringError(error: any, expectedMessage: string): Promise<void> {
        if (!error.message || !error.message.includes(expectedMessage)) {
            throw new Error(`错误消息不匹配。期望包含: "${expectedMessage}", 实际: "${error.message}"`);
        }
    }

    /**
     * 便捷方法：匹配 Native Orders 错误
     *
     * ✅ **正确用法**：
     * ```typescript
     * const expectedError = new RevertErrors.NativeOrders.OrderNotFillableError(
     *     orderHash,    // 来自测试中的订单
     *     orderStatus   // 来自业务逻辑分析
     * );
     * await UnifiedErrorMatcher.expectNativeOrdersError(tx, expectedError);
     * ```
     */
    static async expectNativeOrdersError(txPromise: Promise<any>, expectedError: any): Promise<void> {
        return this.expectError(txPromise, expectedError);
    }
}
