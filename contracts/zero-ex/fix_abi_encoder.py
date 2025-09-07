#!/usr/bin/env python3
"""
批量修复 AbiEncoder 使用的脚本
"""

import re
import sys

def fix_abi_encoder_usage(content):
    """修复 AbiEncoder 的使用"""
    
    # 移除 AbiEncoder 导入
    content = re.sub(r'import\s*{\s*([^}]*),?\s*AbiEncoder\s*,?\s*([^}]*)\s*}\s*from\s*[\'"]@0x/utils[\'"];', 
                     r'import { \1\2 } from "@0x/utils";', content)
    content = re.sub(r'import\s*{\s*AbiEncoder\s*,?\s*([^}]*)\s*}\s*from\s*[\'"]@0x/utils[\'"];', 
                     r'import { \1 } from "@0x/utils";', content)
    content = re.sub(r'import\s*{\s*AbiEncoder\s*}\s*from\s*[\'"]@0x/utils[\'"];', '', content)
    
    # 清理空的导入行
    content = re.sub(r'import\s*{\s*,?\s*}\s*from\s*[\'"]@0x/utils[\'"];', '', content)
    content = re.sub(r'import\s*{\s*}\s*from\s*[\'"]@0x/utils[\'"];', '', content)
    
    # 修复简单的 AbiEncoder.create 使用
    patterns = [
        # getLiquidityProviderMultiHopSubcall
        (r'const plpDataEncoder = AbiEncoder\.create\(\[\s*{\s*name:\s*[\'"]provider[\'"],\s*type:\s*[\'"]address[\'"],?\s*},\s*{\s*name:\s*[\'"]auxiliaryData[\'"],\s*type:\s*[\'"]bytes[\'"],?\s*},?\s*\]\);',
         'const abiCoder = ethers.AbiCoder.defaultAbiCoder();'),
        
        (r'data:\s*plpDataEncoder\.encode\(\{\s*provider:\s*([^,]+),\s*auxiliaryData:\s*([^}]+),?\s*\}\)',
         r'data: abiCoder.encode(["address", "bytes"], [\1, \2])'),
         
        # getNestedBatchSellSubcall
        (r'const batchSellDataEncoder = AbiEncoder\.create\(\[\s*{\s*name:\s*[\'"]calls[\'"],\s*type:\s*[\'"]tuple\[\][\'"],\s*components:\s*\[\s*{\s*name:\s*[\'"]id[\'"],\s*type:\s*[\'"]uint8[\'"],?\s*},\s*{\s*name:\s*[\'"]sellAmount[\'"],\s*type:\s*[\'"]uint256[\'"],?\s*},\s*{\s*name:\s*[\'"]data[\'"],\s*type:\s*[\'"]bytes[\'"],?\s*},?\s*\],?\s*},?\s*\]\);',
         'const abiCoder = ethers.AbiCoder.defaultAbiCoder();'),
         
        (r'data:\s*batchSellDataEncoder\.encode\(\{\s*calls\s*\}\)',
         'data: abiCoder.encode(["tuple(uint8,uint256,bytes)[]"], [calls])'),
    ]
    
    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    
    return content

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 fix_abi_encoder.py <file_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        fixed_content = fix_abi_encoder_usage(content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        
        print(f"Fixed AbiEncoder usage in {file_path}")
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
