import * as artifacts from '../src';

import { expect } from 'chai';
import 'mocha';

// Test that all artifacts are in Hardhat format and have required properties
describe('@0x/contract-artifacts', () => {
    it('should export artifacts in Hardhat native format', () => {
        expect(artifacts).to.be.an('object');

        // Test key artifacts
        const keyArtifacts = ['IERC20Token', 'IZeroEx', 'WETH9', 'ZRXToken'];

        for (const artifactName of keyArtifacts) {
            const artifact = (artifacts as any)[artifactName];
            expect(artifact, `${artifactName} should exist`).to.exist;

            // Check Hardhat format
            expect(artifact._format, `${artifactName} should have _format`).to.equal('hh-sol-artifact-1');
            expect(artifact.contractName, `${artifactName} should have contractName`).to.be.a('string');
            expect(artifact.sourceName, `${artifactName} should have sourceName`).to.be.a('string');
            expect(artifact.abi, `${artifactName} should have abi`).to.be.an('array');
            expect(artifact.bytecode, `${artifactName} should have bytecode`).to.be.a('string');
            expect(artifact.deployedBytecode, `${artifactName} should have deployedBytecode`).to.be.a('string');
        }
    });

    it('IERC20Token should have correct contract structure', () => {
        const IERC20Token = (artifacts as any).IERC20Token;

        expect(IERC20Token.contractName).to.equal('IERC20Token');
        expect(IERC20Token.sourceName).to.include('IERC20Token.sol');
        expect(IERC20Token.abi).to.be.an('array');
        expect(IERC20Token.abi.length).to.be.greaterThan(0);

        // Check for standard ERC20 functions in ABI
        const functionNames = IERC20Token.abi
            .filter((item: any) => item.type === 'function')
            .map((item: any) => item.name);

        expect(functionNames).to.include('balanceOf');
        expect(functionNames).to.include('transfer');
        expect(functionNames).to.include('allowance');
        expect(functionNames).to.include('approve');
    });

    it('IZeroEx should have correct contract structure', () => {
        const IZeroEx = (artifacts as any).IZeroEx;

        expect(IZeroEx.contractName).to.equal('IZeroEx');
        expect(IZeroEx.sourceName).to.include('IZeroEx.sol');
        expect(IZeroEx.abi).to.be.an('array');
        expect(IZeroEx.abi.length).to.be.greaterThan(0);
    });

    it('should not have legacy abi-gen format properties', () => {
        const IERC20Token = (artifacts as any).IERC20Token;

        // These should NOT exist (old abi-gen format)
        expect(IERC20Token.schemaVersion).to.be.undefined;
        expect(IERC20Token.compilerOutput).to.be.undefined;
        expect(IERC20Token.compiler).to.be.undefined;

        // These SHOULD exist (Hardhat format)
        expect(IERC20Token._format).to.exist;
        expect(IERC20Token.abi).to.exist;
        expect(IERC20Token.bytecode).to.exist;
    });

    it('should have optimal properties for TypeChain', () => {
        const IERC20Token = (artifacts as any).IERC20Token;

        // Essential properties for TypeChain
        expect(IERC20Token._format).to.equal('hh-sol-artifact-1');
        expect(IERC20Token.contractName).to.be.a('string');
        expect(IERC20Token.abi).to.be.an('array');
        expect(IERC20Token.bytecode).to.be.a('string');
        expect(IERC20Token.deployedBytecode).to.be.a('string');
        expect(IERC20Token.linkReferences).to.be.an('object');
        expect(IERC20Token.deployedLinkReferences).to.be.an('object');

        // Should not have unnecessary properties (optimized for bundle size)
        expect(IERC20Token.metadata).to.be.undefined;
        expect(IERC20Token.userdoc).to.be.undefined;
        expect(IERC20Token.devdoc).to.be.undefined;
        expect(IERC20Token.storageLayout).to.be.undefined;
    });
});
