import { SignatureType } from '@0x/types';
import { ethers } from 'ethers';
export declare const assert: {
    isSenderAddressAsync(variableName: string, senderAddressHex: string, providerOrSigner: ethers.Provider | ethers.Signer): Promise<void>;
    isOneOfExpectedSignatureTypes(signature: string, signatureTypes: SignatureType[]): void;
    assert: Chai.AssertStatic;
    isETHAddressHex(variableName: string, value: string): void;
    isHexString(variableName: string, value: string): void;
    isUndefined(variableName: string, value: any): void;
    isString(variableName: string, value: any): void;
    isNumber(variableName: string, value: any): void;
    isBoolean(variableName: string, value: any): void;
    doesConformToSchema(variableName: string, value: any, schema: object): void;
};
