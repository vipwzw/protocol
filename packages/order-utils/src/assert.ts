import { assert as chaiAssert } from 'chai';
import { SignatureType } from '@0x/types';
import { ethers } from 'ethers';
import { SchemaValidator } from '@0x/json-schemas';
import * as _ from 'lodash';

import { utils } from './utils';

// 基础断言工具，替代 @0x/assert
const baseAssert = {
    assert: chaiAssert,
    isETHAddressHex(variableName: string, value: string): void {
        if (!ethers.isAddress(value)) {
            throw new Error(`Expected ${variableName} to be a valid Ethereum address, got: ${value}`);
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
    doesConformToSchema(variableName: string, value: any, schema: object): void {
        const schemaValidator = new SchemaValidator();
        const isValid = schemaValidator.isValid(value, schema);
        if (!isValid) {
            const validationResult = schemaValidator.validate(value, schema);
            throw new Error(`Expected ${variableName} to conform to schema, but validation failed: ${JSON.stringify(validationResult.errors)}`);
        }
    }
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
                // 如果是 Provider，简单验证地址格式（因为大多数 Provider 不支持 listAccounts）
                baseAssert.isETHAddressHex(variableName, senderAddressHex);
            }
        } catch (error) {
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
};
