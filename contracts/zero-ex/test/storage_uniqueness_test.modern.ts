import { readdir, readFile } from 'fs';
import { basename, resolve } from 'path';
import { promisify } from 'util';

describe('Storage ID Uniqueness Test - Modern', function() {
    // Extended timeout for file operations
    this.timeout(30000);
    
    const STORAGE_SOURCES_DIR = resolve(__dirname, '../../contracts/src/storage');

    async function findStorageIdFromSourceFileAsync(path: string): Promise<string | void> {
        const contents = await promisify(readFile)(path, { encoding: 'utf-8' });
        const m = /LibStorage\.\s*getStorageOffset\(\s*LibStorage\.\s*StorageId\.\s*(\w+)\s*\)/m.exec(contents);
        if (m) {
            return m[1];
        }
    }

    it('all StorageId references are unique in storage libraries', async function() {
        console.log('🔍 Checking storage ID uniqueness...');
        console.log(`📁 Scanning directory: ${STORAGE_SOURCES_DIR}`);
        
        const sourcePaths = (await promisify(readdir)(STORAGE_SOURCES_DIR))
            .filter(p => p.endsWith('.sol'))
            .map(p => resolve(STORAGE_SOURCES_DIR, p));
            
        console.log(`📄 Found ${sourcePaths.length} Solidity files`);
        
        const storageIds = (await Promise.all(sourcePaths.map(async p => findStorageIdFromSourceFileAsync(p)))).filter(
            id => !!id,
        );
        
        console.log(`🔑 Found ${storageIds.length} storage IDs: [${storageIds.join(', ')}]`);
        
        for (let i = 0; i < storageIds.length; ++i) {
            const storageId = storageIds[i];
            for (let j = 0; j < storageIds.length; ++j) {
                if (i !== j && storageId === storageIds[j]) {
                    throw new Error(
                        `Found duplicate StorageId ${storageId} ` +
                            `in files ${basename(sourcePaths[i])}, ${basename(sourcePaths[j])}`,
                    );
                }
            }
        }
        
        console.log('✅ All storage IDs are unique!');
    });
}); 