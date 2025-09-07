#!/bin/bash

# 🚀 快速CI检查脚本 - 核心检查项目
# 使用方法: ./scripts/ci-quick-check.sh [--fix]
#
# 参数说明:
#   --fix    自动修复可修复的问题 (格式化等)
#   --help   显示帮助信息

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 参数解析
AUTO_FIX=false
SHOW_HELP=false

for arg in "$@"; do
    case $arg in
        --fix)
            AUTO_FIX=true
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
    echo "🚀 快速CI检查脚本"
    echo ""
    echo "使用方法:"
    echo "  ./scripts/ci-quick-check.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --fix     自动修复可修复的问题 (格式化等)"
    echo "  --help    显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./scripts/ci-quick-check.sh          # 快速检查"
    echo "  ./scripts/ci-quick-check.sh --fix    # 检查并自动修复"
    exit 0
fi

echo -e "${BLUE}⚡ Quick CI Check${NC}"
echo -e "${BLUE}=================${NC}"
echo ""

# 辅助函数
log_step() {
    echo -e "${CYAN}📋 $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

FAILED_CHECKS=0

# 1. 基础环境检查
log_step "检查基础环境..."
if command -v node &> /dev/null && command -v yarn &> /dev/null && command -v forge &> /dev/null; then
    log_success "基础环境OK"
else
    log_error "基础环境 - 缺少必要工具 (node, yarn, forge)"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# 2. 依赖检查
log_step "检查依赖..."
if [ -d "node_modules" ]; then
    log_success "依赖已安装"
else
    log_warning "依赖未安装 - 运行 'yarn install'"
    if [ "$AUTO_FIX" = true ]; then
        echo "自动安装依赖..."
        yarn install --frozen-lockfile
        log_success "依赖安装完成"
    else
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
fi

# 3. 代码格式检查
log_step "检查代码格式..."
if yarn prettier:ci &>/dev/null; then
    log_success "代码格式OK"
else
    log_warning "代码格式问题"
    if [ "$AUTO_FIX" = true ]; then
        echo "自动修复格式..."
        yarn prettier
        log_success "格式修复完成"
    else
        echo "提示: 运行 'yarn prettier' 或使用 --fix 参数自动修复"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
fi

# 4. TypeScript Lint检查
log_step "检查TypeScript代码质量..."
if yarn lint:ts &>/dev/null; then
    log_success "TypeScript代码质量OK"
else
    log_error "TypeScript Lint错误"
    echo "提示: 检查并修复TypeScript错误"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# 5. Solidity Lint检查
log_step "检查Solidity代码质量..."
if yarn lint:contracts &>/dev/null; then
    log_success "Solidity代码质量OK"
else
    log_error "Solidity Lint错误"
    echo "提示: 检查并修复Solidity错误"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# 6. 快速构建检查
log_step "快速构建检查..."
if yarn build:ts &>/dev/null; then
    log_success "TypeScript构建OK"
else
    log_error "TypeScript构建失败"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# 7. Forge编译检查 (仅zero-ex模块)
log_step "检查Forge编译 (zero-ex)..."
cd contracts/zero-ex
if forge build &>/dev/null; then
    log_success "Forge编译OK"
else
    log_error "Forge编译失败"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
cd ../..

# 8. Git状态检查
log_step "检查Git状态..."
if git diff --quiet; then
    if git diff --cached --quiet; then
        log_success "Git工作区干净"
    else
        log_warning "有文件在暂存区"
    fi
else
    log_warning "有未提交的更改"
fi

echo ""
echo -e "${BLUE}=============${NC}"

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}🎉 所有快速检查通过!${NC}"
    echo -e "${GREEN}代码看起来很不错，可以继续开发或运行完整测试。${NC}"
    echo ""
    echo "💡 下一步建议:"
    echo "   运行完整测试: ./scripts/ci-local-test.sh"
    echo "   或者继续开发工作"
    exit 0
else
    echo -e "${RED}💥 发现 $FAILED_CHECKS 个问题${NC}"
    echo ""
    echo "💡 修复建议:"
    if [ "$AUTO_FIX" = false ]; then
        echo "   自动修复: ./scripts/ci-quick-check.sh --fix"
    fi
    echo "   完整检查: ./scripts/ci-local-test.sh"
    exit 1
fi 