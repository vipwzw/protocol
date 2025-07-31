import { ethers } from 'ethers';
import * as _ from 'lodash';

// Node types for compatibility
export enum NodeType {
    Ganache = 'ganache',
    Geth = 'geth',
    Hardhat = 'hardhat'
}

export class BlockchainLifecycle {
    private readonly _provider: ethers.JsonRpcProvider;
    private readonly _snapshotIdsStack: string[];
    private _addresses: string[] = [];
    private _nodeType: NodeType | undefined;

    constructor(provider?: ethers.JsonRpcProvider) {
        // Use JsonRpcProvider to have access to send method
        this._provider = provider || new ethers.JsonRpcProvider('http://localhost:8545');
        this._snapshotIdsStack = [];
    }

    public async startAsync(): Promise<void> {
        const nodeType = await this._getNodeTypeAsync();
        
        if (nodeType === NodeType.Hardhat || nodeType === NodeType.Ganache) {
            // Use evm_snapshot for Hardhat/Ganache
            const snapshotId = await this._provider.send("evm_snapshot", []);
            this._snapshotIdsStack.push(snapshotId);
        } else {
            // For other nodes, store the current block number
            const blockNumber = await this._provider.getBlockNumber();
            this._snapshotIdsStack.push(blockNumber.toString());
        }
    }

    public async revertAsync(): Promise<void> {
        const nodeType = await this._getNodeTypeAsync();
        
        if (nodeType === NodeType.Hardhat || nodeType === NodeType.Ganache) {
            const snapshotId = this._snapshotIdsStack.pop();
            if (!snapshotId) {
                throw new Error('No snapshot to revert to');
            }
            
            const didRevert = await this._provider.send("evm_revert", [snapshotId]);
            if (!didRevert) {
                throw new Error(`Snapshot with id #${snapshotId} failed to revert`);
            }
        } else {
            throw new Error(`Revert not supported for node type: ${nodeType}`);
        }
    }

    public async mineBlockAsync(): Promise<void> {
        await this._provider.send("evm_mine", []);
    }

    public async getBlockNumberAsync(): Promise<number> {
        return await this._provider.getBlockNumber();
    }

    private async _getNodeTypeAsync(): Promise<NodeType> {
        if (this._nodeType === undefined) {
            try {
                // Try to detect node type - default to Hardhat for testing
                const network = await this._provider.getNetwork();
                if (network.chainId === 31337n) {
                    this._nodeType = NodeType.Hardhat;
                } else {
                    this._nodeType = NodeType.Ganache; // Fallback
                }
            } catch (error) {
                this._nodeType = NodeType.Hardhat; // Default fallback
            }
        }
        return this._nodeType;
    }
}