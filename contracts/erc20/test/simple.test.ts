import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("🧪 ERC20 Package TypeScript Tests", function () {
    let accounts: SignerWithAddress[];

    beforeEach(async function () {
        accounts = await ethers.getSigners();
    });

    it("✅ should have access to test accounts", async function () {
        expect(accounts.length).to.be.greaterThan(0);
        expect(accounts[0].address).to.be.properAddress;
        console.log(`✅ 找到 ${accounts.length} 个测试账户`);
        console.log(`📍 第一个账户: ${accounts[0].address}`);
    });

    it("✅ should have correct network configuration", async function () {
        const network = await ethers.provider.getNetwork();
        expect(network.chainId).to.equal(1337);
        console.log(`✅ 网络 ID: ${network.chainId} (Hardhat 本地网络)`);
    });

    it("✅ should be able to check balances", async function () {
        const balance = await ethers.provider.getBalance(accounts[0].address);
        expect(balance).to.be.gt(0);
        console.log(`✅ 账户余额: ${ethers.formatEther(balance)} ETH`);
    });

    it("✅ should have access to ethers utilities with TypeScript", async function () {
        const amount = ethers.parseEther("1.0");
        expect(amount.toString()).to.equal("1000000000000000000");
        
        const formatted = ethers.formatEther(amount);
        expect(formatted).to.equal("1.0");
        console.log(`✅ TypeScript Ethers 工具正常: ${formatted} ETH`);
    });

    it("✅ should support TypeScript types for addresses", async function () {
        const address: string = accounts[0].address;
        const isValid: boolean = ethers.isAddress(address);
        
        expect(isValid).to.be.true;
        expect(address).to.match(/^0x[0-9a-fA-F]{40}$/);
        console.log(`✅ TypeScript 地址类型验证: ${address.slice(0, 10)}...`);
    });
}); 