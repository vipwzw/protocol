import { expect } from 'chai';
import { ethers } from 'hardhat';
import { expect } from './test_constants';
import * as _ from 'lodash';

import { constants as stakingConstants } from '../src/constants';

import { deployAndConfigureContractsAsync, StakingApiWrapper } from './utils/api_wrapper';
import { ERC20Wrapper } from '@0x/contracts-asset-proxy';

// tslint:disable:no-unnecessary-type-assertion
describe('Epochs', () => {
    // tokens & addresses
    let accounts: string[];
    let owner: string;
    // wrappers
    let stakingApiWrapper: StakingApiWrapper;
    let erc20Wrapper: ERC20Wrapper;

    beforeEach(async () => {
        // create fresh accounts for each test
        const { ethers } = require('hardhat');
        const signers = await ethers.getSigners();
        accounts = signers.map((s: any) => s.address);
        owner = accounts[0];
        
        // set up ERC20Wrapper for each test
        erc20Wrapper = new ERC20Wrapper(ethers.provider, accounts, owner);
        
        // deploy fresh staking contracts for each test
        stakingApiWrapper = await deployAndConfigureContractsAsync(
            { provider: ethers.provider }, 
            owner, 
            erc20Wrapper
        );
    });
    describe('Epochs & TimeLocks', () => {
        it('basic epochs & timeLock periods', async () => {
            ///// 1/3 Validate Assumptions /////
            const params = await stakingApiWrapper.utils.getParamsAsync();
            expect(Number(params.epochDurationInSeconds)).to.equal(
                Number(stakingConstants.DEFAULT_PARAMS.epochDurationInSeconds),
            );
            ///// 2/3 Validate Initial Epoch & TimeLock Period /////
            {
                // epoch
                const currentEpoch = await stakingApiWrapper.stakingContract.currentEpoch();
                expect(Number(currentEpoch)).to.equal(Number(stakingConstants.INITIAL_EPOCH));
            }
            ///// 3/3 Increment Epoch (TimeLock Should Not Increment) /////
            await stakingApiWrapper.utils.skipToNextEpochAndFinalizeAsync();
            {
                // epoch
                const currentEpoch = await stakingApiWrapper.stakingContract.currentEpoch();
                expect(Number(currentEpoch)).to.equal(Number(stakingConstants.INITIAL_EPOCH) + 1);
            }
        });
    });
});
// tslint:enable:no-unnecessary-type-assertion
