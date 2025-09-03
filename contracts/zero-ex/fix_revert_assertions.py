#!/usr/bin/env python3
"""
批量修复错误断言格式问题
将 expect(tx).to.be.revertedWith(new RevertErrors...) 
改为 expect(tx).to.be.revertedWith(expectedError.encode())
"""

import re
import sys

def fix_revert_assertions(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 匹配模式：return expect(tx).to.be.revertedWith(\n                new RevertErrors...),\n            );
    pattern = r'return expect\(([^)]+)\)\.to\.be\.revertedWith\(\s*\n\s*new (RevertErrors\.[^,]+),\s*\n\s*\);'
    
    def replacement(match):
        tx_var = match.group(1)
        error_constructor = match.group(2)
        return f'const expectedError = new {error_constructor};\n            return expect({tx_var}).to.be.revertedWith(expectedError.encode());'
    
    # 应用替换
    new_content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    
    # 处理单行格式
    pattern2 = r'return expect\(([^)]+)\)\.to\.be\.revertedWith\(\s*new (RevertErrors\.[^)]+\)[^)]*\)\s*\);'
    
    def replacement2(match):
        tx_var = match.group(1)
        error_constructor = match.group(2)
        return f'const expectedError = new {error_constructor});\n            return expect({tx_var}).to.be.revertedWith(expectedError.encode());'
    
    new_content = re.sub(pattern2, replacement2, new_content)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed revert assertions in {file_path}")
        return True
    else:
        print(f"No changes needed in {file_path}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 fix_revert_assertions.py <file_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    fix_revert_assertions(file_path)
