import re

# Read the file
with open('test/proxies.ts', 'r') as f:
    content = f.read()

# Pattern to match incomplete assetProxyInterface calls
pattern = r'(const data = )assetProxyInterface\s*\.transferFrom\(([^;]+)\)\s*;'

def replacement_func(match):
    prefix = match.group(1)
    args = match.group(2).strip()
    
    # Split the arguments and clean them up
    args_list = [arg.strip() for arg in args.split(',')]
    
    # Format the replacement
    formatted_args = ',\n                    '.join(args_list)
    return f"{prefix}assetProxyInterface.interface.encodeFunctionData('transferFrom', [\n                    {formatted_args},\n                ]);"

# Apply the replacement
new_content = re.sub(pattern, replacement_func, content, flags=re.MULTILINE | re.DOTALL)

# Write back to file
with open('test/proxies.ts', 'w') as f:
    f.write(new_content)

print("Fixed incomplete assetProxyInterface calls")
