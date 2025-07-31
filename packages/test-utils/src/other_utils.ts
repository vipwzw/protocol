import { ethers } from 'ethers';
import * as crypto from 'crypto';

/**
 * 组合测试用的字节32值
 */
export const bytes32Values = [
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    '0x0000000000000000000000000000000000000000000000000000000000000001',
    '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    ethers.keccak256(ethers.toUtf8Bytes('test')),
    ethers.randomBytes(32),
];

/**
 * 组合测试用的 uint256 值
 */
export const uint256Values = [
    0n,
    1n,
    2n ** 8n - 1n,    // max uint8
    2n ** 16n - 1n,   // max uint16
    2n ** 32n - 1n,   // max uint32
    2n ** 64n - 1n,   // max uint64
    2n ** 128n - 1n,  // max uint128
    2n ** 256n - 1n,  // max uint256
];

/**
 * 组合测试函数接口
 */
export interface ReferenceFunction<T> {
    (...args: any[]): T;
}

/**
 * 组合测试 - 与参考函数对比
 */
export function testCombinatoriallyWithReferenceFunc<T>(
    values: any[][],
    testFunc: (...args: any[]) => Promise<T>,
    referenceFunc: ReferenceFunction<T>,
    description?: string
): void {
    if (values.length === 0) {
        return;
    }

    // 生成所有可能的参数组合
    function* generateCombinations(arrays: any[][], current: any[] = []): Generator<any[]> {
        if (current.length === arrays.length) {
            yield [...current];
            return;
        }

        for (const value of arrays[current.length]) {
            yield* generateCombinations(arrays, [...current, value]);
        }
    }

    const combinations = Array.from(generateCombinations(values));
    
    combinations.forEach((args, index) => {
        it(`${description || 'combinatorial test'} - case ${index + 1}: [${args.join(', ')}]`, async function() {
            const expected = referenceFunc(...args);
            const actual = await testFunc(...args);
            
            // 比较结果
            if (typeof expected === 'bigint' && typeof actual === 'bigint') {
                if (expected !== actual) {
                    throw new Error(`Expected ${expected}, but got ${actual}`);
                }
            } else if (Array.isArray(expected) && Array.isArray(actual)) {
                if (expected.length !== actual.length) {
                    throw new Error(`Array length mismatch: expected ${expected.length}, got ${actual.length}`);
                }
                for (let i = 0; i < expected.length; i++) {
                    if (expected[i] !== actual[i]) {
                        throw new Error(`Array element ${i} mismatch: expected ${expected[i]}, got ${actual[i]}`);
                    }
                }
            } else {
                if (expected !== actual) {
                    throw new Error(`Expected ${expected}, but got ${actual}`);
                }
            }
        });
    });
}

/**
 * 抽象资产包装器基类（简化版本）
 */
export abstract class AbstractAssetWrapper {
    protected _provider: ethers.Provider;

    constructor(provider: ethers.Provider) {
        this._provider = provider;
    }

    public abstract getProxyId(): string;
    public abstract encodeAssetData(...args: any[]): string;
    public abstract decodeAssetData(data: string): any;
}

/**
 * 日志解码器类（简化版本）
 */
export class LogDecoder {
    private _abis: ethers.Interface[] = [];

    constructor(abis: any[]) {
        this._abis = abis.map(abi => new ethers.Interface(abi));
    }

    public decodeLogData(log: ethers.Log): any {
        for (const abi of this._abis) {
            try {
                return abi.parseLog({
                    topics: log.topics,
                    data: log.data
                });
            } catch {
                continue;
            }
        }
        throw new Error('Unable to decode log data');
    }
}

/**
 * 签名工具（简化版本）
 */
export const signingUtils = {
    /**
     * 对消息进行签名
     */
    async signMessageAsync(
        signer: ethers.Signer,
        message: string
    ): Promise<string> {
        return await signer.signMessage(message);
    },

    /**
     * 对类型化数据进行签名
     */
    async signTypedDataAsync(
        signer: ethers.Signer,
        domain: any,
        types: any,
        message: any
    ): Promise<string> {
        return await signer.signTypedData(domain, types, message);
    },

    /**
     * 恢复签名者地址
     */
    recoverSignerAddress(
        message: string,
        signature: string
    ): string {
        return ethers.verifyMessage(message, signature);
    }
};

/**
 * 类型编码工具（简化版本）
 */
export const typeEncodingUtils = {
    /**
     * 编码函数调用数据
     */
    encodeFunctionCallData(
        abi: any[],
        functionName: string,
        args: any[]
    ): string {
        const iface = new ethers.Interface(abi);
        return iface.encodeFunctionData(functionName, args);
    },

    /**
     * 解码函数调用数据
     */
    decodeFunctionCallData(
        abi: any[],
        functionName: string,
        data: string
    ): any {
        const iface = new ethers.Interface(abi);
        return iface.decodeFunctionData(functionName, data);
    }
};

/**
 * 订单工具（简化版本）
 */
export const orderUtils = {
    /**
     * 计算订单哈希
     */
    getOrderHash(order: any): string {
        // 这里应该实现具体的订单哈希计算逻辑
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'uint256'],
            [order.maker || ethers.ZeroAddress, order.amount || 0, order.nonce || 0]
        );
        return ethers.keccak256(encoded);
    }
};

/**
 * 交易哈希工具（简化版本）
 */
export const transactionHashUtils = {
    /**
     * 计算交易哈希
     */
    getTransactionHash(transaction: any): string {
        // 这里应该实现具体的交易哈希计算逻辑
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256', 'bytes'],
            [transaction.to || ethers.ZeroAddress, transaction.value || 0, transaction.data || '0x']
        );
        return ethers.keccak256(encoded);
    }
};

/**
 * 订单哈希工具（简化版本）
 */
export const orderHashUtils = {
    getOrderHashHex: orderUtils.getOrderHash
};