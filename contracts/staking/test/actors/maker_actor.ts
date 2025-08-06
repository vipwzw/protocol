import { expect } from '../test_utils';
import { RevertError } from './staker_actor'; // Import from where we defined it
import * as _ from 'lodash';

import { PoolOperatorActor } from './pool_operator_actor';

export class MakerActor extends PoolOperatorActor {
    public async joinStakingPoolAsMakerAsync(poolId: string, revertError?: RevertError): Promise<void> {
        // add maker
        const signer = await this._getSigner();
        const tx = this._stakingApiWrapper.stakingContract.connect(signer).joinStakingPoolAsMaker(poolId);
        if (revertError !== undefined) {
            await expect(tx).to.be.reverted;
            return;
        }
        const receipt = await tx;
        await receipt.wait();
        // check the pool id of the maker
        const poolIdOfMaker = await this._stakingApiWrapper.stakingContract.poolIdByMaker(this.getOwner());
        expect(poolIdOfMaker, 'pool id of maker').to.be.equal(poolId);
    }
}
