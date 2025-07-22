#!/bin/bash

# 编译所有 Foundry 合约包的脚本
# Usage: ./scripts/compile-all-foundry.sh

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 包含 foundry.toml 的包列表
PACKAGES=(
    "contracts/erc20"
    "contracts/utils"
    "contracts/treasury"
    "contracts/zero-ex"
    "contracts/governance"
)

echo -e "${BLUE}🚀 开始编译所有 Foundry 合约包...${NC}"
echo ""

# 记录开始时间
start_time=$(date +%s)
success_count=0
total_count=${#PACKAGES[@]}

# 遍历所有包进行编译
for package in "${PACKAGES[@]}"; do
    echo -e "${YELLOW}📦 编译包: ${package}${NC}"
    
    if [ ! -d "$package" ]; then
        echo -e "${RED}❌ 目录不存在: $package${NC}"
        continue
    fi
    
    if [ ! -f "$package/foundry.toml" ]; then
        echo -e "${RED}❌ 未找到 foundry.toml: $package${NC}"
        continue
    fi
    
    # 切换到包目录并编译
    cd "$package"
    
    # 确保依赖库已安装
    if [ ! -d "lib/forge-std" ]; then
        echo -e "${YELLOW}⚠️  安装 forge-std 依赖...${NC}"
        forge install foundry-rs/forge-std --no-commit 2>/dev/null || true
    fi
    
    if forge build --quiet; then
        echo -e "${GREEN}✅ $package 编译成功${NC}"
        ((success_count++))
    else
        echo -e "${RED}❌ $package 编译失败${NC}"
    fi
    
    # 返回根目录
    cd - > /dev/null
    echo ""
done

# 计算总耗时
end_time=$(date +%s)
duration=$((end_time - start_time))

# 输出总结
echo -e "${BLUE}📊 编译完成总结:${NC}"
echo -e "   成功: ${GREEN}$success_count${NC}/$total_count 个包"
echo -e "   耗时: ${duration}s"

if [ $success_count -eq $total_count ]; then
    echo -e "${GREEN}🎉 所有包编译成功！${NC}"
    exit 0
else
    echo -e "${RED}⚠️  有 $((total_count - success_count)) 个包编译失败${NC}"
    exit 1
fi 