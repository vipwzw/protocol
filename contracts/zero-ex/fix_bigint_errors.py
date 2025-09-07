#!/usr/bin/env python3
"""
批量修复 BigInt 混合错误的脚本
"""

import re
import sys

def fix_bigint_errors(content):
    """修复 BigInt 混合错误"""
    
    # 修复常见的 BigInt + number 模式
    patterns = [
        # order.amount + number -> order.amount + numberN
        (r'(\w+\.(?:takerAmount|makerAmount|amount))\s*\+\s*(\d+)(?!n)', r'\1 + \2n'),
        (r'(\w+\.(?:takerAmount|makerAmount|amount))\s*-\s*(\d+)(?!n)', r'\1 - \2n'),
        (r'(\w+\.(?:takerAmount|makerAmount|amount))\s*\*\s*(\d+)(?!n)', r'\1 * \2n'),
        (r'(\w+\.(?:takerAmount|makerAmount|amount))\s*/\s*(\d+)(?!n)', r'\1 / \2n'),
        
        # 其他常见的 BigInt 字段
        (r'(\w+\.(?:nonce|salt|expiry|value|balance))\s*\+\s*(\d+)(?!n)', r'\1 + \2n'),
        (r'(\w+\.(?:nonce|salt|expiry|value|balance))\s*-\s*(\d+)(?!n)', r'\1 - \2n'),
        
        # 函数调用中的 number 参数需要转换为 BigInt
        (r'\.reduce\(\(a,\s*b\)\s*=>\s*a\s*\+\s*b,\s*0\)', r'.reduce((a, b) => a + b, 0n)'),
    ]
    
    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    
    return content

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 fix_bigint_errors.py <file_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        fixed_content = fix_bigint_errors(content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        
        print(f"Fixed BigInt errors in {file_path}")
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
