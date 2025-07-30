import { expect } from 'chai';
import '@nomicfoundation/hardhat-chai-matchers';
const { ethers } = require('hardhat');
import { Contract, MaxUint256 } from 'ethers';
import { randomBytes } from 'crypto';

describe('PermissionlessTransformerDeployer - Modern Tests', function () {
    // Extended timeout for deployment operations
    this.timeout(180000);

    let admin: any;
    let sender: any;
    let deployer: any;
    let deployBytes: string;

    before(async function () {
        console.log('🚀 Setting up PermissionlessTransformerDeployer Test...');

        // Get signers
        const signers = await ethers.getSigners();
        [admin, sender] = signers;

        console.log('👤 Admin:', admin.target);
        console.log('👤 Sender:', sender.target);

        await deployContractsAsync();

        console.log('✅ PermissionlessTransformerDeployer test environment ready!');
    });

    async function deployContractsAsync(): Promise<void> {
        console.log('📦 Deploying PermissionlessTransformerDeployer...');

        // Deploy PermissionlessTransformerDeployer
        const DeployerFactory = await ethers.getContractFactory('PermissionlessTransformerDeployer');
        deployer = await DeployerFactory.deploy();
        await deployer.waitForDeployment();
        console.log(`✅ PermissionlessTransformerDeployer: ${await deployer.getAddress()}`);

        // Get deploy bytes for test transformer
        const TestTransformerFactory = await ethers.getContractFactory(
            'TestPermissionlessTransformerDeployerTransformer',
        );
        deployBytes = TestTransformerFactory.bytecode;
        console.log(`📄 Deploy bytes length: ${deployBytes.length}`);
    }

    function generateRandomSalt(): string {
        return '0x' + randomBytes(32).toString('hex');
    }

    describe('deploy()', function () {
        it('can deploy safe contract', async function () {
            const salt = generateRandomSalt();

            // Call to get target address
            const targetAddress = await deployer.deploy.staticCall(deployBytes, salt);

            // Execute deployment
            const tx = await deployer.connect(sender).deploy(deployBytes, salt);
            const receipt = await tx.wait();

            // Verify deployed contract
            const TestTransformerFactory = await ethers.getContractFactory(
                'TestPermissionlessTransformerDeployerTransformer',
            );
            const deployedContract = TestTransformerFactory.attach(targetAddress);

            const deployerAddress = await deployedContract.deployer();
            expect(deployerAddress).to.equal(await deployer.getAddress());

            // Check event was emitted
            const deployedEvent = receipt.logs.find((log: any) => log.fragment?.name === 'Deployed');
            expect(deployedEvent).to.not.be.undefined;

            if (deployedEvent) {
                expect(deployedEvent.args.deployedAddress).to.equal(targetAddress);
                expect(deployedEvent.args.salt).to.equal(salt);
                expect(deployedEvent.args.sender).to.equal(sender.target);
            }
        });

        it('deploys at predictable address', async function () {
            const salt = generateRandomSalt();
            const targetAddress = await deployer.deploy.staticCall(deployBytes, salt);

            // Calculate expected address using CREATE2
            const initCodeHash = ethers.keccak256(deployBytes);
            const expectedAddress = ethers.getCreate2Address(await deployer.getAddress(), salt, initCodeHash);

            expect(targetAddress).to.equal(expectedAddress);
        });

        it('cannot deploy suicidal contract', async function () {
            // Get bytecode for suicidal contract
            const SuicidalFactory = await ethers.getContractFactory('TestPermissionlessTransformerDeployerSuicidal');
            const suicidalDeployBytes = SuicidalFactory.bytecode;

            let error: any;
            try {
                await deployer.deploy(suicidalDeployBytes, generateRandomSalt());
            } catch (e) {
                error = e;
            }
            expect(error).to.not.be.undefined;
        });

        it('can deploy safe contract with value', async function () {
            const salt = generateRandomSalt();
            const value = ethers.parseEther('0.001');

            // Call to get target address
            const targetAddress = await deployer.deploy.staticCall(deployBytes, salt, { value });

            // Execute deployment with value
            const tx = await deployer.connect(sender).deploy(deployBytes, salt, { value });
            const receipt = await tx.wait();

            // Verify deployed contract
            const TestTransformerFactory = await ethers.getContractFactory(
                'TestPermissionlessTransformerDeployerTransformer',
            );
            const deployedContract = TestTransformerFactory.attach(targetAddress);

            const deployerAddress = await deployedContract.deployer();
            expect(deployerAddress).to.equal(await deployer.getAddress());

            // Check contract received ETH
            const contractBalance = await ethers.provider.getBalance(targetAddress);
            expect(Number(contractBalance)).to.equal(Number(value));

            // Check event was emitted
            const deployedEvent = receipt.logs.find((log: any) => log.fragment?.name === 'Deployed');
            expect(deployedEvent).to.not.be.undefined;
        });

        it('reverts if constructor throws', async function () {
            const CONSTRUCTOR_FAIL_VALUE = ethers.parseEther('0.003333');

            let error: any;
            try {
                await deployer
                    .connect(sender)
                    .deploy(deployBytes, generateRandomSalt(), { value: CONSTRUCTOR_FAIL_VALUE });
            } catch (e) {
                error = e;
            }
            expect(error).to.not.be.undefined;
        });

        it('can retrieve deployment salt from contract address', async function () {
            const salt = generateRandomSalt();
            const targetAddress = await deployer.deploy.staticCall(deployBytes, salt);

            // Deploy the contract
            await deployer.connect(sender).deploy(deployBytes, salt);

            // Retrieve salt from address
            const retrievedSalt = await deployer.toDeploymentSalt(targetAddress);
            expect(retrievedSalt).to.equal(salt);
        });

        it('can retrieve deployment init code hash from contract address', async function () {
            const salt = generateRandomSalt();
            const targetAddress = await deployer.deploy.staticCall(deployBytes, salt);

            // Deploy the contract
            await deployer.connect(sender).deploy(deployBytes, salt);

            // Retrieve init code hash from address
            const retrievedHash = await deployer.toInitCodeHash(targetAddress);
            const expectedHash = ethers.keccak256(deployBytes);
            expect(retrievedHash).to.equal(expectedHash);
        });
    });
});
