#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 读取MetaTransactions测试文件
const filePath = path.join(__dirname, 'contracts/zero-ex/test/features/meta_transactions_test.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 定义替换规则
const replacements = [
    // transformERC20 调用
    {
        pattern: /transformERC20Feature\s*\.\s*transformERC20\s*\(\s*([^)]+)\s*\)\s*\.getABIEncodedTransactionData\(\)/g,
        replacement: (match, args) => {
            // 解析参数
            const cleanArgs = args.replace(/\s+/g, ' ').trim();
            return `transformERC20Feature.interface.encodeFunctionData('transformERC20', [${cleanArgs}])`;
        }
    },
    
    // createTransformWallet 调用
    {
        pattern: /transformERC20Feature\.createTransformWallet\(\)\.getABIEncodedTransactionData\(\)/g,
        replacement: `transformERC20Feature.interface.encodeFunctionData('createTransformWallet', [])`
    },
    
    // 其他简单的方法调用
    {
        pattern: /(\w+)\.(\w+)\(([^)]*)\)\.getABIEncodedTransactionData\(\)/g,
        replacement: (match, contract, method, args) => {
            const cleanArgs = args.trim() ? `[${args}]` : '[]';
            return `${contract}.interface.encodeFunctionData('${method}', ${cleanArgs})`;
        }
    }
];

// 应用替换
replacements.forEach(({ pattern, replacement }) => {
    if (typeof replacement === 'function') {
        content = content.replace(pattern, replacement);
    } else {
        content = content.replace(pattern, replacement);
    }
});

// 写回文件
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ MetaTransactions API语法修复完成！');
console.log('修复的模式：');
console.log('- transformERC20Feature.transformERC20(...).getABIEncodedTransactionData()');
console.log('- transformERC20Feature.createTransformWallet().getABIEncodedTransactionData()');
console.log('- 其他 contract.method(...).getABIEncodedTransactionData() 调用');

