import * as fs from 'fs';
import * as path from 'path';
import { ErrorTypeDetector } from './error_type_detector';

/**
 * 错误处理自动化修复工具
 *
 * 扫描测试文件，识别错误处理模式，并生成修复建议或自动修复
 */
export class ErrorFixAutomation {
    /**
     * 扫描测试目录，找出所有需要修复的错误处理
     */
    static async scanTestDirectory(testDir: string): Promise<ScanResult> {
        const results: ScanResult = {
            totalFiles: 0,
            filesWithErrors: 0,
            errorPatterns: {},
            fixSuggestions: [],
        };

        const testFiles = this.findTestFiles(testDir);
        results.totalFiles = testFiles.length;

        for (const filePath of testFiles) {
            const fileAnalysis = await this.analyzeTestFile(filePath);
            if (fileAnalysis.issues.length > 0) {
                results.filesWithErrors++;
                results.fixSuggestions.push(fileAnalysis);

                // 统计错误模式
                for (const issue of fileAnalysis.issues) {
                    const pattern = issue.pattern;
                    results.errorPatterns[pattern] = (results.errorPatterns[pattern] || 0) + 1;
                }
            }
        }

        return results;
    }

    /**
     * 分析单个测试文件
     */
    private static async analyzeTestFile(filePath: string): Promise<FileAnalysis> {
        const content = fs.readFileSync(filePath, 'utf-8');
        const issues: ErrorIssue[] = [];

        // 检测各种错误处理模式
        issues.push(...this.detectGenericRevertUsage(content, filePath));
        issues.push(...this.detectIncorrectErrorMatching(content, filePath));
        issues.push(...this.detectMissingErrorHandling(content, filePath));
        issues.push(...this.detectDeprecatedApiUsage(content, filePath));

        return {
            filePath,
            issues,
            suggestions: issues.map(issue => this.generateFixSuggestion(issue)),
        };
    }

    /**
     * 检测通用 revert 使用（违反规则）
     */
    private static detectGenericRevertUsage(content: string, filePath: string): ErrorIssue[] {
        const issues: ErrorIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            // 检测 .to.be.reverted 使用
            if (line.includes('.to.be.reverted') && !line.includes('revertedWith')) {
                issues.push({
                    type: 'generic_revert',
                    pattern: 'generic_revert_usage',
                    line: index + 1,
                    content: line.trim(),
                    severity: 'error',
                    message: '使用了通用的 .to.be.reverted，应该匹配具体错误',
                });
            }

            // 检测 expect(tx).to.be.rejected 使用
            if (line.includes('.to.be.rejected')) {
                issues.push({
                    type: 'generic_revert',
                    pattern: 'generic_rejected_usage',
                    line: index + 1,
                    content: line.trim(),
                    severity: 'warning',
                    message: '使用了通用的 .to.be.rejected，建议匹配具体错误',
                });
            }
        });

        return issues;
    }

    /**
     * 检测错误的错误匹配
     */
    private static detectIncorrectErrorMatching(content: string, filePath: string): ErrorIssue[] {
        const issues: ErrorIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            // 检测可能的错误匹配问题
            if (line.includes('revertedWith') && line.includes('new ')) {
                // 检查是否直接传递了错误对象而不是 .encode()
                if (
                    !line.includes('.encode()') &&
                    (line.includes('ZeroExRevertErrors') || line.includes('RevertErrors'))
                ) {
                    issues.push({
                        type: 'incorrect_matching',
                        pattern: 'missing_encode_call',
                        line: index + 1,
                        content: line.trim(),
                        severity: 'error',
                        message: '错误对象需要调用 .encode() 方法',
                    });
                }
            }

            // 检测可能的动态参数错误
            if (line.includes('MetaTransactionExpiredError') || line.includes('MetaTransactionAlreadyExecutedError')) {
                issues.push({
                    type: 'dynamic_parameter',
                    pattern: 'dynamic_parameter_error',
                    line: index + 1,
                    content: line.trim(),
                    severity: 'warning',
                    message: '这是动态参数错误，建议使用 UnifiedErrorMatcher',
                });
            }
        });

        return issues;
    }

    /**
     * 检测缺失的错误处理
     */
    private static detectMissingErrorHandling(content: string, filePath: string): ErrorIssue[] {
        const issues: ErrorIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            // 检测可能需要错误处理但没有的情况
            if (
                line.includes('// TODO:') &&
                (line.includes('error') || line.includes('revert') || line.includes('fail'))
            ) {
                issues.push({
                    type: 'missing_handling',
                    pattern: 'todo_error_handling',
                    line: index + 1,
                    content: line.trim(),
                    severity: 'info',
                    message: 'TODO 注释表明需要完善错误处理',
                });
            }
        });

        return issues;
    }

    /**
     * 检测过时的 API 使用
     */
    private static detectDeprecatedApiUsage(content: string, filePath: string): ErrorIssue[] {
        const issues: ErrorIssue[] = [];
        const lines = content.split('\n');

        const deprecatedPatterns = [
            { pattern: '.sendTransactionAsync()', replacement: 'await contract.method()' },
            { pattern: '.address', replacement: 'await getAddress()' },
            { pattern: 'getBalanceInWeiAsync', replacement: 'provider.getBalance()' },
            { pattern: 'getAccountNonceAsync', replacement: 'provider.getTransactionCount()' },
        ];

        lines.forEach((line, index) => {
            deprecatedPatterns.forEach(({ pattern, replacement }) => {
                if (line.includes(pattern)) {
                    issues.push({
                        type: 'deprecated_api',
                        pattern: 'deprecated_api_usage',
                        line: index + 1,
                        content: line.trim(),
                        severity: 'warning',
                        message: `过时的 API: ${pattern}，建议使用: ${replacement}`,
                    });
                }
            });
        });

        return issues;
    }

    /**
     * 生成修复建议
     */
    private static generateFixSuggestion(issue: ErrorIssue): FixSuggestion {
        switch (issue.type) {
            case 'generic_revert':
                return {
                    issue,
                    fixType: 'replace',
                    suggestion: '使用 UnifiedErrorMatcher.expectError() 或具体的错误匹配',
                    codeExample: this.getGenericRevertFixExample(issue),
                };

            case 'incorrect_matching':
                return {
                    issue,
                    fixType: 'modify',
                    suggestion: '添加 .encode() 调用或使用 UnifiedErrorMatcher',
                    codeExample: this.getIncorrectMatchingFixExample(issue),
                };

            case 'dynamic_parameter':
                return {
                    issue,
                    fixType: 'replace',
                    suggestion: '使用 UnifiedErrorMatcher 处理动态参数',
                    codeExample: this.getDynamicParameterFixExample(issue),
                };

            case 'deprecated_api':
                return {
                    issue,
                    fixType: 'replace',
                    suggestion: '更新到 ethers v6 API',
                    codeExample: this.getDeprecatedApiFixExample(issue),
                };

            default:
                return {
                    issue,
                    fixType: 'manual',
                    suggestion: '需要手动检查和修复',
                    codeExample: '// 请手动分析并修复此问题',
                };
        }
    }

    /**
     * 生成通用 revert 修复示例
     */
    private static getGenericRevertFixExample(issue: ErrorIssue): string {
        if (issue.content.includes('.to.be.reverted')) {
            return `
// ❌ 错误的通用检查
${issue.content}

// ✅ 正确的具体错误匹配
await UnifiedErrorMatcher.expectError(
    txPromise,
    new RevertErrors.NativeOrders.OrderNotFillableError(orderHash, OrderStatus.Expired)
);`;
        }

        return `
// ❌ 通用错误检查
${issue.content}

// ✅ 具体错误匹配
await UnifiedErrorMatcher.expectError(txPromise, expectedError);`;
    }

    /**
     * 生成错误匹配修复示例
     */
    private static getIncorrectMatchingFixExample(issue: ErrorIssue): string {
        return `
// ❌ 缺少 .encode() 调用
${issue.content}

// ✅ 正确的编码调用
${issue.content.replace(')', '.encode())')}

// 或者使用 UnifiedErrorMatcher（推荐）
await UnifiedErrorMatcher.expectError(txPromise, expectedError);`;
    }

    /**
     * 生成动态参数修复示例
     */
    private static getDynamicParameterFixExample(issue: ErrorIssue): string {
        return `
// ❌ 直接使用动态参数错误
${issue.content}

// ✅ 使用 UnifiedErrorMatcher 处理动态参数
await UnifiedErrorMatcher.expectMetaTransactionsError(
    txPromise,
    new ZeroExRevertErrors.MetaTransactions.MetaTransactionExpiredError(
        mtxHash,
        0n, // 动态参数，将自动解析
        expirationTimeSeconds
    )
);`;
    }

    /**
     * 生成过时 API 修复示例
     */
    private static getDeprecatedApiFixExample(issue: ErrorIssue): string {
        let fixedContent = issue.content;

        // 替换常见的过时 API
        fixedContent = fixedContent.replace('.sendTransactionAsync()', '()');
        fixedContent = fixedContent.replace('.address', 'await getAddress()');
        fixedContent = fixedContent.replace('getBalanceInWeiAsync', 'provider.getBalance');

        return `
// ❌ 过时的 API
${issue.content}

// ✅ 现代化的 API
${fixedContent}`;
    }

    /**
     * 查找测试文件
     */
    private static findTestFiles(dir: string): string[] {
        const files: string[] = [];

        const scan = (currentDir: string) => {
            const entries = fs.readdirSync(currentDir);

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory() && !entry.includes('node_modules')) {
                    scan(fullPath);
                } else if (stat.isFile() && entry.endsWith('_test.ts')) {
                    files.push(fullPath);
                }
            }
        };

        scan(dir);
        return files;
    }

    /**
     * 生成修复报告
     */
    static generateFixReport(scanResult: ScanResult): string {
        let report = `# 错误处理修复报告\n\n`;

        report += `## 📊 总体统计\n`;
        report += `- 总文件数: ${scanResult.totalFiles}\n`;
        report += `- 有问题的文件: ${scanResult.filesWithErrors}\n`;
        report += `- 修复率: ${(((scanResult.totalFiles - scanResult.filesWithErrors) / scanResult.totalFiles) * 100).toFixed(1)}%\n\n`;

        report += `## 🔍 错误模式分布\n`;
        for (const [pattern, count] of Object.entries(scanResult.errorPatterns)) {
            report += `- ${pattern}: ${count} 个\n`;
        }
        report += `\n`;

        report += `## 📝 修复建议\n`;
        for (const fileAnalysis of scanResult.fixSuggestions) {
            report += `### ${fileAnalysis.filePath}\n`;
            for (const suggestion of fileAnalysis.suggestions) {
                report += `**第 ${suggestion.issue.line} 行** (${suggestion.issue.severity}): ${suggestion.suggestion}\n`;
                report += `\`\`\`typescript\n${suggestion.codeExample}\n\`\`\`\n\n`;
            }
        }

        return report;
    }

    /**
     * 自动应用简单修复
     */
    static async autoFix(filePath: string, dryRun: boolean = true): Promise<AutoFixResult> {
        const content = fs.readFileSync(filePath, 'utf-8');
        let fixedContent = content;
        const appliedFixes: string[] = [];

        // 应用简单的文本替换修复
        const simpleReplacements = [
            {
                pattern: /\.to\.be\.reverted(?!With)/g,
                replacement: '.to.be.rejected // TODO: 使用具体错误匹配',
                description: '替换通用 revert 检查',
            },
            {
                pattern: /\.sendTransactionAsync\(\)/g,
                replacement: '()',
                description: '移除过时的 sendTransactionAsync 调用',
            },
        ];

        for (const { pattern, replacement, description } of simpleReplacements) {
            if (pattern.test(fixedContent)) {
                fixedContent = fixedContent.replace(pattern, replacement);
                appliedFixes.push(description);
            }
        }

        if (!dryRun && fixedContent !== content) {
            fs.writeFileSync(filePath, fixedContent);
        }

        return {
            filePath,
            originalContent: content,
            fixedContent,
            appliedFixes,
            hasChanges: fixedContent !== content,
        };
    }
}

// 类型定义
interface ScanResult {
    totalFiles: number;
    filesWithErrors: number;
    errorPatterns: Record<string, number>;
    fixSuggestions: FileAnalysis[];
}

interface FileAnalysis {
    filePath: string;
    issues: ErrorIssue[];
    suggestions: FixSuggestion[];
}

interface ErrorIssue {
    type: 'generic_revert' | 'incorrect_matching' | 'dynamic_parameter' | 'missing_handling' | 'deprecated_api';
    pattern: string;
    line: number;
    content: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
}

interface FixSuggestion {
    issue: ErrorIssue;
    fixType: 'replace' | 'modify' | 'manual';
    suggestion: string;
    codeExample: string;
}

interface AutoFixResult {
    filePath: string;
    originalContent: string;
    fixedContent: string;
    appliedFixes: string[];
    hasChanges: boolean;
}

// 导出便捷函数
export const scanTestDirectory = ErrorFixAutomation.scanTestDirectory.bind(ErrorFixAutomation);
export const generateFixReport = ErrorFixAutomation.generateFixReport.bind(ErrorFixAutomation);
export const autoFix = ErrorFixAutomation.autoFix.bind(ErrorFixAutomation);
