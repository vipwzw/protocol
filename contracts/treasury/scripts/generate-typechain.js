#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 自动生成 Typechain 类型定义
 * 使用通配符匹配所有合约 artifacts
 */

function generateTypechain() {
    console.log('🔄 开始自动生成 Typechain 类型定义...');
    
    try {
        // 使用通配符匹配所有合约 artifacts
        const command = `npx typechain --target ethers-v6 --out-dir src/typechain-types artifacts/contracts/**/*.json`;
        
        console.log('📝 执行命令:', command);
        
        // 排除 dbg.json 文件，只处理主要的 artifacts
        const artifactsDir = path.join(__dirname, '../artifacts/contracts');
        const allArtifacts = [];
        
        // 递归查找所有 JSON 文件
        function findArtifacts(dir) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory()) {
                    findArtifacts(filePath);
                } else if (file.endsWith('.json') && !file.endsWith('.dbg.json')) {
                    // 转换为相对路径
                    const relativePath = path.relative(path.join(__dirname, '..'), filePath);
                    allArtifacts.push(relativePath);
                }
            }
        }
        
        if (fs.existsSync(artifactsDir)) {
            findArtifacts(artifactsDir);
        }
        
        if (allArtifacts.length === 0) {
            console.log('⚠️  没有找到任何 artifacts 文件');
            console.log('请先运行: yarn compile');
            process.exit(1);
        }
        
        console.log(`📦 找到 ${allArtifacts.length} 个 artifacts 文件:`);
        allArtifacts.forEach(artifact => console.log(`   - ${artifact}`));
        
        // 执行 typechain 生成
        const typechainCommand = `npx typechain --target ethers-v6 --out-dir src/typechain-types ${allArtifacts.join(' ')}`;
        
        console.log('🚀 执行 Typechain 生成...');
        execSync(typechainCommand, { stdio: 'inherit' });
        
        console.log('✅ Typechain 类型定义生成完成！');
        
        // 显示生成的文件
        const typechainDir = path.join(__dirname, '../src/typechain-types');
        if (fs.existsSync(typechainDir)) {
            const files = fs.readdirSync(typechainDir);
            const typeFiles = files.filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'));
            console.log(`📄 生成了 ${typeFiles.length} 个类型文件:`);
            typeFiles.forEach(file => console.log(`   - ${file}`));
        }
        
    } catch (error) {
        console.error('❌ Typechain 生成失败:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    generateTypechain();
}

module.exports = { generateTypechain }; 