// Re-export contract artifacts from Hardhat compilation
// This provides JavaScript/TypeScript access to compiled contract ABIs and bytecode

import * as fs from 'fs';
import * as path from 'path';

// Helper function to load artifacts
function loadArtifact(name: string) {
    try {
        const artifactPath = path.join(__dirname, '../artifacts/src', `${name}.sol`, `${name}.json`);
        return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    } catch (error) {
        console.warn(`Could not load artifact for ${name}:`, error);
        return null;
    }
}

// Export main contract artifacts
export const ZRXToken = loadArtifact('ZRXToken');
export const WETH9 = loadArtifact('WETH9');
export const IERC20Token = loadArtifact('IERC20Token');
export const IEtherToken = loadArtifact('IEtherToken');
export const LibERC20Token = loadArtifact('LibERC20Token'); 