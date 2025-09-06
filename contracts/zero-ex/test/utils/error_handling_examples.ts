/**
 * 统一错误处理示例
 *
 * 这个文件展示了如何在实际测试中使用统一错误处理工具
 */

import { ethers } from 'hardhat';
import { expect } from 'chai';
import { ZeroExRevertErrors } from '@0x/utils';
import { RevertErrors } from '@0x/protocol-utils';
import { UnifiedErrorMatcher } from './unified_error_matcher';
import { ErrorTypeDetector } from './error_type_detector';

// 模拟的测试环境
interface TestEnvironment {
    feature: any;
    nativeOrdersFeature: any;
    mtx: any;
    order: any;
    signature: string;
}

/**
 * 示例 1: MetaTransactions 错误处理
 */
export class MetaTransactionsErrorExamples {
    /**
     * ✅ 正确处理过期错误（动态参数）
     */
    static async handleExpiredError(env: TestEnvironment) {
        // 旧方法 ❌ - 无法预知 block.timestamp
        /*
        const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
            env.mtx.hash,
            ???, // 无法预知确切的时间戳
            env.mtx.expirationTimeSeconds
        );
        await expect(tx).to.be.revertedWith(expectedError.encode()); // 会失败
        */

        // 新方法 ✅ - 自动处理动态参数
        await UnifiedErrorMatcher.expectMetaTransactionsError(
            env.feature.executeMetaTransaction(env.mtx, env.signature),
            new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
                env.mtx.hash,
                0n, // 占位符，实际值将从错误中解析
                env.mtx.expirationTimeSeconds,
            ),
        );
    }

    /**
     * ✅ 正确处理签名验证错误
     */
    static async handleSignatureError(env: TestEnvironment) {
        await UnifiedErrorMatcher.expectMetaTransactionsError(
            env.feature.executeMetaTransaction(env.mtx, '0xinvalid'),
            new ZeroExRevertErrors.SignatureValidator.SignatureValidationError(
                4, // WRONG_SIGNER
                env.mtx.hash,
                env.mtx.signer,
                '0x', // 签名占位符，实际值将自动解析
            ),
        );
    }

    /**
     * ✅ 正确处理已执行错误（允许块号差异）
     */
    static async handleAlreadyExecutedError(env: TestEnvironment) {
        // 首先执行一次
        await env.feature.executeMetaTransaction(env.mtx, env.signature);

        // 再次执行应该失败
        await UnifiedErrorMatcher.expectMetaTransactionsError(
            env.feature.executeMetaTransaction(env.mtx, env.signature),
            new ZeroExRevertErrors.MetaTransactions.MetaTransactionAlreadyExecutedError(
                env.mtx.hash,
                0n, // 块号占位符
            ),
            {
                allowedBlockNumberDiff: 5, // 允许 5 个块的差异
            },
        );
    }

    /**
     * ✅ 正确处理发送者错误（静态参数）
     */
    static async handleWrongSenderError(env: TestEnvironment) {
        const wrongSender = '0x1234567890123456789012345678901234567890';

        await UnifiedErrorMatcher.expectMetaTransactionsError(
            env.feature.executeMetaTransaction(
                {
                    ...env.mtx,
                    sender: wrongSender,
                },
                env.signature,
            ),
            new ZeroExRevertErrors.MetaTransactions.MetaTransactionWrongSenderError(
                env.mtx.hash,
                env.mtx.sender, // 实际发送者
                wrongSender, // 期望发送者
            ),
        );
    }
}

/**
 * 示例 2: Native Orders 错误处理
 */
export class NativeOrdersErrorExamples {
    /**
     * ✅ 正确处理订单不可填充错误
     */
    static async handleOrderNotFillableError(env: TestEnvironment) {
        // 方法 1: 继续使用现有的成功模式
        const expectedError = new RevertErrors.NativeOrders.OrderNotFillableError(
            env.order.getHash(),
            1, // OrderStatus.Expired
        );

        try {
            await env.nativeOrdersFeature.fillLimitOrder(env.order, env.signature, env.order.takerAmount);
            throw new Error('交易应该失败但没有失败');
        } catch (error) {
            expect(error.data).to.equal(expectedError.encode());
        }

        // 方法 2: 使用统一接口（推荐）
        await UnifiedErrorMatcher.expectNativeOrdersError(
            env.nativeOrdersFeature.fillLimitOrder(env.order, env.signature, env.order.takerAmount),
            expectedError,
        );
    }

    /**
     * ✅ 正确处理只有订单制造者可以取消错误
     */
    static async handleOnlyOrderMakerAllowedError(env: TestEnvironment) {
        const notMaker = '0x1234567890123456789012345678901234567890';

        await UnifiedErrorMatcher.expectNativeOrdersError(
            env.nativeOrdersFeature.connect(notMaker).cancelLimitOrder(env.order),
            new RevertErrors.NativeOrders.OnlyOrderMakerAllowed(env.order.getHash(), notMaker, env.order.maker),
        );
    }

    /**
     * ✅ 正确处理订单签名错误
     */
    static async handleOrderSignatureError(env: TestEnvironment) {
        await UnifiedErrorMatcher.expectNativeOrdersError(
            env.nativeOrdersFeature.fillLimitOrder(env.order, '0xinvalid', env.order.takerAmount),
            new RevertErrors.NativeOrders.OrderNotSignedByMakerError(
                env.order.getHash(),
                '0x0000000000000000000000000000000000000000', // 实际签名者
                env.order.maker,
            ),
        );
    }
}

/**
 * 示例 3: 字符串错误处理
 */
export class StringErrorExamples {
    /**
     * ✅ 正确处理字符串错误
     */
    static async handleStringError(env: TestEnvironment) {
        // 方法 1: 使用标准 chai 匹配器
        await expect(env.nativeOrdersFeature.registerAllowedRfqOrigins([], true)).to.be.revertedWith(
            'NativeOrdersFeature/NO_CONTRACT_ORIGINS',
        );

        // 方法 2: 使用统一接口
        await UnifiedErrorMatcher.expectStringError(
            env.nativeOrdersFeature.registerAllowedRfqOrigins([], true),
            'NativeOrdersFeature/NO_CONTRACT_ORIGINS',
        );
    }
}

/**
 * 示例 4: 错误诊断和调试
 */
export class ErrorDiagnosisExamples {
    /**
     * 🔍 分析未知错误
     */
    static async diagnoseUnknownError(env: TestEnvironment) {
        try {
            await env.feature.someUnknownMethod();
        } catch (error) {
            // 分析错误
            const analysis = ErrorTypeDetector.analyzeError(error);
            console.log('错误分析:', analysis);

            // 生成修复代码
            const fixCode = ErrorTypeDetector.generateMatchingCode(error, 'env.feature.someUnknownMethod()');
            console.log('建议的修复代码:\n', fixCode);

            // 根据分析结果选择处理方式
            switch (analysis.type) {
                case 'rich_error':
                    if (analysis.errorType === 'dynamic') {
                        console.log('这是动态参数错误，使用 UnifiedErrorMatcher.expectMetaTransactionsError()');
                    } else {
                        console.log('这是静态参数错误，可以直接比较 .encode()');
                    }
                    break;
                case 'string_error':
                    console.log('这是字符串错误，使用标准 chai 匹配器');
                    break;
                default:
                    console.log('未知错误类型，需要手动分析');
            }
        }
    }

    /**
     * 🔧 自动生成错误匹配代码
     */
    static generateErrorMatchingCode(errorData: string, errorSelector: string): string {
        // 根据错误选择器生成相应的匹配代码
        const selectorToCode: Record<string, string> = {
            '0x47ab394e': `
// MetaTransactionExpiredError
await UnifiedErrorMatcher.expectMetaTransactionsError(
    txPromise,
    new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
        mtxHash,
        0n, // 动态时间戳
        expirationTimeSeconds
    )
);`,
            '0x4c7607a3': `
// SignatureValidationError  
await UnifiedErrorMatcher.expectMetaTransactionsError(
    txPromise,
    new ZeroExRevertErrors.SignatureValidator.SignatureValidationError(
        errorCode,
        hash,
        signerAddress,
        '0x' // 签名占位符
    )
);`,
            '0x7e5a2318': `
// OnlyOrderMakerAllowed
await UnifiedErrorMatcher.expectNativeOrdersError(
    txPromise,
    new RevertErrors.NativeOrders.OnlyOrderMakerAllowed(
        orderHash,
        sender,
        maker
    )
);`,
        };

        return (
            selectorToCode[errorSelector] ||
            `
// 未知错误选择器: ${errorSelector}
// 错误数据: ${errorData}
// 请手动分析并创建适当的错误匹配代码`
        );
    }
}

/**
 * 示例 5: 批量错误处理迁移
 */
export class MigrationExamples {
    /**
     * 🔄 迁移旧的错误处理代码
     */
    static migrateOldErrorHandling() {
        const examples = [
            {
                title: '通用 revert 检查',
                old: `await expect(tx).to.be.reverted;`,
                new: `await UnifiedErrorMatcher.expectError(tx, expectedError);`,
            },
            {
                title: '错误对象直接传递',
                old: `await expect(tx).to.be.revertedWith(new SomeError(...));`,
                new: `await expect(tx).to.be.revertedWith(new SomeError(...).encode());`,
            },
            {
                title: '动态参数错误',
                old: `
const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
    mtxHash, 
    block.timestamp, // 无法预知
    expirationTime
);
await expect(tx).to.be.revertedWith(expectedError.encode());`,
                new: `
await UnifiedErrorMatcher.expectMetaTransactionsError(
    tx,
    new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
        mtxHash,
        0n, // 占位符
        expirationTime
    )
);`,
            },
        ];

        console.log('错误处理迁移示例:');
        examples.forEach(({ title, old, new: newCode }) => {
            console.log(`\n=== ${title} ===`);
            console.log('❌ 旧代码:');
            console.log(old);
            console.log('✅ 新代码:');
            console.log(newCode);
        });
    }

    /**
     * 📋 生成迁移检查清单
     */
    static generateMigrationChecklist(): string[] {
        return [
            '✅ 移除所有 .to.be.reverted 使用',
            '✅ 移除所有 .to.be.rejected 使用（除非有特殊原因）',
            '✅ 确保所有错误对象调用 .encode()',
            '✅ 对动态参数错误使用 UnifiedErrorMatcher',
            '✅ 对静态参数错误使用直接比较或 UnifiedErrorMatcher',
            '✅ 对字符串错误使用标准 chai 匹配器',
            '✅ 添加适当的错误消息和注释',
            '✅ 运行测试确保所有错误匹配正确',
            '✅ 更新相关文档和注释',
        ];
    }
}

// 导出所有示例类
export {
    MetaTransactionsErrorExamples,
    NativeOrdersErrorExamples,
    StringErrorExamples,
    ErrorDiagnosisExamples,
    MigrationExamples,
};
