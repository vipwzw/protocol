#!/bin/bash

# Quick test script for GitHub Actions components
echo "🚀 Quick GitHub Actions Test"
echo "============================"

# Set up Foundry PATH
if [ -d "/Users/kingwang/.foundry/bin" ]; then
    export PATH="/Users/kingwang/.foundry/bin:$PATH"
fi

# Test basic environment
echo "1. Environment Check:"
node --version && echo "✅ Node.js OK" || echo "❌ Node.js missing"
yarn --version && echo "✅ Yarn OK" || echo "❌ Yarn missing"
forge --version && echo "✅ Foundry OK" || echo "❌ Foundry missing"

# Test YAML syntax
echo -e "\n2. YAML Validation:"
python3 -c "
import yaml
import glob
import sys

success = True
for file in glob.glob('.github/workflows/*.yml') + ['.github/auto-assign.yml']:
    try:
        with open(file, 'r') as f:
            yaml.safe_load(f)
        print(f'✅ {file}')
    except Exception as e:
        print(f'❌ {file}: {e}')
        success = False

sys.exit(0 if success else 1)
"

# Test contract compilation (quick)
echo -e "\n3. Smart Contract Check:"
cd contracts/governance
if forge build > /dev/null 2>&1; then
    echo "✅ Governance contracts compile"
else
    echo "❌ Governance contracts failed"
fi
cd - > /dev/null

# Test TypeScript (quick check)
echo -e "\n4. TypeScript Check:"
if [ -d "node_modules" ]; then
    if yarn lint:ts > /dev/null 2>&1; then
        echo "✅ TypeScript linting passed"
    else
        if yarn lint:ts 2>&1 | grep -q "✖.*problems.*(0 errors"; then
            echo "⚠️ TypeScript linting (warnings only)"
        else
            echo "❌ TypeScript linting failed"
        fi
    fi
else
    echo "⚠️ Dependencies not installed"
fi

echo -e "\n5. Project Structure:"
[ -f "package.json" ] && echo "✅ package.json" || echo "❌ package.json"
[ -d "contracts" ] && echo "✅ contracts/" || echo "❌ contracts/"
[ -d "packages" ] && echo "✅ packages/" || echo "❌ packages/"
[ -d ".github/workflows" ] && echo "✅ .github/workflows/" || echo "❌ .github/workflows/"

echo -e "\n✅ Quick test completed!"
echo "For detailed testing, run: ./scripts/test-github-actions-local.sh" 
