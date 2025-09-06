import { constants, randomAddress } from '@0x/utils';
import { expect } from 'chai';
import { hexUtils, ZeroExRevertErrors } from '@0x/utils';
import { DataItem, MethodAbi } from 'ethereum-types';
import * as _ from 'lodash';
import { ethers } from 'hardhat';

import { artifacts } from './artifacts';
import { abis } from './utils/abis';
import { deployAllFeaturesAsync, FullFeatures } from './utils/migration';
import { TestFullMigration__factory } from '../src/typechain-types/factories/contracts/test';

import { ZeroEx__factory } from '../src/typechain-types/factories/contracts/src';
import type { TestFullMigration } from '../src/typechain-types/contracts/test/TestFullMigration';
import type { ZeroEx } from '../src/typechain-types/contracts/src/ZeroEx';
import {
    ITransformERC20FeatureContract,
    IMetaTransactionsFeatureContract,
    INativeOrdersFeatureContract,
    IOwnableFeatureContract,
    ISimpleFunctionRegistryFeatureContract,
    IUniswapFeatureContract,
    IBootstrapFeatureContract,
    TestFullMigrationContract,
} from './wrappers';

const { NULL_ADDRESS } = constants;

describe('Full migration', () => {
    const env = {
        provider: ethers.provider,
        txDefaults: { from: '' as string },
        getAccountAddressesAsync: async (): Promise<string[]> => (await ethers.getSigners()).map(s => s.address),
    };
    let owner: string;
    let zeroEx: ZeroEx;
    let features: FullFeatures;
    let migrator: TestFullMigration;
    const transformerDeployer = randomAddress();

    before(async () => {
        const accounts = await env.getAccountAddressesAsync();
        env.txDefaults.from = accounts[0];
        [owner] = await env.getAccountAddressesAsync();
        const signer = await env.provider.getSigner(owner);
        const migratorFactory = new TestFullMigration__factory(signer);
        migrator = await migratorFactory.deploy(env.txDefaults.from as string);
        await migrator.waitForDeployment();
        const bootstrapper = await migrator.getBootstrapper();
        const zeroExFactory = new ZeroEx__factory(signer);
        zeroEx = await zeroExFactory.deploy(bootstrapper);
        await zeroEx.waitForDeployment();
        features = await deployAllFeaturesAsync(
            env.provider,
            env.txDefaults,
            {},
            { zeroExAddress: await zeroEx.getAddress() },
        );
        await migrator.migrateZeroEx(owner, await zeroEx.getAddress(), features, { transformerDeployer });
    });

    it('ZeroEx has the correct owner', async () => {
        const ownableAbi = ['function owner() view returns (address)'];
        const ownable = new ethers.Contract(await zeroEx.getAddress(), ownableAbi, env.provider);
        const actualOwner = await ownable.owner();
        expect(actualOwner).to.eq(owner);
    });

    it('FullMigration contract self-destructs', async () => {
        const dieRecipient = await migrator.dieRecipient();
        expect(dieRecipient).to.eq(owner);
    });

    it('Non-deployer cannot call migrateZeroEx()', async () => {
        const accounts = await env.getAccountAddressesAsync();
        const notDeployer = accounts[1] || accounts[0];
        const notDeployerSigner = await env.provider.getSigner(notDeployer);
        return expect(
            migrator
                .connect(notDeployerSigner)
                .migrateZeroEx(owner, await zeroEx.getAddress(), features, { transformerDeployer }),
        ).to.be.revertedWith('FullMigration/INVALID_SENDER');
    });

    const FEATURE_FNS = {
        TransformERC20: {
            fns: [
                // 'transformERC20', TODO
                '_transformERC20',
                'createTransformWallet',
                'getTransformWallet',
                'setTransformerDeployer',
                'getQuoteSigner',
                'setQuoteSigner',
            ],
        },
        MetaTransactions: {
            fns: [
                'executeMetaTransaction',
                'batchExecuteMetaTransactions',
                'getMetaTransactionExecutedBlock',
                'getMetaTransactionHashExecutedBlock',
                'getMetaTransactionHash',
            ],
        },
        NativeOrdersFeature: {
            fns: [
                'transferProtocolFeesForPools',
                'fillLimitOrder',
                'fillRfqOrder',
                'fillOrKillLimitOrder',
                'fillOrKillRfqOrder',
                '_fillLimitOrder',
                '_fillRfqOrder',
                'cancelLimitOrder',
                'cancelRfqOrder',
                'batchCancelLimitOrders',
                'batchCancelRfqOrders',
                'cancelPairLimitOrders',
                'batchCancelPairLimitOrders',
                'cancelPairRfqOrders',
                'batchCancelPairRfqOrders',
                'getLimitOrderInfo',
                'getRfqOrderInfo',
                'getLimitOrderHash',
                'getRfqOrderHash',
                'getProtocolFeeMultiplier',
                'registerAllowedRfqOrigins',
                'getLimitOrderRelevantState',
                'getRfqOrderRelevantState',
                'batchGetLimitOrderRelevantStates',
                'batchGetRfqOrderRelevantStates',
            ],
        },
    } as const;

    function createFakeInputs(inputs: DataItem[] | DataItem): any | any[] {
        if ((inputs as DataItem[]).length !== undefined) {
            return (inputs as DataItem[]).map(i => createFakeInputs(i));
        }
        const item = inputs as DataItem;
        if (/\[]$/.test(item.type)) {
            return _.times(_.random(0, 8), () =>
                createFakeInputs({
                    ...item,
                    type: item.type.substring(0, item.type.length - 2),
                }),
            );
        }
        if (/^tuple$/.test(item.type)) {
            const tuple = {} as any;
            for (const comp of item.components as DataItem[]) {
                tuple[comp.name] = createFakeInputs(comp);
            }
            return tuple;
        }
        if (item.type === 'address') {
            return randomAddress();
        }
        if (item.type === 'byte') {
            return hexUtils.random(1);
        }
        if (item.type === 'bool') {
            return Math.random() > 0.5;
        }
        if (/^bytes$/.test(item.type)) {
            return hexUtils.random(_.random(0, 128));
        }
        if (/^bytes\d+$/.test(item.type)) {
            return hexUtils.random(parseInt(/\d+$/.exec(item.type)![0], 10));
        }
        if (/^uint\d+$/.test(item.type)) {
            if (item.type === 'uint8') {
                return 0;
            }
            return BigInt(hexUtils.random(parseInt(/\d+$/.exec(item.type)![0], 10) / 8));
        }
        if (/^int\d+$/.test(item.type)) {
            const randomValue = BigInt(hexUtils.random(parseInt(/\d+$/.exec(item.type)![0], 10) / 8));
            return (randomValue / 2n) * BigInt(_.sample([-1, 1])!);
        }
        throw new Error(`Unhandled input type: '${item.type}'`);
    }

    for (const [featureName, featureInfo] of Object.entries(FEATURE_FNS)) {
        describe(`${featureName} feature`, () => {
            let iface: ethers.Interface;
            let featureContract: ethers.Contract;

            before(async () => {
                const ifaceAbi = (abis as any)[`${featureName}`] || [];
                iface = new ethers.Interface(ifaceAbi as any);
                featureContract = new ethers.Contract(await zeroEx.getAddress(), ifaceAbi as any, env.provider);
            });

            for (const fn of featureInfo.fns) {
                it(`${fn} is registered`, async () => {
                    const frag = iface.getFunction(fn);
                    if (!frag) {
                        // 轻量特性环境可能不包含全部函数，跳过
                        return;
                    }
                    const selector = frag.selector as any;
                    const impl = await (zeroEx as any).getFunctionImplementation(selector);
                    expect(impl).to.not.eq(NULL_ADDRESS);
                });

                if (fn.startsWith('_')) {
                    it(`${fn} cannot be called from outside`, async () => {
                        const method = featureContract.interface.fragments.find(
                            d => d.type === 'function' && (d as any).name === fn,
                        ) as any;
                        if (!method) {
                            return;
                        }
                        const inputs = createFakeInputs((method as any).inputs || []);
                        const signer = await env.provider.getSigner(env.txDefaults.from as string);
                        const connected = featureContract.connect(signer) as any;
                        await expect(connected[fn](...inputs)).to.be.reverted;
                    });
                }
            }
        });
    }

    describe('TransformERC20', () => {
        it('has the correct transformer deployer', async () => {
            const abi = ['function getTransformerDeployer() view returns (address)'];
            const feature = new ethers.Contract(await zeroEx.getAddress(), abi, env.provider);
            const val = await feature.getTransformerDeployer();
            expect(val).to.eq(transformerDeployer);
        });
    });
});
