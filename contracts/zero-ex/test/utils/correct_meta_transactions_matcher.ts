import { ethers } from 'ethers';
import { ZeroExRevertErrors } from '@0x/utils';

/**
 * 正确的 MetaTransactions 错误匹配器
 * 基于业务逻辑构造错误参数，而不是动态解析
 */
export class CorrectMetaTransactionsMatcher {
    
    /**
     * ✅ 正确的 MetaTransactionExpiredError 匹配
     * 
     * 业务逻辑分析：
     * - mtxHash: 测试中已知
     * - blockTimestamp: 当前区块时间戳，可以通过 provider 获取
     * - expirationTimeSeconds: 测试中设置的过期时间
     */
    static async expectMetaTransactionExpiredError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        expectedExpirationTime: bigint,
        provider: ethers.Provider
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error("交易应该失败但没有失败");
        } catch (error: any) {
            // 获取当前区块时间戳 - 这是业务逻辑可以确定的
            const currentBlock = await provider.getBlock('latest');
            const currentBlockTimestamp = BigInt(currentBlock!.timestamp);
            
            // 基于业务逻辑构造预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
                expectedMtxHash,
                currentBlockTimestamp,  // 基于业务逻辑获取
                expectedExpirationTime
            );
            
            // 直接比较编码结果
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }
        }
    }

    /**
     * ✅ 正确的 MetaTransactionAlreadyExecutedError 匹配
     * 
     * 业务逻辑分析：
     * - mtxHash: 测试中已知
     * - blockNumber: 第一次执行时的区块号，可以从 receipt 获取
     */
    static async expectMetaTransactionAlreadyExecutedError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        firstExecutionReceipt: ethers.TransactionReceipt
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error("交易应该失败但没有失败");
        } catch (error: any) {
            // 基于业务逻辑构造预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionAlreadyExecutedError(
                expectedMtxHash,
                BigInt(firstExecutionReceipt.blockNumber)  // 从第一次执行的 receipt 获取
            );
            
            // 直接比较编码结果
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }
        }
    }

    /**
     * ✅ 正确的 MetaTransactionWrongSenderError 匹配
     * 
     * 业务逻辑分析：
     * - mtxHash: 测试中已知
     * - sender: 实际发送交易的账户（测试中已知）
     * - expectedSender: MetaTransaction 中指定的 sender（测试中已知）
     */
    static async expectMetaTransactionWrongSenderError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        actualSender: string,
        expectedSender: string
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error("交易应该失败但没有失败");
        } catch (error: any) {
            // 基于业务逻辑构造预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionWrongSenderError(
                expectedMtxHash,
                actualSender,    // 测试中已知的实际发送者
                expectedSender   // MetaTransaction 中指定的发送者
            );
            
            // 直接比较编码结果
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }
        }
    }

    /**
     * ✅ 正确的 MetaTransactionUnsupportedFunctionError 匹配
     * 
     * 业务逻辑分析：
     * - mtxHash: 测试中已知
     * - selector: 从 callData 中提取的函数选择器（测试中已知）
     */
    static async expectMetaTransactionUnsupportedFunctionError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        expectedSelector: string
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error("交易应该失败但没有失败");
        } catch (error: any) {
            // 基于业务逻辑构造预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionUnsupportedFunctionError(
                expectedMtxHash,
                expectedSelector  // 从测试的 callData 中已知
            );
            
            // 直接比较编码结果
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }
        }
    }

    /**
     * ✅ 正确的 MetaTransactionInsufficientEthError 匹配
     * 
     * 业务逻辑分析：
     * - mtxHash: 测试中已知
     * - availableEth: 发送的 ETH 数量（测试中已知）
     * - requiredEth: MetaTransaction 需要的 ETH 数量（测试中已知）
     */
    static async expectMetaTransactionInsufficientEthError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        availableEth: bigint,
        requiredEth: bigint
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error("交易应该失败但没有失败");
        } catch (error: any) {
            // 基于业务逻辑构造预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionInsufficientEthError(
                expectedMtxHash,
                availableEth,  // 测试中发送的 ETH 数量
                requiredEth    // MetaTransaction 需要的 ETH 数量
            );
            
            // 直接比较编码结果
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }
        }
    }

    /**
     * ✅ 正确的 MetaTransactionGasPriceError 匹配
     * 
     * 业务逻辑分析：
     * - mtxHash: 测试中已知
     * - gasPrice: 实际使用的 gas price（测试中已知）
     * - minGasPrice: MetaTransaction 的最小 gas price（测试中已知）
     * - maxGasPrice: MetaTransaction 的最大 gas price（测试中已知）
     */
    static async expectMetaTransactionGasPriceError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        actualGasPrice: bigint,
        minGasPrice: bigint,
        maxGasPrice: bigint
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error("交易应该失败但没有失败");
        } catch (error: any) {
            // 基于业务逻辑构造预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionGasPriceError(
                expectedMtxHash,
                actualGasPrice,  // 测试中使用的实际 gas price
                minGasPrice,     // MetaTransaction 的最小 gas price
                maxGasPrice      // MetaTransaction 的最大 gas price
            );
            
            // 直接比较编码结果
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }
        }
    }

    /**
     * ✅ 正确的 SignatureValidationError 匹配
     * 
     * 业务逻辑分析：
     * - code: 错误代码（测试场景决定，如 WRONG_SIGNER = 4）
     * - hash: MetaTransaction hash（测试中已知）
     * - signerAddress: 预期的签名者地址（测试中已知）
     * - signature: 使用的签名数据（测试中已知）
     */
    static async expectSignatureValidationError(
        txPromise: Promise<any>,
        expectedCode: number,
        expectedHash: string,
        expectedSigner: string,
        usedSignature: string
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error("交易应该失败但没有失败");
        } catch (error: any) {
            // 基于业务逻辑构造预期错误
            const expectedError = new ZeroExRevertErrors.SignatureValidator.SignatureValidationError(
                expectedCode,    // 基于测试场景确定（如 WRONG_SIGNER = 4）
                expectedHash,    // MetaTransaction hash
                expectedSigner,  // 预期的签名者
                usedSignature    // 测试中使用的签名
            );
            
            // 直接比较编码结果
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }
        }
    }

    /**
     * ✅ 正确的 MetaTransactionCallFailedError 匹配
     * 
     * 业务逻辑分析：
     * - mtxHash: 测试中已知
     * - callData: MetaTransaction 的 callData（测试中已知）
     * - returnData: 失败调用的返回数据（需要分析具体的失败原因）
     */
    static async expectMetaTransactionCallFailedError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        expectedCallData: string,
        expectedReturnData: string
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error("交易应该失败但没有失败");
        } catch (error: any) {
            // 基于业务逻辑构造预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionCallFailedError(
                expectedMtxHash,
                expectedCallData,    // MetaTransaction 的 callData
                expectedReturnData   // 分析失败原因得到的 returnData
            );
            
            // 直接比较编码结果
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }
        }
    }
}

/**
 * 🎯 关键洞察总结：
 * 
 * 1. **所有参数都可以基于业务逻辑确定**：
 *    - mtxHash: 测试中构造的 MetaTransaction
 *    - 时间戳: 通过 provider.getBlock() 获取
 *    - 区块号: 从交易 receipt 获取
 *    - Gas 相关: 测试中设置的值
 *    - 地址: 测试中使用的账户
 *    - callData: 测试中构造的数据
 * 
 * 2. **没有真正的"动态"参数**：
 *    - 即使是 block.timestamp 和 block.number，也可以通过业务逻辑获取
 *    - 关键是理解什么时候获取这些值
 * 
 * 3. **测试的本质**：
 *    - 我们要测试特定的业务场景
 *    - 我们必须知道预期的错误是什么
 *    - 如果不知道预期错误，就无法编写有意义的测试
 * 
 * 4. **错误的"动态解析"方法**：
 *    - 从错误中提取参数，再用这些参数构造"预期"错误
 *    - 这只是验证编码/解码的一致性，没有验证业务逻辑
 *    - 这种方法让任何错误都能"通过"测试
 */
