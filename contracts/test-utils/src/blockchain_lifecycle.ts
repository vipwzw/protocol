const { ethers } = require('hardhat');

export class BlockchainLifecycle {
    private _snapshotIds: string[] = [];

    public async startAsync(): Promise<void> {
        try {
            const snapshotId = await ethers.provider.send('evm_snapshot', []);
            this._snapshotIds.push(snapshotId);
        } catch (error) {
            console.warn('Failed to take snapshot:', error);
            throw error;
        }
    }

    public async revertAsync(): Promise<void> {
        const snapshotId = this._snapshotIds.pop();
        if (snapshotId === undefined) {
            throw new Error('No snapshot to revert to');
        }
        try {
            const didRevert = await ethers.provider.send('evm_revert', [snapshotId]);
            if (!didRevert) {
                throw new Error(`Revert to snapshot ${snapshotId} failed`);
            }
        } catch (error) {
            console.warn('Failed to revert snapshot:', error);
            throw error;
        }
    }
}
