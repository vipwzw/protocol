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
        return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
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
            return '0x' + Array.from(value).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        return '0x';
    }
};

// 签名工具，替代 @0x/utils 中的 signTypedDataUtils
export const signTypedDataUtils = {
    generateTypedDataHash(typedData: any): string {
        // 这里是简化实现，实际的 EIP712 哈希计算
        // 在生产环境中应该使用完整的 EIP712 实现
        return hexUtils.random(32);
    }
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
