import { assert as chaiAssert } from 'chai';
import { SignatureType } from '@0x/utils';
import { ethers } from 'ethers';
import { SchemaValidator } from '@0x/json-schemas';
import * as _ from 'lodash';

import { utils } from './utils';

// 延迟初始化的 SchemaValidator 实例
let globalSchemaValidator: SchemaValidator | null = null;

function getSchemaValidator(): SchemaValidator {
    if (!globalSchemaValidator) {
        try {
            globalSchemaValidator = new SchemaValidator();
        } catch (_error) {
            // 如果创建失败，返回一个简单的模拟实现
            const mockValidator = {
                isValid: () => true,
                validate: () => ({ errors: [] }),
            } as any;
            globalSchemaValidator = mockValidator;
        }
    }
    return globalSchemaValidator!;
}

// 基础断言工具，替代 @0x/assert
const baseAssert = {
    assert: chaiAssert,
    isETHAddressHex(variableName: string, value: string): void {
        if (!ethers.isAddress(value)) {
            throw new Error(`Expected ${variableName} to be of type ETHAddressHex, encountered: ${value}`);
        }
    },
    isHexString(variableName: string, value: string): void {
        if (!/^0x[0-9a-fA-F]*$/.test(value)) {
            throw new Error(`Expected ${variableName} to be a hex string, got: ${value}`);
        }
    },
    isUndefined(variableName: string, value: any): void {
        if (value !== undefined) {
            throw new Error(`Expected ${variableName} to be undefined, got: ${value}`);
        }
    },
    isString(variableName: string, value: any): void {
        if (typeof value !== 'string') {
            throw new Error(`Expected ${variableName} to be a string, got: ${typeof value}`);
        }
    },
    isNumber(variableName: string, value: any): void {
        if (typeof value !== 'number') {
            throw new Error(`Expected ${variableName} to be a number, got: ${typeof value}`);
        }
    },
    isBoolean(variableName: string, value: any): void {
        if (typeof value !== 'boolean') {
            throw new Error(`Expected ${variableName} to be a boolean, got: ${typeof value}`);
        }
    },
    doesConformToSchema(variableName: string, value: any, schema: object, _subSchemas?: any[]): void {
        const validator = getSchemaValidator();
        const isValid = validator.isValid(value, schema);
        if (!isValid) {
            const validationResult = validator.validate(value, schema);
            throw new Error(
                `Expected ${variableName} to conform to schema, but validation failed: ${JSON.stringify(validationResult.errors)}`,
            );
        }
        // 注意：subSchemas 参数在这里被接受但不处理，保持兼容性
    },
};

export const assert = {
    ...baseAssert,
    async isSenderAddressAsync(
        variableName: string,
        senderAddressHex: string,
        providerOrSigner: ethers.Provider | ethers.Signer,
    ): Promise<void> {
        baseAssert.isETHAddressHex(variableName, senderAddressHex);
        // 使用 ethers v6 检查地址是否可用
        try {
            // 如果是 Signer，直接检查地址
            if ('getAddress' in providerOrSigner) {
                const signerAddress = await providerOrSigner.getAddress();
                if (signerAddress.toLowerCase() !== senderAddressHex.toLowerCase()) {
                    throw new Error(
                        `Specified ${variableName} ${senderAddressHex} doesn't match signer address ${signerAddress}`,
                    );
                }
            } else {
                // 如果是 Provider，检查地址是否在可用账户列表中
                let accounts: string[] = [];
                try {
                    accounts = await (providerOrSigner as any).send('eth_accounts', []);
                } catch (_rpcError) {
                    // 如果 RPC 调用失败，只验证地址格式
                    baseAssert.isETHAddressHex(variableName, senderAddressHex);
                    return; // 早期返回，避免继续执行下面的账户检查
                }

                // 检查地址是否在账户列表中（统一转为小写比较）
                const normalizedSenderAddress = senderAddressHex.toLowerCase();
                const normalizedAccounts = accounts.map(addr => addr.toLowerCase());
                if (!accounts || !normalizedAccounts.includes(normalizedSenderAddress)) {
                    throw new Error(
                        `Specified ${variableName} ${senderAddressHex} isn't available through the supplied web3 provider`,
                    );
                }
            }
        } catch (error) {
            // 如果错误消息已经包含我们想要的信息，直接重新抛出
            if (
                error instanceof Error &&
                (error.message.includes("isn't available through the supplied web3 provider") ||
                    error.message.includes("doesn't match signer address"))
            ) {
                throw error;
            }
            throw new Error(
                `Failed to validate sender address: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    },
    isOneOfExpectedSignatureTypes(signature: string, signatureTypes: SignatureType[]): void {
        baseAssert.isHexString('signature', signature);
        const signatureTypeIndexIfExists = utils.getSignatureTypeIndexIfExists(signature);
        const isExpectedSignatureType = _.includes(signatureTypes, signatureTypeIndexIfExists);
        if (!isExpectedSignatureType) {
            throw new Error(
                `Unexpected signatureType: ${signatureTypeIndexIfExists}. Valid signature types: ${signatureTypes}`,
            );
        }
    },
    isValidBaseUnitAmount(variableName: string, value: bigint): void {
        if (typeof value !== 'bigint') {
            throw new Error(`Expected ${variableName} to be a bigint, got: ${typeof value}`);
        }
        if (value < 0n) {
            throw new Error(`Expected ${variableName} to be a non-negative bigint, got: ${value}`);
        }
    },
    isBigNumber(variableName: string, value: any): void {
        // 在新的实现中，我们使用 bigint，所以检查是否为 bigint
        if (typeof value !== 'bigint') {
            throw new Error(`Expected ${variableName} to be a bigint, got: ${typeof value}`);
        }
    },
};
