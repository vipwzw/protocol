/**
 * 现代化测试模式和工具
 * 基于 asset-proxy 模块的成功迁移经验
 */

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer, Contract } from 'ethers';

// 现代化常量定义
export const ModernConstants = {
    NULL_ADDRESS: ethers.ZeroAddress,
    NULL_BYTES: '0x',
    ZERO_AMOUNT: 0n,
    MAX_UINT256: ethers.MaxUint256,
};

// 本地 AssetProxyId 定义
export const AssetProxyId = {
    ERC20Proxy: '0xf47261b0',
    ERC721Proxy: '0x02571792', 
    ERC1155Proxy: '0xa7cb5fb7',
    ERC20Bridge: '0xdc1600f3',
    StaticCall: '0xc339d10a',
    MultiAsset: '0x94cfcdd7',
};

// 本地 RevertReason 定义
export const RevertReason = {
    SenderNotAuthorizedError: 'only authorized',
    TransferFailed: 'transfer failed',
    InvalidAssetData: 'invalid asset data',
    ProxyMismatch: 'proxy mismatch',
};

/**
 * 现代化的随机地址生成
 */
export function randomAddress(): string {
    return ethers.Wallet.createRandom().address;
}

/**
 * 现代化的随机整数生成  
 */
export function getRandomInteger(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 现代化的区块链生命周期管理
 */
export class BlockchainLifecycle {
    private snapshotId: string | null = null;

    async startAsync(): Promise<void> {
        this.snapshotId = await ethers.provider.send('evm_snapshot', []);
    }

    async revertAsync(): Promise<void> {
        if (this.snapshotId) {
            await ethers.provider.send('evm_revert', [this.snapshotId]);
            this.snapshotId = null;
        }
    }
}

/**
 * 现代化的合约部署助手
 */
export class ModernDeploymentHelper {
    private signers: Signer[];
    private deployer: Signer;

    constructor(signers: Signer[]) {
        this.signers = signers;
        this.deployer = signers[0];
    }

    static async createAsync(): Promise<ModernDeploymentHelper> {
        const signers = await ethers.getSigners();
        return new ModernDeploymentHelper(signers);
    }

    /**
     * 使用 TypeChain 工厂部署合约的通用方法
     */
    async deployContractAsync<T extends Contract>(
        FactoryClass: any,
        ...constructorArgs: any[]
    ): Promise<T> {
        const factory = new FactoryClass(this.deployer);
        const contract = await factory.deploy(...constructorArgs);
        await contract.waitForDeployment();
        return contract as T;
    }

    /**
     * 获取签名者
     */
    getSigners(): Signer[] {
        return this.signers;
    }

    /**
     * 获取部署者
     */
    getDeployer(): Signer {
        return this.deployer;
    }

    /**
     * 获取指定索引的签名者
     */
    getSigner(index: number): Signer {
        return this.signers[index];
    }
}

/**
 * 现代化的事务处理助手
 */
export class TransactionHelper {
    /**
     * 执行事务并等待确认
     */
    static async executeAndWait(txPromise: Promise<any>): Promise<any> {
        const tx = await txPromise;
        return await tx.wait();
    }

    /**
     * 获取调用返回值（不发送事务）
     */
    static async staticCall<T>(contractMethod: any, ...args: any[]): Promise<T> {
        return await contractMethod.staticCall(...args);
    }

    /**
     * 先获取返回值，再执行事务
     */
    static async callAndExecute<T>(contractMethod: any, ...args: any[]): Promise<{ returnValue: T; receipt: any }> {
        const returnValue = await contractMethod.staticCall(...args);
        const tx = await contractMethod(...args);
        const receipt = await tx.wait();
        return { returnValue, receipt };
    }
}

/**
 * 现代化的断言助手
 */
export class AssertionHelper {
    /**
     * 检查事务回滚并包含特定错误消息
     */
    static async expectRevertWithReason(txPromise: Promise<any>, reason: string): Promise<void> {
        await expect(txPromise).to.be.revertedWith(reason);
    }

    /**
     * 检查事务回滚并包含自定义错误
     */
    static async expectRevertWithCustomError(txPromise: Promise<any>, contract: Contract, errorName: string): Promise<void> {
        await expect(txPromise).to.be.revertedWithCustomError(contract, errorName);
    }

    /**
     * 检查事务简单回滚
     */
    static async expectRevert(txPromise: Promise<any>): Promise<void> {
        await expect(txPromise).to.be.reverted;
    }

    /**
     * 检查余额变化
     */
    static async expectBalanceChange(
        tokenContract: Contract,
        address: string,
        expectedChange: bigint,
        txPromise: Promise<any>
    ): Promise<void> {
        const balanceBefore = await tokenContract.balanceOf(address);
        await txPromise;
        const balanceAfter = await tokenContract.balanceOf(address);
        expect(balanceAfter - balanceBefore).to.equal(expectedChange);
    }
}

/**
 * BigNumber 到 BigInt 迁移助手
 */
export class BigIntHelper {
    /**
     * 安全地将数值转换为 BigInt
     */
    static toBigInt(value: any): bigint {
        if (typeof value === 'bigint') {
            return value;
        }
        if (typeof value === 'string' || typeof value === 'number') {
            return BigInt(value);
        }
        if (value && typeof value.toString === 'function') {
            return BigInt(value.toString());
        }
        throw new Error(`Cannot convert ${value} to BigInt`);
    }

    /**
     * 安全地将 BigInt 转换为 number（用于随机数生成）
     */
    static toNumber(value: bigint): number {
        if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new Error(`BigInt ${value} is too large to convert to number safely`);
        }
        return Number(value);
    }

    /**
     * BigInt 乘法（替代 BigNumber.times）
     */
    static multiply(a: bigint, b: bigint): bigint {
        return a * b;
    }

    /**
     * BigInt 除法（替代 BigNumber.div）
     */
    static divide(a: bigint, b: bigint): bigint {
        return a / b;
    }

    /**
     * BigInt 加法（替代 BigNumber.plus）
     */
    static add(a: bigint, b: bigint): bigint {
        return a + b;
    }

    /**
     * BigInt 减法（替代 BigNumber.minus）
     */
    static subtract(a: bigint, b: bigint): bigint {
        return a - b;
    }
}

/**
 * 现代化测试套件的基础类
 */
export abstract class ModernTestSuite {
    protected deploymentHelper!: ModernDeploymentHelper;
    protected blockchain!: BlockchainLifecycle;
    protected signers!: Signer[];

    /**
     * 通用的测试设置
     */
    protected async setupTestEnvironment(): Promise<void> {
        this.signers = await ethers.getSigners();
        this.deploymentHelper = await ModernDeploymentHelper.createAsync();
        this.blockchain = new BlockchainLifecycle();
        
        await this.blockchain.startAsync();
        console.log('✅ Modern test environment initialized');
    }

    /**
     * 通用的测试清理
     */
    protected async cleanupTestEnvironment(): Promise<void> {
        await this.blockchain.revertAsync();
        console.log('🧹 Test environment cleanup completed');
    }

    /**
     * 子类需要实现的抽象方法
     */
    protected abstract deployContracts(): Promise<void>;
}

/**
 * 现代化错误处理
 */
export class ErrorHelper {
    /**
     * 创建标准化的错误消息
     */
    static createErrorMessage(contractName: string, functionName: string, reason: string): string {
        return `${contractName}.${functionName}: ${reason}`;
    }

    /**
     * 检查是否为预期的错误类型
     */
    static isExpectedError(error: any, expectedMessage: string): boolean {
        return error.message && error.message.includes(expectedMessage);
    }
}

// 导出所有工具作为默认对象
export default {
    ModernConstants,
    AssetProxyId,
    RevertReason,
    randomAddress,
    getRandomInteger,
    BlockchainLifecycle,
    ModernDeploymentHelper,
    TransactionHelper,
    AssertionHelper,
    BigIntHelper,
    ModernTestSuite,
    ErrorHelper,
};