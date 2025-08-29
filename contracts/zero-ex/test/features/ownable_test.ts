import { LogDecoder, randomAddress, verifyEventsFromLogs } from '@0x/utils';
import { expect } from 'chai';
import { hexUtils, OwnableRevertErrors, StringRevertError, ZeroExRevertErrors } from '@0x/utils';
import { ethers } from 'hardhat';

import { artifacts } from '../artifacts';
import { abis } from '../utils/abis';
import { initialMigrateAsync } from '../utils/migration';
import { TestMigrator__factory } from '../../src/typechain-types/factories/contracts/test';
import type { TestMigrator } from '../../src/typechain-types/contracts/test/TestMigrator';
import { IOwnableFeature__factory } from '../../src/typechain-types/factories/contracts/src/features/interfaces';
import type { IOwnableFeature } from '../../src/typechain-types/contracts/src/features/interfaces';
// IOwnableFeatureEvents will be handled differently

describe('Ownable feature', () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
    } as any;
    let notOwner: string;
    let owner: string;
    let ownable: IOwnableFeature;
    let testMigrator: TestMigrator;
    let succeedingMigrateFnCallData: string;
    let failingMigrateFnCallData: string;
    let revertingMigrateFnCallData: string;
    let logDecoder: LogDecoder;

    before(async () => {
        const accounts = await env.getAccountAddressesAsync();
        env.txDefaults.from = accounts[0];
        [owner, notOwner] = await env.getAccountAddressesAsync();
        // LogDecoder 已废弃，使用 ethers 的原生事件解析
        const zeroEx = await initialMigrateAsync(owner, env.provider, env.txDefaults);
        // 创建 OwnableFeature 接口
        ownable = IOwnableFeature__factory.connect(await zeroEx.getAddress(), await env.provider.getSigner(owner));
        // 使用 TypeChain 工厂部署合约
        const signer = await env.provider.getSigner(owner);
        const testMigratorFactory = new TestMigrator__factory(signer);
        testMigrator = await testMigratorFactory.deploy();
        await testMigrator.waitForDeployment();
        succeedingMigrateFnCallData = testMigrator.interface.encodeFunctionData('succeedingMigrate');
        failingMigrateFnCallData = testMigrator.interface.encodeFunctionData('failingMigrate');
        revertingMigrateFnCallData = testMigrator.interface.encodeFunctionData('revertingMigrate');
    });

    describe('transferOwnership()', () => {
        it('non-owner cannot transfer ownership', async () => {
            const newOwner = randomAddress();
            const notOwnerSigner = await env.provider.getSigner(notOwner);
            return expect(
                ownable.connect(notOwnerSigner).transferOwnership(newOwner)
            ).to.be.rejected;
        });

        it('owner can transfer ownership', async () => {
            const newOwner = randomAddress();
            const ownerSigner = await env.provider.getSigner(owner);
            const tx = await ownable.connect(ownerSigner).transferOwnership(newOwner);
            const receipt = await tx.wait();
            verifyEventsFromLogs(
                receipt.logs,
                [
                    {
                        previousOwner: owner,
                        newOwner,
                    },
                ],
                'OwnershipTransferred',
            );
            expect(await ownable.owner()).to.eq(newOwner);
        });
    });

    describe('migrate()', () => {
        const newOwner = randomAddress();

        it('non-owner cannot call migrate()', async () => {
            const notOwnerSigner = await env.provider.getSigner(notOwner);
            return expect(
                ownable
                    .connect(notOwnerSigner)
                    .migrate(await testMigrator.getAddress(), succeedingMigrateFnCallData, newOwner)
            ).to.be.rejected;
        });

        it('can successfully execute a migration', async () => {
            const ownerSigner = await env.provider.getSigner(owner);
            const tx = await ownable
                .connect(ownerSigner)
                .migrate(await testMigrator.getAddress(), succeedingMigrateFnCallData, newOwner);
            const receipt = await tx.wait();
            const logs = receipt.logs;
            verifyEventsFromLogs(
                logs,
                [
                    {
                        callData: succeedingMigrateFnCallData,
                        owner: owner,
                    },
                ],
                'TestMigrateCalled',
            );
            expect(await ownable.owner()).to.eq(newOwner);
        });

        it('failing migration reverts', async () => {
            const ownerSigner = await env.provider.getSigner(owner);
            return expect(
                ownable
                    .connect(ownerSigner)
                    .migrate(await testMigrator.getAddress(), failingMigrateFnCallData, newOwner)
            ).to.be.rejected;
        });

        it('reverting migration reverts', async () => {
            const ownerSigner = await env.provider.getSigner(owner);
            return expect(
                ownable
                    .connect(ownerSigner)
                    .migrate(await testMigrator.getAddress(), revertingMigrateFnCallData, newOwner)
            ).to.be.rejected;
        });
    });
});
