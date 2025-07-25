import { ethers } from "hardhat";
import { expect } from "chai";

describe("Bridge Fix Verification", function () {
    let testBridge: any;
    let takerToken: any;
    let makerToken: any;
    let deployer: any;

    beforeEach(async function () {
        [deployer] = await ethers.getSigners();

        // 部署测试代币
        const TokenFactory = await ethers.getContractFactory("TestMintableERC20Token");
        takerToken = await TokenFactory.deploy();
        makerToken = await TokenFactory.deploy();

        // 部署测试桥
        const BridgeFactory = await ethers.getContractFactory("TestFillQuoteTransformerBridge");
        testBridge = await BridgeFactory.deploy();
    });

    it("should consume taker tokens when sellTokenForToken is called", async function () {
        const sellAmount = ethers.parseEther("1");
        const buyAmount = ethers.parseEther("0.5");

        // 铸造代币给测试桥
        await takerToken.mint(await testBridge.getAddress(), sellAmount);

        // 检查初始余额
        const bridgeBalanceBefore = await takerToken.balanceOf(await testBridge.getAddress());
        expect(bridgeBalanceBefore).to.equal(sellAmount);

        // 编码 auxiliaryData
        const auxiliaryData = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [buyAmount]);

        // 调用 sellTokenForToken
        await testBridge.sellTokenForToken(
            await takerToken.getAddress(),
            await makerToken.getAddress(),
            deployer.address,
            1, // minBuyAmount
            auxiliaryData
        );

        // 检查代币是否被消费
        const bridgeBalanceAfter = await takerToken.balanceOf(await testBridge.getAddress());
        expect(bridgeBalanceAfter).to.equal(0n, "Bridge should consume all taker tokens");

        // 检查是否铸造了 maker 代币
        const recipientMakerBalance = await makerToken.balanceOf(deployer.address);
        expect(recipientMakerBalance).to.equal(buyAmount, "Should mint correct amount of maker tokens");
    });
}); 