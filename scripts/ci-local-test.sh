#!/bin/bash

# 🚀 本地CI测试脚本 - 模拟完整CI流程
# 使用方法: ./scripts/ci-local-test.sh [--skip-forge] [--skip-coverage] [--module=<module>]
# 
# 参数说明:
#   --skip-forge     跳过Forge测试 (节省时间)
#   --skip-coverage  跳过覆盖率检查
#   --module=<name>  只测试指定模块 (erc20, zero-ex, governance)
#   --help          显示帮助信息

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 参数解析
SKIP_FORGE=false
SKIP_COVERAGE=false
TARGET_MODULE=""
SHOW_HELP=false

for arg in "$@"; do
    case $arg in
        --skip-forge)
            SKIP_FORGE=true
            shift
            ;;
        --skip-coverage)
            SKIP_COVERAGE=true
            shift
            ;;
        --module=*)
            TARGET_MODULE="${arg#*=}"
            shift
            ;;
        --help)
            SHOW_HELP=true
            shift
            ;;
        *)
            echo "未知参数: $arg"
            SHOW_HELP=true
            ;;
    esac
done

# 显示帮助信息
if [ "$SHOW_HELP" = true ]; then
    echo "🚀 本地CI测试脚本"
    echo ""
    echo "使用方法:"
    echo "  ./scripts/ci-local-test.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --skip-forge      跳过Forge测试 (节省时间)"
    echo "  --skip-coverage   跳过覆盖率检查"
    echo "  --module=<name>   只测试指定模块 (erc20, zero-ex, governance)"
    echo "  --help           显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./scripts/ci-local-test.sh                    # 完整测试"
    echo "  ./scripts/ci-local-test.sh --skip-forge       # 跳过Forge测试"
    echo "  ./scripts/ci-local-test.sh --module=zero-ex   # 只测试zero-ex模块"
    exit 0
fi

# 开始时间
START_TIME=$(date +%s)

echo -e "${BLUE}🚀 Starting Local CI Test Suite${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# 记录测试步骤
PASSED_STEPS=()
FAILED_STEPS=()
SKIPPED_STEPS=()

# 辅助函数
log_step() {
    echo -e "\n${CYAN}📋 Step: $1${NC}"
    echo -e "${CYAN}$(echo "$1" | sed 's/./=/g')${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    PASSED_STEPS+=("$1")
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    FAILED_STEPS+=("$1")
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_skip() {
    echo -e "${YELLOW}⏭️  $1${NC}"
    SKIPPED_STEPS+=("$1")
}

check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✅ $1 已安装${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 未找到${NC}"
        return 1
    fi
}

# 步骤1: 环境检查
log_step "Environment Check"
echo "检查必要工具..."

TOOLS_OK=true
if ! check_command "node"; then TOOLS_OK=false; fi
if ! check_command "yarn"; then TOOLS_OK=false; fi
if ! check_command "forge"; then TOOLS_OK=false; fi
if ! check_command "git"; then TOOLS_OK=false; fi

if [ "$TOOLS_OK" = true ]; then
    log_success "Environment Check"
    echo "Node version: $(node --version)"
    echo "Yarn version: $(yarn --version)"
    echo "Forge version: $(forge --version | head -n 1)"
else
    log_error "Environment Check - 缺少必要工具"
    exit 1
fi

# 步骤2: 依赖检查和安装
log_step "Dependencies Check"
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    yarn install --frozen-lockfile
    log_success "Dependencies Installation"
else
    echo "检查依赖是否最新..."
    if yarn check --verify-tree; then
        log_success "Dependencies Check"
    else
        log_warning "Dependencies may be outdated"
        echo "重新安装依赖..."
        yarn install --frozen-lockfile
        log_success "Dependencies Reinstallation"
    fi
fi

# 步骤3: 构建检查
log_step "Build Check"
echo "构建项目..."
if yarn build; then
    log_success "Build Check"
else
    log_error "Build Check"
    exit 1
fi

# 步骤4: TypeScript Lint检查
log_step "TypeScript Lint Check"
echo "运行TypeScript lint..."
if yarn lint:ts; then
    log_success "TypeScript Lint Check"
else
    log_error "TypeScript Lint Check"
    exit 1
fi

# 步骤5: Solidity Lint检查
log_step "Solidity Lint Check"
echo "运行Solidity合约lint..."
if yarn lint:contracts; then
    log_success "Solidity Lint Check"
else
    log_error "Solidity Lint Check"
    exit 1
fi

# 步骤6: 代码格式化检查
log_step "Code Formatting Check"
echo "检查代码格式..."
if yarn prettier:ci; then
    log_success "Code Formatting Check"
else
    log_error "Code Formatting Check"
    echo "提示: 运行 'yarn prettier' 来自动修复格式问题"
    exit 1
fi

# 步骤7: 质量检查
log_step "Quality Checks"

# 链接检查
echo "检查文档链接..."
if yarn test:links; then
    log_success "Link Check"
else
    log_warning "Link Check - 可能有损坏的链接"
fi

# 文档差异检查
echo "检查文档差异..."
if yarn diff_md_docs:ci; then
    log_success "Documentation Diff Check"
else
    log_warning "Documentation Diff Check - 文档可能需要更新"
fi

# 文档生成测试
echo "测试文档生成..."
if yarn test:generate_docs:ci; then
    log_success "Documentation Generation Test"
else
    log_warning "Documentation Generation Test - 跳过"
fi

# 步骤8: 合约测试
log_step "Contract Tests"
echo "运行合约测试..."

# 获取合约包列表
CONTRACT_PACKAGES="@0x/contracts-multisig @0x/contracts-utils @0x/contracts-exchange-libs @0x/contracts-erc721 @0x/contracts-erc1155 @0x/contracts-asset-proxy @0x/contracts-broker @0x/contracts-zero-ex"

echo "测试合约包: $CONTRACT_PACKAGES"
if yarn wsrun -p $CONTRACT_PACKAGES -m --serial -c test:ci; then
    log_success "Contract Tests"
else
    log_error "Contract Tests"
    exit 1
fi

# 步骤9: 包测试
log_step "Package Tests"
echo "运行本地包测试..."

LOCAL_PACKAGES="@0x/contracts-test-utils @0x/contract-addresses @0x/contract-artifacts @0x/contract-wrappers-test @0x/order-utils"

echo "测试本地包: $LOCAL_PACKAGES"
if yarn wsrun -p $LOCAL_PACKAGES -m --serial -c test:ci; then
    log_success "Package Tests"
else
    log_error "Package Tests"
    exit 1
fi

# 步骤10: Forge测试
if [ "$SKIP_FORGE" = true ]; then
    log_skip "Forge Tests (跳过)"
else
    log_step "Forge Tests"
    
    # 定义要测试的合约模块
    if [ -n "$TARGET_MODULE" ]; then
        MODULES=("$TARGET_MODULE")
        echo "只测试模块: $TARGET_MODULE"
    else
        MODULES=("erc20" "zero-ex" "governance")
        echo "测试所有模块: ${MODULES[*]}"
    fi
    
    FORGE_SUCCESS=true
    
    for module in "${MODULES[@]}"; do
        echo ""
        echo -e "${PURPLE}🔨 Testing module: $module${NC}"
        
        if [ ! -d "contracts/$module" ]; then
            echo -e "${YELLOW}⚠️  Module $module not found, skipping...${NC}"
            continue
        fi
        
        cd "contracts/$module"
        
        # 构建
        echo "Building $module..."
        if forge build --sizes; then
            echo -e "${GREEN}✅ Build successful for $module${NC}"
        else
            echo -e "${RED}❌ Build failed for $module${NC}"
            FORGE_SUCCESS=false
            cd ../..
            continue
        fi
        
        # 测试
        echo "Testing $module..."
        if forge test -vvv --gas-report; then
            echo -e "${GREEN}✅ Tests passed for $module${NC}"
        else
            echo -e "${RED}❌ Tests failed for $module${NC}"
            FORGE_SUCCESS=false
        fi
        
        cd ../..
    done
    
    if [ "$FORGE_SUCCESS" = true ]; then
        log_success "Forge Tests"
    else
        log_error "Forge Tests"
        exit 1
    fi
fi

# 步骤11: 覆盖率检查
if [ "$SKIP_COVERAGE" = true ]; then
    log_skip "Coverage Check (跳过)"
else
    log_step "Coverage Check"
    
    echo "生成zero-ex模块的覆盖率报告..."
    cd contracts/zero-ex
    
    if forge coverage --report summary; then
        log_success "Coverage Check"
    else
        log_warning "Coverage Check - 无法生成覆盖率报告"
    fi
    
    cd ../..
fi

# 最终报告
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BLUE}🎉 CI测试完成!${NC}"
echo -e "${BLUE}==============${NC}"
echo ""
echo -e "${GREEN}✅ 通过的步骤 (${#PASSED_STEPS[@]}):"
for step in "${PASSED_STEPS[@]}"; do
    echo -e "   ${GREEN}✅ $step${NC}"
done

if [ ${#SKIPPED_STEPS[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⏭️  跳过的步骤 (${#SKIPPED_STEPS[@]}):"
    for step in "${SKIPPED_STEPS[@]}"; do
        echo -e "   ${YELLOW}⏭️  $step${NC}"
    done
fi

if [ ${#FAILED_STEPS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ 失败的步骤 (${#FAILED_STEPS[@]}):"
    for step in "${FAILED_STEPS[@]}"; do
        echo -e "   ${RED}❌ $step${NC}"
    done
fi

echo ""
echo -e "${CYAN}⏱️  总用时: ${DURATION}秒${NC}"

if [ ${#FAILED_STEPS[@]} -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 所有测试通过! 代码可以安全提交到CI。${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}💥 有 ${#FAILED_STEPS[@]} 个步骤失败，请修复后再提交。${NC}"
    exit 1
fi 