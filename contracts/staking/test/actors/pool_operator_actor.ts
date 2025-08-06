import { expect } from '../test_utils';
import { RevertError } from './staker_actor'; // Import from where we defined it
import * as _ from 'lodash';

import { BaseActor } from './base_actor';

export class PoolOperatorActor extends BaseActor {
    public async createStakingPoolAsync(
        operatorShare: number,
        addOperatorAsMaker: boolean,
        revertError?: RevertError,
    ): Promise<string> {
        // create pool
        const poolIdPromise = this._stakingApiWrapper.utils.createStakingPoolAsync(
            this._owner,
            operatorShare,
            addOperatorAsMaker,
        );
        if (revertError !== undefined) {
            // For LibRichErrors.rrevert calls, we need to check the error data
            // The error selector for OperatorShareError is 0x22df9597
            try {
                await poolIdPromise;
                throw new Error('Expected transaction to revert');
            } catch (error: any) {
                // Check if the error data contains the expected selector
                const expectedSelector = '0x22df9597'; // OperatorShareError selector
                if (error.data && error.data.includes(expectedSelector.slice(2))) {
                    // This is the expected OperatorShareError
                    return '';
                } else {
                    // Re-throw if it's not the expected error
                    throw error;
                }
            }
        }
        const poolId = await poolIdPromise;
        // validate pool id
        const lastPoolId = await this._stakingApiWrapper.stakingContract.lastPoolId();
        expect(poolId, 'pool id').to.equal(lastPoolId);

        if (addOperatorAsMaker) {
            // check the pool id of the operator
            const poolIdOfMaker = await this._stakingApiWrapper.stakingContract.poolIdByMaker(this._owner);
            expect(poolIdOfMaker, 'pool id of maker').to.be.equal(poolId);
        }
        return poolId;
    }
    public async decreaseStakingPoolOperatorShareAsync(
        poolId: string,
        newOperatorShare: number,
        revertError?: RevertError,
    ): Promise<void> {
        // decrease operator share
        const signer = await this._getSigner();
        const tx = this._stakingApiWrapper.stakingContract.connect(signer).decreaseStakingPoolOperatorShare(poolId, newOperatorShare);
        if (revertError !== undefined) {
            // For LibRichErrors.rrevert calls, we need to check the error data
            try {
                await tx;
                throw new Error('Expected transaction to revert');
            } catch (error: any) {
                // Check for specific error types based on the error message
                if (revertError.message === 'OperatorShareError') {
                    const expectedSelector = '0x22df9597'; // OperatorShareError selector
                    if (error.data && error.data.includes(expectedSelector.slice(2))) {
                        return;
                    }
                } else if (revertError.message === 'OnlyCallableByPoolOperatorError') {
                    const expectedSelector = '0x82ded785'; // OnlyCallableByPoolOperatorError selector
                    if (error.data && error.data.includes(expectedSelector.slice(2))) {
                        return;
                    }
                }
                // Re-throw if it's not the expected error
                throw error;
            }
        }
        const receipt = await tx;
        await receipt.wait();
        // Check operator share
        const pool = await this._stakingApiWrapper.stakingContract.getStakingPool(poolId);
        expect(pool.operatorShare, 'updated operator share').to.equal(newOperatorShare);
    }
}
