import { StakingApiWrapper } from '../utils/api_wrapper';

export class BaseActor {
    protected readonly _owner: string;
    protected readonly _stakingApiWrapper: StakingApiWrapper;
    protected readonly _signer: any;

    constructor(owner: string, stakingApiWrapper: StakingApiWrapper) {
        this._owner = owner;
        this._stakingApiWrapper = stakingApiWrapper;
        this._signer = null; // Will be set asynchronously
    }

    protected async _getSigner(): Promise<any> {
        if (this._signer) {
            return this._signer;
        }

        const { ethers } = require('hardhat');
        const signers = await ethers.getSigners();
        const signer = signers.find((s: any) => s.address.toLowerCase() === this._owner.toLowerCase());

        if (!signer) {
            throw new Error(`Could not find signer for address: ${this._owner}`);
        }

        return signer;
    }
    public getOwner(): string {
        return this._owner;
    }
    public getStakingApiWrapper(): StakingApiWrapper {
        return this._stakingApiWrapper;
    }
}
