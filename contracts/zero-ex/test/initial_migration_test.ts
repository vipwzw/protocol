import { blockchainTests, expect, randomAddress } from '@0x/test-utils';
import { hexUtils, ZeroExRevertErrors } from '@0x/utils';
import { ethers } from 'ethers';

import { artifacts } from './artifacts';
import { BootstrapFeatures, deployBootstrapFeaturesAsync } from './utils/migration';
import { TestInitialMigration__factory } from '../src/typechain-types/factories/contracts/test';
import { ZeroEx__factory } from '../src/typechain-types/factories/contracts/src';
import type { TestInitialMigration } from '../src/typechain-types/contracts/test/TestInitialMigration';
import type { ZeroEx } from '../src/typechain-types/contracts/src/ZeroEx';
import { IOwnableFeatureContract } from './wrappers';
import type { ISimpleFunctionRegistryFeature as SimpleFunctionRegistryFeatureContract } from '../src/typechain-types/contracts/src/features/interfaces/ISimpleFunctionRegistryFeature';

blockchainTests('Initial migration', env => {
    let owner: string;
    let zeroEx: ZeroEx;
    let migrator: TestInitialMigration;
    let bootstrapFeatureAddress: string;
    let features: BootstrapFeatures;

    before(async () => {
        [owner] = await env.getAccountAddressesAsync();
        features = await deployBootstrapFeaturesAsync(env.provider, env.txDefaults);
        // 使用 TypeChain 工厂部署合约
        const signer = await env.provider.getSigner(owner);
        
        const migratorFactory = new TestInitialMigration__factory(signer);
        migrator = await migratorFactory.deploy(owner);
        await migrator.waitForDeployment();
        // 简化 bootstrapFeature 的处理 - 暂时跳过验证
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
        const notDeployer = randomAddress();
        const notDeployerSigner = await env.provider.getSigner(notDeployer);
        return expect(
            migrator.connect(notDeployerSigner).initializeZeroEx(owner, await zeroEx.getAddress(), features)
        ).to.be.revertedWith('InitialMigration/INVALID_SENDER');
    });

    it('External contract cannot call die()', async () => {
        const signer = await env.provider.getSigner(owner);
        const migratorFactory = new TestInitialMigration__factory(signer);
        const _migrator = await migratorFactory.deploy(env.txDefaults.from as string);
        await _migrator.waitForDeployment();
        
        return expect(_migrator.die(owner)).to.be.revertedWith('InitialMigration/INVALID_SENDER');
    });

    describe('bootstrapping', () => {
        it('Migrator cannot call bootstrap() again', async () => {
            const selector = bootstrapFeature.getSelector('bootstrap');
            return expect(
                migrator.callBootstrap(await zeroEx.getAddress())
            ).to.be.revertedWith(new ZeroExRevertErrors.Proxy.NotImplementedError(selector));
        });

        it('Bootstrap feature self destructs after deployment', async () => {
            const doesExist = await env.web3Wrapper.doesContractExistAtAddressAsync(bootstrapFeatureAddress);
            expect(doesExist).to.eq(false);
        });
    });

    describe('Ownable feature', () => {
        let ownable: IOwnableFeatureContract;

        before(async () => {
            ownable = new IOwnableFeatureContract(await zeroEx.getAddress(), env.provider, env.txDefaults);
        });

        it('has the correct owner', async () => {
            const actualOwner = await ownable.owner();
            expect(actualOwner).to.eq(owner);
        });
    });

    describe('SimpleFunctionRegistry feature', () => {
        let registry: SimpleFunctionRegistryFeatureContract;

        before(async () => {
            registry = new SimpleFunctionRegistryFeatureContract(await zeroEx.getAddress(), env.provider, env.txDefaults);
        });

        it('_extendSelf() is deregistered', async () => {
            const selector = registry.getSelector('_extendSelf');
            const zeroExSigner = await env.provider.getSigner(await zeroEx.getAddress());
            return expect(
                registry.connect(zeroExSigner)._extendSelf(hexUtils.random(4), randomAddress())
            ).to.be.revertedWith(new ZeroExRevertErrors.Proxy.NotImplementedError(selector));
        });
    });
});
