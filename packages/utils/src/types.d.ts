declare module '@0x/types' {
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
}

export {}; 