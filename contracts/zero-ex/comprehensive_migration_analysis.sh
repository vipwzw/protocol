#!/bin/bash

echo "=== 🎯 综合迁移分析：测试用例详细对比 ==="
echo

# 分析每个有差异的文件的具体情况
declare -A files=(
    ["features/multiplex_test.ts"]="42:35"
    ["features/native_orders_feature_test.ts"]="107:105"
)

for file in "${!files[@]}"; do
    IFS=':' read -r original modern <<< "${files[$file]}"
    echo "�� 文件: $file"
    echo "   原始: $original 个测试  ->  现代: $modern 个测试"
    
    # 提取所有测试名称
    echo "   �� 提取测试名称进行对比..."
    
    # 原始文件测试名称
    original_tests="/tmp/${file//\//_}_original.txt"
    grep "it(" "test-main/$file" | sed "s/.*it('\([^']*\)'.*/\1/" | sort > "$original_tests"
    
    # 现代文件测试名称
    modern_tests="/tmp/${file//\//_}_modern.txt"
    if [ -f "test/${file%.ts}.modern.ts" ]; then
        grep "it(" "test/${file%.ts}.modern.ts" | sed "s/.*it('\([^']*\)'.*/\1/" | sort > "$modern_tests"
    fi
    
    # 找出丢失的测试
    missing_tests="/tmp/${file//\//_}_missing.txt"
    comm -23 "$original_tests" "$modern_tests" > "$missing_tests"
    
    # 找出新增的测试
    added_tests="/tmp/${file//\//_}_added.txt"
    comm -13 "$original_tests" "$modern_tests" > "$added_tests"
    
    if [ -s "$missing_tests" ]; then
        echo "   ❌ 可能丢失的测试 ($(wc -l < "$missing_tests")):"
        cat "$missing_tests" | head -5 | sed 's/^/      - /'
        if [ $(wc -l < "$missing_tests") -gt 5 ]; then
            echo "      ... (还有 $(($(wc -l < "$missing_tests") - 5)) 个)"
        fi
    fi
    
    if [ -s "$added_tests" ]; then
        echo "   ✅ 新增的测试 ($(wc -l < "$added_tests")):"
        cat "$added_tests" | head -5 | sed 's/^/      + /'
        if [ $(wc -l < "$added_tests") -gt 5 ]; then
            echo "      ... (还有 $(($(wc -l < "$added_tests") - 5)) 个)"
        fi
    fi
    
    echo "   📊 净变化: $((modern - original)) 个测试"
    echo
done

echo "=== 📋 迁移任务列表生成 ==="
echo

echo "基于分析结果，生成具体的迁移验证任务："
echo

task_id=1

for file in "${!files[@]}"; do
    IFS=':' read -r original modern <<< "${files[$file]}"
    
    missing_tests="/tmp/${file//\//_}_missing.txt"
    if [ -s "$missing_tests" ]; then
        echo "任务 $task_id: 验证 $file 中丢失的测试用例"
        echo "  - 原始: $original 个测试"
        echo "  - 现代: $modern 个测试"
        echo "  - 可能丢失: $(wc -l < "$missing_tests") 个测试"
        echo "  - 需要手动验证每个丢失的测试是否被合并或重构"
        echo
        ((task_id++))
    fi
done

echo "任务 $task_id: 总体验证"
echo "  - 验证所有关键功能测试都已覆盖"
echo "  - 确认新增测试用例的合理性"
echo "  - 运行完整测试套件确保无功能丢失"
echo

