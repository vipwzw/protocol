#!/bin/bash

# 0x Protocol TypeScript 有序编译脚本
# 按照依赖关系顺序编译 TypeScript 包

set -e

echo "🔨 开始 TypeScript 有序编译..."

# 定义颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 记录开始时间
START_TIME=$(date +%s)

# 编译函数
build_package() {
    local package_name=$1
    local package_path=$2
    
    echo -e "${BLUE}📦 编译 ${package_name}...${NC}"
    
    if [ -d "$package_path" ]; then
        cd "$package_path"
        
        # 检查是否有 tsconfig.json
        if [ -f "tsconfig.json" ]; then
            # 使用 TypeScript 编译器
            if npx tsc -b --verbose 2>/dev/null; then
                echo -e "${GREEN}✅ ${package_name} 编译成功${NC}"
            else
                echo -e "${YELLOW}⚠️  ${package_name} TypeScript 编译失败，尝试 yarn build:ts...${NC}"
                if yarn build:ts 2>/dev/null; then
                    echo -e "${GREEN}✅ ${package_name} yarn build:ts 成功${NC}"
                else
                    echo -e "${RED}❌ ${package_name} 编译失败${NC}"
                    return 1
                fi
            fi
        else
            echo -e "${YELLOW}⚠️  ${package_name} 没有 tsconfig.json，跳过${NC}"
        fi
        
        cd - > /dev/null
    else
        echo -e "${RED}❌ 目录不存在: ${package_path}${NC}"
        return 1
    fi
}

# 返回项目根目录
cd "$(dirname "$0")"

echo -e "${BLUE}📍 当前目录: $(pwd)${NC}"

# 第一阶段：基础工具包（无依赖）
echo -e "${YELLOW}🚀 第一阶段：基础工具包${NC}"
build_package "utils" "packages/utils"
build_package "json-schemas" "packages/json-schemas"
build_package "base-contract" "packages/base-contract"

# 第二阶段：合约工具包
echo -e "${YELLOW}🚀 第二阶段：合约工具包${NC}"
build_package "contracts-utils" "contracts/utils"
build_package "contracts-erc20" "contracts/erc20"
build_package "contracts-erc721" "contracts/erc721"
build_package "contracts-erc1155" "contracts/erc1155"

# 第三阶段：交换库和资产代理
echo -e "${YELLOW}🚀 第三阶段：交换库和资产代理${NC}"
build_package "contracts-exchange-libs" "contracts/exchange-libs"
build_package "contracts-asset-proxy" "contracts/asset-proxy"

# 第四阶段：协议工具
echo -e "${YELLOW}🚀 第四阶段：协议工具${NC}"
build_package "protocol-utils" "packages/protocol-utils"
build_package "order-utils" "packages/order-utils"

# 第五阶段：合约地址和构件
echo -e "${YELLOW}🚀 第五阶段：合约地址和构件${NC}"
build_package "contract-addresses" "packages/contract-addresses"
build_package "contract-artifacts" "packages/contract-artifacts"

# 第六阶段：高级合约
echo -e "${YELLOW}🚀 第六阶段：高级合约${NC}"
build_package "contracts-staking" "contracts/staking"
build_package "contracts-governance" "contracts/governance"
build_package "contracts-treasury" "contracts/treasury"

# 第七阶段：核心协议
echo -e "${YELLOW}🚀 第七阶段：核心协议${NC}"
build_package "contracts-zero-ex" "contracts/zero-ex"

# 第八阶段：包装器（依赖所有合约）
echo -e "${YELLOW}🚀 第八阶段：包装器${NC}"
build_package "contract-wrappers" "packages/contract-wrappers"

# 计算总时间
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "${GREEN}🎉 TypeScript 有序编译完成！${NC}"
echo -e "${GREEN}⏱️  总耗时: ${DURATION} 秒${NC}"

# 验证编译结果
echo -e "${BLUE}🔍 验证编译结果...${NC}"

FAILED_PACKAGES=()

# 检查关键包的编译输出
for package in "packages/utils/lib" "packages/base-contract/lib" "contracts/utils/lib" "packages/order-utils/lib"; do
    if [ ! -d "$package" ]; then
        FAILED_PACKAGES+=("$package")
    fi
done

if [ ${#FAILED_PACKAGES[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ 所有关键包编译成功！${NC}"
    exit 0
else
    echo -e "${RED}❌ 以下包编译失败:${NC}"
    for package in "${FAILED_PACKAGES[@]}"; do
        echo -e "${RED}  - $package${NC}"
    done
    exit 1
fi
