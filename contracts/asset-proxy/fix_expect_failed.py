import re

# Read the file
with open('test/proxies.ts', 'r') as f:
    content = f.read()

# Pattern 1: expectTransactionFailedAsync with RevertReason
pattern1 = r'(\s+)await expectTransactionFailedAsync\(\s*(authorizedSigner\.sendTransaction\(\{[^}]+\}\)),\s*RevertReason\.(\w+),\s*\);'
replacement1 = r'\1await expect(\n\1    \2\n\1).to.be.revertedWith(\'\3\');'

# Pattern 2: expectTransactionFailedWithoutReasonAsync  
pattern2 = r'(\s+)await expectTransactionFailedWithoutReasonAsync\(\s*(authorizedSigner\.sendTransaction\(\{[^}]+\}\)),\s*\);'
replacement2 = r'\1await expect(\n\1    \2\n\1).to.be.reverted;'

# Apply replacements
content = re.sub(pattern1, replacement1, content, flags=re.MULTILINE | re.DOTALL)
content = re.sub(pattern2, replacement2, content, flags=re.MULTILINE | re.DOTALL)

# Write back to file
with open('test/proxies.ts', 'w') as f:
    f.write(content)

print("Fixed expectTransactionFailedAsync calls")
