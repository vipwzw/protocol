import { blockchainTests, expect, filterLogsToArguments } from '@0x/test-utils';
import { AuthorizableRevertErrors } from '@0x/contracts-utils';
import { TransactionReceiptWithDecodedLogs } from 'ethereum-types';
import * as _ from 'lodash';

import { TestMixinParams__factory, TestMixinParams } from '../../src/typechain-types';
import { IStakingEventsParamsSetEventArgs } from '../wrappers';
import { ethers } from 'hardhat';

import { constants as stakingConstants } from '../../src/constants';
import { StakingParams } from '../../src/types';

blockchainTests('Configurable Parameters unit tests', env => {
    let testContract: TestMixinParams;
    let authorizedAddress: string;
    let notAuthorizedAddress: string;

    before(async () => {
        [authorizedAddress, notAuthorizedAddress] = await env.getAccountAddressesAsync();
        const [deployer] = await ethers.getSigners();
        const factory = new TestMixinParams__factory(deployer);
        testContract = await factory.deploy();
        
        const tx = await testContract.addAuthorizedAddress(authorizedAddress);
        await tx.wait();
    });

    blockchainTests.resets('setParams()', () => {
        async function setParamsAndAssertAsync(
            params: Partial<StakingParams>,
            from?: string,
        ): Promise<TransactionReceiptWithDecodedLogs> {
            const _params = {
                ...stakingConstants.DEFAULT_PARAMS,
                ...params,
            };
            const tx = await testContract.setParams(
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
            const actual = await testContract.getParams().callAsync();
            expect(actual[0]).to.equal(_params.epochDurationInSeconds);
            expect(actual[1]).to.equal(_params.rewardDelegatedStakeWeight);
            expect(actual[2]).to.equal(_params.minimumPoolStake);
            expect(actual[3]).to.equal(_params.cobbDouglasAlphaNumerator);
            expect(actual[4]).to.equal(_params.cobbDouglasAlphaDenominator);
            return receipt;
        }

        it('throws if not called by an authorized address', async () => {
            const tx = setParamsAndAssertAsync({}, notAuthorizedAddress);
            const expectedError = new AuthorizableRevertErrors.SenderNotAuthorizedError(notAuthorizedAddress);
            return expect(tx).to.revertWith(expectedError);
        });

        it('throws if `assertValidStorageParams()` throws`', async () => {
            const setupTx = await testContract.setShouldFailAssertValidStorageParams(true);
            await setupTx.wait();
            const tx = setParamsAndAssertAsync({});
            return expect(tx).to.revertWith('ASSERT_VALID_STORAGE_PARAMS_FAILED');
        });

        it('works if called by owner', async () => {
            return setParamsAndAssertAsync({});
        });
    });
});
// tslint:enable:no-unnecessary-type-assertion
