const Ajv = require('ajv'); // require style for ajv v6
// @ts-ignore - lodash.values doesn't have types
import values = require('lodash.values');

import { schemas } from './schemas';

// 全局 AJV 实例，避免重复 schema 的问题
let _globalValidator: any;

function getOrCreateValidator(): any {
    if (!_globalValidator) {
        _globalValidator = new Ajv({ allErrors: true, loadSchema: false });
        
        // 只添加一次所有的 schemas
        const allSchemas = values(schemas).filter((s: any) => s !== undefined && s.id !== undefined);
        
        // 先添加所有基础 schema
        for (const schema of allSchemas) {
            try {
                _globalValidator.addSchema(schema, schema.id);
            } catch (err: any) {
                // 忽略重复 schema 错误
                if (err.message && !err.message.includes('already exists')) {
                    throw err;
                }
            }
        }
    }
    return _globalValidator;
}

/**
 * A validator wrapping (AJV) [https://github.com/ajv-validator/ajv]
 */
export class SchemaValidator {
    private readonly _validator: any;
    /**
     * Instantiates a SchemaValidator instance
     */
    constructor(newSchemas: object[] = []) {
        this._validator = getOrCreateValidator();
        
        // 只添加新的 schemas
        for (const schema of newSchemas.filter(s => s !== undefined)) {
            try {
                this._validator.addSchema(schema, (schema as any).id);
            } catch (err: any) {
                // 忽略重复 schema 错误
                if (err.message && !err.message.includes('already exists')) {
                    throw err;
                }
            }
        }
    }
    /**
     * Add a schema to the validator. All schemas and sub-schemas must be added to
     * the validator before the `validate` and `isValid` methods can be called with
     * instances of that schema.
     * @param schema The schema to add
     */
    public addSchema(schemaObjectOrArray: object | object[]): void {
        const _schemas = Array.isArray(schemaObjectOrArray) ? schemaObjectOrArray : [schemaObjectOrArray];
        for (const s of _schemas) {
            try {
                this._validator.addSchema(s); // AJV validates upon adding
            } catch (err) {
                // Ignore duplicate errors.
                if (err instanceof Error && !err.message.endsWith('already exists')) {
                    throw err;
                }
            }
        }
    }
    // In order to validate a complex JS object using jsonschema, we must replace any complex
    // sub-types (e.g BigNumber, BigInt) with a simpler string representation. Since BigNumber and other
    // complex types implement the `toString` method, we can stringify the object and
    // then parse it. The resultant object can then be checked using jsonschema.
    
    /**
     * 转换包含 BigInt 的对象为可 JSON 序列化的对象
     */
    private _convertBigIntToString(obj: any): any {
        return JSON.parse(JSON.stringify(obj, (key, value) => {
            if (typeof value === 'bigint') {
                return value.toString();
            }
            return value;
        }));
    }
    
    /**
     * Validate the JS object conforms to a specific JSON schema
     * @param instance JS object in question
     * @param schema Schema to check against
     * @returns The results of the validation
     */
    public validate(instance: any, schema: object): any {
        this.isValid(instance, schema);
        return this._validator; // errors field is returned here. Will be overwritten on the next validation.
    }
    /**
     * Check whether an instance properly adheres to a JSON schema
     * @param instance JS object in question
     * @param schema Schema to check against
     * @returns Whether or not the instance adheres to the schema
     */
    public isValid(instance: any, schema: object): boolean {
        const convertedInstance = this._convertBigIntToString(instance);
        return this._validator.validate(schema, convertedInstance) as boolean;
    }
}
