/*
 * -----------------------------------------------------------------------------
 * Modern TypeChain + ethers v6 contract wrappers for zero-ex test compatibility
 * -----------------------------------------------------------------------------
 */

import { ethers } from 'hardhat';
import { ContractArtifact, TxData } from 'ethereum-types';

// Import TypeChain factories for the contracts we need
import {
    TestLibNativeOrder__factory,
    TestMintableERC20Token__factory,
    PermissionlessTransformerDeployer__factory,
    ZeroEx__factory,
    IZeroEx__factory,
} from '../src/typechain-types/factories';

import type {
    TestLibNativeOrder,
    TestMintableERC20Token,
    PermissionlessTransformerDeployer,
    ZeroEx,
    IZeroEx,
} from '../src/typechain-types';

/**
 * Modern contract wrapper that provides legacy deployFrom0xArtifactAsync interface
 */
function createLegacyWrapper(Factory: any) {
    return class {
        public static async deployFrom0xArtifactAsync(
            artifact: ContractArtifact,
            provider: any,
            txDefaults?: any,
            logDecodeDependencies?: any,
            ...args: any[]
        ) {
            // Get signer from ethers
            const [signer] = await ethers.getSigners();

            // Deploy using TypeChain factory
            const factory = new Factory(signer);
            const contract = await factory.deploy(...args);
            await contract.waitForDeployment();

            // Return the contract instance directly - TypeChain contracts are already feature-complete
            return contract;
        }
    };
}

// Export legacy-compatible contract wrappers
export const TestLibNativeOrderContract = createLegacyWrapper(TestLibNativeOrder__factory);
export const TestMintableERC20TokenContract = createLegacyWrapper(TestMintableERC20Token__factory);
export const PermissionlessTransformerDeployerContract = createLegacyWrapper(
    PermissionlessTransformerDeployer__factory,
);
export const ZeroExContract = createLegacyWrapper(ZeroEx__factory);
export const IZeroExContract = createLegacyWrapper(IZeroEx__factory);

// Also export the factory classes directly for modern usage
export {
    TestLibNativeOrder__factory,
    TestMintableERC20Token__factory,
    PermissionlessTransformerDeployer__factory,
    ZeroEx__factory,
    IZeroEx__factory,
};

// Export type definitions
export type { TestLibNativeOrder, TestMintableERC20Token, PermissionlessTransformerDeployer, ZeroEx, IZeroEx };
