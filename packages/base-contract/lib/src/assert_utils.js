"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assert = void 0;
const chai_1 = require("chai");
const json_schemas_1 = require("@0x/json-schemas");
// 懒加载的 SchemaValidator 实例，避免重复创建
let _schemaValidator;
function getSchemaValidator() {
    if (_schemaValidator === undefined) {
        _schemaValidator = new json_schemas_1.SchemaValidator();
    }
    return _schemaValidator;
}
// 基础断言工具，替代 @0x/assert
exports.assert = {
    ...chai_1.assert,
    isETHAddressHex(variableName, value) {
        // 简单的以太坊地址验证：42 字符，以 0x 开头，其余为十六进制
        const addressRegex = /^0x[a-fA-F0-9]{40}$/;
        if (!addressRegex.test(value)) {
            throw new Error(`Expected ${variableName} to be a valid Ethereum address, got: ${value}`);
        }
    },
    isHexString(variableName, value) {
        if (!/^0x[0-9a-fA-F]*$/.test(value)) {
            throw new Error(`Expected ${variableName} to be a hex string, got: ${value}`);
        }
    },
    doesConformToSchema(variableName, value, schema) {
        const schemaValidator = getSchemaValidator();
        const isValid = schemaValidator.isValid(value, schema);
        if (!isValid) {
            const validationResult = schemaValidator.validate(value, schema);
            throw new Error(`Expected ${variableName} to conform to schema, but validation failed: ${JSON.stringify(validationResult.errors)}`);
        }
    },
    isBlockParam(variableName, value) {
        // 简化的区块参数验证
        if (typeof value !== 'string' && typeof value !== 'number') {
            throw new Error(`Expected ${variableName} to be a valid block parameter (string or number), got: ${typeof value}`);
        }
    }
};
