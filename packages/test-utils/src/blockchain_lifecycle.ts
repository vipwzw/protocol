const { ethers } = require('hardhat');

/**
 * 现代化的区块链生命周期管理，兼容原有接口
 */
export class BlockchainLifecycle {
    private _snapshotIds: string[] = [];

    /**
     * 开始新的快照
     */
    public async startAsync(): Promise<void> {
        try {
            const snapshotId = await ethers.provider.send('evm_snapshot', []);
            this._snapshotIds.push(snapshotId);
        } catch (error) {
            console.warn('Failed to take snapshot:', error);
            throw error;
        }
    }

    /**
     * 恢复到最近的快照
     */
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

    /**
     * 获取当前快照数量
     */
    public getSnapshotCount(): number {
        return this._snapshotIds.length;
    }

    /**
     * 清除所有快照
     */
    public clearSnapshots(): void {
        this._snapshotIds = [];
    }

    /**
     * 恢复到指定的快照 ID
     */
    public async revertToSnapshotAsync(snapshotId: string): Promise<void> {
        try {
            const didRevert = await ethers.provider.send('evm_revert', [snapshotId]);
            if (!didRevert) {
                throw new Error(`Revert to snapshot ${snapshotId} failed`);
            }
            // 移除这个快照之后的所有快照
            const index = this._snapshotIds.indexOf(snapshotId);
            if (index !== -1) {
                this._snapshotIds = this._snapshotIds.slice(0, index);
            }
        } catch (error) {
            console.warn('Failed to revert to snapshot:', error);
            throw error;
        }
    }
}