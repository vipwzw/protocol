#!/bin/bash

# 编译所有合约包的统一脚本 (Foundry + Hardhat)
# Usage: ./scripts/compile-all.sh

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 开始编译所有合约包 (Foundry + Hardhat)...${NC}"
echo ""

# 记录开始时间
start_time=$(date +%s)

# 1. 编译所有 Foundry 包
echo -e "${PURPLE}============================================${NC}"
echo -e "${PURPLE}📦 第一阶段: 编译 Foundry 包${NC}"
echo -e "${PURPLE}============================================${NC}"
echo ""

FOUNDRY_PACKAGES=(
    "contracts/erc20"
    "contracts/utils"
    "contracts/treasury"
    "contracts/zero-ex"
    "contracts/governance"
)

foundry_success=0
foundry_total=${#FOUNDRY_PACKAGES[@]}

for package in "${FOUNDRY_PACKAGES[@]}"; do
    echo -e "${YELLOW}🔨 Foundry 编译: ${package}${NC}"
    
    if [ ! -d "$package" ]; then
        echo -e "${RED}❌ 目录不存在: $package${NC}"
        continue
    fi
    
    if [ ! -f "$package/foundry.toml" ]; then
        echo -e "${YELLOW}⚠️  跳过 (无 foundry.toml): $package${NC}"
        continue
    fi
    
    cd "$package"
    
    # 确保依赖库已安装
    if [ ! -d "lib/forge-std" ]; then
        echo -e "${YELLOW}📦 安装 forge-std 依赖...${NC}"
        forge install foundry-rs/forge-std --no-commit 2>/dev/null || true
    fi
    
    if forge build --quiet; then
        echo -e "${GREEN}✅ Foundry 编译成功: $package${NC}"
        ((foundry_success++))
    else
        echo -e "${RED}❌ Foundry 编译失败: $package${NC}"
    fi
    
    cd - > /dev/null
    echo ""
done

# 2. 编译所有 Hardhat 包
echo -e "${PURPLE}============================================${NC}"
echo -e "${PURPLE}⚡ 第二阶段: 编译 Hardhat 包${NC}"
echo -e "${PURPLE}============================================${NC}"
echo ""

HARDHAT_PACKAGES=(
    "contracts/erc20"
    "contracts/governance"
    "contracts/utils"
    "contracts/treasury"
    "contracts/zero-ex"
    "contracts/test-utils"
)

hardhat_success=0
hardhat_total=${#HARDHAT_PACKAGES[@]}

for package in "${HARDHAT_PACKAGES[@]}"; do
    echo -e "${YELLOW}⚡ Hardhat 编译: ${package}${NC}"
    
    if [ ! -d "$package" ]; then
        echo -e "${RED}❌ 目录不存在: $package${NC}"
        continue
    fi
    
    if [ ! -f "$package/hardhat.config.ts" ]; then
        echo -e "${YELLOW}⚠️  跳过 (无 hardhat.config.ts): $package${NC}"
        continue
    fi
    
    cd "$package"
    
    if npx hardhat compile --quiet; then
        echo -e "${GREEN}✅ Hardhat 编译成功: $package${NC}"
        ((hardhat_success++))
    else
        echo -e "${RED}❌ Hardhat 编译失败: $package${NC}"
    fi
    
    cd - > /dev/null
    echo ""
done

# 计算总耗时
end_time=$(date +%s)
duration=$((end_time - start_time))

# 输出总结
echo -e "${PURPLE}============================================${NC}"
echo -e "${BLUE}📊 编译完成总结${NC}"
echo -e "${PURPLE}============================================${NC}"
echo -e "🔨 Foundry: ${GREEN}$foundry_success${NC}/$foundry_total 个包成功"
echo -e "⚡ Hardhat: ${GREEN}$hardhat_success${NC}/$hardhat_total 个包成功"
echo -e "⏱️  总耗时: ${duration}s"
echo ""

total_expected=$((foundry_total + hardhat_total))
total_success=$((foundry_success + hardhat_success))

if [ $total_success -eq $total_expected ]; then
    echo -e "${GREEN}🎉 所有包编译成功！${NC}"
    exit 0
else
    failed_count=$((total_expected - total_success))
    echo -e "${RED}⚠️  有 $failed_count 个包编译失败${NC}"
    exit 1
fi 