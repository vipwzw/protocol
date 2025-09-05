#!/bin/bash

# 0x Protocol 项目测试统计脚本
echo "🚀 0x Protocol 项目测试统计报告"
echo "=================================="
echo ""

# 合约模块
CONTRACT_MODULES=(
    "contracts/asset-proxy"
    "contracts/erc1155"
    "contracts/erc20"
    "contracts/erc721"
    "contracts/exchange-libs"
    "contracts/governance"
    "contracts/staking"
    "contracts/treasury"
    "contracts/utils"
    "contracts/zero-ex"
)

# Packages 模块
PACKAGE_MODULES=(
    "packages/base-contract"
    "packages/contract-addresses"
    "packages/contract-artifacts"
    "packages/contract-wrappers"
    "packages/json-schemas"
    "packages/order-utils"
    "packages/protocol-utils"
    "packages/utils"
)

TOTAL_PASSING=0
TOTAL_PENDING=0
TOTAL_FAILING=0
TOTAL_MODULES=0
SUCCESS_MODULES=0

echo "📋 合约模块测试结果："
echo "===================="

for module in "${CONTRACT_MODULES[@]}"; do
    if [ -d "$module" ] && [ -f "$module/package.json" ]; then
        echo "🔍 测试模块: $module"
        cd "$module"
        
        # 检查是否有测试脚本
        if grep -q '"test"' package.json 2>/dev/null; then
            # 运行测试并捕获输出
            if timeout 60 yarn test 2>&1 | tee test_output.tmp; then
                # 解析测试结果
                if grep -q "passing\|failing\|pending" test_output.tmp; then
                    PASSING=$(grep -o '[0-9]\+ passing' test_output.tmp | grep -o '[0-9]\+' | head -1 || echo "0")
                    PENDING=$(grep -o '[0-9]\+ pending' test_output.tmp | grep -o '[0-9]\+' | head -1 || echo "0")
                    FAILING=$(grep -o '[0-9]\+ failing' test_output.tmp | grep -o '[0-9]\+' | head -1 || echo "0")
                    
                    echo "  ✅ $PASSING passing, 📋 $PENDING pending, ❌ $FAILING failing"
                    
                    TOTAL_PASSING=$((TOTAL_PASSING + PASSING))
                    TOTAL_PENDING=$((TOTAL_PENDING + PENDING))
                    TOTAL_FAILING=$((TOTAL_FAILING + FAILING))
                    
                    if [ "$FAILING" -eq 0 ]; then
                        SUCCESS_MODULES=$((SUCCESS_MODULES + 1))
                    fi
                else
                    echo "  ⚠️ 无法解析测试结果"
                fi
            else
                echo "  ❌ 测试执行失败"
            fi
            rm -f test_output.tmp
        else
            echo "  ⚠️ 无测试脚本"
        fi
        
        TOTAL_MODULES=$((TOTAL_MODULES + 1))
        cd - > /dev/null
        echo ""
    fi
done

echo ""
echo "📦 Packages 模块测试结果："
echo "========================"

for module in "${PACKAGE_MODULES[@]}"; do
    if [ -d "$module" ] && [ -f "$module/package.json" ]; then
        echo "🔍 测试模块: $module"
        cd "$module"
        
        # 检查是否有测试脚本
        if grep -q '"test"' package.json 2>/dev/null; then
            # 运行测试并捕获输出
            if timeout 60 yarn test 2>&1 | tee test_output.tmp; then
                # 解析测试结果
                if grep -q "passing\|failing\|pending" test_output.tmp; then
                    PASSING=$(grep -o '[0-9]\+ passing' test_output.tmp | grep -o '[0-9]\+' | head -1 || echo "0")
                    PENDING=$(grep -o '[0-9]\+ pending' test_output.tmp | grep -o '[0-9]\+' | head -1 || echo "0")
                    FAILING=$(grep -o '[0-9]\+ failing' test_output.tmp | grep -o '[0-9]\+' | head -1 || echo "0")
                    
                    echo "  ✅ $PASSING passing, 📋 $PENDING pending, ❌ $FAILING failing"
                    
                    TOTAL_PASSING=$((TOTAL_PASSING + PASSING))
                    TOTAL_PENDING=$((TOTAL_PENDING + PENDING))
                    TOTAL_FAILING=$((TOTAL_FAILING + FAILING))
                    
                    if [ "$FAILING" -eq 0 ]; then
                        SUCCESS_MODULES=$((SUCCESS_MODULES + 1))
                    fi
                else
                    echo "  ⚠️ 无法解析测试结果"
                fi
            else
                echo "  ❌ 测试执行失败"
            fi
            rm -f test_output.tmp
        else
            echo "  ⚠️ 无测试脚本"
        fi
        
        TOTAL_MODULES=$((TOTAL_MODULES + 1))
        cd - > /dev/null
        echo ""
    fi
done

echo ""
echo "🎯 总体测试统计："
echo "================"
echo "📊 总测试数量: $((TOTAL_PASSING + TOTAL_PENDING + TOTAL_FAILING))"
echo "✅ 通过测试: $TOTAL_PASSING"
echo "📋 待定测试: $TOTAL_PENDING" 
echo "❌ 失败测试: $TOTAL_FAILING"
echo "🏆 成功模块: $SUCCESS_MODULES / $TOTAL_MODULES"

if [ "$TOTAL_FAILING" -eq 0 ]; then
    echo "🎉 恭喜！所有测试都通过了！"
else
    echo "⚠️ 还有 $TOTAL_FAILING 个测试需要修复"
fi

echo ""
echo "测试完成时间: $(date)"
