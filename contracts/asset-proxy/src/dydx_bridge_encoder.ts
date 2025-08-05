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

/**
 * 将对象格式的数据转换为数组格式（用于 ethers.js v6 兼容性）
 */
function convertToArrayFormat(obj: any, components: any[]): any {
    if (Array.isArray(obj)) {
        return obj.map(item => convertToArrayFormat(item, components));
    }
    
    if (typeof obj === 'object' && obj !== null) {
        return components.map(component => {
            const value = obj[component.name];
            if (component.components && Array.isArray(value)) {
                // 处理嵌套的 tuple 数组
                return value.map(item => convertToArrayFormat(item, component.components));
            } else if (component.components && typeof value === 'object') {
                // 处理嵌套的 tuple 对象
                return convertToArrayFormat(value, component.components);
            }
            return value;
        });
    }
    
    return obj;
}

// 使用 ethers AbiCoder 替代 AbiEncoder
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

// DydxBridgeData ABI 组件定义
const DYDX_BRIDGE_DATA_ABI_COMPONENTS = [
    { name: 'accountNumbers', type: 'uint256[]' },
    {
        name: 'actions',
        type: 'tuple[]',
        components: [
            { name: 'actionType', type: 'uint8' },
            { name: 'accountIdx', type: 'uint256' },
            { name: 'marketId', type: 'uint256' },
            { name: 'conversionRateNumerator', type: 'uint256' },
            { name: 'conversionRateDenominator', type: 'uint256' }
        ]
    }
];

const dydxBridgeDataTypes = [
    'tuple(uint256[],tuple(uint8,uint256,uint256,uint256,uint256)[])'
];

export const dydxBridgeDataEncoder = {
    encode: (data: DydxBridgeData): string => {
        // 转换为数组格式以兼容 ethers.js v6
        const arrayData = convertToArrayFormat(data, DYDX_BRIDGE_DATA_ABI_COMPONENTS);
        return abiCoder.encode(dydxBridgeDataTypes, [arrayData]);
    },
    decode: (encoded: string): DydxBridgeData => {
        const [decoded] = abiCoder.decode(dydxBridgeDataTypes, encoded);
        return decoded as DydxBridgeData;
    }
};
