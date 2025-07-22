#!/bin/bash

# 清理所有合约包的缓存和构建产物脚本 (Foundry + Hardhat)
# Usage: ./scripts/clean-all.sh

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 开始清理所有合约包缓存和构建产物...${NC}"
echo ""

# 记录开始时间
start_time=$(date +%s)

# 所有包列表 (包含 Foundry 和 Hardhat 项目)
ALL_PACKAGES=(
    "contracts/erc20"
    "contracts/utils"
    "contracts/treasury"
    "contracts/zero-ex"
    "contracts/governance"
    "contracts/test-utils"
    "packages/protocol-utils"
    "packages/contract-addresses"
    "packages/contract-artifacts"
)

foundry_cleaned=0
hardhat_cleaned=0
total_cleaned=0

echo -e "${PURPLE}============================================${NC}"
echo -e "${PURPLE}🧹 清理各包的缓存和构建产物${NC}"
echo -e "${PURPLE}============================================${NC}"
echo ""

for package in "${ALL_PACKAGES[@]}"; do
    echo -e "${YELLOW}🗂️  处理包: ${package}${NC}"
    
    if [ ! -d "$package" ]; then
        echo -e "${RED}❌ 目录不存在: $package${NC}"
        continue
    fi
    
    cd "$package"
    
    has_foundry=false
    has_hardhat=false
    
    # 检查是否是 Foundry 项目
    if [ -f "foundry.toml" ]; then
        has_foundry=true
        echo -e "   🔨 清理 Foundry 缓存..."
        
        # 清理 Foundry 相关文件
        if [ -d "out" ]; then
            rm -rf out
            echo -e "   ${GREEN}✅ 删除 out/ 目录${NC}"
        fi
        
        if [ -d "cache" ]; then
            rm -rf cache
            echo -e "   ${GREEN}✅ 删除 cache/ 目录${NC}"
        fi
        
        # 运行 forge clean (如果可用)
        if command -v forge &> /dev/null; then
            forge clean 2>/dev/null || true
            echo -e "   ${GREEN}✅ 执行 forge clean${NC}"
        fi
        
        ((foundry_cleaned++))
    fi
    
    # 检查是否是 Hardhat 项目
    if [ -f "hardhat.config.js" ]; then
        has_hardhat=true
        echo -e "   ⚡ 清理 Hardhat 缓存..."
        
        # 清理 Hardhat 相关文件
        if [ -d "artifacts" ]; then
            rm -rf artifacts
            echo -e "   ${GREEN}✅ 删除 artifacts/ 目录${NC}"
        fi
        
        if [ -d "cache/hardhat" ]; then
            rm -rf cache/hardhat
            echo -e "   ${GREEN}✅ 删除 cache/hardhat/ 目录${NC}"
        elif [ -d "cache" ]; then
            rm -rf cache
            echo -e "   ${GREEN}✅ 删除 cache/ 目录${NC}"
        fi
        
        if [ -d "typechain-types" ]; then
            rm -rf typechain-types
            echo -e "   ${GREEN}✅ 删除 typechain-types/ 目录${NC}"
        fi
        
        # 运行 hardhat clean (如果可用)
        if command -v npx &> /dev/null && [ -f "package.json" ]; then
            npx hardhat clean 2>/dev/null || true
            echo -e "   ${GREEN}✅ 执行 hardhat clean${NC}"
        fi
        
        ((hardhat_cleaned++))
    fi
    
    # 清理通用临时文件
    if [ -d "node_modules/.cache" ]; then
        rm -rf node_modules/.cache
        echo -e "   ${GREEN}✅ 删除 node_modules/.cache${NC}"
    fi
    
    if $has_foundry || $has_hardhat; then
        ((total_cleaned++))
        echo -e "   ${GREEN}✅ $package 清理完成${NC}"
    else
        echo -e "   ${YELLOW}⚠️  跳过 (非合约包): $package${NC}"
    fi
    
    cd - > /dev/null
    echo ""
done

# 清理根目录的缓存
echo -e "${PURPLE}============================================${NC}"
echo -e "${PURPLE}🧹 清理根目录缓存${NC}"
echo -e "${PURPLE}============================================${NC}"
echo ""

echo -e "${YELLOW}🗂️  清理根目录缓存文件...${NC}"

# 清理根目录的构建产物
if [ -d "cache" ]; then
    rm -rf cache
    echo -e "${GREEN}✅ 删除根目录 cache/ 目录${NC}"
fi

if [ -d "artifacts" ]; then
    rm -rf artifacts
    echo -e "${GREEN}✅ 删除根目录 artifacts/ 目录${NC}"
fi

if [ -d "out" ]; then
    rm -rf out
    echo -e "${GREEN}✅ 删除根目录 out/ 目录${NC}"
fi

if [ -d "typechain-types" ]; then
    rm -rf typechain-types
    echo -e "${GREEN}✅ 删除根目录 typechain-types/ 目录${NC}"
fi

# 清理 node_modules 缓存
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    echo -e "${GREEN}✅ 删除 node_modules/.cache${NC}"
fi

# 清理 yarn/npm 缓存
if command -v yarn &> /dev/null; then
    yarn cache clean 2>/dev/null || true
    echo -e "${GREEN}✅ 清理 Yarn 缓存${NC}"
fi

if command -v npm &> /dev/null; then
    npm cache clean --force 2>/dev/null || true
    echo -e "${GREEN}✅ 清理 NPM 缓存${NC}"
fi

# 计算总耗时
end_time=$(date +%s)
duration=$((end_time - start_time))

# 输出总结
echo ""
echo -e "${PURPLE}============================================${NC}"
echo -e "${BLUE}📊 清理完成总结${NC}"
echo -e "${PURPLE}============================================${NC}"
echo -e "🔨 Foundry 包: ${GREEN}$foundry_cleaned${NC} 个已清理"
echo -e "⚡ Hardhat 包: ${GREEN}$hardhat_cleaned${NC} 个已清理"
echo -e "📦 总包数: ${GREEN}$total_cleaned${NC} 个已处理"
echo -e "⏱️  总耗时: ${duration}s"
echo ""
echo -e "${GREEN}🎉 所有缓存和构建产物清理完成！${NC}"
echo -e "${BLUE}💡 提示: 下次编译前需要重新安装依赖和编译合约${NC}" 