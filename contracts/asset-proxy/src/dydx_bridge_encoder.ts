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

            // 处理 null 或 undefined 值
            if (value === null || value === undefined) {
                // 根据组件类型返回默认值
                if (component.type.endsWith('[]')) {
                    return []; // 数组类型默认为空数组
                } else if (component.type.startsWith('uint') || component.type.startsWith('int')) {
                    return 0; // 整数类型默认为 0
                } else if (component.type === 'address') {
                    return '0x0000000000000000000000000000000000000000'; // 地址类型默认为零地址
                } else if (component.type === 'bytes' || component.type.startsWith('bytes')) {
                    return '0x'; // bytes 类型默认为空字节
                } else {
                    return 0; // 其他类型默认为 0
                }
            }

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
            { name: 'conversionRateDenominator', type: 'uint256' },
        ],
    },
];

const dydxBridgeDataTypes = ['tuple(uint256[],tuple(uint8,uint256,uint256,uint256,uint256)[])'];

export const dydxBridgeDataEncoder = {
    encode: (data: DydxBridgeData): string => {
        // 转换为数组格式以兼容 ethers.js v6
        const arrayData = convertToArrayFormat(data, DYDX_BRIDGE_DATA_ABI_COMPONENTS);
        return abiCoder.encode(dydxBridgeDataTypes, [arrayData]);
    },
    decode: (encoded: string): DydxBridgeData => {
        const [decoded] = abiCoder.decode(dydxBridgeDataTypes, encoded);
        return decoded as DydxBridgeData;
    },
};
