#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MONOREPO_ROOT = path.join(__dirname, '../../..');

// HACK (xianny): can't import the root package.json normally because it is outside rootDir of this project
const pkgJson = JSON.parse(fs.readFileSync(path.join(MONOREPO_ROOT, 'package.json')).toString());
const pkgNames = pkgJson.config.contractsPackages.split(' ');

// 定义需要发布的 artifacts
const artifactsToPublish = [
    'DummyERC20Token',
    'ERC20Token', 
    'IZeroEx',
    'WETH9',
    'ZRXToken',
    'IERC20Token',
    'IEtherToken',
    'LibERC20Token',
    'Token',
    'UnlimitedAllowanceToken',
    'ZeroEx',
    'FullMigration',
    'InitialMigration',
    'IFlashWallet',
    'IERC20Transformer',
    'IOwnableFeature',
    'ISimpleFunctionRegistryFeature',
    'ITransformERC20Feature',
    'FillQuoteTransformer',
    'PayTakerTransformer',
    'PositiveSlippageFeeTransformer',
    'WethTransformer',
    'OwnableFeature',
    'SimpleFunctionRegistryFeature',
    'TransformERC20Feature',
    'AffiliateFeeTransformer',
    'MetaTransactionsFeature',
    'LogMetadataTransformer',
    'LiquidityProviderFeature',
    'ILiquidityProviderFeature',
    'NativeOrdersFeature',
    'INativeOrdersFeature',
    'FeeCollectorController',
    'FeeCollector',
    'CurveLiquidityProvider',
    'BatchFillNativeOrdersFeature',
    'IBatchFillNativeOrdersFeature',
    'MultiplexFeature',
    'IMultiplexFeature',
    'OtcOrdersFeature',
    'IOtcOrdersFeature',
    'ZrxTreasury',
    'IZrxTreasury',
    'DefaultPoolOperator',
    'TreasuryStaking',
    'IStaking'
];

console.log(`📦 开始复制 contract artifacts...`);
console.log(`合约包: ${pkgNames.join(', ')}`);

const contractsDirs = [];
for (const pkgName of pkgNames) {
    if (!pkgName.startsWith('@0x/contracts-')) {
        console.log(`❌ 无效的包名: [${pkgName}]. 合约包必须以 'contracts-' 开头`);
        continue;
    }
    contractsDirs.push(pkgName.split('/contracts-')[1]);
}

const contractsPath = path.join(MONOREPO_ROOT, 'contracts');
const allArtifactPaths = [];

function findArtifactsInDirectory(baseDir, targetNames) {
    const found = [];
    
    function searchRecursive(dir) {
        if (!fs.existsSync(dir)) {
            return;
        }
        
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                searchRecursive(itemPath);
            } else if (item.endsWith('.json') && !item.endsWith('.dbg.json')) {
                const contractName = item.split('.')[0];
                if (targetNames.includes(contractName)) {
                    found.push(itemPath);
                }
            }
        }
    }
    
    searchRecursive(baseDir);
    return found;
}

for (const dir of contractsDirs) {
    console.log(`🔍 处理目录: ${dir}`);
    
    // Try generated-artifacts first (for Foundry)
    const generatedArtifactsDir = path.join(contractsPath, dir, 'generated-artifacts');
    if (fs.existsSync(generatedArtifactsDir)) {
        console.log(`  📁 找到 generated-artifacts: ${generatedArtifactsDir}`);
        const artifactPaths = fs
            .readdirSync(generatedArtifactsDir)
            .filter(artifact => {
                const artifactWithoutExt = artifact.split('.')[0];
                return artifactsToPublish.includes(artifactWithoutExt);
            })
            .map(artifact => path.join(generatedArtifactsDir, artifact));
        allArtifactPaths.push(...artifactPaths);
        console.log(`  ✅ 从 generated-artifacts 找到 ${artifactPaths.length} 个文件`);
    } else {
        // Try artifacts directory (for Hardhat)
        const hardhatArtifactsDir = path.join(contractsPath, dir, 'artifacts');
        console.log(`  📁 查找 hardhat artifacts: ${hardhatArtifactsDir}`);
        const foundArtifacts = findArtifactsInDirectory(hardhatArtifactsDir, artifactsToPublish);
        allArtifactPaths.push(...foundArtifacts);
        console.log(`  ✅ 从 hardhat artifacts 找到 ${foundArtifacts.length} 个文件`);
    }
}

console.log(`\n📊 总计找到 ${allArtifactPaths.length} 个 artifacts:`);
allArtifactPaths.slice(0, 10).forEach(p => console.log(`  - ${path.basename(p)}`));
if (allArtifactPaths.length > 10) {
    console.log(`  ... 还有 ${allArtifactPaths.length - 10} 个文件`);
}

// 确保 artifacts 目录存在
const artifactsDir = path.join(__dirname, '../artifacts');
if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
    console.log(`📁 创建 artifacts 目录: ${artifactsDir}`);
}

if (allArtifactPaths.length > 0) {
    let copied = 0;
    for (const _path of allArtifactPaths) {
        const fileName = _path.split('/').slice(-1)[0];
        const targetPath = path.join(artifactsDir, fileName);
        try {
            fs.copyFileSync(_path, targetPath);
            console.log(`✅ 复制: ${fileName}`);
            copied++;
        } catch (err) {
            console.log(`❌ 复制失败: ${fileName} - ${err.message}`);
        }
    }
    console.log(`\n🎉 完成! 成功复制 ${copied} 个 contract artifacts`);
    
    // 自动运行转换器
    if (copied > 0) {
        console.log(`\n🔄 运行 artifacts 转换器...`);
        try {
            // 首先确保 transform.js 存在，如果不存在就编译 TypeScript
            const transformJsPath = path.join(__dirname, '../lib/src/transform.js');
            if (!fs.existsSync(transformJsPath)) {
                console.log(`📝 编译转换器...`);
                execSync('tsc src/transform.ts --target es2017 --module commonjs --outDir lib/src/', {
                    cwd: path.join(__dirname, '..'),
                    stdio: 'pipe'
                });
            }
            
            // 运行转换器
            execSync(`node lib/src/transform.js ./artifacts`, {
                cwd: path.join(__dirname, '..'),
                stdio: 'inherit'
            });
            
            // 运行 prettier
            try {
                execSync(`prettier --write ./artifacts/*.json`, {
                    cwd: path.join(__dirname, '..'),
                    stdio: 'pipe'
                });
                console.log(`✨ Prettier 格式化完成`);
            } catch (prettierErr) {
                console.log(`⚠️  Prettier 格式化跳过 (可能没有安装)`);
            }
            
            console.log(`✅ Artifacts 转换完成!`);
        } catch (err) {
            console.log(`⚠️  转换器运行失败: ${err.message}`);
            console.log(`💡 提示: 将在后续构建步骤中重试转换`);
        }
    }
} else {
    console.log(`⚠️  没有找到任何 artifacts 文件`);
    // 即使没有找到文件，也不要失败，因为可能是第一次构建
    console.log(`💡 提示: 请先运行 'yarn compile:hardhat' 或 'yarn compile:foundry' 生成 artifacts`);
} 