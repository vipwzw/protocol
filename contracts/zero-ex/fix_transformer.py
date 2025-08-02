import re

# 读取文件
with open('test/transformers/fill_quote_transformer_test.ts', 'r') as f:
    content = f.read()

# 修复重复的 reduce 调用
content = re.sub(r'\.reduce\(\(a, b\) => a \+ b, 0n\)bridgeOrders\.map\(o => o\.takerTokenAmount\)\.reduce\(\(a, b\) => a \+ b, 0n\).*?\.reduce\(\(a, b\) => a \+ b, 0n\)', '.reduce((a, b) => a + b, 0n)', content)

# 写回文件
with open('test/transformers/fill_quote_transformer_test.ts', 'w') as f:
    f.write(content)

print("修复完成")
