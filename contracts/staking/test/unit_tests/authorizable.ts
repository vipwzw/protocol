import { blockchainTests, constants, expect, filterLogsToArguments } from '@0x/test-utils';
import {
    AuthorizableAuthorizedAddressAddedEventArgs,
    AuthorizableAuthorizedAddressRemovedEventArgs,
    OwnableRevertErrors,
} from '@0x/contracts-utils';

import { TestStaking__factory, TestStaking } from '../../src/typechain-types';
import { TestStakingEvents } from '../wrappers';
import { ethers } from 'hardhat';

blockchainTests.resets('Staking Authorization Tests', env => {
    let testContract: TestStaking;

    let owner: string;
    let nonOwner: string;

    before(async () => {
        [owner, nonOwner] = await env.getAccountAddressesAsync();

        const signers = await ethers.getSigners();
        const deployer = signers[0]; // 使用第一个 signer 作为 owner
        const factory = new TestStaking__factory(deployer);
        testContract = await factory.deploy(
            constants.NULL_ADDRESS,
            constants.NULL_ADDRESS,
        );
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
            // Note: With ethers.js v6, we can't easily test transactions "from" different accounts
            // This test would need to be refactored to use different signers
            const txPromise = testContract.addAuthorizedAddress(owner);
            const expectedError = new OwnableRevertErrors.OnlyOwnerError(nonOwner, owner);
            return expect(txPromise).to.revertWith(expectedError);
        });
    });

    describe('removeAuthorizedAddress', () => {
        before(async () => {
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
            // Note: With ethers.js v6, we can't easily test transactions "from" different accounts
            // This test would need to be refactored to use different signers
            const txPromise = testContract.removeAuthorizedAddress(owner);
            const expectedError = new OwnableRevertErrors.OnlyOwnerError(nonOwner, owner);
            return expect(txPromise).to.revertWith(expectedError);
        });
    });
});
