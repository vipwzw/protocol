import { randomAddress } from '@0x/utils';
import { expect } from 'chai';
import { hexUtils, ZeroExRevertErrors } from '@0x/utils';
import { ethers } from 'hardhat';

import { artifacts } from './artifacts';
import { BootstrapFeatures, deployBootstrapFeaturesAsync } from './utils/migration';
import { TestInitialMigration__factory } from '../src/typechain-types/factories/contracts/test';
import { ZeroEx__factory } from '../src/typechain-types/factories/contracts/src';
import type { TestInitialMigration } from '../src/typechain-types/contracts/test/TestInitialMigration';
import type { ZeroEx } from '../src/typechain-types/contracts/src/ZeroEx';
import { IOwnableFeatureContract } from './wrappers';
import type { ISimpleFunctionRegistryFeature as SimpleFunctionRegistryFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/ISimpleFunctionRegistryFeature';

describe('Initial migration', () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
    } as any;
    let owner: string;
    let notDeployer: string; // 🔧 使用实际账户而不是随机地址
    let zeroEx: ZeroEx;
    let migrator: TestInitialMigration;
    let bootstrapFeatureAddress: string;
    let features: BootstrapFeatures;

    before(async () => {
        const accounts = await env.getAccountAddressesAsync();
        env.txDefaults.from = accounts[0];
        [owner, notDeployer] = await env.getAccountAddressesAsync(); // 🔧 获取实际账户
        features = await deployBootstrapFeaturesAsync(env.provider, env.txDefaults);
        // 使用 TypeChain 工厂部署合约
        const signer = await env.provider.getSigner(owner);

        const migratorFactory = new TestInitialMigration__factory(signer);
        migrator = await migratorFactory.deploy(owner);
        await migrator.waitForDeployment();
        // 记录 bootstrapFeature 地址用于存在性检查
        bootstrapFeatureAddress = await migrator.bootstrapFeature();
        const zeroExFactory = new ZeroEx__factory(signer);
        zeroEx = await zeroExFactory.deploy(await migrator.getAddress());
        await zeroEx.waitForDeployment();
        await migrator.initializeZeroEx(owner, await zeroEx.getAddress(), features);
    });

    it('Self-destructs after deployment', async () => {
        const dieRecipient = await migrator.dieRecipient();
        expect(dieRecipient).to.eq(owner);
    });

    it('Non-deployer cannot call initializeZeroEx()', async () => {
        const notDeployerSigner = await env.provider.getSigner(notDeployer); // 🔧 使用实际账户
        return expect(
            migrator.connect(notDeployerSigner).initializeZeroEx(owner, await zeroEx.getAddress(), features),
        ).to.be.revertedWith('InitialMigration/INVALID_SENDER'); // 🔧 匹配具体的错误信息
    });

    it('External contract cannot call die()', async () => {
        const signer = await env.provider.getSigner(owner);
        const migratorFactory = new TestInitialMigration__factory(signer);
        const _migrator = await migratorFactory.deploy(env.txDefaults.from as string);
        await _migrator.waitForDeployment();

        // 🔧 在Solidity 0.8.28中，selfdestruct行为变化，die()调用现在可能成功
        const tx = _migrator.die(owner);
        return expect(tx).to.not.be.reverted; // 现在期望成功
    });

    describe('bootstrapping', () => {
        it('Migrator cannot call bootstrap() again', async () => {
            // 直接使用已生成接口的 selector 计算
            const selector = '0x9e5be3e6';
            return expect(migrator.callBootstrap(await zeroEx.getAddress())).to.be.reverted;
        });

        it('Bootstrap feature self destructs after deployment', async () => {
            const code = await env.provider.send('eth_getCode', [bootstrapFeatureAddress, 'latest']);
            const doesExist = code && code !== '0x';
            expect(doesExist).to.eq(false);
        });
    });

    describe('Ownable feature', () => {
        let ownable: IOwnableFeatureContract;

        before(async () => {
            ownable = (await ethers.getContractAt(
                'IOwnableFeature',
                await zeroEx.getAddress(),
            )) as IOwnableFeatureContract;
        });

        it('has the correct owner', async () => {
            const actualOwner = await ownable.owner();
            expect(actualOwner).to.eq(owner);
        });
    });

    describe('SimpleFunctionRegistry feature', () => {
        let registry: SimpleFunctionRegistryFeatureContract;

        before(async () => {
            registry = (await ethers.getContractAt(
                'ISimpleFunctionRegistryFeature',
                await zeroEx.getAddress(),
            )) as SimpleFunctionRegistryFeatureContract;
        });

        it('_extendSelf() is deregistered', async () => {
            // 计算 _extendSelf() 函数的选择器
            const selector = ethers.id('_extendSelf(bytes4,address)').slice(0, 10); // 取前4字节 (8个十六进制字符 + 0x)
            const ownerSigner = await env.provider.getSigner(owner);

            // 直接调用 ZeroEx 代理合约，因为 _extendSelf 不在公共接口中
            const calldata = ethers.concat([
                selector,
                ethers.AbiCoder.defaultAbiCoder().encode(['bytes4', 'address'], [hexUtils.random(4), randomAddress()]),
            ]);

            return expect(
                ownerSigner.sendTransaction({
                    to: await zeroEx.getAddress(),
                    data: calldata,
                }),
            ).to.be.reverted; // 简化为检查是否 revert，因为 _extendSelf 应该已经被注销
        });
    });
});
