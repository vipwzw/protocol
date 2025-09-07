import { expect } from 'chai';
import { ethers } from 'hardhat';

// StakingRevertErrors replacement
export class StakingRevertErrors {
    static PoolManagerError(): Error {
        return new Error('Staking: pool manager error');
    }

    static InsufficientBalanceError(): Error {
        return new Error('Staking: insufficient balance');
    }

    static OperatorShareError = class extends Error {
        constructor(code: string, poolId: string, share: number) {
            super(`Staking: operator share error - ${code} for pool ${poolId} with share ${share}`);
        }
    };

    static OnlyCallableByPoolOperatorError = class extends Error {
        constructor(caller: string, poolId: string) {
            super(`Staking: only callable by pool operator - ${caller} for pool ${poolId}`);
        }
    };

    static OperatorShareErrorCodes = {
        OperatorShareTooLarge: 'OperatorShareTooLarge',
        CanOnlyDecreaseOperatorShare: 'CanOnlyDecreaseOperatorShare',
    };
}
import * as _ from 'lodash';

import { constants as stakingConstants } from '../src/constants';

import { MakerActor } from './actors/maker_actor';
import { PoolOperatorActor } from './actors/pool_operator_actor';
import { deployAndConfigureContractsAsync, StakingApiWrapper } from './utils/api_wrapper';
import { ERC20Wrapper } from '@0x/contracts-asset-proxy';

// tslint:disable:no-unnecessary-type-assertion
// tslint:disable:max-file-line-count
describe('Staking Pool Management', () => {
    // constants
    const { PPM_100_PERCENT, PPM_DENOMINATOR } = stakingConstants;
    // tokens & addresses
    let accounts: string[];
    let owner: string;
    let users: string[];
    // wrappers
    let stakingApiWrapper: StakingApiWrapper;
    let erc20Wrapper: ERC20Wrapper;

    beforeEach(async () => {
        // create fresh accounts for each test
        const { ethers } = require('hardhat');
        const signers = await ethers.getSigners();
        accounts = signers.map((s: any) => s.address);
        [owner, ...users] = accounts;

        // set up ERC20Wrapper for each test
        erc20Wrapper = new ERC20Wrapper(ethers.provider, accounts, owner);

        // deploy fresh staking contracts for each test
        stakingApiWrapper = await deployAndConfigureContractsAsync({ provider: ethers.provider }, owner, erc20Wrapper);
    });

    it('Should successfully create a pool', async () => {
        // test parameters
        const operatorAddress = users[0];
        const operatorShare = Math.floor((39 / 100) * PPM_DENOMINATOR);

        const poolOperator = new PoolOperatorActor(operatorAddress, stakingApiWrapper);
        // create pool
        const poolId = await poolOperator.createStakingPoolAsync(operatorShare, false);
        expect(poolId).to.be.equal(stakingConstants.INITIAL_POOL_ID);
        // check that the next pool id was incremented
        const lastPoolId = await stakingApiWrapper.stakingContract.lastPoolId();
        expect(lastPoolId).to.be.equal(stakingConstants.INITIAL_POOL_ID);
    });
    it('Should successfully create several staking pools, as long as the operator is only a maker in one', async () => {
        // test parameters
        const operatorAddress = users[0];
        const operatorShare = Math.floor((39 / 100) * PPM_DENOMINATOR);
        const poolOperator = new PoolOperatorActor(operatorAddress, stakingApiWrapper);
        // create pool
        const poolId1 = await poolOperator.createStakingPoolAsync(operatorShare, true);
        expect(poolId1).to.be.equal(stakingConstants.INITIAL_POOL_ID);
        const poolId2 = await poolOperator.createStakingPoolAsync(operatorShare, false);
        expect(poolId2).to.be.equal(stakingConstants.SECOND_POOL_ID);
    });
    it('Should fail to create a pool with operator share > 100', async () => {
        // test parameters
        const operatorAddress = users[0];
        const operatorShare = Math.floor((101 / 100) * PPM_DENOMINATOR);
        const poolOperator = new PoolOperatorActor(operatorAddress, stakingApiWrapper);

        // In ethers v6, we check for custom error by name rather than exact message
        const revertError = { message: 'OperatorShareError' };
        // create pool
        await poolOperator.createStakingPoolAsync(operatorShare, false, revertError);
    });
    it('Should successfully create a pool and add owner as a maker', async () => {
        // test parameters
        const operatorAddress = users[0];
        const operatorShare = Math.floor((39 / 100) * PPM_DENOMINATOR);
        const poolOperator = new PoolOperatorActor(operatorAddress, stakingApiWrapper);
        // create pool
        const poolId = await poolOperator.createStakingPoolAsync(operatorShare, true);
        expect(poolId).to.be.equal(stakingConstants.INITIAL_POOL_ID);
        // check that the next pool id was incremented
        const lastPoolId = await stakingApiWrapper.stakingContract.lastPoolId();
        expect(lastPoolId).to.be.equal(stakingConstants.INITIAL_POOL_ID);
    });
    it('Should throw if operatorShare is > PPM_DENOMINATOR', async () => {
        // test parameters
        const operatorAddress = users[0];
        // tslint:disable-next-line
        const operatorShare = PPM_100_PERCENT + 1;
        const poolOperator = new PoolOperatorActor(operatorAddress, stakingApiWrapper);
        // create pool with expected error
        const expectedError = { message: 'OperatorShareError' };
        await poolOperator.createStakingPoolAsync(operatorShare, true, expectedError);
    });
    it('Should successfully add a maker to a pool', async () => {
        // test parameters
        const operatorAddress = users[0];
        const operatorShare = Math.floor((39 / 100) * PPM_DENOMINATOR);
        const poolOperator = new PoolOperatorActor(operatorAddress, stakingApiWrapper);
        const makerAddress = users[1];
        const maker = new MakerActor(makerAddress, stakingApiWrapper);
        // create pool
        const poolId = await poolOperator.createStakingPoolAsync(operatorShare, true);
        expect(poolId).to.be.equal(stakingConstants.INITIAL_POOL_ID);
        // maker joins pool
        await maker.joinStakingPoolAsMakerAsync(poolId);
    });
    it('Maker should successfully remove themselves from a pool', async () => {
        // test parameters
        const operatorAddress = users[0];
        const operatorShare = Math.floor((39 / 100) * PPM_DENOMINATOR);
        const poolOperator = new PoolOperatorActor(operatorAddress, stakingApiWrapper);
        const makerAddress = users[1];
        const maker = new MakerActor(makerAddress, stakingApiWrapper);
        // create pool
        const poolId = await poolOperator.createStakingPoolAsync(operatorShare, true);
        expect(poolId).to.be.equal(stakingConstants.INITIAL_POOL_ID);
        // maker joins pool
        await maker.joinStakingPoolAsMakerAsync(poolId);
        // maker removes themselves from pool
        await maker.joinStakingPoolAsMakerAsync(stakingConstants.NIL_POOL_ID);
    });
    it('Should successfully add/remove multiple makers to the same pool', async () => {
        // test parameters
        const operatorAddress = users[0];
        const operatorShare = Math.floor((39 / 100) * PPM_DENOMINATOR);
        const poolOperator = new PoolOperatorActor(operatorAddress, stakingApiWrapper);
        const makerAddresses = users.slice(1, 4);
        const makers = makerAddresses.map(makerAddress => new MakerActor(makerAddress, stakingApiWrapper));
        // create pool
        const poolId = await poolOperator.createStakingPoolAsync(operatorShare, false);
        expect(poolId).to.be.equal(stakingConstants.INITIAL_POOL_ID);
        // add makers to pool
        await Promise.all(makers.map(async maker => maker.joinStakingPoolAsMakerAsync(poolId)));
        // remove makers to pool
        await Promise.all(makers.map(async maker => maker.joinStakingPoolAsMakerAsync(stakingConstants.NIL_POOL_ID)));
    });
    it('Operator should successfully decrease their share of rewards', async () => {
        // test parameters
        const operatorAddress = users[0];
        const operatorShare = Math.floor((39 / 100) * PPM_DENOMINATOR);
        const poolOperator = new PoolOperatorActor(operatorAddress, stakingApiWrapper);

        // create pool
        const poolId = await poolOperator.createStakingPoolAsync(operatorShare, false);
        expect(poolId).to.be.equal(stakingConstants.INITIAL_POOL_ID);

        // decrease operator share
        await poolOperator.decreaseStakingPoolOperatorShareAsync(poolId, operatorShare - 1);
    });
    it('Should fail if operator tries to increase their share of rewards', async () => {
        // test parameters
        const operatorAddress = users[0];
        const operatorShare = Math.floor((39 / 100) * PPM_DENOMINATOR);
        const poolOperator = new PoolOperatorActor(operatorAddress, stakingApiWrapper);

        // create pool
        const poolId = await poolOperator.createStakingPoolAsync(operatorShare, false);
        expect(poolId).to.be.equal(stakingConstants.INITIAL_POOL_ID);

        const increasedOperatorShare = operatorShare + 1;
        const revertError = { message: 'OperatorShareError' };
        // decrease operator share (should fail when trying to increase)
        await poolOperator.decreaseStakingPoolOperatorShareAsync(poolId, increasedOperatorShare, revertError);
    });
    it('Should be successful if operator calls decreaseStakingPoolOperatorShare and newOperatorShare == oldOperatorShare', async () => {
        // test parameters
        const operatorAddress = users[0];
        const operatorShare = Math.floor((39 / 100) * PPM_DENOMINATOR);
        const poolOperator = new PoolOperatorActor(operatorAddress, stakingApiWrapper);

        // create pool
        const poolId = await poolOperator.createStakingPoolAsync(operatorShare, false);
        expect(poolId).to.be.equal(stakingConstants.INITIAL_POOL_ID);

        // decrease operator share
        await poolOperator.decreaseStakingPoolOperatorShareAsync(poolId, operatorShare);
    });
    it('should fail to decrease operator share if not called by operator', async () => {
        // test parameters
        const operatorAddress = users[0];
        const operatorShare = Math.floor((39 / 100) * PPM_DENOMINATOR);
        const poolOperator = new PoolOperatorActor(operatorAddress, stakingApiWrapper);
        const makerAddress = users[1];
        const maker = new MakerActor(makerAddress, stakingApiWrapper);
        // create pool
        const poolId = await poolOperator.createStakingPoolAsync(operatorShare, true);
        expect(poolId).to.be.equal(stakingConstants.INITIAL_POOL_ID);
        await maker.decreaseStakingPoolOperatorShareAsync(poolId, operatorShare - 1, {
            message: 'OnlyCallableByPoolOperatorError',
        });
    });
});
// tslint:enable:no-unnecessary-type-assertion
