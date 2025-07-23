import { BlockchainLifecycle } from './blockchain_lifecycle'; // Custom import
import { TxData, Web3Wrapper } from '@0x/web3-wrapper';
import * as _ from 'lodash';
import * as mocha from 'mocha';
import * as process from 'process';

import { provider, txDefaults, web3Wrapper } from './web3_wrapper';

export type ISuite = mocha.ISuite;
export type ISuiteCallbackContext = mocha.ISuiteCallbackContext;
export type SuiteCallback = (this: ISuiteCallbackContext) => void;
export type ContextDefinitionCallback<T> = (description: string, callback: SuiteCallback) => T;
export type BlockchainSuiteCallback = (this: ISuiteCallbackContext, env: BlockchainTestsEnvironment) => void;
export type BlockchainContextDefinitionCallback<T> = (description: string, callback: BlockchainSuiteCallback) => T;
export interface ContextDefinition extends mocha.IContextDefinition {
    optional: ContextDefinitionCallback<ISuite | void>;
}

/**
 * `blockchainTests()` config options.
 */
export interface BlockchainContextConfig {
    fork: Partial<{
        // Accounts to unlock on hardhat.
        unlockedAccounts: string[];
    }>;
}

let TEST_ENV_CONFIG: Partial<BlockchainContextConfig> = {};

/**
 * Interface for `blockchainTests()`.
 */
export interface BlockchainContextDefinition {
    (description: string, callback: BlockchainSuiteCallback): ISuite;
    configure: (config?: Partial<BlockchainContextConfig>) => void;
    only: BlockchainContextDefinitionCallback<ISuite>;
    skip: BlockchainContextDefinitionCallback<void>;
    optional: BlockchainContextDefinitionCallback<ISuite | void>;
    resets: BlockchainContextDefinitionCallback<ISuite | void> & {
        only: BlockchainContextDefinitionCallback<ISuite>;
        skip: BlockchainContextDefinitionCallback<void>;
        optional: BlockchainContextDefinitionCallback<ISuite | void>;
    };
    fork: BlockchainContextDefinitionCallback<ISuite | void> & {
        only: BlockchainContextDefinitionCallback<ISuite>;
        skip: BlockchainContextDefinitionCallback<void>;
        optional: BlockchainContextDefinitionCallback<ISuite | void>;
        resets: BlockchainContextDefinitionCallback<ISuite | void>;
    };
    live: BlockchainContextDefinitionCallback<ISuite | void> & {
        only: BlockchainContextDefinitionCallback<ISuite>;
        skip: BlockchainContextDefinitionCallback<void>;
        optional: BlockchainContextDefinitionCallback<ISuite | void>;
    };
}

/**
 * Describes the environment object passed into the `blockchainTests()` callback.
 */
export interface BlockchainTestsEnvironment {
    blockchainLifecycle: BlockchainLifecycle;
    provider: any; // Changed from Web3ProviderEngine
    txDefaults: Partial<TxData>;
    web3Wrapper: Web3Wrapper;
    accounts: string[];
}

class BlockchainTestsEnvironmentBase {
    public blockchainLifecycle!: BlockchainLifecycle;
    public provider!: any; // Changed from Web3ProviderEngine
    public txDefaults!: Partial<TxData>;
    public web3Wrapper!: Web3Wrapper;
    public accounts!: string[];

    public async getTxDataWithDefaults(txData: Partial<TxData> = {}): Promise<TxData> {
        return { ...this.txDefaults, ...txData } as TxData;
    }

    public reset(): void {
        throw new Error(`${this.constructor.name} is not initialized`);
    }
}

interface BlockchainEnvironmentFactory {
    create(): BlockchainTestsEnvironment;
}

/**
 * `BlockchainTestsEnvironment` that uses the default hardhat provider.
 */
export class StandardBlockchainTestsEnvironmentSingleton extends BlockchainTestsEnvironmentBase {
    private static _instance: StandardBlockchainTestsEnvironmentSingleton | undefined;

    // Create or retrieve the singleton instance of this class.
    public static create(): StandardBlockchainTestsEnvironmentSingleton {
        if (StandardBlockchainTestsEnvironmentSingleton._instance === undefined) {
            StandardBlockchainTestsEnvironmentSingleton._instance = new StandardBlockchainTestsEnvironmentSingleton();
        }
        return StandardBlockchainTestsEnvironmentSingleton._instance;
    }

    // Reset the singleton.
    public static reset(): void {
        StandardBlockchainTestsEnvironmentSingleton._instance = undefined;
    }

    // Get the singleton instance of this class.
    public static getInstance(): StandardBlockchainTestsEnvironmentSingleton | undefined {
        return StandardBlockchainTestsEnvironmentSingleton._instance;
    }

    protected constructor() {
        super();
        this.blockchainLifecycle = new BlockchainLifecycle();
        this.provider = provider;
        this.txDefaults = txDefaults;
        this.web3Wrapper = web3Wrapper;
        // Initialize with Hardhat default accounts
        this.accounts = [
            '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
            '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
            '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
            '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
            '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
            '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
            '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',
            '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720'
        ];
    }
}

/**
 * `BlockchainTestsEnvironment` that uses a forked hardhat provider.
 */
export class ForkedBlockchainTestsEnvironmentSingleton extends BlockchainTestsEnvironmentBase {
    private static _instance: ForkedBlockchainTestsEnvironmentSingleton | undefined;

    // Create or retrieve the singleton instance of this class.
    public static create(): ForkedBlockchainTestsEnvironmentSingleton {
        if (ForkedBlockchainTestsEnvironmentSingleton._instance === undefined) {
            ForkedBlockchainTestsEnvironmentSingleton._instance = new ForkedBlockchainTestsEnvironmentSingleton();
        }
        return ForkedBlockchainTestsEnvironmentSingleton._instance;
    }

    // Reset the singleton.
    public static reset(): void {
        ForkedBlockchainTestsEnvironmentSingleton._instance = undefined;
    }

    protected static _createWeb3Provider(forkHost: string): any {
        // Changed from Web3ProviderEngine
        // TODO: Implement forking with hardhat
        // For now, just return a dummy provider
        console.warn(`Fork provider not implemented yet for ${forkHost}`);
        return createDummyProvider();
    }

    // Get the singleton instance of this class.
    public static getInstance(): ForkedBlockchainTestsEnvironmentSingleton | undefined {
        return ForkedBlockchainTestsEnvironmentSingleton._instance;
    }

    protected constructor() {
        super();
        this.txDefaults = txDefaults;
        this.provider = process.env.FORK_RPC_URL
            ? ForkedBlockchainTestsEnvironmentSingleton._createWeb3Provider(process.env.FORK_RPC_URL)
            : // Create a dummy provider if no RPC backend supplied.
              createDummyProvider();
        this.web3Wrapper = new Web3Wrapper(this.provider);
        this.blockchainLifecycle = new BlockchainLifecycle();
        this.accounts = []; // TODO: Load from provider
    }
}

/**
 * `BlockchainTestsEnvironment` that uses a live web3 provider.
 */
export class LiveBlockchainTestsEnvironmentSingleton extends BlockchainTestsEnvironmentBase {
    private static _instance: LiveBlockchainTestsEnvironmentSingleton | undefined;

    // Create or retrieve the singleton instance of this class.
    public static create(): LiveBlockchainTestsEnvironmentSingleton {
        if (LiveBlockchainTestsEnvironmentSingleton._instance === undefined) {
            LiveBlockchainTestsEnvironmentSingleton._instance = new LiveBlockchainTestsEnvironmentSingleton();
        }
        return LiveBlockchainTestsEnvironmentSingleton._instance;
    }

    // Reset the singleton.
    public static reset(): void {
        LiveBlockchainTestsEnvironmentSingleton._instance = undefined;
    }

    protected static _createWeb3Provider(rpcHost: string): any {
        // Changed from Web3ProviderEngine
        // TODO: Implement live provider with hardhat
        // For now, just return a dummy provider
        console.warn(`Live provider not implemented yet for ${rpcHost}`);
        return createDummyProvider();
    }

    // Get the singleton instance of this class.
    public static getInstance(): LiveBlockchainTestsEnvironmentSingleton | undefined {
        return LiveBlockchainTestsEnvironmentSingleton._instance;
    }

    protected constructor() {
        super();
        this.txDefaults = txDefaults;
        this.provider = process.env.LIVE_RPC_URL
            ? LiveBlockchainTestsEnvironmentSingleton._createWeb3Provider(process.env.LIVE_RPC_URL)
            : // Create a dummy provider if no RPC backend supplied.
              createDummyProvider();
        this.web3Wrapper = new Web3Wrapper(this.provider);
        const snapshotHandlerAsync = async (): Promise<void> => {
            throw new Error('Snapshots are not supported with a live provider.');
        };
        this.blockchainLifecycle = {
            startAsync: snapshotHandlerAsync,
            revertAsync: snapshotHandlerAsync,
        } as any;
        this.accounts = []; // TODO: Load from provider
    }
}

// The original `describe()` global provided by mocha.
const mochaDescribe = (global as any).describe as mocha.IContextDefinition;

/**
 * An augmented version of mocha's `describe()`.
 */
export const describe = _.assign(mochaDescribe, {
    optional(description: string, callback: SuiteCallback): ISuite | void {
        const describeCall = process.env.TEST_ALL ? mochaDescribe : mochaDescribe.skip;
        return describeCall(description, callback);
    },
}) as ContextDefinition;

/**
 * Like mocha's `describe()`, but sets up a blockchain environment for you.
 */
export const blockchainTests: BlockchainContextDefinition = _.assign(
    function (description: string, callback: BlockchainSuiteCallback): ISuite {
        return defineBlockchainSuite(StandardBlockchainTestsEnvironmentSingleton, description, callback, describe);
    },
    {
        configure(config?: Partial<BlockchainContextConfig>): void {
            // Update the global config and reset all environment singletons.
            TEST_ENV_CONFIG = {
                ...TEST_ENV_CONFIG,
                ...config,
            };
            ForkedBlockchainTestsEnvironmentSingleton.reset();
            StandardBlockchainTestsEnvironmentSingleton.reset();
            LiveBlockchainTestsEnvironmentSingleton.reset();
        },
        only(description: string, callback: BlockchainSuiteCallback): ISuite {
            return defineBlockchainSuite(
                StandardBlockchainTestsEnvironmentSingleton,
                description,
                callback,
                describe.only,
            );
        },
        skip(description: string, callback: BlockchainSuiteCallback): void {
            return defineBlockchainSuite(
                StandardBlockchainTestsEnvironmentSingleton,
                description,
                callback,
                describe.skip,
            );
        },
        optional(description: string, callback: BlockchainSuiteCallback): ISuite | void {
            return defineBlockchainSuite(
                StandardBlockchainTestsEnvironmentSingleton,
                description,
                callback,
                process.env.TEST_ALL ? describe : describe.skip,
            );
        },
        fork: _.assign(
            function (description: string, callback: BlockchainSuiteCallback): ISuite | void {
                return defineBlockchainSuite(
                    ForkedBlockchainTestsEnvironmentSingleton,
                    description,
                    callback,
                    process.env.FORK_RPC_URL ? describe : describe.skip,
                );
            },
            {
                only(description: string, callback: BlockchainSuiteCallback): ISuite | void {
                    return defineBlockchainSuite(
                        ForkedBlockchainTestsEnvironmentSingleton,
                        description,
                        callback,
                        process.env.FORK_RPC_URL ? describe.only : describe.skip,
                    );
                },
                skip(description: string, callback: BlockchainSuiteCallback): void {
                    return defineBlockchainSuite(
                        ForkedBlockchainTestsEnvironmentSingleton,
                        description,
                        callback,
                        describe.skip,
                    );
                },
                optional(description: string, callback: BlockchainSuiteCallback): ISuite | void {
                    return defineBlockchainSuite(
                        ForkedBlockchainTestsEnvironmentSingleton,
                        description,
                        callback,
                        process.env.FORK_RPC_URL ? describe.optional : describe.skip,
                    );
                },
                resets(description: string, callback: BlockchainSuiteCallback): ISuite | void {
                    return defineResetsBlockchainSuite(
                        ForkedBlockchainTestsEnvironmentSingleton,
                        description,
                        callback,
                        process.env.FORK_RPC_URL ? describe : describe.skip,
                    );
                },
            },
        ),
        live: _.assign(
            function (description: string, callback: BlockchainSuiteCallback): ISuite | void {
                return defineBlockchainSuite(
                    LiveBlockchainTestsEnvironmentSingleton,
                    description,
                    callback,
                    process.env.LIVE_RPC_URL ? describe : describe.skip,
                );
            },
            {
                only(description: string, callback: BlockchainSuiteCallback): ISuite | void {
                    return defineBlockchainSuite(
                        LiveBlockchainTestsEnvironmentSingleton,
                        description,
                        callback,
                        process.env.LIVE_RPC_URL ? describe.only : describe.skip,
                    );
                },
                skip(description: string, callback: BlockchainSuiteCallback): void {
                    return defineBlockchainSuite(
                        LiveBlockchainTestsEnvironmentSingleton,
                        description,
                        callback,
                        describe.skip,
                    );
                },
                optional(description: string, callback: BlockchainSuiteCallback): ISuite | void {
                    return defineBlockchainSuite(
                        LiveBlockchainTestsEnvironmentSingleton,
                        description,
                        callback,
                        process.env.LIVE_RPC_URL ? describe.optional : describe.skip,
                    );
                },
            },
        ),
        resets: _.assign(
            function (description: string, callback: BlockchainSuiteCallback): ISuite {
                return defineResetsBlockchainSuite(
                    StandardBlockchainTestsEnvironmentSingleton,
                    description,
                    callback,
                    describe,
                );
            },
            {
                only(description: string, callback: BlockchainSuiteCallback): ISuite {
                    return defineResetsBlockchainSuite(
                        StandardBlockchainTestsEnvironmentSingleton,
                        description,
                        callback,
                        describe.only,
                    );
                },
                skip(description: string, callback: BlockchainSuiteCallback): void {
                    return defineResetsBlockchainSuite(
                        StandardBlockchainTestsEnvironmentSingleton,
                        description,
                        callback,
                        describe.skip,
                    );
                },
                optional(description: string, callback: BlockchainSuiteCallback): ISuite | void {
                    return defineResetsBlockchainSuite(
                        StandardBlockchainTestsEnvironmentSingleton,
                        description,
                        callback,
                        describe.optional,
                    );
                },
            },
        ),
    },
) as BlockchainContextDefinition;

function defineBlockchainSuite<T>(
    envFactory: BlockchainEnvironmentFactory,
    description: string,
    callback: BlockchainSuiteCallback,
    describeCall: ContextDefinitionCallback<T>,
): T {
    return describeCall(description, function (this: ISuiteCallbackContext): void {
        callback.call(this, envFactory.create());
    });
}

function defineResetsBlockchainSuite<T>(
    envFactory: BlockchainEnvironmentFactory,
    description: string,
    callback: BlockchainSuiteCallback,
    describeCall: ContextDefinitionCallback<T>,
): T {
    return describeCall(description, function (this: ISuiteCallbackContext): void {
        const env = envFactory.create();
        beforeEach(async () => env.blockchainLifecycle.startAsync());
        afterEach(async () => env.blockchainLifecycle.revertAsync());
        callback.call(this, env);
    });
}

function createDummyProvider(): any {
    // Changed from Web3ProviderEngine
    return {
        addProvider: _.noop,
        on: _.noop,
        send: _.noop,
        sendAsync: _.noop,
        start: _.noop,
        stop: _.noop,
    } as any;
}
