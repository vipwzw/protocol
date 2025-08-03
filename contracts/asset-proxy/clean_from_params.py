import re

# Read the file
with open('test/proxies.ts', 'r') as f:
    lines = f.readlines()

# Remove lines that contain only 'from: xxx,' (with optional whitespace)
cleaned_lines = []
for line in lines:
    # Skip lines that are just 'from: xxx,' with optional whitespace
    if re.match(r'^\s*from:\s*\w+,\s*$', line):
        continue
    cleaned_lines.append(line)

# Write back to file
with open('test/proxies.ts', 'w') as f:
    f.writelines(cleaned_lines)

print("Cleaned from parameters")
