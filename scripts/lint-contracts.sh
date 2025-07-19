#!/bin/bash

# 严格的Solidity代码检查脚本
# 当发现错误时会导致CI失败

echo "🔍 Running Solidity lint checks..."

# 找到solhint可执行文件的路径
SOLHINT_CMD="./node_modules/.bin/solhint"
if [ ! -f "$SOLHINT_CMD" ]; then
    SOLHINT_CMD="npx solhint"
fi

# 运行solhint并捕获输出，不管退出码
LINT_OUTPUT=$($SOLHINT_CMD 'contracts/**/*.sol' 2>&1)
SOLHINT_EXIT_CODE=$?

echo "$LINT_OUTPUT"

# 检查输出中是否包含错误（只计算真正的error级别，不包括warning中的"error"文本）
ERROR_COUNT=$(echo "$LINT_OUTPUT" | grep -E "^\s*[0-9]+:[0-9]+\s+error\s+" | wc -l || true)
WARNING_COUNT=$(echo "$LINT_OUTPUT" | grep -E "^\s*[0-9]+:[0-9]+\s+warning\s+" | wc -l || true)

echo ""
echo "📊 Lint Summary:"
echo "   Errors: $ERROR_COUNT"
echo "   Warnings: $WARNING_COUNT"
echo "   Solhint exit code: $SOLHINT_EXIT_CODE"

# 如果有错误，则失败
if [ $ERROR_COUNT -gt 0 ]; then
    echo ""
    echo "❌ Solidity lint failed with $ERROR_COUNT error(s)"
    echo "   Please fix the linting errors before proceeding"
    exit 1
fi

if [ $WARNING_COUNT -gt 0 ]; then
    echo ""
    echo "⚠️  Found $WARNING_COUNT warning(s), but no errors"
fi

echo ""
echo "✅ Solidity lint passed successfully!"
exit 0 