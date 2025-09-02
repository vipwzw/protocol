#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 读取MetaTransactions测试文件
const filePath = path.join(__dirname, 'contracts/zero-ex/test/features/meta_transactions_test.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 修复executeMetaTransaction调用语法
// 从 feature.executeMetaTransaction(mtx, signature)(callOpts)
// 到 feature.connect(signer).executeMetaTransaction(mtx, signature, callOpts)

// 但首先我们需要确保有正确的signer
// 让我们使用一个更简单的方法：直接传递callOpts作为第三个参数

content = content.replace(
    /(\s*)(const\s+\w+\s*=\s*(?:await\s+)?)?feature\.executeMetaTransaction\(([^)]+)\)\(([^)]+)\);?/g,
    (match, indent, declaration, mtxAndSig, callOpts) => {
        // 解析mtx和signature
        const params = mtxAndSig.split(',').map(p => p.trim());
        const mtx = params[0];
        const signature = params[1];
        
        if (declaration) {
            // 如果有声明（const result = ...），保持await
            return `${indent}${declaration}feature.executeMetaTransaction(${mtx}, ${signature}, ${callOpts});`;
        } else {
            // 如果没有声明，这是一个表达式
            return `${indent}feature.executeMetaTransaction(${mtx}, ${signature}, ${callOpts})`;
        }
    }
);

// 写回文件
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ MetaTransactions执行语法修复完成！');
console.log('修复的模式：');
console.log('- feature.executeMetaTransaction(mtx, signature)(callOpts)');
console.log('- 改为 feature.executeMetaTransaction(mtx, signature, callOpts)');

