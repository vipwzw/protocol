#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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

console.log(`📦 直接复制 Hardhat artifacts (无转换)...`);
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
    
    // 直接使用 Hardhat artifacts (TypeChain 标准格式)
    const hardhatArtifactsDir = path.join(contractsPath, dir, 'artifacts');
    if (fs.existsSync(hardhatArtifactsDir)) {
        console.log(`  📁 Hardhat artifacts: ${hardhatArtifactsDir}`);
        const foundArtifacts = findArtifactsInDirectory(hardhatArtifactsDir, artifactsToPublish);
        allArtifactPaths.push(...foundArtifacts);
        console.log(`  ✅ 找到 ${foundArtifacts.length} 个 artifacts`);
    } else {
        console.log(`  ⚠️  未找到 artifacts 目录: ${hardhatArtifactsDir}`);
    }
}

console.log(`📋 总共找到 ${allArtifactPaths.length} 个 artifacts`);

if (allArtifactPaths.length === 0) {
    console.log('❌ 未找到任何 artifacts！请确保已编译合约。');
    console.log('💡 提示: 在各合约目录运行 `forge build` 或 `hardhat compile`');
    process.exit(1);
}

// 确保输出目录存在
const outputDir = path.join(__dirname, '../artifacts');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 直接复制 Hardhat artifacts (不做任何转换)
let copiedCount = 0;
console.log(`\n📄 开始复制 artifacts...`);

for (const _path of allArtifactPaths) {
    const fileName = _path.split('/').slice(-1)[0];
    const targetPath = path.join(outputDir, fileName);
    
    try {
        // 直接复制，保持 Hardhat 原生格式
        fs.copyFileSync(_path, targetPath);
        console.log(`  ✅ ${fileName}`);
        copiedCount++;
    } catch (error) {
        console.log(`  ❌ 复制失败: ${fileName} - ${error.message}`);
    }
}

console.log(`\n🎉 成功复制 ${copiedCount} 个 Hardhat artifacts！`);
console.log(`📂 输出目录: ${outputDir}`);
console.log(`💡 这些 artifacts 已经是 TypeChain 和 ethers v6 的标准格式！`);
console.log(`🚀 无需转换，直接可用于 TypeChain 生成类型！`); 