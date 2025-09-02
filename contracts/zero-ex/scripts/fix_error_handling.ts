#!/usr/bin/env ts-node

/**
 * 错误处理修复命令行工具
 * 
 * 使用方法:
 * npx ts-node scripts/fix_error_handling.ts --scan
 * npx ts-node scripts/fix_error_handling.ts --fix test/features/meta_transactions_test.ts
 * npx ts-node scripts/fix_error_handling.ts --report
 */

import * as fs from 'fs';
import * as path from 'path';
import { ErrorFixAutomation } from '../test/utils/error_fix_automation';
import { ErrorTypeDetector } from '../test/utils/error_type_detector';

interface CliOptions {
    scan?: boolean;
    fix?: string;
    report?: boolean;
    dryRun?: boolean;
    help?: boolean;
}

class ErrorHandlingCli {
    
    static async main() {
        const options = this.parseArgs();
        
        if (options.help) {
            this.showHelp();
            return;
        }

        try {
            if (options.scan) {
                await this.scanCommand();
            } else if (options.fix) {
                await this.fixCommand(options.fix, options.dryRun);
            } else if (options.report) {
                await this.reportCommand();
            } else {
                console.log('请指定一个命令。使用 --help 查看帮助。');
            }
        } catch (error) {
            console.error('❌ 执行失败:', error.message);
            process.exit(1);
        }
    }

    /**
     * 扫描命令：扫描所有测试文件
     */
    private static async scanCommand() {
        console.log('🔍 扫描测试文件中的错误处理问题...\n');
        
        const testDir = path.join(__dirname, '../test');
        const scanResult = await ErrorFixAutomation.scanTestDirectory(testDir);
        
        console.log('📊 扫描结果:');
        console.log(`- 总文件数: ${scanResult.totalFiles}`);
        console.log(`- 有问题的文件: ${scanResult.filesWithErrors}`);
        console.log(`- 修复率: ${((scanResult.totalFiles - scanResult.filesWithErrors) / scanResult.totalFiles * 100).toFixed(1)}%\n`);
        
        console.log('🔍 错误模式分布:');
        for (const [pattern, count] of Object.entries(scanResult.errorPatterns)) {
            console.log(`- ${pattern}: ${count} 个`);
        }
        
        if (scanResult.filesWithErrors > 0) {
            console.log('\n📝 需要修复的文件:');
            for (const fileAnalysis of scanResult.fixSuggestions) {
                console.log(`- ${fileAnalysis.filePath} (${fileAnalysis.issues.length} 个问题)`);
            }
            
            console.log('\n💡 建议:');
            console.log('- 使用 --fix <文件路径> 修复特定文件');
            console.log('- 使用 --report 生成详细报告');
        } else {
            console.log('\n✅ 所有文件都没有发现错误处理问题！');
        }
    }

    /**
     * 修复命令：修复指定文件
     */
    private static async fixCommand(filePath: string, dryRun: boolean = false) {
        console.log(`🔧 ${dryRun ? '预览' : '修复'} 文件: ${filePath}\n`);
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }

        // 分析文件
        const content = fs.readFileSync(filePath, 'utf-8');
        console.log('📋 分析文件内容...');
        
        // 应用自动修复
        const fixResult = await ErrorFixAutomation.autoFix(filePath, dryRun);
        
        if (fixResult.hasChanges) {
            console.log('✅ 发现并修复了以下问题:');
            fixResult.appliedFixes.forEach(fix => {
                console.log(`- ${fix}`);
            });
            
            if (dryRun) {
                console.log('\n📄 修复后的内容预览:');
                console.log('--- 差异 ---');
                this.showDiff(fixResult.originalContent, fixResult.fixedContent);
            } else {
                console.log(`\n✅ 文件已成功修复: ${filePath}`);
                console.log('请运行测试验证修复结果。');
            }
        } else {
            console.log('✅ 文件没有发现需要自动修复的问题。');
        }

        // 提供手动修复建议
        await this.provideManualFixSuggestions(filePath);
    }

    /**
     * 报告命令：生成详细报告
     */
    private static async reportCommand() {
        console.log('📊 生成错误处理修复报告...\n');
        
        const testDir = path.join(__dirname, '../test');
        const scanResult = await ErrorFixAutomation.scanTestDirectory(testDir);
        const report = ErrorFixAutomation.generateFixReport(scanResult);
        
        const reportPath = path.join(__dirname, '../ERROR_HANDLING_FIX_REPORT.md');
        fs.writeFileSync(reportPath, report);
        
        console.log(`✅ 报告已生成: ${reportPath}`);
        console.log('\n📋 报告摘要:');
        console.log(report.split('\n').slice(0, 20).join('\n'));
        console.log('\n... (查看完整报告请打开文件)');
    }

    /**
     * 提供手动修复建议
     */
    private static async provideManualFixSuggestions(filePath: string) {
        console.log('\n🔍 检查需要手动修复的问题...');
        
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const suggestions: string[] = [];

        // 检查复杂的错误处理模式
        lines.forEach((line, index) => {
            if (line.includes('MetaTransactionExpiredError') || 
                line.includes('MetaTransactionAlreadyExecutedError')) {
                suggestions.push(`第 ${index + 1} 行: 考虑使用 UnifiedErrorMatcher 处理动态参数错误`);
            }
            
            if (line.includes('// TODO') && line.toLowerCase().includes('error')) {
                suggestions.push(`第 ${index + 1} 行: 完成 TODO 中的错误处理`);
            }
            
            if (line.includes('try {') && lines[index + 1]?.includes('await')) {
                const nextFewLines = lines.slice(index, index + 10).join('\n');
                if (nextFewLines.includes('error.data') && nextFewLines.includes('expect')) {
                    suggestions.push(`第 ${index + 1} 行: 考虑使用 UnifiedErrorMatcher 简化 try-catch 错误处理`);
                }
            }
        });

        if (suggestions.length > 0) {
            console.log('\n💡 手动修复建议:');
            suggestions.forEach(suggestion => {
                console.log(`- ${suggestion}`);
            });
            
            console.log('\n📖 参考资料:');
            console.log('- 查看 UNIFIED_ERROR_HANDLING_GUIDE.md 获取详细指南');
            console.log('- 查看 test/utils/error_handling_examples.ts 获取示例代码');
        } else {
            console.log('✅ 没有发现需要手动修复的复杂问题。');
        }
    }

    /**
     * 显示文件差异
     */
    private static showDiff(original: string, fixed: string) {
        const originalLines = original.split('\n');
        const fixedLines = fixed.split('\n');
        
        const maxLines = Math.max(originalLines.length, fixedLines.length);
        let diffCount = 0;
        
        for (let i = 0; i < maxLines && diffCount < 20; i++) {
            const origLine = originalLines[i] || '';
            const fixedLine = fixedLines[i] || '';
            
            if (origLine !== fixedLine) {
                console.log(`${i + 1:3}: - ${origLine}`);
                console.log(`${i + 1:3}: + ${fixedLine}`);
                diffCount++;
            }
        }
        
        if (diffCount >= 20) {
            console.log('... (更多差异请查看文件)');
        }
    }

    /**
     * 解析命令行参数
     */
    private static parseArgs(): CliOptions {
        const args = process.argv.slice(2);
        const options: CliOptions = {};
        
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            switch (arg) {
                case '--scan':
                    options.scan = true;
                    break;
                case '--fix':
                    options.fix = args[++i];
                    break;
                case '--report':
                    options.report = true;
                    break;
                case '--dry-run':
                    options.dryRun = true;
                    break;
                case '--help':
                case '-h':
                    options.help = true;
                    break;
                default:
                    if (arg.startsWith('--')) {
                        throw new Error(`未知选项: ${arg}`);
                    }
            }
        }
        
        return options;
    }

    /**
     * 显示帮助信息
     */
    private static showHelp() {
        console.log(`
🔧 0x Protocol 错误处理修复工具

使用方法:
  npx ts-node scripts/fix_error_handling.ts [选项]

选项:
  --scan              扫描所有测试文件，显示错误处理问题统计
  --fix <文件路径>     修复指定文件的错误处理问题
  --report            生成详细的修复报告
  --dry-run           预览修复结果，不实际修改文件
  --help, -h          显示此帮助信息

示例:
  # 扫描所有测试文件
  npx ts-node scripts/fix_error_handling.ts --scan
  
  # 预览修复特定文件
  npx ts-node scripts/fix_error_handling.ts --fix test/features/meta_transactions_test.ts --dry-run
  
  # 实际修复特定文件
  npx ts-node scripts/fix_error_handling.ts --fix test/features/meta_transactions_test.ts
  
  # 生成详细报告
  npx ts-node scripts/fix_error_handling.ts --report

注意:
  - 建议先使用 --dry-run 预览修复结果
  - 修复后请运行测试验证结果
  - 复杂的错误处理可能需要手动修复
        `);
    }
}

// 运行 CLI
if (require.main === module) {
    ErrorHandlingCli.main().catch(error => {
        console.error('❌ 未处理的错误:', error);
        process.exit(1);
    });
}

export { ErrorHandlingCli };
