#!/bin/bash

# 严格的Prettier格式检查脚本
# 当发现格式问题时会导致CI失败

echo "🔍 Checking code formatting with Prettier..."

# 运行prettier检查并捕获输出
PRETTIER_OUTPUT=$(yarn prettier --list-different '**/*.{ts,tsx,json,sol}' --config .prettierrc 2>&1)
PRETTIER_EXIT_CODE=$?

if [ $PRETTIER_EXIT_CODE -eq 0 ]; then
    echo "✅ All files are properly formatted!"
    exit 0
fi

echo "$PRETTIER_OUTPUT"

# 统计需要格式化的文件数量
UNFORMATTED_COUNT=$(echo "$PRETTIER_OUTPUT" | grep -v "^yarn run" | grep -v "^$" | wc -l | tr -d ' ')

echo ""
echo "📊 Prettier Check Summary:"
echo "   Unformatted files: $UNFORMATTED_COUNT"
echo "   Prettier exit code: $PRETTIER_EXIT_CODE"

echo ""
echo "❌ Code formatting check failed!"
echo "   $UNFORMATTED_COUNT file(s) need formatting"
echo ""
echo "🔧 To fix formatting issues, run:"
echo "   yarn prettier"
echo ""
exit 1 