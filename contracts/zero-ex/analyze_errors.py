#!/usr/bin/env python3
"""
分析测试错误并进行分类
"""

import re
import json
from collections import defaultdict

def analyze_test_errors(log_file):
    """分析测试错误日志"""
    
    with open(log_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取失败的测试
    test_pattern = r'^\s+(\d+)\)\s+(.+?)$'
    tests = re.findall(test_pattern, content, re.MULTILINE)
    
    # 错误分类统计
    error_categories = defaultdict(list)
    
    # 分析每个测试的错误
    test_blocks = re.split(r'^\s+\d+\)', content, flags=re.MULTILINE)[1:]  # 跳过第一个空块
    
    for i, block in enumerate(test_blocks):
        if i >= len(tests):
            break
            
        test_num, test_name = tests[i]
        
        # 错误类型分析
        if 'missing value for component id' in block:
            error_categories['ABI_ENCODING_ERRORS'].append((test_num, test_name))
        elif 'Transaction reverted without a reason string' in block:
            error_categories['TRANSACTION_REVERTS'].append((test_num, test_name))
        elif 'VM Exception while processing transaction: reverted with an unrecognized custom error' in block:
            if '0x47ab394e' in block:
                error_categories['ONLY_SELF_ERRORS'].append((test_num, test_name))
            elif '0xbea726ef' in block:
                error_categories['META_TRANSACTION_ERRORS'].append((test_num, test_name))
            elif '0x734e6e1c' in block:
                error_categories['FUNCTION_NOT_FOUND_ERRORS'].append((test_num, test_name))
            else:
                error_categories['OTHER_CUSTOM_ERRORS'].append((test_num, test_name))
        elif 'AssertionError: Expected transaction to be reverted with reason' in block:
            error_categories['REVERT_ASSERTION_ERRORS'].append((test_num, test_name))
        elif 'AssertionError: expected' in block and 'to equal' in block:
            error_categories['VALUE_ASSERTION_ERRORS'].append((test_num, test_name))
        elif 'TypeError:' in block:
            if 'is not a function' in block:
                error_categories['FUNCTION_NOT_FOUND_ERRORS'].append((test_num, test_name))
            else:
                error_categories['TYPE_ERRORS'].append((test_num, test_name))
        elif 'RangeError: data out-of-bounds' in block:
            error_categories['DATA_BOUNDS_ERRORS'].append((test_num, test_name))
        elif 'Error: Instance of' in block and 'does not have all its parameter values set' in block:
            error_categories['PARAMETER_MISSING_ERRORS'].append((test_num, test_name))
        elif '错误编码不匹配' in block:
            error_categories['ERROR_ENCODING_MISMATCH'].append((test_num, test_name))
        else:
            error_categories['UNCLASSIFIED_ERRORS'].append((test_num, test_name))
    
    return error_categories

def print_error_summary(error_categories):
    """打印错误分类摘要"""
    
    total_errors = sum(len(errors) for errors in error_categories.values())
    
    print(f"📊 **错误分类统计** (总计: {total_errors} 个)")
    print("=" * 60)
    
    # 按错误数量排序
    sorted_categories = sorted(error_categories.items(), key=lambda x: len(x[1]), reverse=True)
    
    for category, errors in sorted_categories:
        count = len(errors)
        percentage = (count / total_errors * 100) if total_errors > 0 else 0
        
        print(f"\n🔸 **{category.replace('_', ' ')}**: {count} 个 ({percentage:.1f}%)")
        
        # 显示前5个示例
        for i, (test_num, test_name) in enumerate(errors[:5]):
            print(f"   {test_num}) {test_name}")
        
        if len(errors) > 5:
            print(f"   ... 还有 {len(errors) - 5} 个")

def main():
    log_file = 'full_test_results.log'
    
    try:
        error_categories = analyze_test_errors(log_file)
        print_error_summary(error_categories)
        
        # 保存详细分析结果
        with open('error_analysis.json', 'w', encoding='utf-8') as f:
            json.dump(error_categories, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 详细分析结果已保存到 error_analysis.json")
        
    except FileNotFoundError:
        print(f"❌ 找不到日志文件: {log_file}")
    except Exception as e:
        print(f"❌ 分析过程中出错: {e}")

if __name__ == "__main__":
    main()
