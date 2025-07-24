#!/usr/bin/env node
const fs = require('fs');

// 读取文件
const filePath = 'test/features/erc1155_orders_test.modern.ts';
let content = fs.readFileSync(filePath, 'utf8');

console.log('🔧 开始批量修复sellERC1155参数...');

// 定义需要修复的模式
const patterns = [
    // 模式1: 完整的5参数调用
    {
        regex: /(\s+)(const result = )?await erc1155OrdersFeature\.connect\(taker\)\.sellERC1155\(\s*order,\s*signature,\s*order\.erc1155TokenId,\s*order\.erc1155TokenAmount,\s*([^,\)]+),\s*([^,\)]+)\s*\);/gm,
        replacement: '$1$2await erc1155OrdersFeature.connect(taker).sellERC1155(\n$1    order,\n$1    signature,\n$1    order.erc1155TokenAmount,\n$1    $3,\n$1    $4\n$1);'
    },
    // 模式2: try-catch中的调用
    {
        regex: /(\s+)(await erc1155OrdersFeature\.connect\(taker\)\.sellERC1155\(\s*order,\s*signature,\s*order\.erc1155TokenId,\s*order\.erc1155TokenAmount,\s*([^,\)]+),\s*([^,\)]+)\s*\);)/gm,
        replacement: '$1await erc1155OrdersFeature.connect(taker).sellERC1155(\n$1    order,\n$1    signature,\n$1    order.erc1155TokenAmount,\n$1    $3,\n$1    $4\n$1);'
    }
];

let changeCount = 0;

patterns.forEach((pattern, index) => {
    const matches = content.match(pattern.regex);
    if (matches) {
        console.log(`Pattern ${index + 1}: 找到 ${matches.length} 个匹配项`);
        changeCount += matches.length;
        content = content.replace(pattern.regex, pattern.replacement);
    }
});

// 检查还有没有其他格式的sellERC1155调用需要手动处理
const remainingCalls = content.match(/sellERC1155\([^)]*order\.erc1155TokenId[^)]*\)/g);
if (remainingCalls) {
    console.log(`⚠️  还有 ${remainingCalls.length} 个sellERC1155调用可能需要手动处理`);
    remainingCalls.forEach((call, i) => console.log(`  ${i+1}: ${call.substring(0, 80)}...`));
}

// 写回文件
fs.writeFileSync(filePath, content);

console.log(`✅ 批量修复完成！共修改了 ${changeCount} 个sellERC1155调用`);
console.log('🎯 建议运行测试验证修复效果'); 