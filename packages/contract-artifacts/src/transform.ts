import { deleteNestedProperty, logUtils } from '@0x/utils';
import * as fs from 'fs';

export const REQUIRED_PROPERTIES: string[] = [
    'schemaVersion',
    'contractName',
    'compilerOutput.evm.bytecode.object',
    'compilerOutput.evm.deployedBytecode.object',
    'compilerOutput.abi',
    'compilerOutput.devdoc',
    'compiler',
];

export const FORBIDDEN_PROPERTIES: string[] = [
    'compilerOutput.evm.bytecode.sourceMap',
    'compilerOutput.evm.bytecode.opcodes',
    'compilerOutput.evm.bytecode.linkReferences',
    'compilerOutput.evm.deployedBytecode.sourceMap',
    'compilerOutput.evm.deployedBytecode.opcodes',
    'compilerOutput.evm.deployedBytecode.linkReferences',
    'compilerOutput.evm.assembly',
    'compilerOutput.evm.legacyAssembly',
    'compilerOutput.evm.gasEstimates',
    'compilerOutput.evm.methodIdentifiers',
    'compilerOutput.metadata',
    'compilerOutput.userdoc',
    'compiler.settings.remappings',
    'sourceCodes',
    'sources',
    'sourceTreeHashHex',
];

// Convert Hardhat artifact format to expected format
function convertHardhatArtifact(artifact: any): any {
    // If it's already in the expected format, return as is
    if (artifact.schemaVersion || artifact.compilerOutput) {
        return artifact;
    }

    // If it's a Hardhat artifact, convert it
    if (artifact._format && artifact._format.startsWith('hh-sol-artifact')) {
        return {
            schemaVersion: '3.0.0',
            contractName: artifact.contractName,
            compilerOutput: {
                abi: artifact.abi,
                evm: {
                    bytecode: {
                        object: artifact.bytecode || ''
                    },
                    deployedBytecode: {
                        object: artifact.deployedBytecode || ''
                    }
                },
                devdoc: {
                    methods: {}
                }
            },
            compiler: {
                name: 'hardhat',
                version: '0.8.28'
            }
        };
    }

    return artifact;
}

function removeForbiddenProperties(inputDir: string, outputDir: string): void {
    const filePaths = fs
        .readdirSync(inputDir)
        .filter(filename => filename.indexOf('.json') !== -1)
        .map(filename => `./${inputDir}/${filename}`);

    for (const filePath of filePaths) {
        const artifact = JSON.parse(fs.readFileSync(filePath).toString()) as { [name: string]: any };
        
        // Convert Hardhat artifact to expected format
        const convertedArtifact = convertHardhatArtifact(artifact);
        
        // Remove forbidden properties
        for (const property of FORBIDDEN_PROPERTIES) {
            deleteNestedProperty(convertedArtifact, property);
        }
        
        fs.writeFileSync(filePath.replace(inputDir, outputDir), JSON.stringify(convertedArtifact));
    }
}

if (require.main === module) {
    const inputDir = process.argv[2];
    const outputDir = process.argv[3] !== undefined ? process.argv[3] : inputDir;
    logUtils.log(`Deleting forbidden properties from artifacts in ${inputDir}. Output to ${outputDir}`);
    if (!fs.existsSync(`./${outputDir}`)) {
        fs.mkdirSync(`./${outputDir}`);
    }
    removeForbiddenProperties(inputDir, outputDir);
}
