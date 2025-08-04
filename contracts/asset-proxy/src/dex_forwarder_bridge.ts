import { ethers } from 'ethers';

export interface DexForwarderBridgeCall {
    target: string;
    inputTokenAmount: bigint;
    outputTokenAmount: bigint;
    bridgeData: string;
}

export interface DexForwaderBridgeData {
    inputToken: string;
    calls: DexForwarderBridgeCall[];
}

// 使用 ethers AbiCoder 替代 AbiEncoder
const abiCoder = ethers.AbiCoder.defaultAbiCoder();
const dexForwarderBridgeDataTypes = [
    'address', // inputToken
    'tuple[]' // calls
];

export const dexForwarderBridgeDataEncoder = {
    encode: (data: DexForwaderBridgeData): string => {
        return abiCoder.encode(dexForwarderBridgeDataTypes, [data.inputToken, data.calls]);
    },
    decode: (encoded: string): DexForwaderBridgeData => {
        const [inputToken, calls] = abiCoder.decode(dexForwarderBridgeDataTypes, encoded);
        return { inputToken, calls };
    }
};
