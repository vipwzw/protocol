const { ethers } = require('hardhat');
import { BlockchainLifecycle } from './blockchain_lifecycle';
import { web3Wrapper, txDefaults } from './web3_wrapper';

/**
 * 区块链测试环境接口
 */
export interface BlockchainTestsEnvironment {
    blockchainLifecycle: BlockchainLifecycle;
    accounts: string[];
    txDefaults: any;
    web3Wrapper: typeof web3Wrapper;
    provider: any;
    getAccountAddressesAsync(): Promise<string[]>;
}

/**
 * 测试环境基类
 */
class BlockchainTestsEnvironmentBase implements BlockchainTestsEnvironment {
    public blockchainLifecycle!: BlockchainLifecycle;
    public accounts!: string[];
    public txDefaults!: any;
    public web3Wrapper!: typeof web3Wrapper;
    public provider!: any;

    /**
     * 获取带默认值的交易数据
     */
    public async getTxDataWithDefaults(txData: any = {}): Promise<any> {
        return { ...this.txDefaults, ...txData };
    }

    /**
     * 获取账户地址列表
     */
    public async getAccountAddressesAsync(): Promise<string[]> {
        return this.accounts;
    }

    /**
     * 重置环境（子类可重写）
     */
    public reset(): void {
        // 默认实现为空，子类可重写
    }
}

/**
 * 标准区块链测试环境单例
 */
class StandardBlockchainTestsEnvironmentSingleton extends BlockchainTestsEnvironmentBase {
    private static _instance?: StandardBlockchainTestsEnvironmentSingleton;
    private _isInitialized = false;

    public static getInstance(): StandardBlockchainTestsEnvironmentSingleton {
        if (!this._instance) {
            this._instance = new StandardBlockchainTestsEnvironmentSingleton();
        }
        return this._instance;
    }

    public async initializeAsync(): Promise<void> {
        if (this._isInitialized) {
            return;
        }

        // 初始化区块链生命周期
        this.blockchainLifecycle = new BlockchainLifecycle();
        
        // 获取测试账户
        const signers = await ethers.getSigners();
        this.accounts = signers.map((signer: any) => signer.address);
        
        // 设置 provider
        this.provider = ethers.provider;
        
        // 设置默认交易参数
        this.txDefaults = {
            ...txDefaults,
            from: this.accounts[0], // 默认使用第一个账户
        };
        
        // 设置 web3Wrapper
        this.web3Wrapper = web3Wrapper;

        this._isInitialized = true;
    }

    public reset(): void {
        this._isInitialized = false;
    }
}

/**
 * 主要的 blockchainTests 函数，保持向后兼容的接口
 */
export function blockchainTests(
    description: string,
    testCallback: (env: BlockchainTestsEnvironment) => void
): void {
    describe(description, function() {
        // 预先初始化环境
        const singleton = StandardBlockchainTestsEnvironmentSingleton.getInstance();
        let env: BlockchainTestsEnvironment;

        // 在所有测试开始前初始化环境
        before(async function() {
            await singleton.initializeAsync();
            env = singleton;
        });

        // 在每个测试开始前创建快照
        beforeEach(async function() {
            if (env && env.blockchainLifecycle) {
                await env.blockchainLifecycle.startAsync();
            }
        });

        // 在每个测试结束后恢复快照
        afterEach(async function() {
            if (env && env.blockchainLifecycle) {
                await env.blockchainLifecycle.revertAsync();
            }
        });

        // 运行用户的测试回调，传入 singleton 作为环境
        // 这样可以避免 env 变量未赋值的问题
        testCallback(singleton);
    });
}

/**
 * 重新导出 describe 以保持兼容性，并添加 optional 方法
 */
export const describe = Object.assign(global.describe, {
    optional: (title: string, fn?: (this: Mocha.Suite) => void) => {
        // 环境变量控制是否运行可选测试
        if (process.env.RUN_OPTIONAL_TESTS === 'true') {
            return fn ? global.describe(title, fn) : global.describe(title, () => {});
        } else {
            return fn ? global.describe.skip(title, fn) : global.describe.skip(title, () => {});
        }
    }
});

/**
 * 为了完整的向后兼容，提供其他测试环境配置
 */
export namespace blockchainTests {
    /**
     * 分叉网络测试（简化版本）
     */
    export function fork(
        description: string,
        config: { forkUrl?: string; blockNumber?: number },
        testCallback: (env: BlockchainTestsEnvironment) => void
    ): void {
        // 在实际使用中，这里可以配置 Hardhat 网络分叉
        describe(`${description} (Fork)`, function() {
            console.warn('Fork testing requires Hardhat network configuration');
            
            const singleton = StandardBlockchainTestsEnvironmentSingleton.getInstance();
            
            before(async function() {
                await singleton.initializeAsync();
            });

            testCallback(singleton);
        });
    }

    /**
     * 实时网络测试（简化版本）
     */
    export function live(
        description: string,
        config: { networkUrl: string },
        testCallback: (env: BlockchainTestsEnvironment) => void
    ): void {
        describe(`${description} (Live)`, function() {
            console.warn('Live network testing requires careful configuration');
            testCallback({} as BlockchainTestsEnvironment);
        });
    }

    /**
     * 重置所有测试环境
     */
    export function reset(): void {
        StandardBlockchainTestsEnvironmentSingleton.getInstance().reset();
    }

    /**
     * 重置测试环境的别名方法（向后兼容）
     */
    export function resets(
        description: string,
        testCallback: (env: BlockchainTestsEnvironment) => void
    ): void {
        return blockchainTests(description, testCallback);
    }

    /**
     * 配置测试环境（向后兼容）
     */
    export function configure(config: any): void {
        // 简化的配置实现，可以根据需要扩展
        console.log('Test configuration:', config);
    }

    /**
     * 可选测试方法（向后兼容）
     */
    export function optional(title: string, fn?: (this: Mocha.Suite) => void): Mocha.Suite | void {
        // 环境变量控制是否运行可选测试
        if (process.env.RUN_OPTIONAL_TESTS === 'true') {
            return fn ? global.describe(title, fn) : global.describe(title, () => {});
        } else {
            return fn ? global.describe.skip(title, fn) : global.describe.skip(title, () => {});
        }
    }
}

/**
 * 导出环境类型以保持兼容性
 * 注意：这里重新导出是为了保持向后兼容性
 */

/**
 * 便利函数：获取当前测试环境
 */
export async function getCurrentTestEnvironment(): Promise<BlockchainTestsEnvironment> {
    const singleton = StandardBlockchainTestsEnvironmentSingleton.getInstance();
    await singleton.initializeAsync();
    return singleton;
}