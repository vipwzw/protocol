import { expect } from '@0x/test-utils';
import { RevertError } from '@0x/utils';
import * as _ from 'lodash';

import { PoolOperatorActor } from './pool_operator_actor';

export class MakerActor extends PoolOperatorActor {
    public async joinStakingPoolAsMakerAsync(poolId: string, revertError?: RevertError): Promise<void> {
        // add maker
        const tx = this._stakingApiWrapper.stakingContract.joinStakingPoolAsMaker(poolId);
        if (revertError !== undefined) {
            await expect(tx).to.revertWith(revertError);
            return;
        }
        const receipt = await tx;
        await receipt.wait();
        // check the pool id of the maker
        const poolIdOfMaker = await this._stakingApiWrapper.stakingContract.poolIdByMaker(this.getOwner());
        expect(poolIdOfMaker, 'pool id of maker').to.be.equal(poolId);
    }
}
