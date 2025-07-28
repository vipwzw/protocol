export declare const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
export declare const NULL_BYTES = "0x";
export declare const hexUtils: {
    concat(...hexStrings: string[]): string;
    slice(hexString: string, start: number, end?: number): string;
    random(numBytes?: number): string;
    toHex(value: string | Buffer | Uint8Array): string;
};
export declare const signTypedDataUtils: {
    generateTypedDataHash(typedData: any): string;
};
export declare function generatePseudoRandom256BitNumber(): bigint;
export declare const utils: {
    getSignatureTypeIndexIfExists(signature: string): number;
    getCurrentUnixTimestampSec(): bigint;
    getPartialAmountFloor(numerator: bigint, denominator: bigint, target: bigint): bigint;
};
