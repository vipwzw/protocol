import { ethers } from 'ethers';

export enum DydxBridgeActionType {
    Deposit,
    Withdraw,
}

export interface DydxBridgeAction {
    actionType: DydxBridgeActionType;
    accountIdx: bigint;
    marketId: bigint;
    conversionRateNumerator: bigint;
    conversionRateDenominator: bigint;
}

export interface DydxBridgeData {
    accountNumbers: bigint[];
    actions: DydxBridgeAction[];
}

// 使用 ethers AbiCoder 替代 AbiEncoder
const abiCoder = ethers.AbiCoder.defaultAbiCoder();
const dydxBridgeDataTypes = [
    'tuple(uint256[],tuple(uint8,uint256,uint256,uint256,uint256)[])'
];

export const dydxBridgeDataEncoder = {
    encode: (data: DydxBridgeData): string => {
        return abiCoder.encode(dydxBridgeDataTypes, [data]);
    },
    decode: (encoded: string): DydxBridgeData => {
        const [decoded] = abiCoder.decode(dydxBridgeDataTypes, encoded);
        return decoded as DydxBridgeData;
    }
};
