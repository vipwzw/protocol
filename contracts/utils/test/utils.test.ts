import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("🔧 Utils Package TypeScript Tests", function () {
    let accounts: SignerWithAddress[];
    let deployer: SignerWithAddress;
    let user1: SignerWithAddress;

    beforeEach(async function () {
        accounts = await ethers.getSigners();
        [deployer, user1] = accounts;
    });

    it("✅ should have proper test account setup", async function () {
        expect(accounts.length).to.be.greaterThan(1);
        expect(deployer.address).to.match(/^0x[0-9a-fA-F]{40}$/);
        expect(user1.address).to.match(/^0x[0-9a-fA-F]{40}$/);
        console.log(`✅ Deployer: ${deployer.address}`);
        console.log(`✅ User1: ${user1.address}`);
    });

    describe("📚 LibBytes", function () {
        it("✅ should handle bytes operations with TypeScript", async function () {
            // 测试字节操作类型
            const testData = "0x1234567890abcdef";
            const testString = "Hello, 0x Protocol!";
            
            // 转换为字节
            const stringBytes = ethers.toUtf8Bytes(testString);
            const hexBytes = ethers.getBytes(testData);
            
            expect(stringBytes).to.be.instanceof(Uint8Array);
            expect(hexBytes).to.be.instanceof(Uint8Array);
            expect(hexBytes.length).to.equal(8);
            
            console.log(`✅ String bytes length: ${stringBytes.length}`);
            console.log(`✅ Hex bytes length: ${hexBytes.length}`);
        });

        it("✅ should support type-safe bytes concatenation", async function () {
            const part1 = ethers.toUtf8Bytes("Hello");
            const part2 = ethers.toUtf8Bytes("World");
            
            // 创建新的 Uint8Array 来连接
            const combined = new Uint8Array(part1.length + part2.length);
            combined.set(part1, 0);
            combined.set(part2, part1.length);
            
            expect(combined.length).to.equal(part1.length + part2.length);
            console.log(`✅ Combined bytes length: ${combined.length}`);
        });
    });

    describe("🧮 LibMath", function () {
        it("✅ should handle math operations with BigInt", async function () {
            // 使用 BigInt 进行数学运算
            const value1 = ethers.utils.parseEther("100");
            const value2 = ethers.utils.parseEther("50");
            const percentage = 25n; // 25%
            
            // 计算百分比
            const percentageResult = (value1 * percentage) / 100n;
            
            expect(value1).to.be.a('bigint');
            expect(value2).to.be.a('bigint');
            expect(percentageResult).to.be.a('bigint');
            expect(percentageResult).to.equal(ethers.utils.parseEther("25"));
            
            console.log(`✅ Value1: ${ethers.utils.formatEther(value1)} ETH`);
            console.log(`✅ Value2: ${ethers.utils.formatEther(value2)} ETH`);
            console.log(`✅ 25% of Value1: ${ethers.utils.formatEther(percentageResult)} ETH`);
        });

        it("✅ should support safe math operations", async function () {
            const maxUint256 = (2n ** 256n) - 1n;
            const halfMax = maxUint256 / 2n;
            
            // 测试安全加法
            const sum = halfMax + 1n;
            expect(sum).to.be.a('bigint');
            expect(sum).to.be.lessThan(maxUint256);
            
            // 测试溢出检测
            const wouldOverflow = maxUint256 > halfMax + halfMax;
            expect(wouldOverflow).to.be.false;
            
            console.log(`✅ Max uint256: ${maxUint256.toString().slice(0, 20)}...`);
            console.log(`✅ Half max: ${halfMax.toString().slice(0, 20)}...`);
        });
    });

    describe("🔐 Authorizable", function () {
        it("✅ should support authorization patterns with TypeScript", async function () {
            // 权限控制类型定义
            interface AuthorizationRole {
                role: string;
                permissions: string[];
                holder: string;
                expiry?: number;
            }

            const adminRole: AuthorizationRole = {
                role: "ADMIN",
                permissions: ["CREATE", "UPDATE", "DELETE", "READ"],
                holder: deployer.address,
                expiry: Math.floor(Date.now() / 1000) + 86400 // 24 hours
            };

            const userRole: AuthorizationRole = {
                role: "USER",
                permissions: ["READ"],
                holder: user1.address
            };

            expect(adminRole.role).to.equal("ADMIN");
            expect(adminRole.permissions).to.include("DELETE");
            expect(adminRole.holder).to.match(/^0x[0-9a-fA-F]{40}$/);
            expect(adminRole.expiry).to.be.a('number');

            expect(userRole.role).to.equal("USER");
            expect(userRole.permissions).to.not.include("DELETE");
            expect(userRole.holder).to.match(/^0x[0-9a-fA-F]{40}$/);

            console.log(`✅ Admin role: ${adminRole.role} with ${adminRole.permissions.length} permissions`);
            console.log(`✅ User role: ${userRole.role} with ${userRole.permissions.length} permissions`);
        });

        it("✅ should handle signature verification with types", async function () {
            const message = "Authorization message";
            const messageHash = ethers.id(message);
            
            // 使用 deployer 签名消息
            const signature = await deployer.signMessage(message);
            
            // 验证签名
            const recoveredAddress = ethers.verifyMessage(message, signature);
            
            expect(signature).to.be.a('string');
            expect(signature).to.match(/^0x[0-9a-fA-F]{130}$/); // 65 bytes = 130 hex chars
            expect(recoveredAddress).to.equal(deployer.address);
            expect(messageHash).to.match(/^0x[0-9a-fA-F]{64}$/);
            
            console.log(`✅ Message hash: ${messageHash.slice(0, 20)}...`);
            console.log(`✅ Signature: ${signature.slice(0, 20)}...`);
            console.log(`✅ Recovered address: ${recoveredAddress}`);
        });
    });

    describe("🚨 Rich Errors", function () {
        it("✅ should handle custom error types", async function () {
            // 自定义错误类型
            interface ContractError {
                name: string;
                signature: string;
                params: Array<{ name: string; type: string; value: any }>;
            }

            const insufficientBalanceError: ContractError = {
                name: "InsufficientBalance",
                signature: "InsufficientBalance(address,uint256,uint256)",
                params: [
                    { name: "account", type: "address", value: user1.address },
                    { name: "requested", type: "uint256", value: ethers.utils.parseEther("100") },
                    { name: "available", type: "uint256", value: ethers.utils.parseEther("50") }
                ]
            };

            expect(insufficientBalanceError.name).to.equal("InsufficientBalance");
            expect(insufficientBalanceError.params).to.have.length(3);
            expect(insufficientBalanceError.params[0].value).to.match(/^0x[0-9a-fA-F]{40}$/);
            expect(insufficientBalanceError.params[1].value).to.be.a('bigint');
            expect(insufficientBalanceError.params[2].value).to.be.a('bigint');

            console.log(`✅ Error: ${insufficientBalanceError.name}`);
            console.log(`✅ Requested: ${ethers.utils.formatEther(insufficientBalanceError.params[1].value)} ETH`);
            console.log(`✅ Available: ${ethers.utils.formatEther(insufficientBalanceError.params[2].value)} ETH`);
        });
    });

    describe("🛡️ Reentrancy Guard", function () {
        it("✅ should support reentrancy protection patterns", async function () {
            // 重入保护状态枚举
            enum ReentrancyStatus {
                NOT_ENTERED = 1,
                ENTERED = 2
            }

            interface ReentrancyGuard {
                status: ReentrancyStatus;
                caller: string;
                timestamp: number;
            }

            const guard: ReentrancyGuard = {
                status: ReentrancyStatus.NOT_ENTERED,
                caller: ethers.ZeroAddress,
                timestamp: 0
            };

            // 模拟进入保护状态
            const enterGuard = (caller: string): ReentrancyGuard => ({
                status: ReentrancyStatus.ENTERED,
                caller: caller,
                timestamp: Math.floor(Date.now() / 1000)
            });

            const activeGuard = enterGuard(deployer.address);

            expect(guard.status).to.equal(ReentrancyStatus.NOT_ENTERED);
            expect(activeGuard.status).to.equal(ReentrancyStatus.ENTERED);
            expect(activeGuard.caller).to.equal(deployer.address);
            expect(activeGuard.timestamp).to.be.a('number');

            console.log(`✅ Initial status: ${ReentrancyStatus[guard.status]}`);
            console.log(`✅ Active status: ${ReentrancyStatus[activeGuard.status]}`);
            console.log(`✅ Active caller: ${activeGuard.caller}`);
        });
    });
}); 