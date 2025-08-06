import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer } from 'ethers';

// 本地 RevertReason 定义，替代 @0x/utils 
const RevertReason = {
    OnlyContractOwner: 'ONLY_CONTRACT_OWNER',
    TargetAlreadyAuthorized: 'TARGET_ALREADY_AUTHORIZED',
    TargetNotAuthorized: 'TARGET_NOT_AUTHORIZED',
    IndexOutOfBounds: 'INDEX_OUT_OF_BOUNDS',
    AuthorizedAddressMismatch: 'AUTHORIZED_ADDRESS_MISMATCH'
};

describe('Authorizable', () => {
    let authorizable: any;
    let owner: string;
    let notOwner: string;
    let address: string;
    let ownerSigner: any;
    let notOwnerSigner: any;

    beforeEach(async () => {
        const signers = await ethers.getSigners();
        ownerSigner = signers[0];
        owner = await signers[0].getAddress();
        address = await signers[1].getAddress();
        notOwnerSigner = signers[2];
        notOwner = await signers[2].getAddress();
        
        // Deploy fresh MixinAuthorizable contract for each test
        const factory = await ethers.getContractFactory('MixinAuthorizable');
        authorizable = await factory.deploy();
        await authorizable.waitForDeployment();
    });

    describe('addAuthorizedAddress', () => {
        it('should revert if not called by owner', async () => {
            await expect(
                authorizable.connect(notOwnerSigner).addAuthorizedAddress(address)
            ).to.be.revertedWith(RevertReason.OnlyContractOwner);
        });

        it('should allow owner to add an authorized address', async () => {
            await authorizable.connect(ownerSigner).addAuthorizedAddress(address);
            const isAuthorized = await authorizable.authorized(address);
            expect(isAuthorized).to.be.true;
        });

        it('should revert if owner attempts to authorize a duplicate address', async () => {
            await authorizable.connect(ownerSigner).addAuthorizedAddress(address);
            await expect(
                authorizable.connect(ownerSigner).addAuthorizedAddress(address)
            ).to.be.revertedWith(RevertReason.TargetAlreadyAuthorized);
        });
    });

    describe('removeAuthorizedAddress', () => {
        it('should revert if not called by owner', async () => {
            await authorizable.connect(ownerSigner).addAuthorizedAddress(address);
            await expect(
                authorizable.connect(notOwnerSigner).removeAuthorizedAddress(address)
            ).to.be.revertedWith(RevertReason.OnlyContractOwner);
        });

        it('should allow owner to remove an authorized address', async () => {
            await authorizable.connect(ownerSigner).addAuthorizedAddress(address);
            await authorizable.connect(ownerSigner).removeAuthorizedAddress(address);
            const isAuthorized = await authorizable.authorized(address);
            expect(isAuthorized).to.be.false;
        });

        it('should revert if owner attempts to remove an address that is not authorized', async () => {
            await expect(
                authorizable.connect(ownerSigner).removeAuthorizedAddress(address)
            ).to.be.revertedWith(RevertReason.TargetNotAuthorized);
        });
    });

    describe('removeAuthorizedAddressAtIndex', () => {
        it('should revert if not called by owner', async () => {
            await authorizable.connect(ownerSigner).addAuthorizedAddress(address);
            const index = 0;
            await expect(
                authorizable.connect(notOwnerSigner).removeAuthorizedAddressAtIndex(address, index)
            ).to.be.revertedWith(RevertReason.OnlyContractOwner);
        });

        it('should revert if index is >= authorities.length', async () => {
            const index = 1;
            await expect(
                authorizable.connect(ownerSigner).removeAuthorizedAddressAtIndex(address, index)
            ).to.be.revertedWith(RevertReason.TargetNotAuthorized);
        });

        it('should revert if owner attempts to remove an address that is not authorized', async () => {
            await authorizable.connect(ownerSigner).addAuthorizedAddress(address);
            const index = 0;
            await expect(
                authorizable.connect(ownerSigner).removeAuthorizedAddressAtIndex(notOwner, index)
            ).to.be.revertedWith(RevertReason.TargetNotAuthorized);
        });

        it('should revert if address at index does not match target', async () => {
            await authorizable.connect(ownerSigner).addAuthorizedAddress(address);
            await authorizable.connect(ownerSigner).addAuthorizedAddress(notOwner);
            const incorrectIndex = 1;
            await expect(
                authorizable.connect(ownerSigner).removeAuthorizedAddressAtIndex(address, incorrectIndex)
            ).to.be.revertedWith(RevertReason.AuthorizedAddressMismatch);
        });

        it('should allow owner to remove an authorized address', async () => {
            await authorizable.connect(ownerSigner).addAuthorizedAddress(address);
            const index = 0;
            await authorizable.connect(ownerSigner).removeAuthorizedAddressAtIndex(address, index);
            const isAuthorized = await authorizable.authorized(address);
            expect(isAuthorized).to.be.false;
        });
    });

    describe('getAuthorizedAddresses', () => {
        it('should return all authorized addresses', async () => {
            const initial = await authorizable.getAuthorizedAddresses();
            expect(initial).to.have.length(0);
            await authorizable.connect(ownerSigner).addAuthorizedAddress(address);
            await authorizable.connect(ownerSigner).addAuthorizedAddress(notOwner);
            const afterAdd = await authorizable.getAuthorizedAddresses();
            expect(afterAdd).to.have.length(2);
            expect(afterAdd).to.include(address);
            expect(afterAdd).to.include(notOwner);
            await authorizable.connect(ownerSigner).removeAuthorizedAddress(address);
            const afterRemove = await authorizable.getAuthorizedAddresses();
            expect(afterRemove).to.have.length(1);
            expect(afterRemove).to.include(notOwner);
        });
    });
});