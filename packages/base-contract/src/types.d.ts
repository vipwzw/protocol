declare module '@0x/utils' {
    export const AbiDecoder: any;
    export const AbiEncoder: any;
    export const intervalUtils: any;
    export const logUtils: any;
    export const BigNumber: any;
    export const NULL_ADDRESS: string;
    export const NULL_BYTES: string;
    export const hexUtils: any;
    export const providerUtils: any;
    export const signTypedDataUtils: any;
    export function generatePseudoRandom256BitNumber(): any;
}

declare module '@0x/json-schemas' {
    export const schemas: any;
    export class SchemaValidator {
        constructor();
        isValid(value: any, schema: object): boolean;
        validate(value: any, schema: object): any;
    }
}

declare module '@0x/types' {
    export interface Order {
        [key: string]: any;
    }
    export interface SignedOrder extends Order {
        signature: string;
    }
    export interface DecodedLogArgs {
        [key: string]: any;
    }
    // 其他需要的类型...
} 