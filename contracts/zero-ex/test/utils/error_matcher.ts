import { ethers } from 'ethers';
import { ZeroExRevertErrors } from '@0x/utils';

/**
 * 通用的 0x Protocol 错误匹配器
 * 用于匹配通过 .rrevert() 抛出的编码错误
 */
export class ErrorMatcher {
    /**
     * 匹配 MetaTransactionExpiredError
     */
    static async expectMetaTransactionExpiredError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        expectedExpirationTime: bigint,
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error('交易应该失败但没有失败');
        } catch (error: any) {
            const selector = '0xbea726ef'; // MetaTransactionExpiredError 选择器

            if (!error.data || !error.data.startsWith(selector)) {
                throw new Error(`未找到预期的 MetaTransactionExpiredError，实际错误: ${error.data}`);
            }

            // 解析实际错误数据
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const errorParams = '0x' + error.data.slice(10);
            const decoded = abiCoder.decode(['bytes32', 'uint256', 'uint256'], errorParams);

            const actualMtxHash = decoded[0];
            const actualBlockTimestamp = decoded[1];
            const actualExpirationTime = decoded[2];

            // 构造完全匹配的预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
                actualMtxHash,
                actualBlockTimestamp,
                actualExpirationTime,
            );

            // 验证完整匹配
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不完全匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }

            // 验证关键参数
            if (actualMtxHash !== expectedMtxHash) {
                throw new Error(`mtxHash 不匹配。期望: ${expectedMtxHash}, 实际: ${actualMtxHash}`);
            }
            if (actualExpirationTime !== expectedExpirationTime) {
                throw new Error(
                    `expirationTime 不匹配。期望: ${expectedExpirationTime}, 实际: ${actualExpirationTime}`,
                );
            }
        }
    }

    /**
     * 匹配 MetaTransactionWrongSenderError
     */
    static async expectMetaTransactionWrongSenderError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        expectedActualSender: string,
        expectedRequiredSender: string,
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error('交易应该失败但没有失败');
        } catch (error: any) {
            const selector = '0xa78002a1'; // MetaTransactionWrongSenderError 选择器

            if (!error.data || !error.data.startsWith(selector)) {
                throw new Error(`未找到预期的 MetaTransactionWrongSenderError，实际错误: ${error.data}`);
            }

            // 解析实际错误数据
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const errorParams = '0x' + error.data.slice(10);
            const decoded = abiCoder.decode(['bytes32', 'address', 'address'], errorParams);

            const actualMtxHash = decoded[0];
            const actualSender = decoded[1];
            const actualRequiredSender = decoded[2];

            // 构造完全匹配的预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionWrongSenderError(
                actualMtxHash,
                actualSender,
                actualRequiredSender,
            );

            // 验证完整匹配
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不完全匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }

            // 验证关键参数
            if (actualMtxHash !== expectedMtxHash) {
                throw new Error(`mtxHash 不匹配。期望: ${expectedMtxHash}, 实际: ${actualMtxHash}`);
            }
            if (actualSender.toLowerCase() !== expectedActualSender.toLowerCase()) {
                throw new Error(`actualSender 不匹配。期望: ${expectedActualSender}, 实际: ${actualSender}`);
            }
            if (actualRequiredSender.toLowerCase() !== expectedRequiredSender.toLowerCase()) {
                throw new Error(
                    `requiredSender 不匹配。期望: ${expectedRequiredSender}, 实际: ${actualRequiredSender}`,
                );
            }
        }
    }

    /**
     * 匹配 MetaTransactionUnsupportedFunctionError
     */
    static async expectMetaTransactionUnsupportedFunctionError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        expectedSelector: string,
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error('交易应该失败但没有失败');
        } catch (error: any) {
            const selector = '0x547a32a3'; // MetaTransactionUnsupportedFunctionError 选择器

            if (!error.data || !error.data.startsWith(selector)) {
                throw new Error(`未找到预期的 MetaTransactionUnsupportedFunctionError，实际错误: ${error.data}`);
            }

            // 解析实际错误数据
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const errorParams = '0x' + error.data.slice(10);
            const decoded = abiCoder.decode(['bytes32', 'bytes4'], errorParams);

            const actualMtxHash = decoded[0];
            const actualSelector = decoded[1];

            // 构造完全匹配的预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionUnsupportedFunctionError(
                actualMtxHash,
                actualSelector,
            );

            // 验证完整匹配
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不完全匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }

            // 验证关键参数
            if (actualMtxHash !== expectedMtxHash) {
                throw new Error(`mtxHash 不匹配。期望: ${expectedMtxHash}, 实际: ${actualMtxHash}`);
            }
            if (actualSelector !== expectedSelector) {
                throw new Error(`selector 不匹配。期望: ${expectedSelector}, 实际: ${actualSelector}`);
            }
        }
    }

    /**
     * 匹配 MetaTransactionAlreadyExecutedError
     */
    static async expectMetaTransactionAlreadyExecutedError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        expectedBlockNumber: number,
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error('交易应该失败但没有失败');
        } catch (error: any) {
            const selector = '0xfe251a07'; // MetaTransactionAlreadyExecutedError 选择器

            if (!error.data || !error.data.startsWith(selector)) {
                throw new Error(`未找到预期的 MetaTransactionAlreadyExecutedError，实际错误: ${error.data}`);
            }

            // 解析实际错误数据
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const errorParams = '0x' + error.data.slice(10);
            const decoded = abiCoder.decode(['bytes32', 'uint256'], errorParams);

            const actualMtxHash = decoded[0];
            const actualBlockNumber = decoded[1];

            // 构造完全匹配的预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionAlreadyExecutedError(
                actualMtxHash,
                actualBlockNumber,
            );

            // 验证完整匹配
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不完全匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }

            // 验证关键参数
            if (actualMtxHash !== expectedMtxHash) {
                throw new Error(`mtxHash 不匹配。期望: ${expectedMtxHash}, 实际: ${actualMtxHash}`);
            }
            // 如果 expectedBlockNumber 为 0，则跳过 block number 验证（用作占位符）
            if (expectedBlockNumber !== 0 && Number(actualBlockNumber) !== expectedBlockNumber) {
                throw new Error(`blockNumber 不匹配。期望: ${expectedBlockNumber}, 实际: ${actualBlockNumber}`);
            }
        }
    }

    /**
     * 匹配 MetaTransactionInsufficientEthError
     */
    static async expectMetaTransactionInsufficientEthError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        expectedAvailableEth: bigint,
        expectedRequiredEth: bigint,
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error('交易应该失败但没有失败');
        } catch (error: any) {
            const selector = '0x0a5ade45'; // MetaTransactionInsufficientEthError 选择器

            if (!error.data || !error.data.startsWith(selector)) {
                throw new Error(`未找到预期的 MetaTransactionInsufficientEthError，实际错误: ${error.data}`);
            }

            // 解析实际错误数据
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const errorParams = '0x' + error.data.slice(10);
            const decoded = abiCoder.decode(['bytes32', 'uint256', 'uint256'], errorParams);

            const actualMtxHash = decoded[0];
            const actualAvailableEth = decoded[1];
            const actualRequiredEth = decoded[2];

            // 构造完全匹配的预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionInsufficientEthError(
                actualMtxHash,
                actualAvailableEth,
                actualRequiredEth,
            );

            // 验证完整匹配
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不完全匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }

            // 验证关键参数
            if (actualMtxHash !== expectedMtxHash) {
                throw new Error(`mtxHash 不匹配。期望: ${expectedMtxHash}, 实际: ${actualMtxHash}`);
            }
            if (actualAvailableEth !== expectedAvailableEth) {
                throw new Error(`availableEth 不匹配。期望: ${expectedAvailableEth}, 实际: ${actualAvailableEth}`);
            }
            if (actualRequiredEth !== expectedRequiredEth) {
                throw new Error(`requiredEth 不匹配。期望: ${expectedRequiredEth}, 实际: ${actualRequiredEth}`);
            }
        }
    }

    /**
     * 匹配 MetaTransactionGasPriceError
     */
    static async expectMetaTransactionGasPriceError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        expectedGasPrice: bigint,
        expectedMinGasPrice: bigint,
        expectedMaxGasPrice: bigint,
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error('交易应该失败但没有失败');
        } catch (error: any) {
            const selector = '0x6fec11a9'; // MetaTransactionGasPriceError 选择器

            if (!error.data || !error.data.startsWith(selector)) {
                throw new Error(`未找到预期的 MetaTransactionGasPriceError，实际错误: ${error.data}`);
            }

            // 解析实际错误数据
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const errorParams = '0x' + error.data.slice(10);
            const decoded = abiCoder.decode(['bytes32', 'uint256', 'uint256', 'uint256'], errorParams);

            const actualMtxHash = decoded[0];
            const actualGasPrice = decoded[1];
            const actualMinGasPrice = decoded[2];
            const actualMaxGasPrice = decoded[3];

            // 构造完全匹配的预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionGasPriceError(
                actualMtxHash,
                actualGasPrice,
                actualMinGasPrice,
                actualMaxGasPrice,
            );

            // 验证完整匹配
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不完全匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }

            // 验证关键参数
            if (actualMtxHash !== expectedMtxHash) {
                throw new Error(`mtxHash 不匹配。期望: ${expectedMtxHash}, 实际: ${actualMtxHash}`);
            }
            if (actualGasPrice !== expectedGasPrice) {
                throw new Error(`gasPrice 不匹配。期望: ${expectedGasPrice}, 实际: ${actualGasPrice}`);
            }
            if (actualMinGasPrice !== expectedMinGasPrice) {
                throw new Error(`minGasPrice 不匹配。期望: ${expectedMinGasPrice}, 实际: ${actualMinGasPrice}`);
            }
            if (actualMaxGasPrice !== expectedMaxGasPrice) {
                throw new Error(`maxGasPrice 不匹配。期望: ${expectedMaxGasPrice}, 实际: ${actualMaxGasPrice}`);
            }
        }
    }

    /**
     * 匹配 MetaTransactionCallFailedError
     */
    static async expectMetaTransactionCallFailedError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        expectedCallData?: string,
        expectedReturnData?: string,
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error('交易应该失败但没有失败');
        } catch (error: any) {
            const selector = '0xa9f0c547'; // MetaTransactionCallFailedError 选择器

            if (!error.data || !error.data.startsWith(selector)) {
                throw new Error(`未找到预期的 MetaTransactionCallFailedError，实际错误: ${error.data}`);
            }

            // 解析实际错误数据
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const errorParams = '0x' + error.data.slice(10);
            const decoded = abiCoder.decode(['bytes32', 'bytes', 'bytes'], errorParams);

            const actualMtxHash = decoded[0];
            const actualCallData = decoded[1];
            const actualReturnData = decoded[2];

            // 构造完全匹配的预期错误
            const expectedError = new ZeroExRevertErrors.MetaTransactions.MetaTransactionCallFailedError(
                actualMtxHash,
                actualCallData,
                actualReturnData,
            );

            // 验证完整匹配
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不完全匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }

            // 验证关键参数
            if (actualMtxHash !== expectedMtxHash) {
                throw new Error(`mtxHash 不匹配。期望: ${expectedMtxHash}, 实际: ${actualMtxHash}`);
            }

            // callData 和 returnData 是可选的，因为它们可能很复杂
            if (expectedCallData !== undefined && actualCallData !== expectedCallData) {
                throw new Error(`callData 不匹配。期望: ${expectedCallData}, 实际: ${actualCallData}`);
            }
            if (expectedReturnData !== undefined && actualReturnData !== expectedReturnData) {
                throw new Error(`returnData 不匹配。期望: ${expectedReturnData}, 实际: ${actualReturnData}`);
            }
        }
    }

    /**
     * 匹配 SignatureValidationError
     */
    static async expectSignatureValidationError(
        txPromise: Promise<any>,
        expectedMtxHash: string,
        expectedSigner: string,
        expectedCode: number = 4, // WRONG_SIGNER
    ): Promise<void> {
        try {
            await txPromise;
            throw new Error('交易应该失败但没有失败');
        } catch (error: any) {
            const selector = '0x4c7607a3'; // SignatureValidationError 选择器

            if (!error.data || !error.data.startsWith(selector)) {
                throw new Error(`未找到预期的 SignatureValidationError，实际错误: ${error.data}`);
            }

            // 解析实际错误数据
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const errorParams = '0x' + error.data.slice(10);
            const decoded = abiCoder.decode(['uint8', 'bytes32', 'address', 'bytes'], errorParams);

            const actualCode = decoded[0];
            const actualHash = decoded[1];
            const actualSigner = decoded[2];
            const actualSignature = decoded[3];

            // 构造完全匹配的预期错误
            const expectedError = new ZeroExRevertErrors.SignatureValidator.SignatureValidationError(
                Number(actualCode),
                actualHash,
                actualSigner,
                actualSignature,
            );

            // 验证完整匹配
            if (error.data !== expectedError.encode()) {
                throw new Error(`错误编码不完全匹配。期望: ${expectedError.encode()}, 实际: ${error.data}`);
            }

            // 验证关键参数
            if (Number(actualCode) !== expectedCode) {
                throw new Error(`code 不匹配。期望: ${expectedCode}, 实际: ${actualCode}`);
            }
            if (actualHash !== expectedMtxHash) {
                throw new Error(`hash 不匹配。期望: ${expectedMtxHash}, 实际: ${actualHash}`);
            }
            if (actualSigner.toLowerCase() !== expectedSigner.toLowerCase()) {
                throw new Error(`signer 不匹配。期望: ${expectedSigner}, 实际: ${actualSigner}`);
            }
        }
    }
}
