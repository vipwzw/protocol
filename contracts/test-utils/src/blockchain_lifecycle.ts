const { ethers } = require('hardhat');

export class BlockchainLifecycle {
    private _snapshotIds: string[] = [];

    public async startAsync(): Promise<void> {
        try {
            const snapshotId = await ethers.provider.send('evm_snapshot', []);
            this._snapshotIds.push(snapshotId);
        } catch (error) {
            console.warn('Failed to take snapshot:', error);
            // Don't throw error in tests, just log it
        }
    }

    public async revertAsync(): Promise<void> {
        const snapshotId = this._snapshotIds.pop();
        if (snapshotId === undefined) {
            return; // No snapshot to revert to
        }
        try {
            const didRevert = await ethers.provider.send('evm_revert', [snapshotId]);
            if (!didRevert) {
                console.warn(`Revert to snapshot ${snapshotId} failed`);
            }
        } catch (error) {
            console.warn('Failed to revert snapshot:', error);
            // Don't throw error in tests
        }
    }
}
