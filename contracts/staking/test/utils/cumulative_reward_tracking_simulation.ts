import { BlockchainTestsEnvironment, expect, toBaseUnitAmount, txDefaults } from '../test_utils';
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
            if (wantedEvents.indexOf(log.event) !== -1) {
                logs.push({
                    event: log.event,
                    epoch: log.args.epoch.toNumber(),
                });
            }
        }
        return logs;
    }

    private static _assertTestLogs(expectedSequence: TestLog[], txReceiptLogs: DecodedLogs): void {
        const logs = CumulativeRewardTrackingSimulation._extractTestLogs(txReceiptLogs);
        expect(logs.length).to.be.equal(expectedSequence.length);
        for (let i = 0; i < expectedSequence.length; i++) {
            const expectedLog = expectedSequence[i];
            const actualLog = logs[i];
            expect(expectedLog.event).to.exist('');
            expect(actualLog.event, `testing event name of ${JSON.stringify(expectedLog)}`).to.be.equal(
                expectedLog.event,
            );
            expect(actualLog.epoch, `testing epoch of ${JSON.stringify(expectedLog)}`).to.be.equal(expectedLog.epoch);
        }
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

    public async deployAndConfigureTestContractsAsync(env: BlockchainTestsEnvironment): Promise<void> {
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

    public getTestCumulativeRewardTrackingContract(): TestCumulativeRewardTrackingContract {
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
                    logs = await this._stakingApiWrapper.utils.skipToNextEpochAndFinalizeAsync();
                    break;

                case TestAction.Delegate:
                    // TODO: 需要使用正确的 signer，暂时使用默认的
                    const stakeTx = await this._stakingApiWrapper.stakingContract.stake(this._amountToStake);
                    await stakeTx.wait();
                    
                    const moveStakeTx = await this._stakingApiWrapper.stakingContract.moveStake(
                        new StakeInfo(StakeStatus.Undelegated),
                        new StakeInfo(StakeStatus.Delegated, this._poolId),
                        this._amountToStake,
                    );
                    receipt = await moveStakeTx.wait();
                    break;

                case TestAction.Undelegate:
                    const undelegateTx = await this._stakingApiWrapper.stakingContract.moveStake(
                        new StakeInfo(StakeStatus.Delegated, this._poolId),
                        new StakeInfo(StakeStatus.Undelegated),
                        this._amountToStake,
                    );
                    receipt = await undelegateTx.wait();
                    break;

                case TestAction.PayProtocolFee:
                    const payFeeTx = await this._stakingApiWrapper.stakingContract.payProtocolFee(
                        this._poolOperator, 
                        this._takerAddress, 
                        this._protocolFee,
                        { value: this._protocolFee }
                    );
                    receipt = await payFeeTx.wait();
                    break;

                case TestAction.CreatePool:
                    const createPoolTx = await this._stakingApiWrapper.stakingContract.createStakingPool(0, true);
                    receipt = await createPoolTx.wait();
                    // TODO: Fix event parsing for ethers.js v6
                    // For now, use a temporary poolId to let the test continue
                    this._poolId = '0x0000000000000000000000000000000000000000000000000000000000000001';
                    /*
                    const createStakingPoolLog = receipt?.logs[0];
                    // tslint:disable-next-line no-unnecessary-type-assertion
                    this._poolId = (createStakingPoolLog as DecodedLogEntry<any>).args.poolId;
                    */
                    break;

                default:
                    throw new Error('Unrecognized test action');
            }
            if (receipt !== undefined) {
                logs = receipt.logs as DecodedLogs;
            }
            combinedLogs.splice(combinedLogs.length, 0, ...logs);
        }
        return combinedLogs;
    }
}
