import { ethers } from 'ethers';

export interface CurveLiquidityProviderData {
    curveAddress: string;
    exchangeFunctionSelector: string;
    fromCoinIdx: bigint;
    toCoinIdx: bigint;
}

// 使用 ethers AbiCoder 替代 AbiEncoder
const abiCoder = ethers.AbiCoder.defaultAbiCoder();
const curveLiquidityProviderDataTypes = ['address', 'bytes4', 'int128', 'int128'];

export const curveLiquidityProviderDataEncoder = {
    encode: (data: [string, string, bigint, bigint]): string => {
        return abiCoder.encode(curveLiquidityProviderDataTypes, data);
    },
    decode: (encoded: string): [string, string, bigint, bigint] => {
        const decoded = abiCoder.decode(curveLiquidityProviderDataTypes, encoded);
        return [decoded[0], decoded[1], decoded[2], decoded[3]];
    },
};

/**
 * Encode data for the curve liquidity provider contract.
 */
export function encodeCurveLiquidityProviderData(data: CurveLiquidityProviderData): string {
    return curveLiquidityProviderDataEncoder.encode([
        data.curveAddress,
        data.exchangeFunctionSelector,
        data.fromCoinIdx,
        data.toCoinIdx,
    ]);
}
