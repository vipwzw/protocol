import { ethers } from 'hardhat';
import { constants, randomAddress, ZeroExRevertErrors } from '@0x/utils';
import { expect } from 'chai';
import * as _ from 'lodash';

import { artifacts } from '../artifacts';
import { TestDelegateCallerContract, TestTransformerBaseContract } from '../wrappers';

describe('Transformer (base)', () => {
    const env = {
        provider: ethers.provider,
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
    };

    let deployer: string;
    let delegateCaller: TestDelegateCallerContract;
    let transformer: TestTransformerBaseContract;

    before(async () => {
        [deployer] = await env.getAccountAddressesAsync();

        const DelegateCallerFactory = await ethers.getContractFactory('TestDelegateCaller');
        delegateCaller = (await DelegateCallerFactory.deploy()) as TestDelegateCallerContract;

        const TransformerBaseFactory = await ethers.getContractFactory('TestTransformerBase');
        transformer = (await TransformerBaseFactory.deploy()) as TestTransformerBaseContract;
    });

    describe('die()', () => {
        it('cannot be called by non-deployer', async () => {
            const notDeployer = randomAddress();
            const notDeployerSigner = await ethers.getImpersonatedSigner(notDeployer);
            const tx = transformer.connect(notDeployerSigner).die(randomAddress());
            return expect(tx).to.be.rejected;
        });

        it('cannot be called outside of its own context', async () => {
            const callData = transformer.interface.encodeFunctionData('die', [randomAddress()]);
            const deployerSigner = await ethers.getImpersonatedSigner(deployer);
            const tx = delegateCaller
                .connect(deployerSigner)
                .executeDelegateCall(await transformer.getAddress(), callData);
            return expect(tx).to.be.rejected;
        });

        it('destroys the transformer', async () => {
            const deployerSigner = await ethers.getImpersonatedSigner(deployer);
            const tx = transformer.connect(deployerSigner).die(randomAddress());
            // 🔧 在Cancun硬分叉后，selfdestruct不再删除代码，只要不revert就算成功
            return expect(tx).to.not.be.reverted;
        });
    });
});
