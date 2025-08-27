import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants } from './test_constants';

// logUtils replacement - simple console logging
export const logUtils = {
    warn: (message: string) => console.warn(message),
    log: (message: string) => console.log(message),
    error: (message: string) => console.error(message),
};
import * as _ from 'lodash';

import { artifacts } from './artifacts';
import { StakingPatchContract, StakingProxyContract, filterLogsToArguments } from './wrappers';

const abis = _.mapValues(_.pickBy(artifacts, v => v && v.compilerOutput), v => v.compilerOutput.abi);
const STAKING_PROXY = '0xa26e80e7dea86279c6d778d702cc413e6cffa777';
const STAKING_OWNER = '0x7d3455421bbc5ed534a83c88fd80387dc8271392';
const EXCHANGE_PROXY = '0xdef1c0ded9bec7f1a1670819833240f027b25eff';

describe('Staking patch mainnet fork tests', () => {
    let stakingProxyContract: any;
    let patchedStakingPatchContract: any;

    before(async () => {
        const [signer] = await ethers.getSigners();
        stakingProxyContract = new ethers.Contract(STAKING_PROXY, artifacts.StakingProxy.abi || artifacts.StakingProxy.compilerOutput?.abi, signer);
        const factory = new ethers.ContractFactory(
            artifacts.Staking.abi || artifacts.Staking.compilerOutput?.abi,
            artifacts.Staking.bytecode || artifacts.Staking.compilerOutput?.evm?.bytecode?.object,
            signer,
        );
        patchedStakingPatchContract = await factory.deploy();
        await patchedStakingPatchContract.waitForDeployment();
    });

    it('Staking proxy successfully attaches to patched logic', async () => {
        const tx = await stakingProxyContract.attachStakingContract(await patchedStakingPatchContract.getAddress());
        const receipt = await tx.wait();
        expect(receipt?.status).to.equal(1);
        logUtils.log(`${receipt.gasUsed?.toString()} gas used`);
    });

    it('Patched staking handles 0 gas protocol fees', async () => {
        const [signer] = await ethers.getSigners();
        const staking = new ethers.Contract(STAKING_PROXY, artifacts.Staking.abi || artifacts.Staking.compilerOutput?.abi, signer);
        const maker = '0x7b1886e49ab5433bb46f7258548092dc8cdca28b';
        const zeroFeeTx = await staking.payProtocolFee(maker, constants.NULL_ADDRESS, constants.ZERO_AMOUNT);
        const zeroFeeReceipt = await zeroFeeTx.wait();
        expect(zeroFeeReceipt?.status).to.equal(1);

        // Coincidentally there's some ETH in the ExchangeProxy
        const nonZeroFeeTx = await staking.payProtocolFee(maker, constants.NULL_ADDRESS, 1n, { value: 1 });
        const nonZeroFeeReceipt = await nonZeroFeeTx.wait();
        expect(nonZeroFeeReceipt?.status).to.equal(1);
    });
});
// tslint:enable:no-unnecessary-type-assertion
