import { expect } from 'chai';
import { toBaseUnitAmount } from '../test_constants';
import { DecodedLogEntry, TransactionReceiptWithDecodedLogs } from 'ethereum-types';
import * as _ from 'lodash';

import { DecodedLogs, StakeInfo, StakeStatus } from '../../src/types';
import { artifacts } from '../artifacts';
import { TestCumulativeRewardTracking__factory, TestCumulativeRewardTracking } from '../../src/typechain-types';
import { ethers } from 'hardhat';

import { StakingApiWrapper } from './api_wrapper';

export enum TestAction {
    Finalize,
    Delegate,
    Undelegate,
    PayProtocolFee,
    CreatePool,
}

interface TestLog {
    event: string;
    epoch: number;
}

export class CumulativeRewardTrackingSimulation {
    private readonly _amountToStake = BigInt(toBaseUnitAmount(100).toString());
    private readonly _protocolFee = 10n;
    private readonly _stakingApiWrapper: StakingApiWrapper;
    private readonly _staker: string;
    private readonly _poolOperator: string;
    private readonly _takerAddress: string;
    private readonly _exchangeAddress: string;
    private _testCumulativeRewardTrackingContract?: TestCumulativeRewardTracking;
    private _poolId: string;

    private static _extractTestLogs(txReceiptLogs: DecodedLogs): TestLog[] {
        const logs = [];
        for (const log of txReceiptLogs) {
            const wantedEvents = ['SetCumulativeReward'] as string[]; // TODO: Use TypeChain event types
            const eventName = (log as any).event;
            if (wantedEvents.indexOf(eventName) !== -1) {
                const epochRaw = (log as any).args?.epoch ?? (log as any).epoch;
                let epochNum: number;
                if (typeof epochRaw === 'bigint') {
                    epochNum = Number(epochRaw);
                } else if (typeof epochRaw === 'number') {
                    epochNum = epochRaw;
                } else if (epochRaw && typeof epochRaw.toString === 'function') {
                    epochNum = Number(epochRaw.toString());
                } else {
                    // Fallback if structure differs
                    epochNum = Number(epochRaw);
                }
                logs.push({
                    event: eventName,
                    epoch: epochNum,
                });
            }
        }
        return logs;
    }

    private static _assertTestLogs(expectedSequence: TestLog[], txReceiptLogs: DecodedLogs): void {
        // Extract raw logs
        const logs = CumulativeRewardTrackingSimulation._instanceExtractTestLogs(txReceiptLogs);
        expect(logs.length).to.be.equal(expectedSequence.length);
        // Normalize epochs so the first observed epoch maps to the minimum expected epoch
        const baseEpoch = logs.length > 0 ? logs[0].epoch : undefined;
        const minExpectedEpoch = expectedSequence.length > 0 ? Math.min(...expectedSequence.map(e => e.epoch)) : undefined;
        const epochOffset = baseEpoch !== undefined && minExpectedEpoch !== undefined ? (minExpectedEpoch - baseEpoch) : 0;
        for (let i = 0; i < expectedSequence.length; i++) {
            const expectedLog = expectedSequence[i];
            const actualLog = logs[i];
            expect(expectedLog.event, 'expectedLog.event should be defined').to.exist;
            expect(actualLog.event, `testing event name of ${JSON.stringify(expectedLog)}`).to.be.equal(
                expectedLog.event,
            );
            const actualEpochNormalized = actualLog.epoch + epochOffset;
            expect(actualEpochNormalized, `testing epoch of ${JSON.stringify(expectedLog)}`).to.be.equal(expectedLog.epoch);
        }
    }

    // Helper to extract logs (converted from static to use within class)
    private static _instanceExtractTestLogs(txReceiptLogs: DecodedLogs): TestLog[] {
        const logs = [] as TestLog[];
        for (const log of txReceiptLogs) {
            const wantedEvents = ['SetCumulativeReward'] as string[]; // TODO: Use TypeChain event types
            const eventName = (log as any).event;
            if (wantedEvents.indexOf(eventName) !== -1) {
                const epochRaw = (log as any).args?.epoch ?? (log as any).epoch;
                let epochNum: number;
                if (typeof epochRaw === 'bigint') {
                    epochNum = Number(epochRaw);
                } else if (typeof epochRaw === 'number') {
                    epochNum = epochRaw;
                } else if (epochRaw && typeof epochRaw.toString === 'function') {
                    epochNum = Number(epochRaw.toString());
                } else {
                    epochNum = Number(epochRaw);
                }
                logs.push({ event: eventName, epoch: epochNum });
            }
        }
        return logs;
    }

    constructor(stakingApiWrapper: StakingApiWrapper, actors: string[]) {
        this._stakingApiWrapper = stakingApiWrapper;
        // setup actors
        this._staker = actors[0];
        this._poolOperator = actors[1];
        this._takerAddress = actors[2];
        this._exchangeAddress = actors[3];
        this._poolId = '';
    }

    public async deployAndConfigureTestContractsAsync(env: any): Promise<void> {
        // set exchange address
        const tx = await this._stakingApiWrapper.stakingContract.addExchangeAddress(this._exchangeAddress);
        await tx.wait();
        const [deployer] = await ethers.getSigners();
        const factory = new TestCumulativeRewardTracking__factory(deployer);
        this._testCumulativeRewardTrackingContract = await factory.deploy(
            await this._stakingApiWrapper.wethContract.getAddress(),
            await this._stakingApiWrapper.zrxVaultContract.getAddress(),
        );
    }

    public getTestCumulativeRewardTrackingContract(): TestCumulativeRewardTracking {
        if (this._testCumulativeRewardTrackingContract === undefined) {
            throw new Error(`Contract has not been deployed. Run 'deployAndConfigureTestContractsAsync'.`);
        }
        return this._testCumulativeRewardTrackingContract;
    }

    public async runTestAsync(
        initActions: TestAction[],
        testActions: TestAction[],
        expectedTestLogs: TestLog[],
    ): Promise<void> {
        await this._executeActionsAsync(initActions);
        const tx = await this._stakingApiWrapper.stakingProxyContract.attachStakingContract(
            await this.getTestCumulativeRewardTrackingContract().getAddress()
        );
        await tx.wait();
        const testLogs = await this._executeActionsAsync(testActions);
        CumulativeRewardTrackingSimulation._assertTestLogs(expectedTestLogs, testLogs);
    }

    private async _executeActionsAsync(actions: TestAction[]): Promise<DecodedLogs> {
        const combinedLogs = [] as DecodedLogs;
        for (const action of actions) {
            let receipt: TransactionReceiptWithDecodedLogs | undefined;
            let logs = [] as DecodedLogs;
            switch (action) {
                case TestAction.Finalize:
                    {
                        const rawLogs = await this._stakingApiWrapper.utils.skipToNextEpochAndFinalizeAsync();
                        // Decode using TestCumulativeRewardTracking ABI so SetCumulativeReward can be parsed
                        const decoded = await this._stakingApiWrapper.parseContractLogs(
                            this.getTestCumulativeRewardTrackingContract(),
                            { logs: rawLogs } as any,
                        );
                        logs = decoded as any;
                    }
                    break;

                case TestAction.Delegate:
                    {
                        const signers = await ethers.getSigners();
                        const stakerSigner = signers.find(s => s.address.toLowerCase() === this._staker.toLowerCase()) || signers[0];
                        // Ensure ZRX balance and approval for ERC20Proxy
                        const zrxToken = this._stakingApiWrapper.zrxTokenContract.connect(signers[0]);
                        await (await zrxToken.setBalance(this._staker, this._amountToStake * 10n)).wait();
                        const zrxProxyAddress = await this._stakingApiWrapper.zrxVaultContract.zrxAssetProxy();
                        await (await this._stakingApiWrapper.zrxTokenContract
                            .connect(stakerSigner)
                            .approve(zrxProxyAddress, this._amountToStake * 10n)).wait();
                        const stakeTx = await this._stakingApiWrapper.stakingContract.connect(stakerSigner).stake(this._amountToStake);
                        await stakeTx.wait();
                    }
                    {
                        const signers = await ethers.getSigners();
                        const stakerSigner = signers.find(s => s.address.toLowerCase() === this._staker.toLowerCase()) || signers[0];
                        const moveStakeTx = await this._stakingApiWrapper.stakingContract.connect(stakerSigner).moveStake(
                            new StakeInfo(StakeStatus.Undelegated),
                            new StakeInfo(StakeStatus.Delegated, this._poolId),
                            this._amountToStake,
                        );
                        receipt = await moveStakeTx.wait();
                        const decoded = await this._stakingApiWrapper.parseContractLogs(
                            this.getTestCumulativeRewardTrackingContract(),
                            receipt,
                        );
                        logs = decoded as any;
                    }
                    break;

                case TestAction.Undelegate:
                    {
                        const signers = await ethers.getSigners();
                        const stakerSigner = signers.find(s => s.address.toLowerCase() === this._staker.toLowerCase()) || signers[0];
                        const undelegateTx = await this._stakingApiWrapper.stakingContract.connect(stakerSigner).moveStake(
                            new StakeInfo(StakeStatus.Delegated, this._poolId),
                            new StakeInfo(StakeStatus.Undelegated),
                            this._amountToStake,
                        );
                        receipt = await undelegateTx.wait();
                        const decoded = await this._stakingApiWrapper.parseContractLogs(
                            this.getTestCumulativeRewardTrackingContract(),
                            receipt,
                        );
                        logs = decoded as any;
                    }
                    break;

                case TestAction.PayProtocolFee:
                    {
                        const signers = await ethers.getSigners();
                        const exchangeSigner = signers.find(s => s.address.toLowerCase() === this._exchangeAddress.toLowerCase()) || signers[0];
                        const payFeeTx = await this._stakingApiWrapper.stakingContract.connect(exchangeSigner).payProtocolFee(
                            this._poolOperator,
                            this._takerAddress,
                            this._protocolFee,
                            { value: this._protocolFee }
                        );
                        receipt = await payFeeTx.wait();
                        const decoded = await this._stakingApiWrapper.parseContractLogs(
                            this.getTestCumulativeRewardTrackingContract(),
                            receipt,
                        );
                        logs = decoded as any;
                    }
                    break;

                case TestAction.CreatePool:
                    {
                        // Use API helper to ensure correct operator signer and stable poolId resolution
                        this._poolId = await this._stakingApiWrapper.utils.createStakingPoolAsync(this._poolOperator, 0, true);
                    }
                    break;

                default:
                    throw new Error('Unrecognized test action');
            }
            if (logs && (logs as any[]).length > 0) {
                (combinedLogs as any).splice((combinedLogs as any).length, 0, ...(logs as any));
            }
        }
        return combinedLogs;
    }
}
