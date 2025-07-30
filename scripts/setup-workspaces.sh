#!/bin/bash

# 确保 @0x/types 包的符号链接正确创建
# 这个脚本解决了 yarn workspaces 有时候无法正确为纯类型包创建符号链接的问题

echo "🔗 设置 @0x/types 包的符号链接..."

# 需要 @0x/types 的包列表
PACKAGES=(
    "base-contract"
    "order-utils" 
    "protocol-utils"
    "utils"
)

# 为每个包创建符号链接
for pkg in "${PACKAGES[@]}"; do
    target_dir="packages/$pkg/node_modules/@0x"
    
    # 创建目录（如果不存在）
    mkdir -p "$target_dir"
    
    # 创建符号链接（如果不存在或已损坏）
    if [ ! -L "$target_dir/types" ] || [ ! -e "$target_dir/types" ]; then
        echo "  ✅ 创建符号链接: $target_dir/types"
        rm -f "$target_dir/types" 2>/dev/null || true
        ln -sf "../../../../packages/types" "$target_dir/types"
    else
        echo "  ⚡ 符号链接已存在: $target_dir/types"
    fi
done

echo "🎉 @0x/types 符号链接设置完成！" 