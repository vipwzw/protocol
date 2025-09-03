#!/usr/bin/env python3
"""
批量修复 multiplex 调用语法错误的脚本
"""

import re
import sys

def fix_multiplex_calls(content):
    """修复 multiplex 调用语法"""
    
    # 修复 multiplex 调用语法错误
    patterns = [
        # 修复 ({ from: taker }) 语法
        (r'(\s+)\.multiplexBatchSellTokenForToken\(\s*([^)]+)\s*\)\s*\(\{\s*from:\s*(\w+)\s*\}\);',
         r'\1.connect(await env.provider.getSigner(\3))\n\1.multiplexBatchSellTokenForToken(\2);'),
        
        (r'(\s+)\.multiplexMultiHopSellTokenForToken\(\s*([^)]+)\s*\)\s*\(\{\s*from:\s*(\w+)\s*\}\);',
         r'\1.connect(await env.provider.getSigner(\3))\n\1.multiplexMultiHopSellTokenForToken(\2);'),
         
        (r'(\s+)\.multiplexBatchSellEthForToken\(\s*([^)]+)\s*\)\s*\(\{\s*from:\s*(\w+)\s*\}\);',
         r'\1.connect(await env.provider.getSigner(\3))\n\1.multiplexBatchSellEthForToken(\2);'),
         
        (r'(\s+)\.multiplexBatchSellTokenForEth\(\s*([^)]+)\s*\)\s*\(\{\s*from:\s*(\w+)\s*\}\);',
         r'\1.connect(await env.provider.getSigner(\3))\n\1.multiplexBatchSellTokenForEth(\2);'),
         
        (r'(\s+)\.multiplexMultiHopSellEthForToken\(\s*([^)]+)\s*\)\s*\(\{\s*from:\s*(\w+)\s*\}\);',
         r'\1.connect(await env.provider.getSigner(\3))\n\1.multiplexMultiHopSellEthForToken(\2);'),
         
        (r'(\s+)\.multiplexMultiHopSellTokenForEth\(\s*([^)]+)\s*\)\s*\(\{\s*from:\s*(\w+)\s*\}\);',
         r'\1.connect(await env.provider.getSigner(\3))\n\1.multiplexMultiHopSellTokenForEth(\2);'),
         
        # 修复 .address 为 await getAddress()
        (r'(\w+)\.address(?=\s*[,\)])', r'await \1.getAddress()'),
    ]
    
    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    
    return content

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 fix_multiplex_calls.py <file_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        fixed_content = fix_multiplex_calls(content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        
        print(f"Fixed multiplex calls in {file_path}")
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
