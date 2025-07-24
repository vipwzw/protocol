#!/bin/bash
echo "| 文件名 | describe | it | test | 总测试用例 |"
echo "|-------|----------|----|----|---------|"

for file in $(find test -name "*.ts" -type f ! -path "*/generated-wrappers/*" | sort); do
    if [[ "$file" == "test/artifacts.ts" || "$file" == "test/wrappers.ts" ]]; then
        continue
    fi
    
    describe_count=$(grep -c "describe(" "$file" 2>/dev/null || echo 0)
    it_count=$(grep -c "it(" "$file" 2>/dev/null || echo 0)  
    test_count=$(grep -c "test(" "$file" 2>/dev/null || echo 0)
    total_tests=$((it_count + test_count))
    
    filename=$(basename "$file")
    printf "| %-40s | %8d | %2d | %4d | %9d |\n" "$filename" "$describe_count" "$it_count" "$test_count" "$total_tests"
done
