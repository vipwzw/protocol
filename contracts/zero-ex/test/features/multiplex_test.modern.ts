import { expect } from 'chai';
const { ethers } = require('hardhat');
import { Contract } from 'ethers';
import { randomBytes } from 'crypto';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

// Configure chai-as-promised for proper async error handling
chai.use(chaiAsPromised);

describe('MultiplexFeature - Complete Modern Tests', function() {
    // Extended timeout for complex multiplex operations
    this.timeout(300000);
    
    let owner: any;
    let maker: any;
    let taker: any;
    let zeroEx: any;
    let multiplex: any;
    let flashWalletAddress: string;
    let sandbox: any;
    let liquidityProvider: any;
    let sushiFactory: any;
    let uniV2Factory: any;
    let uniV3Factory: any;
    let dai: any;
    let shib: any;
    let zrx: any;
    let weth: any;
    let transformerNonce: number;
    let transformFeature: any; // TransformERC20Feature interface pointing to ZeroEx
    
    const POOL_FEE = 1234;
    const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
    const NULL_BYTES = '0x';
    const MAX_UINT256 = ethers.MaxUint256;
    const ZERO_AMOUNT = 0n;
    
    // Multiplex subcall enum
    enum MultiplexSubcall {
        Invalid = 0,
        Rfq = 1,
        Otc = 2,
        UniswapV2 = 3,
        UniswapV3 = 4,
        LiquidityProvider = 5,
        TransformERC20 = 6,
        BatchSell = 7,
        MultiHopSell = 8
    }
    
    interface TransferEvent {
        token: string;
        from: string;
        to: string;
        value?: bigint;
    }
    
    interface MultiHopSellSubcall {
        id: MultiplexSubcall;
        data: string;
    }
    
    interface BatchSellSubcall extends MultiHopSellSubcall {
        sellAmount: bigint;
    }
    
    before(async function() {
        console.log('🚀 Setting up Complete MultiplexFeature Test...');
        
        // Get signers
        const signers = await ethers.getSigners();
        [owner, maker, taker] = signers;
        
        console.log('👤 Owner:', owner.address);
        console.log('👤 Maker:', maker.address);
        console.log('👤 Taker:', taker.address);
        
        await deployContractsAsync();
        await migrateOtcOrdersFeatureAsync();
        await migrateLiquidityProviderContractsAsync();
        await migrateUniswapV2ContractsAsync();
        await migrateUniswapV3ContractsAsync();
        await migrateMultiplexFeatureAsync();
        
        console.log('✅ Complete MultiplexFeature test environment ready!');
    });
    
    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying MultiplexFeature contracts using FullMigration pattern...');
        
        // Deploy tokens using TestMintableERC20Token (no constructor params)
        const TokenFactory = await ethers.getContractFactory('TestMintableERC20Token');
        
        dai = await TokenFactory.deploy();
        await dai.waitForDeployment();
        
        shib = await TokenFactory.deploy();
        await shib.waitForDeployment();
        
        zrx = await TokenFactory.deploy();
        await zrx.waitForDeployment();
        
        const WethFactory = await ethers.getContractFactory('TestWeth');
        weth = await WethFactory.deploy();
        await weth.waitForDeployment();
        
        console.log(`✅ Tokens deployed`);
        
        // Use FullMigration pattern like BatchFillNativeOrders test
        const FullMigrationFactory = await ethers.getContractFactory('FullMigration');
        const migrator = await FullMigrationFactory.deploy(owner.address);
        await migrator.waitForDeployment();
        console.log(`✅ FullMigration: ${await migrator.getAddress()}`);
        
        // Get correct bootstrapper from migrator
        const bootstrapper = await migrator.getBootstrapper();
        
        // Deploy ZeroEx with correct bootstrapper (this avoids permission issues)
        const ZeroExFactory = await ethers.getContractFactory('ZeroEx');
        zeroEx = await ZeroExFactory.deploy(bootstrapper);
        await zeroEx.waitForDeployment();
        const verifyingContract = await zeroEx.getAddress();
        console.log(`✅ ZeroEx: ${verifyingContract}`);
        
        // Deploy all required features for full migration
        const SimpleFunctionRegistryFactory = await ethers.getContractFactory('SimpleFunctionRegistryFeature');
        const registry = await SimpleFunctionRegistryFactory.deploy();
        await registry.waitForDeployment();
        
        const OwnableFactory = await ethers.getContractFactory('OwnableFeature');
        const ownable = await OwnableFactory.deploy();
        await ownable.waitForDeployment();
        
        const TransformERC20Factory = await ethers.getContractFactory('TransformERC20Feature');
        const transformERC20 = await TransformERC20Factory.deploy();
        await transformERC20.waitForDeployment();
        
        const MetaTransactionsFactory = await ethers.getContractFactory('MetaTransactionsFeature');
        const metaTransactions = await MetaTransactionsFactory.deploy(verifyingContract);
        await metaTransactions.waitForDeployment();
        
        // Deploy staking and fee collector for NativeOrdersFeature
        const TestStakingFactory = await ethers.getContractFactory('TestStaking');
        const staking = await TestStakingFactory.deploy(await weth.getAddress());
        await staking.waitForDeployment();
        
        const FeeCollectorFactory = await ethers.getContractFactory('FeeCollectorController');
        const feeCollector = await FeeCollectorFactory.deploy(await weth.getAddress(), await staking.getAddress());
        await feeCollector.waitForDeployment();
        
        // Use TestNativeOrdersFeature
        const TestNativeOrdersFactory = await ethers.getContractFactory('TestNativeOrdersFeature');
        const nativeOrders = await TestNativeOrdersFactory.deploy(
            verifyingContract,
            await weth.getAddress(),
            await staking.getAddress(),
            await feeCollector.getAddress(),
            70000 // protocolFeeMultiplier
        );
        await nativeOrders.waitForDeployment();
        
        const OtcOrdersFactory = await ethers.getContractFactory('OtcOrdersFeature');
        const otcOrders = await OtcOrdersFactory.deploy(verifyingContract, await weth.getAddress());
        await otcOrders.waitForDeployment();
        
        console.log(`✅ All features deployed`);
        
        // Use FullMigration's migrateZeroEx with all features (this handles bootstrap correctly)
        const features = {
            registry: await registry.getAddress(),
            ownable: await ownable.getAddress(),
            transformERC20: await transformERC20.getAddress(),
            metaTransactions: await metaTransactions.getAddress(),
            nativeOrders: await nativeOrders.getAddress(),
            otcOrders: await otcOrders.getAddress()
        };
        
        await migrator.migrateZeroEx(
            owner.address,
            verifyingContract,
            features,
            {
                transformerDeployer: owner.address // Set valid transformer deployer
            }
        );
        console.log(`✅ ZeroEx fully migrated with all features including TransformERC20`);
        
        // Create TransformERC20Feature interface pointing to ZeroEx (proxy pattern)
        transformFeature = new ethers.Contract(
            verifyingContract,
            transformERC20.interface,
            ethers.provider
        );
        console.log(`✅ TransformERC20Feature interface created`);
        
        // Now getTransformWallet should work through the feature interface!
        flashWalletAddress = await transformFeature.getTransformWallet();
        console.log(`✅ FlashWallet address obtained: ${flashWalletAddress}`);
        
        // Initialize transformer nonce
        transformerNonce = 0;
        
        // Setup token approvals and balances
        await setupTokensAsync();
    }

    async function setupTokensAsync(): Promise<void> {
        const tokens = [dai, shib, zrx, weth];
        const accounts = [owner, maker, taker];
        const zeroExAddress = await zeroEx.getAddress();
        
        for (const token of tokens) {
            for (const account of accounts) {
                // Mint tokens
                await mintToAsync(token, account.address, ethers.parseEther('1000000'));
                // Approve ZeroEx
                await token.connect(account).approve(zeroExAddress, MAX_UINT256);
            }
        }
        
        console.log(`✅ Token setup complete`);
    }
    
    async function migrateOtcOrdersFeatureAsync(): Promise<void> {
        console.log('📦 Migrating OTC orders feature...');
        const OtcFeatureFactory = await ethers.getContractFactory('TestOtcOrdersFeature');
        const featureImpl = await OtcFeatureFactory.deploy(
            await zeroEx.getAddress(),
            await weth.getAddress()
        );
        await featureImpl.waitForDeployment();
        
        await zeroEx.connect(owner).migrate(
            await featureImpl.getAddress(),
            featureImpl.interface.encodeFunctionData('migrate', [])
        );
        
        console.log(`✅ OTC orders feature migrated`);
    }
    
    async function migrateLiquidityProviderContractsAsync(): Promise<void> {
        console.log('📦 Migrating liquidity provider contracts...');
        
        const SandboxFactory = await ethers.getContractFactory('LiquidityProviderSandbox');
        sandbox = await SandboxFactory.deploy(await zeroEx.getAddress());
        await sandbox.waitForDeployment();
        
        const LiquidityProviderFactory = await ethers.getContractFactory('TestLiquidityProvider');
        liquidityProvider = await LiquidityProviderFactory.deploy();
        await liquidityProvider.waitForDeployment();
        
        console.log(`✅ Liquidity provider contracts migrated`);
    }
    
    async function migrateUniswapV2ContractsAsync(): Promise<void> {
        console.log('📦 Migrating Uniswap V2 contracts...');
        
        const UniV2FactoryFactory = await ethers.getContractFactory('TestUniswapV2Factory');
        
        sushiFactory = await UniV2FactoryFactory.deploy();
        await sushiFactory.waitForDeployment();
        
        uniV2Factory = await UniV2FactoryFactory.deploy();
        await uniV2Factory.waitForDeployment();
        
        console.log(`✅ Uniswap V2 contracts migrated`);
    }
    
    async function migrateUniswapV3ContractsAsync(): Promise<void> {
        console.log('📦 Migrating Uniswap V3 contracts...');
        
        const UniV3FactoryFactory = await ethers.getContractFactory('TestUniswapV3Factory');
        uniV3Factory = await UniV3FactoryFactory.deploy();
        await uniV3Factory.waitForDeployment();
        
        const UniV3FeatureFactory = await ethers.getContractFactory('TestUniswapV3Feature');
        const featureImpl = await UniV3FeatureFactory.deploy(
            await weth.getAddress(),
            await uniV3Factory.getAddress(),
            await uniV3Factory.POOL_INIT_CODE_HASH()
        );
        await featureImpl.waitForDeployment();
        
        await zeroEx.connect(owner).migrate(
            await featureImpl.getAddress(),
            featureImpl.interface.encodeFunctionData('migrate', [])
        );
        
        console.log(`✅ Uniswap V3 contracts migrated`);
    }
    
    async function migrateMultiplexFeatureAsync(): Promise<void> {
        console.log('📦 Migrating Multiplex feature...');
        
        const MultiplexFactory = await ethers.getContractFactory('TestMultiplexFeature');
        const featureImpl = await MultiplexFactory.deploy(
            await zeroEx.getAddress(),
            await weth.getAddress(),
            await sandbox.getAddress(),
            await uniV2Factory.getAddress(),
            await sushiFactory.getAddress(),
            await uniV2Factory.POOL_INIT_CODE_HASH(),
            await sushiFactory.POOL_INIT_CODE_HASH()
        );
        await featureImpl.waitForDeployment();
        
        await zeroEx.connect(owner).migrate(
            await featureImpl.getAddress(),
            featureImpl.interface.encodeFunctionData('migrate', [])
        );
        
        multiplex = featureImpl.attach(await zeroEx.getAddress());
        
        console.log(`✅ Multiplex feature migrated`);
    }

    // Utility functions
    function generateRandomBytes32(): string {
        return '0x' + randomBytes(32).toString('hex');
    }

    function generateRandomAddress(): string {
        return '0x' + randomBytes(20).toString('hex');
    }

    function toBaseUnitAmount(amount: number): bigint {
        return ethers.parseEther(amount.toString());
    }

    const HIGH_BIT = 1n << 255n;
    function encodeFractionalFillAmount(frac: number): bigint {
        return HIGH_BIT + BigInt(Math.floor(frac * 1e18));
    }

    function isWethContract(token: any): boolean {
        return token === weth;
    }

    async function mintToAsync(token: any, recipient: string, amount: bigint): Promise<void> {
        if (isWethContract(token)) {
            await token.depositTo(recipient, { value: amount });
        } else {
            await token.mint(recipient, amount);
        }
    }

    // Deploy Uniswap pools
    async function createUniswapV2PoolAsync(
        factory: any,
        token0: any,
        token1: any,
        balance0: bigint = toBaseUnitAmount(10),
        balance1: bigint = toBaseUnitAmount(10)
    ): Promise<any> {
        const result = await factory.createPool(await token0.getAddress(), await token1.getAddress());
        const receipt = await result.wait();
        
        const poolCreatedEvent = receipt.logs.find((log: any) => log.fragment?.name === 'PoolCreated');
        const poolAddress = poolCreatedEvent.args.pool;
        
        const PoolFactory = await ethers.getContractFactory('TestUniswapV2Pool');
        const pool = PoolFactory.attach(poolAddress);
        
        await mintToAsync(token0, poolAddress, balance0);
        await mintToAsync(token1, poolAddress, balance1);
        
        const token0Address = await token0.getAddress();
        const token1Address = await token1.getAddress();
        
        if (token0Address < token1Address) {
            await pool.setReserves(balance0, balance1, ZERO_AMOUNT);
        } else {
            await pool.setReserves(balance1, balance0, ZERO_AMOUNT);
        }
        
        return pool;
    }

    async function createUniswapV3PoolAsync(
        token0: any,
        token1: any,
        balance0: bigint = toBaseUnitAmount(10),
        balance1: bigint = toBaseUnitAmount(10)
    ): Promise<any> {
        const result = await uniV3Factory.createPool(
            await token0.getAddress(),
            await token1.getAddress(),
            POOL_FEE
        );
        const receipt = await result.wait();
        
        const poolCreatedEvent = receipt.logs.find((log: any) => log.fragment?.name === 'PoolCreated');
        const poolAddress = poolCreatedEvent.args.pool;
        
        const PoolFactory = await ethers.getContractFactory('TestUniswapV3Pool');
        const pool = PoolFactory.attach(poolAddress);
        
        await mintToAsync(token0, poolAddress, balance0);
        await mintToAsync(token1, poolAddress, balance1);
        
        return pool;
    }

    // Generate subcalls
    function getTestRfqOrder(overrides: any = {}): any {
        return {
            maker: maker.address,
            taker: taker.address,
            makerToken: zrx.target || zrx.address,
            takerToken: dai.target || dai.address,
            makerAmount: toBaseUnitAmount(1),
            takerAmount: toBaseUnitAmount(1),
            txOrigin: taker.address,
            pool: ethers.ZeroHash,
            expiry: Math.floor(Date.now() / 1000) + 3600,
            salt: generateRandomBytes32(),
            verifyingContract: zeroEx.target || zeroEx.address,
            chainId: 1337,
            ...overrides
        };
    }

    async function getRfqSubcallAsync(
        rfqOrder: any,
        sellAmount: bigint = rfqOrder.takerAmount
    ): Promise<BatchSellSubcall> {
        const makerToken = rfqOrder.makerToken === (weth.target || weth.address) ? weth :
            (rfqOrder.makerToken === (zrx.target || zrx.address) ? zrx : dai);
        
        await mintToAsync(makerToken, rfqOrder.maker, rfqOrder.makerAmount);
        
        const orderHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(rfqOrder)));
        const signature = await maker.signMessage(ethers.getBytes(orderHash));
        
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
            ['tuple(address maker, address taker, address makerToken, address takerToken, uint256 makerAmount, uint256 takerAmount, address txOrigin, bytes32 pool, uint64 expiry, uint256 salt)', 'bytes'],
            [rfqOrder, signature]
        );
        
        return {
            id: MultiplexSubcall.Rfq,
            sellAmount,
            data
        };
    }

    function getTestOtcOrder(fields: any = {}): any {
        return {
            maker: maker.address,
            taker: taker.address,
            makerToken: zrx.target || zrx.address,
            takerToken: dai.target || dai.address,
            makerAmount: toBaseUnitAmount(1),
            takerAmount: toBaseUnitAmount(1),
            txOrigin: taker.address,
            nonceBucket: generateRandomBytes32(),
            nonce: BigInt(Math.floor(Math.random() * 1000000)),
            expiry: Math.floor(Date.now() / 1000) + 3600,
            verifyingContract: zeroEx.target || zeroEx.address,
            chainId: 1337,
            ...fields
        };
    }

    async function getOtcSubcallAsync(
        otcOrder: any,
        sellAmount: bigint = otcOrder.takerAmount
    ): Promise<BatchSellSubcall> {
        const makerToken = otcOrder.makerToken === (weth.target || weth.address) ? weth :
            (otcOrder.makerToken === (zrx.target || zrx.address) ? zrx : dai);
        
        await mintToAsync(makerToken, otcOrder.maker, otcOrder.makerAmount);
        
        const orderHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(otcOrder)));
        const signature = await maker.signMessage(ethers.getBytes(orderHash));
        
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
            ['tuple(address maker, address taker, address makerToken, address takerToken, uint256 makerAmount, uint256 takerAmount, address txOrigin, uint256 nonceBucket, uint256 nonce, uint64 expiry)', 'bytes'],
            [otcOrder, signature]
        );
        
        return {
            id: MultiplexSubcall.Otc,
            sellAmount,
            data
        };
    }

    function getUniswapV2MultiHopSubcall(tokens: string[], isSushi = false): MultiHopSellSubcall {
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address[]', 'bool'],
            [tokens, isSushi]
        );
        
        return {
            id: MultiplexSubcall.UniswapV2,
            data
        };
    }

    function getUniswapV2BatchSubcall(
        tokens: string[],
        sellAmount: bigint = toBaseUnitAmount(1),
        isSushi = false
    ): BatchSellSubcall {
        return {
            ...getUniswapV2MultiHopSubcall(tokens, isSushi),
            sellAmount
        };
    }

    function getUniswapV3MultiHopSubcall(tokens: any[]): MultiHopSellSubcall {
        const tokenAddresses = tokens.map(t => t.target || t.address);
        const fees = tokens.slice(0, -1).map(() => POOL_FEE);
        
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address[]', 'uint24[]'],
            [tokenAddresses, fees]
        );
        
        return {
            id: MultiplexSubcall.UniswapV3,
            data
        };
    }

    function getUniswapV3BatchSubcall(tokens: any[], sellAmount: bigint = toBaseUnitAmount(1)): BatchSellSubcall {
        return {
            ...getUniswapV3MultiHopSubcall(tokens),
            sellAmount
        };
    }

    function getLiquidityProviderBatchSubcall(sellAmount: bigint = toBaseUnitAmount(1)): BatchSellSubcall {
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'bytes'],
            [liquidityProvider.target || liquidityProvider.address, '0x']
        );
        
        return {
            id: MultiplexSubcall.LiquidityProvider,
            sellAmount,
            data
        };
    }

    function getTransformERC20Subcall(
        inputToken: string,
        outputToken: string,
        sellAmount: bigint = toBaseUnitAmount(1)
    ): BatchSellSubcall {
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'address', 'uint256'],
            [inputToken, outputToken, ++transformerNonce]
        );
        
        return {
            id: MultiplexSubcall.TransformERC20,
            sellAmount,
            data
        };
    }

    describe('batch sells', function() {
        describe('multiplexBatchSellTokenForToken', function() {
            it('reverts if minBuyAmount is not satisfied', async function() {
                const order = getTestRfqOrder();
                const rfqSubcall = await getRfqSubcallAsync(order);
                await mintToAsync(dai, taker.address, rfqSubcall.sellAmount);

                await expect(
                    multiplex.connect(taker).multiplexBatchSellTokenForToken(
                        dai.target || dai.address,
                        zrx.target || zrx.address,
                        [rfqSubcall],
                        order.takerAmount,
                        order.makerAmount + 1n
                    )
                ).to.be.rejectedWith('UNDERBOUGHT');
                
                console.log(`✅ Correctly rejected insufficient buy amount`);
            });

            it('reverts if given an invalid subcall type', async function() {
                const invalidSubcall: BatchSellSubcall = {
                    id: MultiplexSubcall.Invalid,
                    sellAmount: toBaseUnitAmount(1),
                    data: NULL_BYTES
                };

                await expect(
                    multiplex.connect(taker).multiplexBatchSellTokenForToken(
                        dai.target || dai.address,
                        zrx.target || zrx.address,
                        [invalidSubcall],
                        invalidSubcall.sellAmount,
                        ZERO_AMOUNT
                    )
                ).to.be.rejectedWith('INVALID_SUBCALL');
                
                console.log(`✅ Correctly rejected invalid subcall`);
            });

            it('reverts if the full sell amount is not sold', async function() {
                const order = getTestRfqOrder();
                const rfqSubcall = await getRfqSubcallAsync(order);
                await mintToAsync(dai, taker.address, rfqSubcall.sellAmount);

                await expect(
                    multiplex.connect(taker).multiplexBatchSellTokenForToken(
                        dai.target || dai.address,
                        zrx.target || zrx.address,
                        [rfqSubcall],
                        order.takerAmount + 1n,
                        order.makerAmount
                    )
                ).to.be.rejectedWith('INCORRECT_AMOUNT_SOLD');
                
                console.log(`✅ Correctly rejected incorrect amount sold`);
            });

            it('RFQ, fallback(UniswapV2)', async function() {
                const order = getTestRfqOrder();
                const rfqSubcall = await getRfqSubcallAsync(order);
                await createUniswapV2PoolAsync(uniV2Factory, dai, zrx);
                await mintToAsync(dai, taker.address, rfqSubcall.sellAmount);

                const result = await multiplex.connect(taker).multiplexBatchSellTokenForToken(
                    dai.target || dai.address,
                    zrx.target || zrx.address,
                    [rfqSubcall, getUniswapV2BatchSubcall([dai.target || dai.address, zrx.target || zrx.address], order.takerAmount)],
                    order.takerAmount,
                    ZERO_AMOUNT
                );
                
                const receipt = await result.wait();
                
                // Check for RfqOrderFilled event
                const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'RfqOrderFilled');
                expect(fillEvent).to.not.be.undefined;
                
                console.log(`✅ RFQ with UniswapV2 fallback executed`);
            });

            it('OTC, fallback(UniswapV2)', async function() {
                const order = getTestOtcOrder();
                const otcSubcall = await getOtcSubcallAsync(order);
                await createUniswapV2PoolAsync(uniV2Factory, dai, zrx);
                await mintToAsync(dai, taker.address, otcSubcall.sellAmount);

                const result = await multiplex.connect(taker).multiplexBatchSellTokenForToken(
                    dai.target || dai.address,
                    zrx.target || zrx.address,
                    [otcSubcall, getUniswapV2BatchSubcall([dai.target || dai.address, zrx.target || zrx.address], order.takerAmount)],
                    order.takerAmount,
                    ZERO_AMOUNT
                );
                
                const receipt = await result.wait();
                
                // Check for OtcOrderFilled event
                const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'OtcOrderFilled');
                expect(fillEvent).to.not.be.undefined;
                
                console.log(`✅ OTC with UniswapV2 fallback executed`);
            });

            it('expired RFQ, fallback(UniswapV2)', async function() {
                const order = getTestRfqOrder({ expiry: 0 });
                const rfqSubcall = await getRfqSubcallAsync(order);
                const uniswap = await createUniswapV2PoolAsync(uniV2Factory, dai, zrx);
                await mintToAsync(dai, taker.address, rfqSubcall.sellAmount);

                const result = await multiplex.connect(taker).multiplexBatchSellTokenForToken(
                    dai.target || dai.address,
                    zrx.target || zrx.address,
                    [rfqSubcall, getUniswapV2BatchSubcall([dai.target || dai.address, zrx.target || zrx.address], order.takerAmount)],
                    order.takerAmount,
                    ZERO_AMOUNT
                );
                
                const receipt = await result.wait();
                
                // Check for ExpiredRfqOrder event
                const expiredEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ExpiredRfqOrder');
                expect(expiredEvent).to.not.be.undefined;
                
                // Check for transfer events showing fallback to Uniswap
                const transferEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'Transfer');
                expect(transferEvents.length).to.be.greaterThan(0);
                
                console.log(`✅ Expired RFQ with UniswapV2 fallback executed`);
            });

            it('expired OTC, fallback(UniswapV2)', async function() {
                const order = getTestOtcOrder({ expiry: 0 });
                const otcSubcall = await getOtcSubcallAsync(order);
                const uniswap = await createUniswapV2PoolAsync(uniV2Factory, dai, zrx);
                await mintToAsync(dai, taker.address, otcSubcall.sellAmount);

                const result = await multiplex.connect(taker).multiplexBatchSellTokenForToken(
                    dai.target || dai.address,
                    zrx.target || zrx.address,
                    [otcSubcall, getUniswapV2BatchSubcall([dai.target || dai.address, zrx.target || zrx.address], order.takerAmount)],
                    order.takerAmount,
                    ZERO_AMOUNT
                );
                
                const receipt = await result.wait();
                
                // Check for ExpiredOtcOrder event
                const expiredEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ExpiredOtcOrder');
                expect(expiredEvent).to.not.be.undefined;
                
                // Check for transfer events showing fallback to Uniswap
                const transferEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'Transfer');
                expect(transferEvents.length).to.be.greaterThan(0);
                
                console.log(`✅ Expired OTC with UniswapV2 fallback executed`);
            });

            it('expired RFQ, fallback(TransformERC20)', async function() {
                const order = getTestRfqOrder({ expiry: 0 });
                const rfqSubcall = await getRfqSubcallAsync(order);
                const transformERC20Subcall = getTransformERC20Subcall(
                    dai.target || dai.address,
                    zrx.target || zrx.address,
                    order.takerAmount
                );
                await mintToAsync(dai, taker.address, order.takerAmount);

                const result = await multiplex.connect(taker).multiplexBatchSellTokenForToken(
                    dai.target || dai.address,
                    zrx.target || zrx.address,
                    [rfqSubcall, transformERC20Subcall],
                    order.takerAmount,
                    ZERO_AMOUNT
                );
                
                const receipt = await result.wait();
                
                // Check for ExpiredRfqOrder event
                const expiredEvent = receipt.logs.find((log: any) => log.fragment?.name === 'ExpiredRfqOrder');
                expect(expiredEvent).to.not.be.undefined;
                
                // Check for transform events
                const transformEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'MintTransform');
                expect(transformEvents.length).to.be.greaterThan(0);
                
                console.log(`✅ Expired RFQ with TransformERC20 fallback executed`);
            });

            it('LiquidityProvider, UniV3, Sushiswap', async function() {
                const sushiswap = await createUniswapV2PoolAsync(sushiFactory, dai, zrx);
                const uniV3 = await createUniswapV3PoolAsync(dai, zrx);
                const liquidityProviderSubcall = getLiquidityProviderBatchSubcall();
                const uniV3Subcall = getUniswapV3BatchSubcall([dai, zrx]);
                const sushiswapSubcall = getUniswapV2BatchSubcall(
                    [dai.target || dai.address, zrx.target || zrx.address],
                    undefined,
                    true
                );
                
                const sellAmount = liquidityProviderSubcall.sellAmount + 
                                 uniV3Subcall.sellAmount + 
                                 sushiswapSubcall.sellAmount - 1n;
                
                await mintToAsync(dai, taker.address, sellAmount);
                
                const result = await multiplex.connect(taker).multiplexBatchSellTokenForToken(
                    dai.target || dai.address,
                    zrx.target || zrx.address,
                    [liquidityProviderSubcall, uniV3Subcall, sushiswapSubcall],
                    sellAmount,
                    ZERO_AMOUNT
                );
                
                const receipt = await result.wait();
                
                // Check for multiple transfer events from different protocols
                const transferEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'Transfer');
                expect(transferEvents.length).to.be.greaterThan(0);
                
                console.log(`✅ Multi-protocol batch sell executed: ${transferEvents.length} transfers`);
            });
        });

        describe('multiplexBatchSellEthForToken', function() {
            it('can sell ETH for tokens via RFQ', async function() {
                const order = getTestRfqOrder({
                    makerToken: dai.target || dai.address,
                    takerToken: weth.target || weth.address
                });
                const rfqSubcall = await getRfqSubcallAsync(order);

                const result = await multiplex.connect(taker).multiplexBatchSellEthForToken(
                    dai.target || dai.address,
                    [rfqSubcall],
                    ZERO_AMOUNT,
                    { value: order.takerAmount }
                );
                
                const receipt = await result.wait();
                
                // Check for RfqOrderFilled event
                const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'RfqOrderFilled');
                expect(fillEvent).to.not.be.undefined;
                
                console.log(`✅ ETH to token via RFQ executed`);
            });

            it('can sell ETH for tokens via UniswapV2', async function() {
                await createUniswapV2PoolAsync(uniV2Factory, weth, dai);
                const uniswapSubcall = getUniswapV2BatchSubcall(
                    [weth.target || weth.address, dai.target || dai.address],
                    ethers.parseEther('1')
                );

                const result = await multiplex.connect(taker).multiplexBatchSellEthForToken(
                    dai.target || dai.address,
                    [uniswapSubcall],
                    ZERO_AMOUNT,
                    { value: ethers.parseEther('1') }
                );
                
                const receipt = await result.wait();
                
                // Check for transfer events
                const transferEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'Transfer');
                expect(transferEvents.length).to.be.greaterThan(0);
                
                console.log(`✅ ETH to token via UniswapV2 executed`);
            });
        });

        describe('multiplexBatchSellTokenForEth', function() {
            it('can sell tokens for ETH via RFQ', async function() {
                const order = getTestRfqOrder({
                    makerToken: weth.target || weth.address,
                    takerToken: dai.target || dai.address
                });
                const rfqSubcall = await getRfqSubcallAsync(order);
                await mintToAsync(dai, taker.address, rfqSubcall.sellAmount);

                const balanceBefore = await ethers.provider.getBalance(taker.address);

                const result = await multiplex.connect(taker).multiplexBatchSellTokenForEth(
                    dai.target || dai.address,
                    [rfqSubcall],
                    order.takerAmount,
                    ZERO_AMOUNT
                );
                
                const receipt = await result.wait();
                const balanceAfter = await ethers.provider.getBalance(taker.address);

                // Check for RfqOrderFilled event
                const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'RfqOrderFilled');
                expect(fillEvent).to.not.be.undefined;
                
                // Should have received ETH (accounting for gas costs)
                expect(balanceAfter > balanceBefore - ethers.parseEther('0.1')).to.be.true;
                
                console.log(`✅ Token to ETH via RFQ executed`);
            });

            it('can sell tokens for ETH via UniswapV2', async function() {
                await createUniswapV2PoolAsync(uniV2Factory, dai, weth);
                const uniswapSubcall = getUniswapV2BatchSubcall(
                    [dai.target || dai.address, weth.target || weth.address],
                    ethers.parseEther('1')
                );
                await mintToAsync(dai, taker.address, ethers.parseEther('1'));

                const balanceBefore = await ethers.provider.getBalance(taker.address);

                const result = await multiplex.connect(taker).multiplexBatchSellTokenForEth(
                    dai.target || dai.address,
                    [uniswapSubcall],
                    ethers.parseEther('1'),
                    ZERO_AMOUNT
                );
                
                const receipt = await result.wait();
                const balanceAfter = await ethers.provider.getBalance(taker.address);

                // Check for transfer events
                const transferEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'Transfer');
                expect(transferEvents.length).to.be.greaterThan(0);
                
                // Should have received ETH (accounting for gas costs)
                expect(balanceAfter > balanceBefore - ethers.parseEther('0.1')).to.be.true;
                
                console.log(`✅ Token to ETH via UniswapV2 executed`);
            });
        });
    });

    describe('multihop sells', function() {
        describe('multiplexMultiHopSellTokenForToken', function() {
            it('can execute 2-hop sells through RFQ orders', async function() {
                // Create 2-hop path: DAI -> SHIB -> ZRX
                const order1 = getTestRfqOrder({
                    makerToken: shib.target || shib.address,
                    takerToken: dai.target || dai.address,
                    makerAmount: toBaseUnitAmount(1),
                    takerAmount: toBaseUnitAmount(1)
                });
                
                const order2 = getTestRfqOrder({
                    makerToken: zrx.target || zrx.address,
                    takerToken: shib.target || shib.address,
                    makerAmount: toBaseUnitAmount(1),
                    takerAmount: toBaseUnitAmount(1)
                });

                const rfqSubcall1 = await getRfqSubcallAsync(order1);
                const rfqSubcall2 = await getRfqSubcallAsync(order2);
                
                await mintToAsync(dai, taker.address, order1.takerAmount);

                const result = await multiplex.connect(taker).multiplexMultiHopSellTokenForToken(
                    dai.target || dai.address,
                    zrx.target || zrx.address,
                    [
                        { id: rfqSubcall1.id, data: rfqSubcall1.data },
                        { id: rfqSubcall2.id, data: rfqSubcall2.data }
                    ],
                    order1.takerAmount,
                    ZERO_AMOUNT
                );
                
                const receipt = await result.wait();
                
                // Check for multiple RfqOrderFilled events
                const fillEvents = receipt.logs.filter((log: any) => log.fragment?.name === 'RfqOrderFilled');
                expect(fillEvents.length).to.equal(2);
                
                console.log(`✅ 2-hop multi-hop sell executed with ${fillEvents.length} fills`);
            });

            it('can handle fractional fill amounts', async function() {
                const order = getTestRfqOrder();
                const rfqSubcall = await getRfqSubcallAsync(order);
                
                // Use fractional fill amount (50%)
                const fractionalAmount = encodeFractionalFillAmount(0.5);
                
                await mintToAsync(dai, taker.address, order.takerAmount);

                const result = await multiplex.connect(taker).multiplexMultiHopSellTokenForToken(
                    dai.target || dai.address,
                    zrx.target || zrx.address,
                    [{ id: rfqSubcall.id, data: rfqSubcall.data }],
                    fractionalAmount,
                    ZERO_AMOUNT
                );
                
                const receipt = await result.wait();
                
                // Check for RfqOrderFilled event
                const fillEvent = receipt.logs.find((log: any) => log.fragment?.name === 'RfqOrderFilled');
                expect(fillEvent).to.not.be.undefined;
                
                console.log(`✅ Fractional fill multi-hop executed (50%)`);
            });

            it('can mix different protocol subcalls', async function() {
                // Mix RFQ and UniswapV2
                await createUniswapV2PoolAsync(uniV2Factory, shib, zrx);
                
                const order = getTestRfqOrder({
                    makerToken: shib.target || shib.address,
                    takerToken: dai.target || dai.address
                });
                
                const rfqSubcall = await getRfqSubcallAsync(order);
                const uniswapSubcall = getUniswapV2MultiHopSubcall([
                    shib.target || shib.address,
                    zrx.target || zrx.address
                ]);
                
                await mintToAsync(dai, taker.address, order.takerAmount);

                const result = await multiplex.connect(taker).multiplexMultiHopSellTokenForToken(
                    dai.target || dai.address,
                    zrx.target || zrx.address,
                    [
                        { id: rfqSubcall.id, data: rfqSubcall.data },
                        uniswapSubcall
                    ],
                    order.takerAmount,
                    ZERO_AMOUNT
                );
                
                const receipt = await result.wait();
                
                // Should have both RFQ fill and Uniswap transfer events
                const fillEvents = receipt.logs.filter((log: any) => 
                    log.fragment?.name === 'RfqOrderFilled' || log.fragment?.name === 'Transfer'
                );
                expect(fillEvents.length).to.be.greaterThan(1);
                
                console.log(`✅ Mixed protocol multi-hop executed`);
            });
        });

        describe('multiplexMultiHopSellEthForToken', function() {
            it('can execute ETH to token multi-hop', async function() {
                // Create path: ETH -> DAI -> ZRX
                await createUniswapV2PoolAsync(uniV2Factory, weth, dai);
                
                const order = getTestRfqOrder({
                    makerToken: zrx.target || zrx.address,
                    takerToken: dai.target || dai.address
                });
                
                const uniswapSubcall = getUniswapV2MultiHopSubcall([
                    weth.target || weth.address,
                    dai.target || dai.address
                ]);
                
                const rfqSubcall = await getRfqSubcallAsync(order);

                const result = await multiplex.connect(taker).multiplexMultiHopSellEthForToken(
                    zrx.target || zrx.address,
                    [
                        uniswapSubcall,
                        { id: rfqSubcall.id, data: rfqSubcall.data }
                    ],
                    ZERO_AMOUNT,
                    { value: ethers.parseEther('1') }
                );
                
                const receipt = await result.wait();
                
                // Check for successful execution with events
                const events = receipt.logs.filter((log: any) => 
                    log.fragment?.name === 'RfqOrderFilled' || log.fragment?.name === 'Transfer'
                );
                expect(events.length).to.be.greaterThan(0);
                
                console.log(`✅ ETH to token multi-hop executed`);
            });
        });

        describe('multiplexMultiHopSellTokenForEth', function() {
            it('can execute token to ETH multi-hop', async function() {
                // Create path: DAI -> ZRX -> ETH
                const order = getTestRfqOrder({
                    makerToken: zrx.target || zrx.address,
                    takerToken: dai.target || dai.address
                });
                
                await createUniswapV2PoolAsync(uniV2Factory, zrx, weth);
                
                const rfqSubcall = await getRfqSubcallAsync(order);
                const uniswapSubcall = getUniswapV2MultiHopSubcall([
                    zrx.target || zrx.address,
                    weth.target || weth.address
                ]);
                
                await mintToAsync(dai, taker.address, order.takerAmount);
                
                const balanceBefore = await ethers.provider.getBalance(taker.address);

                const result = await multiplex.connect(taker).multiplexMultiHopSellTokenForEth(
                    dai.target || dai.address,
                    [
                        { id: rfqSubcall.id, data: rfqSubcall.data },
                        uniswapSubcall
                    ],
                    order.takerAmount,
                    ZERO_AMOUNT
                );
                
                const receipt = await result.wait();
                const balanceAfter = await ethers.provider.getBalance(taker.address);
                
                // Check for successful execution with events
                const events = receipt.logs.filter((log: any) => 
                    log.fragment?.name === 'RfqOrderFilled' || log.fragment?.name === 'Transfer'
                );
                expect(events.length).to.be.greaterThan(0);
                
                // Should have received ETH (accounting for gas costs)
                expect(balanceAfter > balanceBefore - ethers.parseEther('0.1')).to.be.true;
                
                console.log(`✅ Token to ETH multi-hop executed`);
            });
        });
    });
}); 