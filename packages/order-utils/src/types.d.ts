declare module '@0x/utils' {
    export const hexUtils: any;
    export const NULL_ADDRESS: string;
    export const NULL_BYTES: string;
    export const signTypedDataUtils: any;
    export const AbiEncoder: any;
    export const providerUtils: any;
    export const BigNumber: any;
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

declare module '@0x/contract-wrappers' {
    export interface IAssetDataContract {
        [key: string]: any;
    }
}

declare module '@0x/contract-addresses' {
    export function getContractAddressesForChainOrThrow(chainId: number): any;
}

declare module '@0x/contract-artifacts' {
    export const artifacts: any;
}

// ethers v6 支持的 Provider 类型
declare type SupportedProvider = any;
