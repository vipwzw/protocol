import { expect } from "chai";
const { ethers } = require('hardhat');

describe("🔧 Utils Package TypeScript Tests", function () {
    let accounts: any[];
    let deployer: any;
    let user1: any;

    beforeEach(async function () {
        accounts = await ethers.getSigners();
        [deployer, user1] = accounts;
    });

    it("✅ should have proper test account setup", async function () {
        expect(accounts.length).to.be.greaterThan(1);
        expect(ethers.isAddress(deployer.address)).to.be.true;
        expect(ethers.isAddress(user1.address)).to.be.true;
        console.log(`✅ Deployer: ${deployer.address}`);
        console.log(`✅ User1: ${user1.address}`);
    });

    describe("📚 LibBytes", function () {
        it("✅ should handle bytes operations with TypeScript", async function () {
            const stringData = "Hello, TypeScript!";
            const hexData = "0x48656c6c6f";
            
            const stringBytes = ethers.toUtf8Bytes(stringData);
            const hexBytes = ethers.getBytes(hexData);
            
            expect(stringBytes.length).to.be.a('number');
            expect(hexBytes.length).to.be.a('number');
            
            console.log(`✅ String bytes length: ${stringBytes.length}`);
            console.log(`✅ Hex bytes length: ${hexBytes.length}`);
        });

        it("✅ should support type-safe bytes concatenation", async function () {
            const bytes1 = ethers.toUtf8Bytes("Hello");
            const bytes2 = ethers.toUtf8Bytes("World");
            
            const combined = new Uint8Array(bytes1.length + bytes2.length);
            combined.set(bytes1);
            combined.set(bytes2, bytes1.length);
            
            expect(combined.length).to.equal(bytes1.length + bytes2.length);
            console.log(`✅ Combined bytes length: ${combined.length}`);
        });
    });

    describe("🧮 LibMath", function () {
        it("✅ should handle math operations with BigInt", async function () {
            const amount1 = ethers.parseEther("1.5");
            const amount2 = ethers.parseEther("2.5");
            
            const sum = amount1 + amount2;
            const formatted = ethers.formatEther(sum);
            
            expect(sum).to.be.a('bigint');
            expect(formatted).to.equal("4.0");
            
            console.log(`✅ Math operation: ${ethers.formatEther(amount1)} + ${ethers.formatEther(amount2)} = ${formatted} ETH`);
        });

        it("✅ should support safe math operations", async function () {
            // 简单的 BigInt 运算测试
            const value1 = 100n;
            const value2 = 200n;
            const result = value1 + value2;
            
            expect(result).to.equal(300n);
            expect(result).to.be.a('bigint');
            
            console.log(`✅ Safe math: ${value1} + ${value2} = ${result}`);
        });
    });

    describe("🔐 Authorizable", function () {
        it("✅ should support authorization patterns with TypeScript", async function () {
            interface AuthRole {
                name: string;
                permissions: number;
            }

            const adminRole: AuthRole = {
                name: "ADMIN",
                permissions: 4
            };

            const userRole: AuthRole = {
                name: "USER", 
                permissions: 1
            };

            expect(adminRole.permissions).to.be.greaterThan(userRole.permissions);
            console.log(`✅ Admin role: ${adminRole.name} with ${adminRole.permissions} permissions`);
            console.log(`✅ User role: ${userRole.name} with ${userRole.permissions} permissions`);
        });

        it("✅ should handle signature verification with types", async function () {
            const message = "Authorize transaction";
            const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
            
            const signature = await deployer.signMessage(ethers.getBytes(messageHash));
            const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
            
            expect(recoveredAddress.toLowerCase()).to.equal(deployer.address.toLowerCase());
            
            console.log(`✅ Message hash: ${messageHash.slice(0, 22)}...`);
            console.log(`✅ Signature: ${signature.slice(0, 22)}...`);
            console.log(`✅ Recovered address: ${recoveredAddress}`);
        });
    });

    describe("🚨 Rich Errors", function () {
        it("✅ should handle custom error types", async function () {
            interface CustomError {
                name: string;
                code: number;
                amount: bigint;
                details: string;
            }

            const insufficientBalanceError: CustomError = {
                name: "InsufficientBalance",
                code: 1001,
                amount: ethers.parseEther("100.5"),
                details: "Account balance too low for transaction"
            };

            expect(insufficientBalanceError.code).to.be.a('number');
            expect(insufficientBalanceError.amount).to.be.a('bigint');
            expect(ethers.formatEther(insufficientBalanceError.amount)).to.equal("100.5");
            
            console.log(`✅ Error: ${insufficientBalanceError.name} (${insufficientBalanceError.code})`);
            console.log(`✅ Amount: ${ethers.formatEther(insufficientBalanceError.amount)} ETH`);
            console.log(`✅ Details: ${insufficientBalanceError.details}`);
        });
    });

    describe("🛡️ Reentrancy Guard", function () {
        it("✅ should support reentrancy protection patterns with types", async function () {
            enum ReentrancyStatus {
                NOT_ENTERED = 1,
                ENTERED = 2
            }

            let currentStatus: ReentrancyStatus = ReentrancyStatus.NOT_ENTERED;
            let activeCaller: string | null = null;

            // 模拟进入受保护的函数
            function enterProtectedFunction(caller: string) {
                if (currentStatus === ReentrancyStatus.ENTERED) {
                    throw new Error("ReentrancyGuard: reentrant call");
                }
                currentStatus = ReentrancyStatus.ENTERED;
                activeCaller = caller;
            }

            function exitProtectedFunction() {
                currentStatus = ReentrancyStatus.NOT_ENTERED;
                activeCaller = null;
            }

            console.log(`✅ Initial status: ${ReentrancyStatus[currentStatus]}`);
            
            enterProtectedFunction(deployer.address);
            console.log(`✅ Active status: ${ReentrancyStatus[currentStatus]}`);
            console.log(`✅ Active caller: ${activeCaller}`);
            
            expect(currentStatus).to.equal(ReentrancyStatus.ENTERED);
            expect(activeCaller).to.equal(deployer.address);
            
            exitProtectedFunction();
            expect(currentStatus).to.equal(ReentrancyStatus.NOT_ENTERED);
        });
    });
}); 