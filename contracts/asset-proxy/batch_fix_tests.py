import re

# Read the file
with open('test/proxies.ts', 'r') as f:
    content = f.read()

# List of test patterns that need setup
test_patterns = [
    r"(it\('should successfully transfer multiple different ERC721 tokens')",
    r"(it\('should successfully transfer a combination of ERC20 and ERC721 tokens')",
    r"(it\('should successfully transfer correct amounts when the `amount` > 1')",
    r"(it\('should successfully transfer a large amount of tokens')",
    r"(it\('should revert if a single transfer fails')",
]

# Setup patterns to add
erc20_setup = """                // Setup ERC20 tokens
                await setupTransferTest({ setupERC20: true });
                """

erc20_erc721_setup = """                // Setup ERC20 and ERC721 tokens
                await setupTransferTest({ setupERC20: true, setupERC721: true, useTokenB: true });
                """

erc721_setup = """                // Setup ERC721 tokens
                await setupTransferTest({ setupERC20: false, setupERC721: true, useTokenB: true });
                """

# Apply fixes for specific tests
for i, pattern in enumerate(test_patterns):
    match = re.search(pattern, content)
    if match:
        test_name = match.group(1)
        
        if 'ERC721' in test_name and 'ERC20' in test_name:
            setup = erc20_erc721_setup
        elif 'ERC721' in test_name:
            setup = erc721_setup
        else:
            setup = erc20_setup
            
        # Find the opening brace after the test declaration
        test_start = match.end()
        brace_pos = content.find('{', test_start)
        if brace_pos != -1:
            # Insert setup after the opening brace
            insert_pos = content.find('\n', brace_pos) + 1
            content = content[:insert_pos] + setup + content[insert_pos:]
            print(f"Fixed test: {test_name}")

# Write back to file
with open('test/proxies.ts', 'w') as f:
    f.write(content)

print("Batch fix completed")
