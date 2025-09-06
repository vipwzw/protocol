import { expect } from 'chai';
import { filterLogsToArguments } from '../test_constants';
import * as _ from 'lodash';

import { TestMixinParams__factory, TestMixinParams } from '../../src/typechain-types';
import { IStakingEventsParamsSetEventArgs } from '../wrappers';
import { ethers } from 'hardhat';

import { constants as stakingConstants } from '../../src/constants';
import { StakingParams } from '../../src/types';

describe('Configurable Parameters unit tests', () => {
    let testContract: TestMixinParams;
    let authorizedAddress: string;
    let notAuthorizedAddress: string;
    let authorizedSigner: any;
    let notAuthorizedSigner: any;

    before(async () => {
        const signers = await ethers.getSigners();
        [authorizedSigner, notAuthorizedSigner] = [signers[0], signers[1]];
        [authorizedAddress, notAuthorizedAddress] = [authorizedSigner.address, notAuthorizedSigner.address];
        const factory = new TestMixinParams__factory(authorizedSigner);
        testContract = await factory.deploy();
        const tx = await testContract.addAuthorizedAddress(authorizedAddress);
        await tx.wait();
    });

    describe('setParams()', () => {
        async function setParamsAndAssertAsync(params: Partial<StakingParams>, from?: 'authorized' | 'unauthorized') {
            const _params = {
                ...stakingConstants.DEFAULT_PARAMS,
                ...params,
            };
            const contract =
                from === 'unauthorized'
                    ? testContract.connect(notAuthorizedSigner)
                    : testContract.connect(authorizedSigner);
            const tx = await contract.setParams(
                BigInt(_params.epochDurationInSeconds),
                BigInt(_params.rewardDelegatedStakeWeight),
                BigInt(_params.minimumPoolStake),
                BigInt(_params.cobbDouglasAlphaNumerator),
                BigInt(_params.cobbDouglasAlphaDenominator),
            );
            const receipt = await tx.wait();
            // Assert event.
            const events = filterLogsToArguments<IStakingEventsParamsSetEventArgs>(receipt.logs, 'ParamsSet');
            expect(events.length).to.eq(1);
            const event = events[0];
            expect(event.epochDurationInSeconds).to.equal(_params.epochDurationInSeconds);
            expect(event.rewardDelegatedStakeWeight).to.equal(_params.rewardDelegatedStakeWeight);
            expect(event.minimumPoolStake).to.equal(_params.minimumPoolStake);
            expect(event.cobbDouglasAlphaNumerator).to.equal(_params.cobbDouglasAlphaNumerator);
            expect(event.cobbDouglasAlphaDenominator).to.equal(_params.cobbDouglasAlphaDenominator);
            // Assert `getParams()`.
            const actual = await testContract.getParams();
            expect(actual[0]).to.equal(_params.epochDurationInSeconds);
            expect(actual[1]).to.equal(_params.rewardDelegatedStakeWeight);
            expect(actual[2]).to.equal(_params.minimumPoolStake);
            expect(actual[3]).to.equal(_params.cobbDouglasAlphaNumerator);
            expect(actual[4]).to.equal(_params.cobbDouglasAlphaDenominator);
            return receipt;
        }

        it('throws if not called by an authorized address', async () => {
            const tx = setParamsAndAssertAsync({}, 'unauthorized');
            await expect(tx).to.be.reverted;
        });

        it('throws if `assertValidStorageParams()` throws`', async () => {
            const setupTx = await testContract.setShouldFailAssertValidStorageParams(true);
            await setupTx.wait();
            const tx = setParamsAndAssertAsync({});
            return expect(tx).to.be.revertedWith('ASSERT_VALID_STORAGE_PARAMS_FAILED');
        });

        it('works if called by owner', async () => {
            // ensure no forced revert in assertValidStorageParams
            const clear = await testContract.setShouldFailAssertValidStorageParams(false);
            await clear.wait();
            return setParamsAndAssertAsync({}, 'authorized');
        });
    });
});
// tslint:enable:no-unnecessary-type-assertion
