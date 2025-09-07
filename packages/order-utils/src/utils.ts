// 常量导出，替代 @0x/utils
export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
export const NULL_BYTES = '0x';

// 十六进制工具，替代 @0x/utils 中的 hexUtils
export const hexUtils = {
    concat(...hexStrings: string[]): string {
        const joined = hexStrings.join('').replace(/0x/g, '');
        return `0x${joined}`;
    },
    slice(hexString: string, start: number, end?: number): string {
        const hex = hexString.replace(/^0x/, '');
        const sliced = hex.slice(start * 2, end ? end * 2 : undefined);
        return `0x${sliced}`;
    },
    random(numBytes: number = 32): string {
        const bytes = new Uint8Array(numBytes);
        crypto.getRandomValues(bytes);
        return (
            '0x' +
            Array.from(bytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
        );
    },
    toHex(value: string | Buffer | Uint8Array): string {
        if (typeof value === 'string') {
            // 如果已经是 hex 格式，直接返回
            if (value.startsWith('0x')) {
                return value;
            }
            // 如果是普通字符串，转换为 hex
            return '0x' + Buffer.from(value, 'utf8').toString('hex');
        }
        if (value instanceof Buffer) {
            return '0x' + value.toString('hex');
        }
        if (value instanceof Uint8Array) {
            return (
                '0x' +
                Array.from(value)
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('')
            );
        }
        return '0x';
    },
};

// 签名工具，替代 @0x/utils 中的 signTypedDataUtils
export const signTypedDataUtils = {
    generateTypedDataHash(typedData: any): string {
        // 使用 ethers.js 的标准 EIP-712 哈希计算
        const { ethers } = require('ethers');

        try {
            // 移除可能冲突的 EIP712Domain 类型定义
            const cleanTypes = { ...typedData.types };
            delete cleanTypes.EIP712Domain;

            // 使用 ethers.TypedDataEncoder 计算标准 EIP-712 哈希
            return ethers.TypedDataEncoder.hash(typedData.domain, cleanTypes, typedData.message);
        } catch (error) {
            // 如果出错，尝试不同的格式
            try {
                // 尝试使用所有类型
                return ethers.TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message);
            } catch (fallbackError) {
                console.error('EIP-712 哈希计算失败:', fallbackError);
                throw new Error(
                    `Failed to generate EIP-712 hash: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`,
                );
            }
        }
    },
};

// 伪随机数生成，替代 @0x/utils
export function generatePseudoRandom256BitNumber(): bigint {
    // 生成 256 位的伪随机数
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let result = 0n;
    for (let i = 0; i < bytes.length; i++) {
        result = (result << 8n) + BigInt(bytes[i]);
    }
    return result;
}

export const utils = {
    getSignatureTypeIndexIfExists(signature: string): number {
        // tslint:disable-next-line:custom-no-magic-numbers
        const signatureTypeHex = signature.slice(-2);
        const base = 16;
        const signatureTypeInt = parseInt(signatureTypeHex, base);
        return signatureTypeInt;
    },
    getCurrentUnixTimestampSec(): bigint {
        const milisecondsInSecond = 1000;
        return BigInt(Math.floor(Date.now() / milisecondsInSecond));
    },
    getPartialAmountFloor(numerator: bigint, denominator: bigint, target: bigint): bigint {
        const fillMakerTokenAmount = (numerator * target) / denominator;
        return fillMakerTokenAmount;
    },
};

// JSON 序列化工具
export const jsonUtils = {
    /**
     * BigInt 安全的 JSON 序列化 replacer 函数
     * 用于 JSON.stringify() 的第二个参数，将 BigInt 转换为字符串
     *
     * @example
     * JSON.stringify(data, jsonUtils.bigIntReplacer)
     */
    bigIntReplacer: (key: string, value: any): any => (typeof value === 'bigint' ? value.toString() : value),

    /**
     * 比较两个可能包含 BigInt 的对象是否相等（序列化比较）
     *
     * @param obj1 第一个对象
     * @param obj2 第二个对象
     * @returns 是否相等
     */
    isEqual: (obj1: any, obj2: any): boolean =>
        JSON.stringify(obj1, jsonUtils.bigIntReplacer) === JSON.stringify(obj2, jsonUtils.bigIntReplacer),
};
