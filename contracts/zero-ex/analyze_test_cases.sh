#!/bin/bash

echo "=== 🎯 测试用例迁移完整性检查 ==="
echo

# 获取所有原始测试文件（排除生成文件和工具文件）
original_files=$(find test-main -name "*.ts" ! -path "*/generated-wrappers/*" ! -path "*/utils/*" ! -name "artifacts.ts" ! -name "wrappers.ts" | sort)

echo "📋 测试文件对比分析："
echo "| 原始文件 | 原始用例数 | 现代文件 | 现代用例数 | 状态 |"
echo "|----------|------------|----------|------------|------|"

total_original=0
total_modern=0
missing_files=()
case_mismatches=()

for original_file in $original_files; do
    # 获取相对路径
    relative_path=$(echo "$original_file" | sed 's|^test-main/||')
    modern_file="test/${relative_path%.ts}.modern.ts"
    
    # 计算测试用例数量
    original_count=$(grep -c "it(" "$original_file" 2>/dev/null || echo "0")
    
    if [ -f "$modern_file" ]; then
        modern_count=$(grep -c "it(" "$modern_file" 2>/dev/null || echo "0")
        total_original=$((total_original + original_count))
        total_modern=$((total_modern + modern_count))
        
        if [ "$original_count" -eq "$modern_count" ]; then
            status="✅ 完整"
        else
            status="⚠️ 数量不匹配"
            case_mismatches+=("$relative_path: $original_count -> $modern_count")
        fi
        echo "| $relative_path | $original_count | ✅ | $modern_count | $status |"
    else
        status="❌ 缺失"
        missing_files+=("$relative_path")
        echo "| $relative_path | $original_count | ❌ | 0 | $status |"
        total_original=$((total_original + original_count))
    fi
done

echo
echo "📊 统计汇总："
echo "- 原始测试用例总数: $total_original"
echo "- 现代测试用例总数: $total_modern"
echo "- 迁移完成度: $(echo "scale=1; $total_modern * 100 / $total_original" | bc -l)%"

if [ ${#missing_files[@]} -gt 0 ]; then
    echo
    echo "❌ 缺失的文件:"
    for file in "${missing_files[@]}"; do
        echo "  - $file"
    done
fi

if [ ${#case_mismatches[@]} -gt 0 ]; then
    echo
    echo "⚠️ 测试用例数量不匹配:"
    for mismatch in "${case_mismatches[@]}"; do
        echo "  - $mismatch"
    done
fi
