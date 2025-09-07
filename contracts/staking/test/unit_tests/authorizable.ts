import { expect } from 'chai';
import { constants, filterLogsToArguments } from '../test_constants';
import {
    AuthorizableAuthorizedAddressAddedEventArgs,
    AuthorizableAuthorizedAddressRemovedEventArgs,
    OwnableRevertErrors,
} from '@0x/contracts-utils';

import { TestStaking__factory, TestStaking } from '../../src/typechain-types';
import { TestStakingEvents } from '../wrappers';
import { ethers } from 'hardhat';

describe('Staking Authorization Tests', () => {
    let testContract: TestStaking;

    let owner: string;
    let nonOwner: string;
    let ownerSigner: any;
    let nonOwnerSigner: any;

    before(async () => {
        const signers = await ethers.getSigners();
        [ownerSigner, nonOwnerSigner] = [signers[0], signers[1]];
        [owner, nonOwner] = [ownerSigner.address, nonOwnerSigner.address];

        const deployer = ownerSigner; // 使用第一个 signer 作为 owner
        const factory = new TestStaking__factory(deployer);
        testContract = await factory.deploy(constants.NULL_ADDRESS, constants.NULL_ADDRESS);
    });

    it("shouldn't have any authorized addresses initially", async () => {
        const authorities = await testContract.getAuthorizedAddresses();
        expect(authorities).to.be.deep.eq([]);
    });

    describe('addAuthorizedAddress', () => {
        it('should allow owner to add authorized address', async () => {
            const tx = await testContract.addAuthorizedAddress(nonOwner);
            const receipt = await tx.wait();

            const args = filterLogsToArguments<AuthorizableAuthorizedAddressAddedEventArgs>(
                receipt.logs,
                TestStakingEvents.AuthorizedAddressAdded,
            );
            expect(args).to.be.deep.eq([{ target: nonOwner, caller: owner }]);

            const authorities = await testContract.getAuthorizedAddresses();
            expect(authorities).to.be.deep.eq([nonOwner]);
        });

        it('should throw if non-owner adds authorized address', async () => {
            const txPromise = testContract.connect(nonOwnerSigner).addAuthorizedAddress(owner);
            await expect(txPromise).to.be.reverted;
        });
    });

    describe('removeAuthorizedAddress', () => {
        before(async () => {
            // 重新部署，确保没有前序授权残留
            const factory = new TestStaking__factory(ownerSigner);
            testContract = await factory.deploy(constants.NULL_ADDRESS, constants.NULL_ADDRESS);
            const tx = await testContract.addAuthorizedAddress(owner);
            await tx.wait();
            const authorities = await testContract.getAuthorizedAddresses();
            expect(authorities).to.be.deep.eq([owner]);
        });

        it('should allow owner to remove authorized address', async () => {
            const tx = await testContract.removeAuthorizedAddress(owner);
            const receipt = await tx.wait();

            const args = filterLogsToArguments<AuthorizableAuthorizedAddressRemovedEventArgs>(
                receipt.logs,
                TestStakingEvents.AuthorizedAddressRemoved,
            );
            expect(args).to.be.deep.eq([{ target: owner, caller: owner }]);

            const authorities = await testContract.getAuthorizedAddresses();
            expect(authorities).to.be.deep.eq([]);
        });

        it('should throw if non-owner removes authorized address', async () => {
            const txPromise = testContract.connect(nonOwnerSigner).removeAuthorizedAddress(owner);
            await expect(txPromise).to.be.reverted;
        });
    });
});
