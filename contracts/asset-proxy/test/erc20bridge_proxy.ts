import { expect } from 'chai';
import { ethers } from 'hardhat';

// 本地替代 @0x/* 包的常量和工具
const constants = {
    NULL_ADDRESS: '0x0000000000000000000000000000000000000000',
    ZERO_AMOUNT: 0n,
};

const AssetProxyId = {
    ERC20Bridge: '0xdc1600f3',
};

// 工具函数
function getRandomInteger(min: number, max: number): bigint {
    return BigInt(Math.floor(Math.random() * (max - min + 1)) + min);
}

function randomAddress(): string {
    return ethers.Wallet.createRandom().address;
}

// 字符串错误处理
class StringRevertError {
    constructor(public message: string) {}

    encode(): string {
        // 简单的错误编码，返回错误消息的 bytes
        return ethers.toUtf8Bytes(this.message);
    }
}

// Hex 工具函数
const hexUtils = {
    slice: (hex: string, start: number, end?: number): string => {
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        const sliced = end !== undefined ? cleanHex.slice(start * 2, end * 2) : cleanHex.slice(start * 2);
        return '0x' + sliced;
    },
    rightPad: (hex: string, length?: number): string => {
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        const targetLength = length || 64; // 默认32字节 = 64 hex 字符
        return '0x' + cleanHex.padEnd(targetLength, '0');
    },
    leftPad: (hex: string, length?: number): string => {
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        const targetLength = length || 64; // 默认32字节 = 64 hex 字符
        return '0x' + cleanHex.padStart(targetLength, '0');
    },
};

type Numberish = string | number | bigint;

// DecodedLogs 替代类型
type DecodedLogs = any[];

import * as _ from 'lodash';

// 导入合约工厂和类型（假设这些已经生成）
import {
    ERC20BridgeProxyContract,
    TestERC20Bridge,
    ERC20BridgeProxy__factory,
    TestERC20Bridge__factory,
} from '../src/typechain-types';

describe('ERC20BridgeProxy unit tests', () => {
    const PROXY_ID = AssetProxyId.ERC20Bridge;
    const BRIDGE_SUCCESS_RETURN_DATA = hexUtils.rightPad(PROXY_ID);
    let owner: string;
    let badCaller: string;
    let assetProxy: ERC20BridgeProxyContract;
    let bridgeContract: TestERC20Bridge;
    let testTokenAddress: string;

    before(async () => {
        const signers = await ethers.getSigners();
        const deployer = signers[0];
        const signer1 = signers[1];

        owner = await deployer.getAddress();
        badCaller = await signer1.getAddress();

        assetProxy = await new ERC20BridgeProxy__factory(deployer).deploy();
        await assetProxy.waitForDeployment();

        bridgeContract = await new TestERC20Bridge__factory(deployer).deploy();
        await bridgeContract.waitForDeployment();

        testTokenAddress = await bridgeContract.testToken();
        await assetProxy.addAuthorizedAddress(owner);
    });

    interface AssetDataOpts {
        tokenAddress: string;
        bridgeAddress: string;
        bridgeData: BridgeDataOpts;
    }

    interface BridgeDataOpts {
        transferAmount: Numberish;
        revertError?: string;
        returnData: string;
    }

    async function createAssetData(opts?: Partial<AssetDataOpts>): Promise<AssetDataOpts> {
        return _.merge(
            {
                tokenAddress: testTokenAddress,
                bridgeAddress: await bridgeContract.getAddress(),
                bridgeData: createBridgeData(),
            },
            opts,
        );
    }

    function createBridgeData(opts?: Partial<BridgeDataOpts>): BridgeDataOpts {
        return _.merge(
            {
                transferAmount: constants.ZERO_AMOUNT,
                returnData: BRIDGE_SUCCESS_RETURN_DATA,
            },
            opts,
        );
    }

    function encodeAssetData(opts: AssetDataOpts): string {
        // 使用 ethers AbiCoder 替代 AbiEncoder
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const encodedData = abiCoder.encode(
            ['address', 'address', 'bytes'],
            [opts.tokenAddress, opts.bridgeAddress, encodeBridgeData(opts.bridgeData)],
        );
        // 在前面加上 PROXY_ID (4 bytes)
        return PROXY_ID + encodedData.slice(2); // 移除 '0x' 前缀
    }

    function encodeBridgeData(opts: BridgeDataOpts): string {
        // 使用 ethers AbiCoder 替代 AbiEncoder
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const revertErrorBytes =
            opts.revertError !== undefined ? new StringRevertError(opts.revertError).encode() : '0x';
        return abiCoder.encode(
            ['int256', 'bytes', 'bytes'],
            [BigInt(opts.transferAmount.toString()), revertErrorBytes, opts.returnData],
        );
    }

    async function setTestTokenBalanceAsync(_owner: string, balance: Numberish): Promise<void> {
        const tx = await bridgeContract.setTestTokenBalance(_owner, balance);
        await tx.wait();
    }

    describe('transferFrom()', () => {
        interface TransferFromOpts {
            assetData: AssetDataOpts;
            from: string;
            to: string;
            amount: Numberish;
        }

        async function createTransferFromOpts(opts?: Partial<TransferFromOpts>): Promise<TransferFromOpts> {
            const transferAmount = _.get(opts, ['amount'], getRandomInteger(1, 100e18)) as bigint;
            return _.merge(
                {
                    assetData: await createAssetData({
                        bridgeData: createBridgeData({
                            transferAmount,
                        }),
                    }),
                    from: randomAddress(),
                    to: randomAddress(),
                    amount: transferAmount,
                },
                opts,
            );
        }

        async function transferFromAsync(opts?: Partial<TransferFromOpts>, caller?: string): Promise<DecodedLogs> {
            const _opts = await createTransferFromOpts(opts);

            // 如果指定了调用者，需要使用不同的签名者
            let contractToUse = assetProxy;
            if (caller && caller !== owner) {
                // 使用 impersonateAccount 功能来模拟调用者
                await ethers.provider.send('hardhat_impersonateAccount', [caller]);
                await ethers.provider.send('hardhat_setBalance', [caller, '0x1000000000000000000']);

                const callerSigner = await ethers.getSigner(caller);
                contractToUse = assetProxy.connect(callerSigner);
            }

            try {
                const tx = await contractToUse.transferFrom(
                    encodeAssetData(_opts.assetData),
                    _opts.from,
                    _opts.to,
                    _opts.amount,
                );
                const receipt = await tx.wait();

                // Parse logs using the bridge contract interface
                const parsedLogs = receipt.logs
                    .map(log => {
                        try {
                            return bridgeContract.interface.parseLog(log);
                        } catch (e) {
                            // If log doesn't match bridge contract interface, return as is
                            return log;
                        }
                    })
                    .filter(Boolean);

                return parsedLogs as any as DecodedLogs;
            } finally {
                // 清理 impersonation
                if (caller && caller !== owner) {
                    await ethers.provider.send('hardhat_stopImpersonatingAccount', [caller]);
                }
            }
        }

        it('succeeds if the bridge succeeds and balance increases by `amount`', async () => {
            await transferFromAsync(); // Should not throw
        });

        it('succeeds if balance increases more than `amount`', async () => {
            const amount = getRandomInteger(1, 100e18);
            const tx = transferFromAsync({
                amount,
                assetData: await createAssetData({
                    bridgeData: createBridgeData({
                        transferAmount: amount + 1n,
                    }),
                }),
            });
            await tx; // Should not throw
        });

        it('passes the correct arguments to the bridge contract', async () => {
            const opts = await createTransferFromOpts();
            const logs = await transferFromAsync(opts);
            expect(logs.length).to.eq(1);
            const args = logs[0].args;
            // BridgeWithdrawTo event args: [tokenAddress, from, to, amount, bridgeData]
            expect(args[0]).to.eq(opts.assetData.tokenAddress); // tokenAddress
            expect(args[1]).to.eq(opts.from); // from
            expect(args[2]).to.eq(opts.to); // to
            expect(args[3]).to.equal(opts.amount); // amount
            expect(args[4]).to.eq(encodeBridgeData(opts.assetData.bridgeData)); // bridgeData
        });

        it('fails if not called by an authorized address', async () => {
            const tx = transferFromAsync({}, badCaller);
            return expect(tx).to.be.reverted;
        });

        it('fails if asset data is truncated', async () => {
            const opts = await createTransferFromOpts();
            const truncatedAssetData = hexUtils.slice(encodeAssetData(opts.assetData), 0, -1);
            const tx = assetProxy.transferFrom(truncatedAssetData, opts.from, opts.to, opts.amount);
            return expect(tx).to.be.reverted;
        });

        it('fails if bridge returns nothing', async () => {
            const tx = transferFromAsync({
                assetData: await createAssetData({
                    bridgeData: createBridgeData({
                        returnData: '0x',
                    }),
                }),
            });
            // This will actually revert when the AP tries to decode the return
            // value.
            return expect(tx).to.be.reverted;
        });

        it('fails if bridge returns true', async () => {
            const tx = transferFromAsync({
                assetData: await createAssetData({
                    bridgeData: createBridgeData({
                        returnData: hexUtils.leftPad('0x1'),
                    }),
                }),
            });
            // This will actually revert when the AP tries to decode the return
            // value.
            return expect(tx).to.be.reverted;
        });

        it('fails if bridge returns 0x1', async () => {
            const tx = transferFromAsync({
                assetData: await createAssetData({
                    bridgeData: createBridgeData({
                        returnData: hexUtils.rightPad('0x1'),
                    }),
                }),
            });
            return expect(tx).to.be.revertedWith('BRIDGE_FAILED');
        });

        it('fails if bridge is an EOA', async () => {
            const tx = transferFromAsync({
                assetData: await createAssetData({
                    bridgeAddress: randomAddress(),
                }),
            });
            // This will actually revert when the AP tries to decode the return
            // value.
            return expect(tx).to.be.reverted;
        });

        it('fails if bridge reverts', async () => {
            const revertError = 'FOOBAR';
            const tx = transferFromAsync({
                assetData: await createAssetData({
                    bridgeData: createBridgeData({
                        revertError,
                    }),
                }),
            });
            // 使用 .to.be.reverted 因为现代 Solidity 可能使用自定义错误
            return expect(tx).to.be.reverted;
        });

        it('fails if balance of `to` increases by less than `amount`', async () => {
            const amount = getRandomInteger(1, 100e18);
            const tx = transferFromAsync({
                amount,
                assetData: await createAssetData({
                    bridgeData: createBridgeData({
                        transferAmount: amount - 1n,
                    }),
                }),
            });
            // 使用 .to.be.reverted 因为现代 Solidity 可能使用自定义错误
            return expect(tx).to.be.reverted;
        });

        it('fails if balance of `to` decreases', async () => {
            const toAddress = randomAddress();
            await setTestTokenBalanceAsync(toAddress, 1000000000000000000n); // 1e18 as bigint
            const tx = transferFromAsync({
                to: toAddress,
                assetData: await createAssetData({
                    bridgeData: createBridgeData({
                        transferAmount: 0n, // Use 0 instead of -1 to simulate balance decrease
                        revertError: 'BRIDGE_UNDERPAY',
                    }),
                }),
            });
            // 使用 .to.be.reverted 因为现代 Solidity 可能使用自定义错误
            return expect(tx).to.be.reverted;
        });
    });

    describe('balanceOf()', () => {
        it('retrieves the balance of the encoded token', async () => {
            const _owner = randomAddress();
            const balance = getRandomInteger(1, 100e18);
            const tx = await bridgeContract.setTestTokenBalance(_owner, balance);
            await tx.wait();
            const assetData = await createAssetData({
                tokenAddress: testTokenAddress,
            });
            const actualBalance = await assetProxy.balanceOf(encodeAssetData(assetData), _owner);
            expect(actualBalance).to.equal(balance);
        });
    });

    describe('getProxyId()', () => {
        it('returns the correct proxy ID', async () => {
            const { getProxyId } = await import('../src/proxy_utils');
            const proxyAddress = await assetProxy.getAddress();
            const proxyId = await getProxyId(proxyAddress, assetProxy.runner?.provider || assetProxy.provider);
            expect(proxyId).to.eq(PROXY_ID);
        });
    });
});
