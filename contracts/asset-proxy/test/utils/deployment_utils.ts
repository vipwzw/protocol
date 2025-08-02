import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer } from 'ethers';

/**
 * 现代化的合约部署辅助函数
 * 替代旧的 deployFrom0xArtifactAsync 模式
 */
export async function deployContractAsync<T>(
    contractName: string,
    deployer?: Signer,
    ...constructorArgs: any[]
): Promise<T> {
    if (!deployer) {
        const signers = await ethers.getSigners();
        deployer = signers[0];
    }
    
    const ContractFactory = await ethers.getContractFactory(contractName, deployer);
    const contract = await ContractFactory.deploy(...constructorArgs);
    await contract.waitForDeployment();
    
    return contract as T;
}

/**
 * 获取 ethers v6 兼容的地址
 */
export async function getAccountAddressesAsync(): Promise<string[]> {
    const signers = await ethers.getSigners();
    return Promise.all(signers.map(signer => signer.getAddress()));
}

/**
 * 简化的资产代理部署器
 * 为 asset-proxy 测试提供统一的部署接口
 */
export class AssetProxyDeploymentHelper {
    private _deployer: Signer;
    private _accounts: string[];

    constructor(deployer: Signer, accounts: string[]) {
        this._deployer = deployer;
        this._accounts = accounts;
    }

    static async createAsync(): Promise<AssetProxyDeploymentHelper> {
        const signers = await ethers.getSigners();
        const accounts = await Promise.all(signers.map(s => s.getAddress()));
        return new AssetProxyDeploymentHelper(signers[0], accounts);
    }

    public async deployERC20ProxyAsync(): Promise<any> {
        return deployContractAsync('ERC20Proxy', this._deployer);
    }

    public async deployERC721ProxyAsync(): Promise<any> {
        return deployContractAsync('ERC721Proxy', this._deployer);
    }

    public async deployERC1155ProxyAsync(): Promise<any> {
        return deployContractAsync('ERC1155Proxy', this._deployer);
    }

    public async deployMultiAssetProxyAsync(): Promise<any> {
        return deployContractAsync('MultiAssetProxy', this._deployer);
    }

    public async deployStaticCallProxyAsync(): Promise<any> {
        return deployContractAsync('StaticCallProxy', this._deployer);
    }

    public get accounts(): string[] {
        return this._accounts;
    }

    public get deployer(): Signer {
        return this._deployer;
    }
}

/**
 * 简化的区块链生命周期管理
 * 使用 Hardhat 的快照功能
 */
export class BlockchainLifecycle {
    private _snapshotId: string | null = null;

    public async startAsync(): Promise<void> {
        // Hardhat 会自动管理测试环境
        console.log('🚀 Blockchain lifecycle started');
    }

    public async revertAsync(): Promise<void> {
        if (this._snapshotId) {
            await ethers.provider.send('evm_revert', [this._snapshotId]);
            this._snapshotId = null;
        }
        console.log('⏪ Blockchain state reverted');
    }

    public async saveSnapshotAsync(): Promise<void> {
        this._snapshotId = await ethers.provider.send('evm_snapshot', []);
        console.log('📸 Blockchain snapshot saved');
    }
}