import { Web3Wrapper } from '@0x/web3-wrapper';

export class BlockchainLifecycle {
    private _web3Wrapper: Web3Wrapper;
    private _snapshotIds: number[] = [];

    constructor(web3Wrapper: Web3Wrapper) {
        this._web3Wrapper = web3Wrapper;
    }

    public async startAsync(): Promise<void> {
        const snapshotId = await this._web3Wrapper.takeSnapshotAsync();
        this._snapshotIds.push(snapshotId);
    }

    public async revertAsync(): Promise<void> {
        const snapshotId = this._snapshotIds.pop();
        if (snapshotId === undefined) {
            throw new Error('No snapshot to revert to');
        }
        const didRevert = await this._web3Wrapper.revertSnapshotAsync(snapshotId);
        if (!didRevert) {
            throw new Error(`Revert to snapshot ${snapshotId} failed`);
        }
    }
}
