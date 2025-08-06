import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import { TestChaiBridge__factory } from '../src/typechain-types';

// 本地 RevertReason 定义，替代 @0x/utils
const RevertReason = {
    ChaiBridgeOnlyCallableByErc20BridgeProxy: 'ChaiBridge/ONLY_CALLABLE_BY_ERC20_BRIDGE_PROXY',
    ChaiBridgeDrawDaiFailed: 'ChaiBridge/DRAW_DAI_FAILED'
};

// 本地 AssetProxyId 定义  
const AssetProxyId = {
    ERC20Bridge: '0xdc1600f3'
};

// 使用测试合约类型
type TestChaiBridgeContract = any;

describe('ChaiBridge unit tests', () => {
    let chaiBridgeContract: TestChaiBridgeContract;
    let testDaiContract: any;
    let fromSigner: Signer;
    let toSigner: Signer;
    let fromAddress: string;
    let toAddress: string;

    const alwaysRevertAddress = '0x0000000000000000000000000000000000000001';
    const amount = 1n;

    before(async () => {
        const signers = await ethers.getSigners();
        [fromSigner, toSigner] = signers;
        fromAddress = await fromSigner.getAddress();
        toAddress = await toSigner.getAddress();
        
        // 使用现代化的部署方式部署 TestChaiBridge
        const factory = await ethers.getContractFactory('TestChaiBridge');
        chaiBridgeContract = await factory.deploy();
        await chaiBridgeContract.waitForDeployment();
        
        // 获取 testChaiDai 合约地址
        const testChaiDaiAddress = await chaiBridgeContract.testChaiDai();
        testDaiContract = await ethers.getContractAt('TestChaiDai', testChaiDaiAddress);
    });

    describe('bridgeTransferFrom()', () => {
        it('fails if not called by ERC20BridgeProxy', async () => {
            // 使用 alwaysRevertAddress 作为调用者，它应该被拒绝
            await ethers.provider.send('hardhat_impersonateAccount', [alwaysRevertAddress]);
            await ethers.provider.send('hardhat_setBalance', [alwaysRevertAddress, '0x1000000000000000000']); // 给账户一些 ETH
            
            const alwaysRevertSigner = await ethers.getSigner(alwaysRevertAddress);
            
            await expect(
                chaiBridgeContract.connect(alwaysRevertSigner).bridgeTransferFrom(
                    ethers.ZeroAddress, // randomAddress() 
                    fromAddress, 
                    toAddress, 
                    amount, 
                    '0x' // constants.NULL_BYTES
                )
            ).to.be.revertedWith(RevertReason.ChaiBridgeOnlyCallableByErc20BridgeProxy);
        });
        
        it('returns magic bytes upon success', async () => {
            const magicBytes = await chaiBridgeContract.bridgeTransferFrom.staticCall(
                ethers.ZeroAddress, // randomAddress()
                fromAddress, 
                toAddress, 
                amount, 
                '0x' // constants.NULL_BYTES
            );
            expect(magicBytes).to.eq(AssetProxyId.ERC20Bridge);
        });
        
        it('should increase the Dai balance of `toAddress` by `amount` if successful', async () => {
            const initialBalance = await testDaiContract.balanceOf(toAddress);
            await chaiBridgeContract.bridgeTransferFrom(
                ethers.ZeroAddress, // randomAddress()
                fromAddress, 
                toAddress, 
                amount, 
                '0x' // constants.NULL_BYTES
            );
            const endBalance = await testDaiContract.balanceOf(toAddress);
            expect(endBalance).to.equal(initialBalance + amount);
        });
        
        it('fails if the `chai.draw` call fails', async () => {
            await expect(
                chaiBridgeContract.bridgeTransferFrom(
                    ethers.ZeroAddress, // randomAddress()
                    alwaysRevertAddress, 
                    toAddress, 
                    amount, 
                    '0x' // constants.NULL_BYTES
                )
            ).to.be.reverted;
        });
    });
});
