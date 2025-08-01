import {
    chaiSetup,
    constants,
    expectTransactionFailedWithoutReasonAsync,
    provider,
    txDefaults,
    web3Wrapper,
} from '@0x/test-utils';
import { BlockchainLifecycle } from '@0x/dev-utils';
import { AssetProxyId, RevertReason } from '@0x/utils';
import { AbiEncoder } from '@0x/utils';
import * as chai from 'chai';
import * as ethUtil from 'ethereumjs-util';
import { ethers } from 'hardhat';

import { artifacts } from './artifacts';

import {
    IAssetData,
    IAssetData__factory,
    IAssetProxy,
    IAssetProxy__factory,
    StaticCallProxy__factory,
    TestStaticCallTarget,
    TestStaticCallTarget__factory,
} from './wrappers';

chaiSetup.configure();
const expect = chai.expect;
const blockchainLifecycle = new BlockchainLifecycle(provider);

describe('StaticCallProxy', () => {
    const amount = constants.ZERO_AMOUNT;
    let fromAddress: string;
    let toAddress: string;

    let assetDataInterface: IAssetData;
    let staticCallProxy: IAssetProxy;
    let staticCallTarget: TestStaticCallTarget;

    before(async () => {
        await blockchainLifecycle.startAsync();
    });
    after(async () => {
        await blockchainLifecycle.revertAsync();
    });
    before(async () => {
        const accounts = await web3Wrapper.getAvailableAddressesAsync();
        [fromAddress, toAddress] = accounts.slice(0, 2);
        const signers = await ethers.getSigners();
        const deployer = signers[0];
        const staticCallProxyWithoutTransferFrom = await new StaticCallProxy__factory(deployer).deploy();
        assetDataInterface = IAssetData__factory.connect(constants.NULL_ADDRESS, provider);
        const contractAddress = await staticCallProxyWithoutTransferFrom.getAddress();
        staticCallProxy = IAssetProxy__factory.connect(
            contractAddress,
            provider
        );
        staticCallTarget = await new TestStaticCallTarget__factory(deployer).deploy();
    });
    beforeEach(async () => {
        await blockchainLifecycle.startAsync();
    });
    afterEach(async () => {
        await blockchainLifecycle.revertAsync();
    });

    describe('general', () => {
        it('should revert if undefined function is called', async () => {
            const undefinedSelector = '0x01020304';
            await expectTransactionFailedWithoutReasonAsync(
                web3Wrapper.sendTransactionAsync({
                    from: fromAddress,
                    to: staticCallProxy.address,
                    value: constants.ZERO_AMOUNT,
                    data: undefinedSelector,
                }),
            );
        });
        it('should have an id of 0xc339d10a', async () => {
            const proxyId = await staticCallProxy.getProxyId();
            const expectedProxyId = AssetProxyId.StaticCall;
            expect(proxyId).to.equal(expectedProxyId);
        });
    });
    describe('transferFrom', () => {
        it('should revert if assetData lies outside the bounds of calldata', async () => {
            const staticCallData = staticCallTarget.interface.encodeFunctionData('noInputFunction');
            const expectedResultHash = constants.KECCAK256_NULL;
            const staticCallTargetAddress = await staticCallTarget.getAddress();
            const assetData = assetDataInterface.interface.encodeFunctionData('StaticCall', [staticCallTargetAddress, staticCallData, expectedResultHash]);
            const txData = staticCallProxy.interface.encodeFunctionData('transferFrom', [assetData, fromAddress, toAddress, amount]);
            const offsetToAssetData = '0000000000000000000000000000000000000000000000000000000000000080';
            const txDataEndBuffer = ethUtil.toBuffer((txData.length - 2) / 2 - 4);
            const paddedTxDataEndBuffer = ethUtil.setLengthLeft(txDataEndBuffer, 32);
            const invalidOffsetToAssetData = ethUtil.bufferToHex(paddedTxDataEndBuffer).slice(2);
            const newAssetData = '0000000000000000000000000000000000000000000000000000000000000304';
            const badTxData = `${txData.replace(offsetToAssetData, invalidOffsetToAssetData)}${newAssetData}`;
            await expectTransactionFailedWithoutReasonAsync(
                web3Wrapper.sendTransactionAsync({
                    to: staticCallProxy.address,
                    from: fromAddress,
                    data: badTxData,
                }),
            );
        });
        it('should revert if the length of assetData is less than 100 bytes', async () => {
            const staticCallData = constants.NULL_BYTES;
            const expectedResultHash = constants.KECCAK256_NULL;
            const staticCallTargetAddress = await staticCallTarget.getAddress();
            const assetData = assetDataInterface.interface.encodeFunctionData('StaticCall', [staticCallTargetAddress, staticCallData, expectedResultHash])
                .slice(0, -128);
            const assetDataByteLen = (assetData.length - 2) / 2;
            expect((assetDataByteLen - 4) % 32).to.equal(0);
            await expectTransactionFailedWithoutReasonAsync(
                staticCallProxy.transferFrom(assetData, fromAddress, toAddress, amount).sendTransactionAsync(),
            );
        });
        it('should revert if the offset to `staticCallData` points to outside of assetData', async () => {
            const staticCallData = staticCallTarget.interface.encodeFunctionData('noInputFunction');
            const expectedResultHash = constants.KECCAK256_NULL;
            const staticCallTargetAddress = await staticCallTarget.getAddress();
            const assetData = assetDataInterface.interface.encodeFunctionData('StaticCall', [staticCallTargetAddress, staticCallData, expectedResultHash]);
            const offsetToStaticCallData = '0000000000000000000000000000000000000000000000000000000000000060';
            const assetDataEndBuffer = ethUtil.toBuffer((assetData.length - 2) / 2 - 4);
            const paddedAssetDataEndBuffer = ethUtil.setLengthLeft(assetDataEndBuffer, 32);
            const invalidOffsetToStaticCallData = ethUtil.bufferToHex(paddedAssetDataEndBuffer).slice(2);
            const newStaticCallData = '0000000000000000000000000000000000000000000000000000000000000304';
            const badAssetData = `${assetData.replace(
                offsetToStaticCallData,
                invalidOffsetToStaticCallData,
            )}${newStaticCallData}`;
            await expectTransactionFailedWithoutReasonAsync(
                staticCallProxy.transferFrom(badAssetData, fromAddress, toAddress, amount).sendTransactionAsync(),
            );
        });
        it('should revert if the callTarget attempts to write to state', async () => {
            const staticCallData = staticCallTarget.interface.encodeFunctionData('updateState');
            const expectedResultHash = constants.KECCAK256_NULL;
            const staticCallTargetAddress = await staticCallTarget.getAddress();
            const assetData = assetDataInterface.interface.encodeFunctionData('StaticCall', [staticCallTargetAddress, staticCallData, expectedResultHash]);
            await expectTransactionFailedWithoutReasonAsync(
                staticCallProxy.transferFrom(assetData, fromAddress, toAddress, amount).sendTransactionAsync(),
            );
        });
        it('should revert with data provided by the callTarget if the staticcall reverts', async () => {
            const staticCallData = staticCallTarget.interface.encodeFunctionData('assertEvenNumber', [1n]);
            const expectedResultHash = constants.KECCAK256_NULL;
            const staticCallTargetAddress = await staticCallTarget.getAddress();
            const assetData = assetDataInterface.interface.encodeFunctionData('StaticCall', [staticCallTargetAddress, staticCallData, expectedResultHash]);
            return expect(
                staticCallProxy.transferFrom(assetData, fromAddress, toAddress, amount).awaitTransactionSuccessAsync(),
            ).to.be.revertedWith(RevertReason.TargetNotEven);
        });
        it('should revert if the hash of the output is different than expected expected', async () => {
            const staticCallData = staticCallTarget.interface.encodeFunctionData('isOddNumber', [0n]);
            const trueAsBuffer = ethUtil.toBuffer('0x0000000000000000000000000000000000000000000000000000000000000001');
            const expectedResultHash = ethUtil.bufferToHex(ethUtil.keccak256(trueAsBuffer));
            const staticCallTargetAddress = await staticCallTarget.getAddress();
            const assetData = assetDataInterface.interface.encodeFunctionData('StaticCall', [staticCallTargetAddress, staticCallData, expectedResultHash]);
            return expect(
                staticCallProxy.transferFrom(assetData, fromAddress, toAddress, amount).awaitTransactionSuccessAsync(),
            ).to.be.revertedWith(RevertReason.UnexpectedStaticCallResult);
        });
        it('should be successful if a function call with no inputs and no outputs is successful', async () => {
            const staticCallData = staticCallTarget.interface.encodeFunctionData('noInputFunction');
            const expectedResultHash = constants.KECCAK256_NULL;
            const staticCallTargetAddress = await staticCallTarget.getAddress();
            const assetData = assetDataInterface.interface.encodeFunctionData('StaticCall', [staticCallTargetAddress, staticCallData, expectedResultHash]);
            await staticCallProxy
                .transferFrom(assetData, fromAddress, toAddress, amount)
                .awaitTransactionSuccessAsync();
        });
        it('should be successful if the staticCallTarget is not a contract and no return value is expected', async () => {
            const staticCallData = '0x0102030405060708';
            const expectedResultHash = constants.KECCAK256_NULL;
            const assetData = assetDataInterface
                .StaticCall(toAddress, staticCallData, expectedResultHash)
                .getABIEncodedTransactionData();
            await staticCallProxy
                .transferFrom(assetData, fromAddress, toAddress, amount)
                .awaitTransactionSuccessAsync();
        });
        it('should be successful if a function call with one static input returns the correct value', async () => {
            const staticCallData = staticCallTarget.interface.encodeFunctionData('isOddNumber', [1n]);
            const trueAsBuffer = ethUtil.toBuffer('0x0000000000000000000000000000000000000000000000000000000000000001');
            const expectedResultHash = ethUtil.bufferToHex(ethUtil.keccak256(trueAsBuffer));
            const staticCallTargetAddress = await staticCallTarget.getAddress();
            const assetData = assetDataInterface.interface.encodeFunctionData('StaticCall', [staticCallTargetAddress, staticCallData, expectedResultHash]);
            await staticCallProxy
                .transferFrom(assetData, fromAddress, toAddress, amount)
                .awaitTransactionSuccessAsync();
        });
        it('should be successful if a function with one dynamic input is successful', async () => {
            const dynamicInput = '0x0102030405060708';
            const staticCallData = staticCallTarget.interface.encodeFunctionData('dynamicInputFunction', [dynamicInput]);
            const expectedResultHash = constants.KECCAK256_NULL;
            const staticCallTargetAddress = await staticCallTarget.getAddress();
            const assetData = assetDataInterface.interface.encodeFunctionData('StaticCall', [staticCallTargetAddress, staticCallData, expectedResultHash]);
            await staticCallProxy
                .transferFrom(assetData, fromAddress, toAddress, amount)
                .awaitTransactionSuccessAsync();
        });
        it('should be successful if a function call returns a complex type', async () => {
            const a = 1n;
            const b = 2n;
            const staticCallData = staticCallTarget.interface.encodeFunctionData('returnComplexType', [a, b]);
            const abiEncoder = new AbiEncoder.DynamicBytes({
                name: '',
                type: 'bytes',
            });
            const aHex = '0000000000000000000000000000000000000000000000000000000000000001';
            const bHex = '0000000000000000000000000000000000000000000000000000000000000002';
            const staticCallTargetAddress = await staticCallTarget.getAddress();
            const expectedResults = `${staticCallTargetAddress}${aHex}${bHex}`;
            const offset = '0000000000000000000000000000000000000000000000000000000000000020';
            const encodedExpectedResultWithOffset = `0x${offset}${abiEncoder.encode(expectedResults).slice(2)}`;
            const expectedResultHash = ethUtil.bufferToHex(
                ethUtil.keccak256(ethUtil.toBuffer(encodedExpectedResultWithOffset)),
            );
            const assetData = assetDataInterface.interface.encodeFunctionData('StaticCall', [staticCallTargetAddress, staticCallData, expectedResultHash]);
            await staticCallProxy
                .transferFrom(assetData, fromAddress, toAddress, amount)
                .awaitTransactionSuccessAsync();
        });
    });
});
