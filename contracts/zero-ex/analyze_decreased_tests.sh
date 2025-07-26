#!/bin/bash

echo "📉 测试用例数量减少的文件详细分析："
echo

decreased_files=(
    "features/multiplex_test.ts:42:35"
    "features/native_orders_feature_test.ts:107:105"
)

for file_info in "${decreased_files[@]}"; do
    IFS=':' read -r file original modern <<< "$file_info"
    echo "🔍 分析文件: $file"
    echo "  原始: $original 个测试用例"
    echo "  现代: $modern 个测试用例"
    echo "  差异: $((original - modern)) 个测试用例可能丢失"
    echo
    
    # 检查具体的测试名称
    echo "  📋 原始文件中的测试用例："
    grep -n "it(" "test-main/$file" | head -10 | sed 's/^/    /'
    echo "  ..."
    echo
    
    echo "  📋 现代文件中的测试用例："
    if [ -f "test/${file%.ts}.modern.ts" ]; then
        grep -n "it(" "test/${file%.ts}.modern.ts" | head -10 | sed 's/^/    /'
        echo "  ..."
    fi
    echo "----------------------------------------"
done
