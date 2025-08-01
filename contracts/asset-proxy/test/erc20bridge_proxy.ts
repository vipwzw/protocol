import {
    chaiSetup,
    constants,
    expect,
    getRandomInteger,
    Numberish,
    randomAddress,
    web3Wrapper,
} from '@0x/test-utils';
import { AuthorizableRevertErrors } from '@0x/contracts-utils';
import { AssetProxyId } from '@0x/utils';
import { AbiEncoder, hexUtils, StringRevertError } from '@0x/utils';
import { DecodedLogs } from 'ethereum-types';
import { ethers } from 'hardhat';
import * as _ from 'lodash';

import { artifacts } from './artifacts';

import { ERC20BridgeProxyContract, TestERC20Bridge, ERC20BridgeProxy__factory, TestERC20Bridge__factory } from './wrappers';

chaiSetup.configure();

describe('ERC20BridgeProxy unit tests', () => {
    const PROXY_ID = AssetProxyId.ERC20Bridge;
    const BRIDGE_SUCCESS_RETURN_DATA = hexUtils.rightPad(PROXY_ID);
    let owner: string;
    let badCaller: string;
    let assetProxy: ERC20BridgeProxyContract;
    let bridgeContract: TestERC20Bridge;
    let testTokenAddress: string;

    before(async () => {
        const accounts = await web3Wrapper.getAvailableAddressesAsync();
        [owner, badCaller] = accounts.slice(0, 2);
        const signers = await ethers.getSigners();
        const deployer = signers[0];
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
        const encoder = AbiEncoder.createMethod('ERC20BridgeProxy', [
            { name: 'tokenAddress', type: 'address' },
            { name: 'bridgeAddress', type: 'address' },
            { name: 'bridgeData', type: 'bytes' },
        ]);
        return encoder.encode([opts.tokenAddress, opts.bridgeAddress, encodeBridgeData(opts.bridgeData)]);
    }

    function encodeBridgeData(opts: BridgeDataOpts): string {
        const encoder = AbiEncoder.create([
            { name: 'transferAmount', type: 'int256' },
            { name: 'revertData', type: 'bytes' },
            { name: 'returnData', type: 'bytes' },
        ]);
        const revertErrorBytes =
            opts.revertError !== undefined ? new StringRevertError(opts.revertError).encode() : '0x';
        return encoder.encode([opts.transferAmount, revertErrorBytes, opts.returnData]);
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
            const tx = await assetProxy.transferFrom(encodeAssetData(_opts.assetData), _opts.from, _opts.to, _opts.amount);
            const receipt = await tx.wait();
            return receipt.logs as any as DecodedLogs;
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
            expect(args.tokenAddress).to.eq(opts.assetData.tokenAddress);
            expect(args.from).to.eq(opts.from);
            expect(args.to).to.eq(opts.to);
            expect(args.amount).to.equal(opts.amount);
            expect(args.bridgeData).to.eq(encodeBridgeData(opts.assetData.bridgeData));
        });

        it('fails if not called by an authorized address', async () => {
            const tx = transferFromAsync({}, badCaller);
            return expect(tx).to.be.revertedWith(new AuthorizableRevertErrors.SenderNotAuthorizedError(badCaller));
        });

        it('fails if asset data is truncated', async () => {
            const opts = createTransferFromOpts();
            const truncatedAssetData = hexUtils.slice(encodeAssetData(opts.assetData), 0, -1);
            const tx = assetProxy
                .transferFrom(truncatedAssetData, opts.from, opts.to, new BigNumber(opts.amount))
                .awaitTransactionSuccessAsync();
            return expect(tx).to.be.reverted;
        });

        it('fails if bridge returns nothing', async () => {
            const tx = transferFromAsync({
                assetData: createAssetData({
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
                assetData: createAssetData({
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
                assetData: createAssetData({
                    bridgeData: createBridgeData({
                        returnData: hexUtils.rightPad('0x1'),
                    }),
                }),
            });
            return expect(tx).to.be.revertedWith('BRIDGE_FAILED');
        });

        it('fails if bridge is an EOA', async () => {
            const tx = transferFromAsync({
                assetData: createAssetData({
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
                assetData: createAssetData({
                    bridgeData: createBridgeData({
                        revertError,
                    }),
                }),
            });
            return expect(tx).to.be.revertedWith(revertError);
        });

        it('fails if balance of `to` increases by less than `amount`', async () => {
            const amount = getRandomInteger(1, 100e18);
            const tx = transferFromAsync({
                amount,
                assetData: createAssetData({
                    bridgeData: createBridgeData({
                        transferAmount: amount - 1n,
                    }),
                }),
            });
            return expect(tx).to.be.revertedWith('BRIDGE_UNDERPAY');
        });

        it('fails if balance of `to` decreases', async () => {
            const toAddress = randomAddress();
            await setTestTokenBalanceAsync(toAddress, 1e18);
            const tx = transferFromAsync({
                to: toAddress,
                assetData: createAssetData({
                    bridgeData: createBridgeData({
                        transferAmount: -1,
                    }),
                }),
            });
            return expect(tx).to.be.revertedWith('BRIDGE_UNDERPAY');
        });
    });

    describe('balanceOf()', () => {
        it('retrieves the balance of the encoded token', async () => {
            const _owner = randomAddress();
            const balance = getRandomInteger(1, 100e18);
            await bridgeContract.setTestTokenBalance(_owner, balance).awaitTransactionSuccessAsync();
            const assetData = createAssetData({
                tokenAddress: testTokenAddress,
            });
            const actualBalance = await assetProxy.balanceOf(encodeAssetData(assetData), _owner);
            expect(actualBalance).to.bignumber.eq(balance);
        });
    });

    describe('getProxyId()', () => {
        it('returns the correct proxy ID', async () => {
            const proxyId = await assetProxy.getProxyId();
            expect(proxyId).to.eq(PROXY_ID);
        });
    });
});
