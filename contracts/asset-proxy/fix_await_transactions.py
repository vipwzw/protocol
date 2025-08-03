import re

# Read the file
with open('test/proxies.ts', 'r') as f:
    content = f.read()

# Pattern to match the awaitTransactionSuccessAsync calls
pattern = r'(\s+)await web3Wrapper\.awaitTransactionSuccessAsync\(\s*await authorizedSigner\.sendTransaction\(\{\s*to: ([^,]+),\s*data,\s*from: authorized,\s*\}\),\s*constants\.AWAIT_TRANSACTION_MINED_MS,\s*\);'

# Replacement
replacement = r'\1const tx = await authorizedSigner.sendTransaction({\n\1    to: \2,\n\1    data,\n\1});\n\1await tx.wait();'

# Apply replacement
new_content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)

# Write back to file
with open('test/proxies.ts', 'w') as f:
    f.write(new_content)

print("Fixed awaitTransactionSuccessAsync calls")
