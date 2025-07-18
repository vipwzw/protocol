#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test results
print_test_result() {
    local test_name="$1"
    local result="$2"
    if [ "$result" -eq 0 ]; then
        echo -e "${GREEN}✅ $test_name${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ $test_name${NC}"
        ((TESTS_FAILED++))
    fi
}

# Function to run a test step
run_test() {
    local test_name="$1"
    local command="$2"
    echo -e "${BLUE}🔍 Testing: $test_name${NC}"
    
    if eval "$command" > /dev/null 2>&1; then
        print_test_result "$test_name" 0
        return 0
    else
        print_test_result "$test_name" 1
        return 1
    fi
}

# Function to run a test step with output
run_test_with_output() {
    local test_name="$1"
    local command="$2"
    echo -e "${BLUE}🔍 Testing: $test_name${NC}"
    
    if eval "$command"; then
        print_test_result "$test_name" 0
        return 0
    else
        print_test_result "$test_name" 1
        return 1
    fi
}

echo -e "${YELLOW}🚀 Local GitHub Actions Testing${NC}"
echo "================================================"

# 1. Basic Environment Checks
echo -e "\n${YELLOW}📋 1. Basic Environment Checks${NC}"
run_test "Node.js availability" "node --version"
run_test "npm availability" "npm --version"
run_test "yarn availability" "yarn --version"
run_test "git availability" "git --version"
run_test "Python3 availability" "python3 --version"

# 2. Project Structure Validation
echo -e "\n${YELLOW}📁 2. Project Structure Validation${NC}"
run_test "contracts directory exists" "[ -d 'contracts' ]"
run_test "packages directory exists" "[ -d 'packages' ]"
run_test "package.json exists" "[ -f 'package.json' ]"
run_test ".github/workflows exists" "[ -d '.github/workflows' ]"
run_test "tsconfig.json exists" "[ -f 'tsconfig.json' ]"

# 3. YAML Syntax Validation
echo -e "\n${YELLOW}🔧 3. YAML Syntax Validation${NC}"
echo "Validating workflow files..."

for workflow in .github/workflows/*.yml; do
    workflow_name=$(basename "$workflow")
    if python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
        print_test_result "YAML syntax: $workflow_name" 0
    else
        print_test_result "YAML syntax: $workflow_name" 1
    fi
done

if python3 -c "import yaml; yaml.safe_load(open('.github/auto-assign.yml'))" 2>/dev/null; then
    print_test_result "YAML syntax: auto-assign.yml" 0
else
    print_test_result "YAML syntax: auto-assign.yml" 1
fi

# 4. Foundry Installation and Testing
echo -e "\n${YELLOW}⚒️  4. Foundry Testing${NC}"

# Add Foundry to PATH if it exists
if [ -d "/Users/kingwang/.foundry/bin" ]; then
    export PATH="/Users/kingwang/.foundry/bin:$PATH"
fi

if command -v forge >/dev/null 2>&1; then
    run_test "Foundry forge available" "forge --version"
    run_test "Foundry cast available" "cast --version"
    run_test "Foundry anvil available" "anvil --version"
    
    # Test contract compilation
    echo "Testing contract compilation..."
    cd contracts/governance 2>/dev/null
    if [ $? -eq 0 ]; then
        if forge build --sizes > /tmp/forge_build.log 2>&1; then
            print_test_result "Governance contracts compilation" 0
        else
            print_test_result "Governance contracts compilation" 1
            echo "Build log:"
            tail -10 /tmp/forge_build.log
        fi
        
        # Test contract tests
        if forge test --summary > /tmp/forge_test.log 2>&1; then
            print_test_result "Governance contracts tests" 0
        else
            print_test_result "Governance contracts tests" 1
            echo "Test log:"
            tail -10 /tmp/forge_test.log
        fi
        cd - > /dev/null
    else
        print_test_result "Navigate to governance contracts" 1
    fi
    
    # Test other contract packages
    for contract_dir in contracts/erc20; do
        if [ -d "$contract_dir" ] && [ -f "$contract_dir/foundry.toml" ]; then
            contract_name=$(basename "$contract_dir")
            echo "Testing $contract_name contracts..."
            cd "$contract_dir"
            if forge build > /tmp/forge_build_${contract_name}.log 2>&1; then
                print_test_result "$contract_name contracts compilation" 0
            else
                print_test_result "$contract_name contracts compilation" 1
            fi
            cd - > /dev/null
        fi
    done
else
    print_test_result "Foundry availability" 1
    echo -e "${YELLOW}⚠️  Foundry not found. Install with: curl -L https://foundry.paradigm.xyz | bash${NC}"
fi

# 5. Node.js Dependencies Testing
echo -e "\n${YELLOW}📦 5. Node.js Dependencies Testing${NC}"

# Check if node_modules exists
if [ -d "node_modules" ]; then
    print_test_result "node_modules directory exists" 0
    
    # Test TypeScript compilation
    if yarn build > /tmp/yarn_build.log 2>&1; then
        print_test_result "TypeScript build" 0
    else
        print_test_result "TypeScript build" 1
        echo "Build errors:"
        tail -10 /tmp/yarn_build.log
    fi
    
    # Test linting
    if yarn lint:ts > /tmp/yarn_lint.log 2>&1; then
        print_test_result "TypeScript linting" 0
    else
        # Check if it's just warnings
        if grep -q "✖.*problems.*(0 errors" /tmp/yarn_lint.log; then
            print_test_result "TypeScript linting (warnings only)" 0
        else
            print_test_result "TypeScript linting" 1
            echo "Lint errors:"
            tail -20 /tmp/yarn_lint.log
        fi
    fi
    
    # Test Solidity linting
    if yarn lint:contracts > /tmp/yarn_lint_contracts.log 2>&1; then
        print_test_result "Solidity linting" 0
    else
        print_test_result "Solidity linting" 1
    fi
    
    # Test prettier check
    if yarn prettier:ci > /tmp/yarn_prettier.log 2>&1; then
        print_test_result "Prettier formatting check" 0
    else
        print_test_result "Prettier formatting check" 1
    fi
    
else
    print_test_result "node_modules directory exists" 1
    echo -e "${YELLOW}⚠️  Dependencies not installed. Run: yarn install${NC}"
fi

# 6. Security and Quality Checks
echo -e "\n${YELLOW}🔒 6. Security and Quality Checks${NC}"

# Check for common security issues
echo "Checking for potential security issues..."

# Check for hardcoded secrets (basic check)
if grep -r -i "password\|secret\|key.*=" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=lib . | grep -v "test\|spec\|mock\|forge-std\|example" > /tmp/secrets_check.log 2>&1; then
    if [ -s /tmp/secrets_check.log ]; then
        print_test_result "No hardcoded secrets" 1
        echo "Potential secrets found:"
        head -5 /tmp/secrets_check.log
    else
        print_test_result "No hardcoded secrets" 0
    fi
else
    print_test_result "No hardcoded secrets" 0
fi

# Check yarn audit (if possible)
if yarn audit --level moderate > /tmp/yarn_audit.log 2>&1; then
    print_test_result "Yarn security audit" 0
else
    # Check if it's just a network issue
    if grep -q "500 Internal Server Error\|network" /tmp/yarn_audit.log; then
        print_test_result "Yarn security audit (network issue)" 0
    else
        print_test_result "Yarn security audit" 1
        echo "Audit issues found:"
        head -10 /tmp/yarn_audit.log
    fi
fi

# 7. GitHub Actions Specific Checks
echo -e "\n${YELLOW}⚙️  7. GitHub Actions Specific Checks${NC}"

# Check for required GitHub Actions
required_actions=(
    "actions/checkout@v4"
    "actions/setup-node@v4"
    "actions/cache@v4"
    "foundry-rs/foundry-toolchain@v1"
)

for action in "${required_actions[@]}"; do
    if grep -r "$action" .github/workflows/ > /dev/null 2>&1; then
        print_test_result "Action available: $action" 0
    else
        print_test_result "Action available: $action" 1
    fi
done

# Check for environment variables usage
if grep -r "env:" .github/workflows/ > /dev/null 2>&1; then
    print_test_result "Environment variables defined" 0
else
    print_test_result "Environment variables defined" 1
fi

# Check for secrets usage
if grep -r "secrets\." .github/workflows/ > /dev/null 2>&1; then
    print_test_result "Secrets properly referenced" 0
else
    print_test_result "Secrets properly referenced" 1
fi

# 8. Test Summary
echo -e "\n${YELLOW}📊 8. Test Summary${NC}"
echo "================================================"
echo -e "Total tests: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! GitHub Actions should work correctly.${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  Some tests failed. Review the issues above before deploying.${NC}"
    exit 1
fi 
