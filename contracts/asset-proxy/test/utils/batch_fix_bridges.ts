#!/usr/bin/env ts-node

/**
 * 🔧 桥测试批量修复脚本
 * 
 * 这个脚本应用通用修复策略到所有桥测试文件，解决常见的兼容性和语法问题。
 */

import * as fs from 'fs';
import * as path from 'path';

// 获取所有桥测试文件
const bridgeTestFiles = [
    'test/kyber_bridge.ts',
    'test/eth2dai_bridge.ts', 
    'test/uniswap_bridge.ts',
    'test/uniswapv2_bridge.ts',
    'test/chai_bridge.ts',
    'test/dydx_bridge.ts',
    'test/bancor_bridge.ts',
];

// 通用导入语句
const UNIVERSAL_IMPORTS = `
// 导入通用事件验证工具
import {
    parseContractLogs,
    getBlockTimestamp,
    parseTransactionResult,
    executeAndParse,
    verifyTokenTransfer,
    verifyTokenApprove,
    verifyEvent,
    ContractEvents,
} from './utils/bridge_event_helpers';
`;

// 修复模式定义
const fixPatterns = [
    // 1. 修复 Chai 断言语法
    {
        pattern: /\.to\.be\.empty\(['"`][^'"`]*['"`]\)/g,
        replacement: '.to.be.empty'
    },
    {
        pattern: /\.to\.bignumber\.eq\(/g,
        replacement: '.to.equal('
    },
    
    // 2. 修复日志解析 - 替换原始日志处理
    {
        pattern: /(const\s+receipt\s*=\s*await\s+.*\.wait\(\);\s*)([\s\S]*?)(return\s*\{\s*[\s\S]*?logs:\s*receipt\.logs\s+as\s+any\s+as\s+DecodedLogs[,\s]*[\s\S]*?\})/g,
        replacement: `$1
            // 使用通用日志解析工具
            const decodedLogs = await parseContractLogs(testContract, receipt);
            const blockTime = await getBlockTimestamp(receipt.blockNumber);
            
            return {
                opts: _opts,
                result: AssetProxyId.ERC20Bridge,
                logs: decodedLogs as any as DecodedLogs,
                blockTime: blockTime,
            }`
    },
    
    // 3. 添加缺失的 ethers 导入
    {
        pattern: /(import\s*\{\s*[^}]*\}\s*from\s*['"`]hardhat['"`];)/,
        replacement: `import { ethers } from 'hardhat';`
    },
];

/**
 * 应用修复到单个文件
 */
function applyFixesToFile(filePath: string): void {
    console.log(`🔧 修复文件: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  文件不存在: ${filePath}`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // 1. 添加通用导入（如果还没有）
    if (!content.includes('bridge_event_helpers')) {
        // 在 artifacts 导入之前添加
        const artifactsImportMatch = content.match(/(import\s*\{\s*artifacts\s*\}\s*from)/);
        if (artifactsImportMatch) {
            content = content.replace(
                artifactsImportMatch[0],
                UNIVERSAL_IMPORTS + '\n' + artifactsImportMatch[0]
            );
            modified = true;
            console.log(`  ✅ 添加了通用导入`);
        }
    }
    
    // 2. 应用修复模式
    fixPatterns.forEach((fix, index) => {
        const beforeLength = content.length;
        content = content.replace(fix.pattern, fix.replacement);
        
        if (content.length !== beforeLength) {
            modified = true;
            console.log(`  ✅ 应用了修复模式 ${index + 1}`);
        }
    });
    
    // 3. 创建基本事件常量（如果需要）
    const bridgeName = path.basename(filePath, '.ts').replace('_bridge', '').replace('bridge', '');
    const eventConstantName = `Test${bridgeName.charAt(0).toUpperCase() + bridgeName.slice(1)}BridgeEvents`;
    
    if (content.includes(eventConstantName) && !content.includes(`const ${eventConstantName}`)) {
        // 添加基本事件常量定义
        const eventConstants = `
// ${bridgeName} 专用事件常量  
const ${eventConstantName} = {
    Trade: '${bridgeName}BridgeTrade',
    TokenTransfer: '${bridgeName}BridgeTokenTransfer',
    TokenApprove: '${bridgeName}BridgeTokenApprove', 
    WethWithdraw: '${bridgeName}BridgeWethWithdraw',
    WethDeposit: '${bridgeName}BridgeWethDeposit',
};
`;
        
        // 在测试描述之前添加
        const describeMatch = content.match(/(describe\s*\()/);
        if (describeMatch) {
            content = content.replace(describeMatch[0], eventConstants + '\n' + describeMatch[0]);
            modified = true;
            console.log(`  ✅ 添加了事件常量`);
        }
    }
    
    // 4. 写回文件
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  💾 文件已更新`);
    } else {
        console.log(`  ⏭️  无需修改`);
    }
}

/**
 * 验证修复结果
 */
async function validateFixes(): Promise<void> {
    console.log('\n🔍 验证修复结果...');
    
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    // 检查编译
    try {
        console.log('📋 检查 TypeScript 编译...');
        await execPromise('npx tsc --noEmit --skipLibCheck');
        console.log('✅ TypeScript 编译通过');
    } catch (error) {
        console.log('❌ TypeScript 编译失败:', error.message.slice(0, 200));
    }
    
    // 快速测试每个桥
    for (const file of bridgeTestFiles) {
        try {
            console.log(`🧪 测试 ${file}...`);
            const { stdout } = await execPromise(`npx hardhat test ${file} --no-compile --grep "returns success bytes" --timeout 5000`);
            
            if (stdout.includes('✔') || stdout.includes('passing')) {
                console.log(`✅ ${file}: 基础测试通过`);
            } else {
                console.log(`⚠️  ${file}: 需要进一步调试`);
            }
        } catch (error) {
            console.log(`❌ ${file}: 测试失败`);
        }
    }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
    console.log('🚀 开始批量修复桥测试...\n');
    
    // 应用修复
    bridgeTestFiles.forEach(applyFixesToFile);
    
    console.log('\n📊 修复总结:');
    console.log(`✅ 处理了 ${bridgeTestFiles.length} 个桥测试文件`);
    console.log('🔧 应用的修复:');
    console.log('  • 添加通用日志解析工具导入');
    console.log('  • 修复 Chai 断言语法');
    console.log('  • 修复 BigNumber 方法调用');
    console.log('  • 统一日志解析逻辑');
    console.log('  • 添加缺失的事件常量');
    
    // 验证结果
    await validateFixes();
    
    console.log('\n🎉 批量修复完成！');
    console.log('💡 下一步可以逐个测试和微调各个桥。');
}

// 运行脚本
if (require.main === module) {
    main().catch(console.error);
}

export { applyFixesToFile, validateFixes };