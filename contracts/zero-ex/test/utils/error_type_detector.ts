import { ethers } from "ethers";
import { RevertError } from '@0x/utils';

/**
 * 错误类型检测工具
 * 
 * 自动分析合约错误并识别错误类型，帮助选择正确的匹配策略
 */
export class ErrorTypeDetector {
    
    /**
     * 分析错误数据并识别错误类型
     */
    static analyzeError(error: any): ErrorAnalysis {
        if (!error.data) {
            return {
                type: 'string_error',
                message: error.message,
                suggestion: '使用 expectStringError() 或标准 chai 匹配器'
            };
        }

        const selector = error.data.slice(0, 10);
        const errorInfo = this.getErrorInfoBySelector(selector);
        
        if (errorInfo) {
            return {
                type: 'rich_error',
                selector,
                errorName: errorInfo.name,
                errorType: errorInfo.type,
                parameters: this.decodeErrorParameters(error.data, errorInfo.abi),
                suggestion: errorInfo.type === 'dynamic' 
                    ? '使用 UnifiedErrorMatcher.expectMetaTransactionsError() 处理动态参数'
                    : '使用 UnifiedErrorMatcher.expectNativeOrdersError() 或直接比较 .encode()'
            };
        }

        return {
            type: 'unknown_error',
            selector,
            rawData: error.data,
            suggestion: '未知错误类型，需要手动分析'
        };
    }

    /**
     * 根据选择器获取错误信息
     */
    private static getErrorInfoBySelector(selector: string): ErrorInfo | null {
        const errorMap: Record<string, ErrorInfo> = {
            // MetaTransactions Rich Errors - 重新分类基于业务逻辑分析
            '0x47ab394e': {
                name: 'MetaTransactionExpiredError',
                type: 'dynamic', // block.timestamp 真正动态
                abi: ['bytes32', 'uint256', 'uint256'],
                paramNames: ['mtxHash', 'blockTimestamp', 'expirationTimeSeconds']
            },
            '0x618fb3e2': {
                name: 'MetaTransactionAlreadyExecutedError', 
                type: 'dynamic', // block.number 真正动态
                abi: ['bytes32', 'uint256'],
                paramNames: ['mtxHash', 'blockNumber']
            },
            '0x4c7607a3': {
                name: 'SignatureValidationError',
                type: 'business_logic', // 基于业务逻辑可构造，但需要特殊处理
                abi: ['uint8', 'bytes32', 'address', 'bytes'],
                paramNames: ['code', 'hash', 'signerAddress', 'signature']
            },
            '0x5c5c3d37': {
                name: 'MetaTransactionCallFailedError',
                type: 'business_logic', // callData 已知，returnData 可分析
                abi: ['bytes32', 'bytes', 'bytes'],
                paramNames: ['mtxHash', 'callData', 'returnData']
            },
            '0x8c4e5de5': {
                name: 'MetaTransactionWrongSenderError',
                type: 'static', // 所有参数都可预测
                abi: ['bytes32', 'address', 'address'],
                paramNames: ['mtxHash', 'sender', 'expectedSender']
            },
            '0x1c18f846': {
                name: 'MetaTransactionUnsupportedFunctionError',
                type: 'static', // 所有参数都可预测
                abi: ['bytes32', 'bytes4'],
                paramNames: ['mtxHash', 'selector']
            },
            '0x9c4ae9c0': {
                name: 'MetaTransactionInsufficientEthError',
                type: 'static', // 所有参数都可预测
                abi: ['bytes32', 'uint256', 'uint256'],
                paramNames: ['mtxHash', 'ethSent', 'ethRequired']
            },
            '0x7e6b1ba9': {
                name: 'MetaTransactionGasPriceError',
                type: 'static', // 所有参数都可预测
                abi: ['bytes32', 'uint256', 'uint256', 'uint256'],
                paramNames: ['mtxHash', 'gasPrice', 'minGasPrice', 'maxGasPrice']
            },

            // Native Orders Rich Errors - 基于业务逻辑分析
            '0x1d44aa5d': {
                name: 'BatchFillIncompleteError',
                type: 'business_logic', // 填充数量基于业务逻辑可计算
                abi: ['bytes32', 'uint256', 'uint256'],
                paramNames: ['orderHash', 'takerTokenFilledAmount', 'takerTokenFillAmount']
            },
            '0x7e5a2318': {
                name: 'OnlyOrderMakerAllowed',
                type: 'static',
                abi: ['bytes32', 'address', 'address'],
                paramNames: ['orderHash', 'sender', 'maker']
            },
            '0x82e2a6b1': {
                name: 'OrderNotFillableError',
                type: 'static',
                abi: ['bytes32', 'uint8'],
                paramNames: ['orderHash', 'orderStatus']
            },
            '0x70d43d15': {
                name: 'OrderNotFillableByTakerError',
                type: 'static',
                abi: ['bytes32', 'address', 'address'],
                paramNames: ['orderHash', 'taker', 'orderTaker']
            },
            '0x5f4d6c81': {
                name: 'OrderNotFillableBySenderError',
                type: 'static',
                abi: ['bytes32', 'address', 'address'],
                paramNames: ['orderHash', 'sender', 'orderSender']
            },
            '0x2e0c0f91': {
                name: 'OrderNotFillableByOriginError',
                type: 'static',
                abi: ['bytes32', 'address', 'address'],
                paramNames: ['orderHash', 'txOrigin', 'orderTxOrigin']
            },
            '0x4a1b7bdc': {
                name: 'OrderNotSignedByMakerError',
                type: 'static',
                abi: ['bytes32', 'address', 'address'],
                paramNames: ['orderHash', 'signer', 'maker']
            }
        };

        return errorMap[selector] || null;
    }

    /**
     * 解码错误参数
     */
    private static decodeErrorParameters(errorData: string, abi: string[]): any[] {
        try {
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const errorParams = '0x' + errorData.slice(10);
            return abiCoder.decode(abi, errorParams);
        } catch (error) {
            return [];
        }
    }

    /**
     * 生成错误匹配代码建议
     */
    static generateMatchingCode(error: any, testContext?: string): string {
        const analysis = this.analyzeError(error);
        
        switch (analysis.type) {
            case 'rich_error':
                if (analysis.errorType === 'dynamic') {
                    return this.generateDynamicErrorCode(analysis, testContext);
                } else if (analysis.errorType === 'business_logic') {
                    return this.generateBusinessLogicErrorCode(analysis, testContext);
                } else {
                    return this.generateStaticErrorCode(analysis, testContext);
                }
            case 'string_error':
                return this.generateStringErrorCode(analysis, testContext);
            default:
                return `// 未知错误类型，需要手动处理\n// 错误数据: ${analysis.rawData}`;
        }
    }

    /**
     * 生成动态错误匹配代码
     */
    private static generateDynamicErrorCode(analysis: ErrorAnalysis, testContext?: string): string {
        const errorName = analysis.errorName;
        const className = this.getErrorClassName(errorName!);
        
        return `
// 🔧 使用 UnifiedErrorMatcher 处理动态参数错误
await UnifiedErrorMatcher.expectMetaTransactionsError(
    ${testContext || 'txPromise'},
    new ZeroExRevertErrors.${className}(
        // 注意：动态参数将在运行时自动解析和匹配
        ${this.generateParameterPlaceholders(analysis.paramNames!)}
    ),
    {
        skipParameterValidation: false, // 设为 true 可跳过参数验证，只检查错误类型
        allowedBlockNumberDiff: 0       // 对于 AlreadyExecutedError，可设置允许的块号差异
    }
);`;
    }

    /**
     * 生成业务逻辑错误匹配代码
     * 这些错误的参数可以通过分析业务逻辑来构造
     */
    private static generateBusinessLogicErrorCode(analysis: ErrorAnalysis, testContext?: string): string {
        const errorName = analysis.errorName;
        
        switch (errorName) {
            case 'BatchFillIncompleteError':
                return `
// 🔧 业务逻辑分析：BatchFillIncompleteError
// 理解场景：订单已部分填充，尝试填充完整数量时只能填充剩余部分
const remainingAmount = originalOrder.takerAmount - alreadyFilledAmount;
await UnifiedErrorMatcher.expectNativeOrdersError(
    ${testContext || 'txPromise'},
    new RevertErrors.NativeOrders.BatchFillIncompleteError(
        orderHash,
        remainingAmount,        // takerTokenFilledAmount: 实际填充的剩余数量
        originalOrder.takerAmount // takerTokenFillAmount: 请求填充的完整数量
    )
);`;
            
            case 'SignatureValidationError':
                return `
// 🔧 业务逻辑分析：SignatureValidationError  
// 需要分析具体的签名验证失败原因
await UnifiedErrorMatcher.expectMetaTransactionsError(
    ${testContext || 'txPromise'},
    new ZeroExRevertErrors.SignatureValidator.SignatureValidationError(
        4, // WRONG_SIGNER - 根据具体场景调整
        mtxHash,
        expectedSigner,
        '0x' // 签名数据，通常为空或无效签名
    )
);`;
            
            case 'MetaTransactionCallFailedError':
                return `
// 🔧 业务逻辑分析：MetaTransactionCallFailedError
// callData 已知，returnData 需要分析失败原因
await UnifiedErrorMatcher.expectMetaTransactionsError(
    ${testContext || 'txPromise'},
    new ZeroExRevertErrors.MetaTransactions.MetaTransactionCallFailedError(
        mtxHash,
        expectedCallData, // 从测试上下文获取
        expectedReturnData // 分析失败调用的返回数据
    )
);`;
            
            default:
                return `
// 🔧 业务逻辑错误：${errorName}
// 需要分析具体的业务场景来构造参数
// 参数: ${analysis.paramNames?.join(', ')}
await UnifiedErrorMatcher.expectError(
    ${testContext || 'txPromise'},
    // 根据业务逻辑构造具体的错误对象
);`;
        }
    }

    /**
     * 生成静态错误匹配代码
     */
    private static generateStaticErrorCode(analysis: ErrorAnalysis, testContext?: string): string {
        const errorName = analysis.errorName;
        const isNativeOrders = errorName!.includes('Order') || errorName === 'OnlyOrderMakerAllowed';
        
        if (isNativeOrders) {
            return `
// 🔧 使用 RevertErrors 对象进行直接匹配
const expectedError = new RevertErrors.NativeOrders.${errorName}(
    ${this.generateParameterPlaceholders(analysis.paramNames!)}
);

try {
    await ${testContext || 'txPromise'};
    throw new Error("交易应该失败但没有失败");
} catch (error) {
    expect(error.data).to.equal(expectedError.encode());
}`;
        } else {
            return `
// 🔧 使用 UnifiedErrorMatcher 处理静态参数错误
await UnifiedErrorMatcher.expectMetaTransactionsError(
    ${testContext || 'txPromise'},
    new ZeroExRevertErrors.MetaTransactions.${errorName}(
        ${this.generateParameterPlaceholders(analysis.paramNames!)}
    )
);`;
        }
    }

    /**
     * 生成字符串错误匹配代码
     */
    private static generateStringErrorCode(analysis: ErrorAnalysis, testContext?: string): string {
        return `
// 🔧 使用标准 chai 匹配器处理字符串错误
await expect(${testContext || 'txPromise'}).to.be.revertedWith("${analysis.message}");`;
    }

    /**
     * 获取错误类名
     */
    private static getErrorClassName(errorName: string): string {
        if (errorName.startsWith('MetaTransaction')) {
            return `MetaTransactions.${errorName}`;
        } else if (errorName === 'SignatureValidationError') {
            return `SignatureValidator.${errorName}`;
        } else {
            return errorName;
        }
    }

    /**
     * 生成参数占位符
     */
    private static generateParameterPlaceholders(paramNames: string[]): string {
        return paramNames.map(name => {
            switch (name) {
                case 'mtxHash':
                case 'orderHash':
                    return `${name} // bytes32`;
                case 'blockTimestamp':
                case 'expirationTimeSeconds':
                case 'blockNumber':
                    return `${name} // uint256 - 动态值`;
                case 'sender':
                case 'maker':
                case 'taker':
                case 'signerAddress':
                    return `${name} // address`;
                case 'code':
                case 'orderStatus':
                    return `${name} // uint8`;
                case 'signature':
                case 'callData':
                case 'returnData':
                    return `${name} // bytes`;
                case 'selector':
                    return `${name} // bytes4`;
                case 'ethSent':
                case 'ethRequired':
                case 'gasPrice':
                case 'minGasPrice':
                case 'maxGasPrice':
                    return `${name} // uint256`;
                default:
                    return `${name} // 请根据实际类型填写`;
            }
        }).join(',\n        ');
    }

    /**
     * 批量分析测试文件中的错误
     */
    static async analyzeTestFile(filePath: string): Promise<TestFileAnalysis> {
        // 这里可以实现文件分析逻辑
        // 扫描测试文件中的错误处理模式，生成修复建议
        return {
            filePath,
            totalErrors: 0,
            errorsByType: {},
            suggestions: []
        };
    }
}

// 类型定义
interface ErrorInfo {
    name: string;
    type: 'static' | 'dynamic' | 'business_logic';
    abi: string[];
    paramNames: string[];
}

interface ErrorAnalysis {
    type: 'rich_error' | 'string_error' | 'unknown_error';
    selector?: string;
    errorName?: string;
    errorType?: 'static' | 'dynamic';
    parameters?: any[];
    paramNames?: string[];
    message?: string;
    rawData?: string;
    suggestion: string;
}

interface TestFileAnalysis {
    filePath: string;
    totalErrors: number;
    errorsByType: Record<string, number>;
    suggestions: string[];
}

// 导出便捷函数
export const analyzeError = ErrorTypeDetector.analyzeError.bind(ErrorTypeDetector);
export const generateMatchingCode = ErrorTypeDetector.generateMatchingCode.bind(ErrorTypeDetector);
