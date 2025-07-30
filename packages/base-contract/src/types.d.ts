// 简化的模块声明
declare module '@0x/utils';

declare module '@0x/json-schemas' {
    export const schemas: any;
    export class SchemaValidator {
        constructor();
        isValid(value: any, schema: object): boolean;
        validate(value: any, schema: object): any;
    }
}

declare module '@0x/utils' {
    export interface Order {
        [key: string]: any;
    }
    export interface SignedOrder extends Order {
        signature: string;
    }
    export interface EIP712Object {
        [key: string]: any;
    }
    export interface EIP712ObjectValue {
        [key: string]: any;
    }
    export interface EIP712TypedData {
        [key: string]: any;
    }
    export interface EIP712Types {
        [key: string]: any;
    }
    export interface EIP712Domain {
        [key: string]: any;
    }
    export interface ZeroExTransaction {
        [key: string]: any;
    }
    export interface ContractAbi {
        [key: string]: any;
    }
    export interface Provider {
        [key: string]: any;
    }
    export interface EventAbi {
        [key: string]: any;
    }
    export interface MethodAbi {
        [key: string]: any;
    }
    export interface TxData {
        [key: string]: any;
    }
}

export {}; 