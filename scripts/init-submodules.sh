#!/bin/bash

# 0x Protocol 子模块初始化脚本
# 用于正确初始化项目中的 Git 子模块

set -e

echo "🔧 初始化 0x Protocol 子模块..."

# 初始化并更新所有子模块
echo "📦 更新子模块..."
git submodule update --init --recursive

# 清理子模块中可能存在的额外文件
echo "🧹 清理子模块..."
cd lib/openzeppelin-contracts
git clean -fd 2>/dev/null || true
cd ../openzeppelin-contracts-upgradeable  
git clean -fd 2>/dev/null || true
cd ../..

# 删除不需要的嵌套子模块（如果存在）
echo "🗑️  删除不需要的嵌套子模块..."
rm -rf lib/openzeppelin-contracts/lib/erc4626-tests 2>/dev/null || true
rm -rf lib/openzeppelin-contracts/lib/halmos-cheatcodes 2>/dev/null || true
rm -rf lib/openzeppelin-contracts-upgradeable/lib/erc4626-tests 2>/dev/null || true
rm -rf lib/openzeppelin-contracts-upgradeable/lib/halmos-cheatcodes 2>/dev/null || true
rm -rf lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts 2>/dev/null || true

echo "✅ 子模块初始化完成！"

# 验证子模块状态
echo "🔍 验证子模块状态..."
git submodule status

echo "🎉 所有子模块已正确初始化！"
