#!/bin/bash

# 严格的TypeScript代码检查脚本
# 当发现错误时会导致CI失败

echo "🔍 Running TypeScript lint checks..."

# 运行wsrun lint并捕获输出，不管退出码
LINT_OUTPUT=$(yarn wsrun --fast-exit --parallel --exclude-missing -p $PKG -c lint 2>&1)
WSRUN_EXIT_CODE=$?

echo "$LINT_OUTPUT"

# 检查输出中是否包含错误
ERROR_COUNT=$(echo "$LINT_OUTPUT" | grep -c " error " || true)
WARNING_COUNT=$(echo "$LINT_OUTPUT" | grep -c " warning " || true)

# 检查是否有包失败 (wsrun会输出失败信息)
FAILED_PACKAGES=$(echo "$LINT_OUTPUT" | grep -c "Command failed" || true)

echo ""
echo "📊 TypeScript Lint Summary:"
echo "   Errors: $ERROR_COUNT"
echo "   Warnings: $WARNING_COUNT"
echo "   Failed packages: $FAILED_PACKAGES"
echo "   Wsrun exit code: $WSRUN_EXIT_CODE"

# 如果wsrun本身失败或有错误，则失败
if [ $WSRUN_EXIT_CODE -ne 0 ] || [ $ERROR_COUNT -gt 0 ] || [ $FAILED_PACKAGES -gt 0 ]; then
    echo ""
    echo "❌ TypeScript lint failed"
    if [ $ERROR_COUNT -gt 0 ]; then
        echo "   Found $ERROR_COUNT error(s)"
    fi
    if [ $FAILED_PACKAGES -gt 0 ]; then
        echo "   $FAILED_PACKAGES package(s) failed lint check"
    fi
    echo "   Please fix the linting errors before proceeding"
    exit 1
fi

if [ $WARNING_COUNT -gt 0 ]; then
    echo ""
    echo "⚠️  Found $WARNING_COUNT warning(s), but no errors"
fi

echo ""
echo "✅ TypeScript lint passed successfully!"
exit 0 