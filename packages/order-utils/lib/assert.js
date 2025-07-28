"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.assert = void 0;
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const json_schemas_1 = require("@0x/json-schemas");
const _ = __importStar(require("lodash"));
const utils_1 = require("./utils");
// 基础断言工具，替代 @0x/assert
const baseAssert = {
    assert: chai_1.assert,
    isETHAddressHex(variableName, value) {
        if (!ethers_1.ethers.isAddress(value)) {
            throw new Error(`Expected ${variableName} to be a valid Ethereum address, got: ${value}`);
        }
    },
    isHexString(variableName, value) {
        if (!/^0x[0-9a-fA-F]*$/.test(value)) {
            throw new Error(`Expected ${variableName} to be a hex string, got: ${value}`);
        }
    },
    isUndefined(variableName, value) {
        if (value !== undefined) {
            throw new Error(`Expected ${variableName} to be undefined, got: ${value}`);
        }
    },
    isString(variableName, value) {
        if (typeof value !== 'string') {
            throw new Error(`Expected ${variableName} to be a string, got: ${typeof value}`);
        }
    },
    isNumber(variableName, value) {
        if (typeof value !== 'number') {
            throw new Error(`Expected ${variableName} to be a number, got: ${typeof value}`);
        }
    },
    isBoolean(variableName, value) {
        if (typeof value !== 'boolean') {
            throw new Error(`Expected ${variableName} to be a boolean, got: ${typeof value}`);
        }
    },
    doesConformToSchema(variableName, value, schema) {
        const schemaValidator = new json_schemas_1.SchemaValidator();
        const isValid = schemaValidator.isValid(value, schema);
        if (!isValid) {
            const validationResult = schemaValidator.validate(value, schema);
            throw new Error(`Expected ${variableName} to conform to schema, but validation failed: ${JSON.stringify(validationResult.errors)}`);
        }
    }
};
exports.assert = {
    ...baseAssert,
    async isSenderAddressAsync(variableName, senderAddressHex, providerOrSigner) {
        baseAssert.isETHAddressHex(variableName, senderAddressHex);
        // 使用 ethers v6 检查地址是否可用
        try {
            // 如果是 Signer，直接检查地址
            if ('getAddress' in providerOrSigner) {
                const signerAddress = await providerOrSigner.getAddress();
                if (signerAddress.toLowerCase() !== senderAddressHex.toLowerCase()) {
                    throw new Error(`Specified ${variableName} ${senderAddressHex} doesn't match signer address ${signerAddress}`);
                }
            }
            else {
                // 如果是 Provider，简单验证地址格式（因为大多数 Provider 不支持 listAccounts）
                baseAssert.isETHAddressHex(variableName, senderAddressHex);
            }
        }
        catch (error) {
            throw new Error(`Failed to validate sender address: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    isOneOfExpectedSignatureTypes(signature, signatureTypes) {
        baseAssert.isHexString('signature', signature);
        const signatureTypeIndexIfExists = utils_1.utils.getSignatureTypeIndexIfExists(signature);
        const isExpectedSignatureType = _.includes(signatureTypes, signatureTypeIndexIfExists);
        if (!isExpectedSignatureType) {
            throw new Error(`Unexpected signatureType: ${signatureTypeIndexIfExists}. Valid signature types: ${signatureTypes}`);
        }
    },
};
