#!/bin/bash

# 验证 Foundry 设置脚本
# 这个脚本模拟 GitHub Actions 中的 Foundry 安装和配置过程

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Foundry Setup Verification${NC}"
echo "=============================="

# Step 1: 检查 Foundry 是否已安装
echo -e "\n${BLUE}Step 1: Checking Foundry installation${NC}"

if command -v forge &> /dev/null; then
    echo -e "${GREEN}✅ forge found in PATH${NC}"
    forge --version
else
    echo -e "${YELLOW}⚠️  forge not found in PATH${NC}"
    echo "Installing Foundry..."
    
    # 模拟 GitHub Actions 安装过程
    if [ ! -d "$HOME/.foundry" ]; then
        echo "Would run: curl -L https://foundry.paradigm.xyz | bash"
        echo -e "${YELLOW}Note: Run 'yarn foundry:install' to actually install Foundry${NC}"
    fi
fi

# Step 2: 验证 PATH 设置
echo -e "\n${BLUE}Step 2: Verifying PATH configuration${NC}"

# 模拟 GitHub Actions 中的 PATH 设置
if [ -d "$HOME/.foundry/bin" ]; then
    echo "Adding $HOME/.foundry/bin to PATH..."
    export PATH="$HOME/.foundry/bin:$PATH"
    echo -e "${GREEN}✅ PATH updated${NC}"
    
    # 验证所有工具都可用
    echo -e "\n${BLUE}Step 3: Verifying Foundry tools${NC}"
    
    if command -v forge &> /dev/null; then
        echo -e "${GREEN}✅ forge: $(which forge)${NC}"
        forge --version | head -1
    else
        echo -e "${RED}❌ forge not accessible${NC}"
    fi
    
    if command -v cast &> /dev/null; then
        echo -e "${GREEN}✅ cast: $(which cast)${NC}"
        cast --version | head -1
    else
        echo -e "${RED}❌ cast not accessible${NC}"
    fi
    
    if command -v anvil &> /dev/null; then
        echo -e "${GREEN}✅ anvil: $(which anvil)${NC}"
        anvil --version | head -1
    else
        echo -e "${RED}❌ anvil not accessible${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Foundry directory not found at $HOME/.foundry/bin${NC}"
    echo "This is expected if Foundry is not installed locally."
fi

# Step 4: 测试合约编译
echo -e "\n${BLUE}Step 4: Testing contract compilation${NC}"

# 测试每个合约目录
contracts=("erc20" "governance")
for contract in "${contracts[@]}"; do
    if [ -d "contracts/$contract" ]; then
        echo -e "\n${BLUE}Testing $contract contracts...${NC}"
        cd "contracts/$contract"
        
        if command -v forge &> /dev/null; then
            if forge build --sizes > /dev/null 2>&1; then
                echo -e "${GREEN}✅ $contract contracts compile successfully${NC}"
            else
                echo -e "${RED}❌ $contract contracts compilation failed${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Skipping $contract compilation (forge not available)${NC}"
        fi
        
        cd - > /dev/null
    fi
done

# Step 5: 生成 GitHub Actions 诊断信息
echo -e "\n${BLUE}Step 5: GitHub Actions diagnostic info${NC}"
echo "This information would be available in GitHub Actions:"
echo "  GITHUB_PATH mechanism: echo \"\$HOME/.foundry/bin\" >> \$GITHUB_PATH"
echo "  Current PATH: $PATH"
echo "  HOME directory: $HOME"
echo "  Foundry directory exists: $([ -d "$HOME/.foundry/bin" ] && echo "yes" || echo "no")"

echo -e "\n${GREEN}🎯 Foundry setup verification completed!${NC}"

# 提供下一步建议
echo -e "\n${BLUE}Next steps:${NC}"
echo "1. If Foundry is not installed, run: yarn foundry:install"
echo "2. To test GitHub Actions locally, run: bash scripts/test-github-actions-local.sh"
echo "3. For quick validation, run: bash scripts/quick-test.sh" 
