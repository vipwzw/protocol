import { constants, randomAddress } from '@0x/utils';
import { expect } from 'chai';
import { OwnableRevertErrors } from '@0x/utils';
import { ethers } from 'hardhat';

import { IOwnableFeatureContract, IZeroExContract, FundRecoveryFeature__factory } from '../../src/wrappers';
import { artifacts } from '../artifacts';
import { FundRecoveryFeature } from '../../src/typechain-types/contracts/src/features/FundRecoveryFeature';
import { abis } from '../utils/abis';
import { fullMigrateAsync } from '../utils/migration';
import { TestMintableERC20Token } from '../../src/typechain-types/contracts/test/tokens/TestMintableERC20Token';

describe('FundRecovery', async () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
        web3Wrapper: {
            getBalanceInWeiAsync: async (addr: string) => ethers.provider.getBalance(addr),
            awaitTransactionMinedAsync: async (hash: string) => ethers.provider.waitForTransaction(hash),
            sendTransactionAsync: async (tx: any) => (await ethers.getSigner(tx.from)).sendTransaction(tx).then(r => r.hash),
        },
    } as any;
    let owner: string;
    let zeroEx: IZeroExContract;
    let token: TestMintableERC20Token;
    before(async () => {
        const accounts = await env.getAccountAddressesAsync();
        env.txDefaults.from = accounts[0];
        const INITIAL_ERC20_BALANCE = ethers.parseUnits('10000', 18);
        [owner] = await env.getAccountAddressesAsync();
        zeroEx = await fullMigrateAsync(owner, env.provider, env.txDefaults, {});
        // 使用 TypeChain factory 部署合约
        const TokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        token = await TokenFactory.deploy() as TestMintableERC20Token;
        await token.mint(await zeroEx.getAddress(), INITIAL_ERC20_BALANCE);
        const signer = await env.provider.getSigner(owner);
        const featureFactory = new FundRecoveryFeature__factory(signer);
        const featureImpl = await featureFactory.deploy();
        await featureImpl.waitForDeployment();
        const ownerSigner = await env.provider.getSigner(owner);
        await zeroEx
            .connect(ownerSigner)
            .migrate(await featureImpl.getAddress(), featureImpl.interface.encodeFunctionData('migrate'), owner);
    });
    describe('Should delegatecall `transferTrappedTokensTo` from the exchange proxy', () => {
        const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const recipientAddress = randomAddress();
        it('Tranfers an arbitrary ERC-20 Token', async () => {
            const amountOut = Web3Wrapper.toBaseUnitAmount(100n, 18);
            await zeroEx
                .transferTrappedTokensTo(token.address, amountOut, recipientAddress)
                ({ from: owner });
            const recipientAddressBalanceAferTransfer = await token.balanceOf(recipientAddress)();
            return expect(recipientAddressBalanceAferTransfer).to.equal(amountOut);
        });
        it('Amount -1 transfers entire balance of ERC-20', async () => {
            const balanceOwner = await token.balanceOf(zeroEx.address)();
            await zeroEx
                .transferTrappedTokensTo(token.address, constants.MAX_UINT256, recipientAddress)
                ({ from: owner });
            const recipientAddressBalanceAferTransfer = await token.balanceOf(recipientAddress)();
            return expect(recipientAddressBalanceAferTransfer).to.equal(balanceOwner);
        });
        it('Amount -1 transfers entire balance of ETH', async () => {
            const amountOut = 20n;
            const ownerSigner = await ethers.getSigner(owner);
            const tx = await ownerSigner.sendTransaction({
                to: await zeroEx.getAddress(),
                value: amountOut,
            });
            await tx.wait();
            const balanceOwner = await ethers.provider.getBalance(zeroEx.address);
            await zeroEx
                .transferTrappedTokensTo(ETH_TOKEN_ADDRESS, constants.MAX_UINT256, recipientAddress)
                ({ from: owner });
            const recipientAddressBalanceAferTransfer = await ethers.provider.getBalance(recipientAddress);
            return expect(recipientAddressBalanceAferTransfer).to.equal(balanceOwner);
        });
        it('Transfers ETH ', async () => {
            const amountOut = 20n;
            const ownerSigner = await ethers.getSigner(owner);
            const tx = await ownerSigner.sendTransaction({
                to: await zeroEx.getAddress(),
                value: amountOut,
            });
            await tx.wait();
            const ownerSigner2 = await env.provider.getSigner(owner);
            await zeroEx
                .connect(ownerSigner2)
                .transferTrappedTokensTo(ETH_TOKEN_ADDRESS, amountOut - 1, recipientAddress);
            const recipientAddressBalance = await ethers.provider.getBalance(recipientAddress);
            return expect(recipientAddressBalance).to.eq(amountOut - 1);
        });
        it('Feature `transferTrappedTokensTo` can only be called by owner', async () => {
            const notOwner = randomAddress();
            const notOwnerSigner = await env.provider.getSigner(notOwner);
            return expect(
                zeroEx
                    .connect(notOwnerSigner)
                    .transferTrappedTokensTo(ETH_TOKEN_ADDRESS, constants.MAX_UINT256, recipientAddress)
            ).to.be.revertedWith(new OwnableRevertErrors.OnlyOwnerError(notOwner, owner));
        });
    });
});
