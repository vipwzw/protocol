#!/usr/bin/env python3
"""
批量应用状态重置机制到所有测试文件
"""

import os
import re
import glob

def apply_state_reset_to_file(file_path):
    """为单个测试文件添加状态重置机制"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查是否已经有状态重置机制
    if 'snapshotId' in content and 'evm_snapshot' in content and 'evm_revert' in content:
        print(f"✅ {file_path} 已经有完整的状态重置机制")
        return False
    
    # 检查是否已经有 snapshotId 变量声明
    if 'snapshotId' not in content:
        # 查找变量声明区域，在最后一个 let 声明后添加 snapshotId
        let_pattern = r'(\s+let\s+[^;]+;)(?=\s*\n\s*before\s*\()'
        matches = list(re.finditer(let_pattern, content))
        if matches:
            last_let = matches[-1]
            content = content[:last_let.end()] + '\n    let snapshotId: string;' + content[last_let.end():]
            print(f"✅ 添加了 snapshotId 变量声明到 {file_path}")
    
    # 查找 before() 块的结尾，添加快照创建
    before_end_pattern = r'(\s+\}\);)(?=\s*\n\s*(describe|it|async\s+function|const|let|\}|$))'
    
    def add_snapshot_creation(match):
        indent = '        '  # 假设是8个空格的缩进
        snapshot_code = f'''
{indent}// 创建初始快照
{indent}snapshotId = await ethers.provider.send('evm_snapshot', []);
{match.group(1)}

    beforeEach(async () => {{
        // 🔄 状态重置：恢复到初始快照，完全重置所有状态
        // 这包括区块链时间、合约状态、账户余额等所有状态
        await ethers.provider.send('evm_revert', [snapshotId]);
        // 重新创建快照供下次使用
        snapshotId = await ethers.provider.send('evm_snapshot', []);
    }});'''
        return snapshot_code
    
    # 应用替换
    new_content = re.sub(before_end_pattern, add_snapshot_creation, content, count=1)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"✅ 成功添加状态重置机制到 {file_path}")
        return True
    else:
        print(f"⚠️  无法找到合适的位置添加状态重置到 {file_path}")
        return False

def main():
    # 获取所有测试文件
    test_files = []
    test_files.extend(glob.glob('test/features/*_test.ts'))
    test_files.extend(glob.glob('test/transformers/*_test.ts'))
    
    # 排除已经处理过的文件
    exclude_files = ['test/features/otc_orders_test.ts']  # 已经手动处理过
    test_files = [f for f in test_files if f not in exclude_files]
    
    print(f"找到 {len(test_files)} 个测试文件需要处理")
    
    success_count = 0
    for file_path in test_files:
        if os.path.exists(file_path):
            if apply_state_reset_to_file(file_path):
                success_count += 1
        else:
            print(f"❌ 文件不存在: {file_path}")
    
    print(f"\n📊 处理结果: {success_count}/{len(test_files)} 个文件成功添加状态重置机制")

if __name__ == "__main__":
    main()
