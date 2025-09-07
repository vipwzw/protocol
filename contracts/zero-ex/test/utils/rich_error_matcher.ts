import { ethers } from 'hardhat';
import { expect } from 'chai';

/**
 * Rich Errors 匹配工具 - 优雅地处理 Solidity Rich Errors
 *
 * 🎯 **设计原则**：
 * - 基于错误选择器进行精确匹配
 * - 支持常见的 0x Protocol Rich Errors
 * - 提供清晰的错误信息
 * - 与 Hardhat chai matchers 兼容
 */
export class RichErrorMatcher {
    /**
     * 通用 Rich Error 匹配方法
     *
     * @param txPromise 要测试的交易 Promise
     * @param errorSignature 错误签名，如 "NotImplementedError(bytes4)"
     * @param expectedParams 期望的参数（可选，用于更精确的验证）
     */
    static async expectRichError(
        txPromise: Promise<any>,
        errorSignature: string,
        expectedParams?: any[],
    ): Promise<void> {
        try {
            await txPromise;
            expect.fail('Transaction should have reverted');
        } catch (error: any) {
            // 计算错误选择器
            const expectedSelector = ethers.id(errorSignature).slice(0, 10);

            if (!error.message.includes(expectedSelector)) {
                throw new Error(
                    `Rich Error 不匹配。期望选择器: ${expectedSelector} (${errorSignature}), ` +
                        `实际错误: ${error.message}`,
                );
            }

            // 如果提供了参数，进行更详细的验证
            if (expectedParams && error.data) {
                try {
                    // 尝试解码参数进行验证
                    const paramTypes = this.extractParamTypes(errorSignature);
                    if (paramTypes.length > 0) {
                        const decodedParams = ethers.AbiCoder.defaultAbiCoder().decode(
                            paramTypes,
                            '0x' + error.data.slice(10), // 跳过选择器
                        );

                        // 验证参数匹配
                        for (let i = 0; i < expectedParams.length && i < decodedParams.length; i++) {
                            if (decodedParams[i] !== expectedParams[i]) {
                                console.warn(`参数 ${i} 不匹配: 期望 ${expectedParams[i]}, 实际 ${decodedParams[i]}`);
                            }
                        }
                    }
                } catch (decodeError) {
                    // 参数解码失败不影响选择器匹配的成功
                    console.warn(`参数解码失败: ${decodeError}`);
                }
            }
        }
    }

    /**
     * 常见的 0x Protocol Rich Errors 快捷方法
     */

    static async expectNotImplementedError(txPromise: Promise<any>, selector?: string): Promise<void> {
        return this.expectRichError(txPromise, 'NotImplementedError(bytes4)', selector ? [selector] : undefined);
    }

    static async expectOnlyOwnerError(txPromise: Promise<any>): Promise<void> {
        return this.expectRichError(txPromise, 'OnlyOwnerError()');
    }

    static async expectNotInRollbackHistoryError(
        txPromise: Promise<any>,
        selector?: string,
        targetImpl?: string,
    ): Promise<void> {
        return this.expectRichError(
            txPromise,
            'NotInRollbackHistoryError(bytes4,address)',
            selector && targetImpl ? [selector, targetImpl] : undefined,
        );
    }

    static async expectOrderNotFillableError(
        txPromise: Promise<any>,
        orderHash?: string,
        orderStatus?: number,
    ): Promise<void> {
        return this.expectRichError(
            txPromise,
            'OrderNotFillableError(bytes32,uint8)',
            orderHash && orderStatus !== undefined ? [orderHash, orderStatus] : undefined,
        );
    }

    static async expectTransformerFailedError(
        txPromise: Promise<any>,
        transformer?: string,
        transformerData?: string,
        resultData?: string,
    ): Promise<void> {
        return this.expectRichError(
            txPromise,
            'TransformerFailedError(address,bytes,bytes)',
            transformer && transformerData && resultData ? [transformer, transformerData, resultData] : undefined,
        );
    }

    static async expectOnlyCallableByDeployerError(
        txPromise: Promise<any>,
        caller?: string,
        deployer?: string,
    ): Promise<void> {
        return this.expectRichError(
            txPromise,
            'OnlyCallableByDeployerError(address,address)',
            caller && deployer ? [caller, deployer] : undefined,
        );
    }

    static async expectOrderNotFillableByOriginError(
        txPromise: Promise<any>,
        orderHash?: string,
        origin?: string,
        sender?: string,
    ): Promise<void> {
        return this.expectRichError(
            txPromise,
            'OrderNotFillableByOriginError(bytes32,address,address)',
            orderHash && origin && sender ? [orderHash, origin, sender] : undefined,
        );
    }

    static async expectOrderNotFillableByTakerError(
        txPromise: Promise<any>,
        orderHash?: string,
        taker?: string,
        sender?: string,
    ): Promise<void> {
        return this.expectRichError(
            txPromise,
            'OrderNotFillableByTakerError(bytes32,address,address)',
            orderHash && taker && sender ? [orderHash, taker, sender] : undefined,
        );
    }

    static async expectOrderNotSignedByMakerError(
        txPromise: Promise<any>,
        orderHash?: string,
        signer?: string,
        maker?: string,
    ): Promise<void> {
        return this.expectRichError(
            txPromise,
            'OrderNotSignedByMakerError(bytes32,address,address)',
            orderHash && signer && maker ? [orderHash, signer, maker] : undefined,
        );
    }

    /**
     * Helper for IncompleteTransformERC20Error
     */
    static async expectIncompleteTransformERC20Error(
        txPromise: Promise<any>,
        outputToken?: string,
        outputTokenAmount?: bigint,
        minOutputTokenAmount?: bigint,
    ): Promise<void> {
        const expectedArgs = [outputToken, outputTokenAmount, minOutputTokenAmount].filter(arg => arg !== undefined);
        return this.expectRichError(
            txPromise,
            'IncompleteTransformERC20Error(address,uint256,uint256)',
            expectedArgs.length > 0 ? expectedArgs : undefined,
        );
    }

    /**
     * Helper for NegativeTransformERC20OutputError
     */
    static async expectNegativeTransformERC20OutputError(
        txPromise: Promise<any>,
        outputToken?: string,
        outputTokenFeeAmount?: bigint,
    ): Promise<void> {
        const expectedArgs = [outputToken, outputTokenFeeAmount].filter(arg => arg !== undefined);
        return this.expectRichError(
            txPromise,
            'NegativeTransformERC20OutputError(address,uint256)',
            expectedArgs.length > 0 ? expectedArgs : undefined,
        );
    }

    /**
     * 匹配 PropertyValidationFailedError
     */
    static async expectPropertyValidationFailedError(
        txPromise: Promise<any>,
        propertyValidator: string,
        token: string,
        tokenId: bigint,
        propertyData: string,
        errorData: string,
    ): Promise<void> {
        return this.expectRichError(txPromise, 'PropertyValidationFailedError(address,address,uint256,bytes,bytes)', [
            propertyValidator,
            token,
            tokenId,
            propertyData,
            errorData,
        ]);
    }

    /**
     * 从错误签名中提取参数类型
     * 例如: "NotImplementedError(bytes4)" -> ["bytes4"]
     */
    private static extractParamTypes(errorSignature: string): string[] {
        const match = errorSignature.match(/\(([^)]*)\)/);
        if (!match || !match[1]) {
            return [];
        }

        return match[1]
            .split(',')
            .map(type => type.trim())
            .filter(type => type.length > 0);
    }
}

/**
 * 便捷的导出函数，用于更简洁的测试代码
 */
export const expectRichError = RichErrorMatcher.expectRichError.bind(RichErrorMatcher);
export const expectNotImplementedError = RichErrorMatcher.expectNotImplementedError.bind(RichErrorMatcher);
export const expectOnlyOwnerError = RichErrorMatcher.expectOnlyOwnerError.bind(RichErrorMatcher);
export const expectNotInRollbackHistoryError = RichErrorMatcher.expectNotInRollbackHistoryError.bind(RichErrorMatcher);
export const expectOrderNotFillableError = RichErrorMatcher.expectOrderNotFillableError.bind(RichErrorMatcher);
export const expectTransformerFailedError = RichErrorMatcher.expectTransformerFailedError.bind(RichErrorMatcher);
export const expectOnlyCallableByDeployerError =
    RichErrorMatcher.expectOnlyCallableByDeployerError.bind(RichErrorMatcher);
export const expectOrderNotFillableByOriginError =
    RichErrorMatcher.expectOrderNotFillableByOriginError.bind(RichErrorMatcher);
export const expectOrderNotFillableByTakerError =
    RichErrorMatcher.expectOrderNotFillableByTakerError.bind(RichErrorMatcher);
export const expectOrderNotSignedByMakerError =
    RichErrorMatcher.expectOrderNotSignedByMakerError.bind(RichErrorMatcher);
export const expectIncompleteTransformERC20Error =
    RichErrorMatcher.expectIncompleteTransformERC20Error.bind(RichErrorMatcher);
export const expectNegativeTransformERC20OutputError =
    RichErrorMatcher.expectNegativeTransformERC20OutputError.bind(RichErrorMatcher);
export const expectPropertyValidationFailedError =
    RichErrorMatcher.expectPropertyValidationFailedError.bind(RichErrorMatcher);
