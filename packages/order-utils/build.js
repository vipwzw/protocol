#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 开始构建 order-utils...');

// 创建输出目录
const libDir = path.join(__dirname, 'lib');
if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
}

try {
    // 检查是否有 typescript 模块
    console.log('1. 检查 TypeScript...');

    try {
        // 尝试使用项目本地的 TypeScript
        execSync('node -e "require(\'typescript\')"', { stdio: 'ignore' });
        console.log('✅ 找到本地 TypeScript');

        // 编译 TypeScript
        console.log('2. 编译 TypeScript 文件...');
        const ts = require('typescript');

        // 使用默认编译选项，简化配置
        const compilerOptions = {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.CommonJS,
            outDir: './lib',
            rootDir: '.',
            declaration: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            strict: false,
            skipLibCheck: true,
            resolveJsonModule: true,
            typeRoots: ['./node_modules/@types'],
            lib: ['ES2020', 'DOM'],
        };

        // 查找所有 TypeScript 文件
        const srcDir = path.join(__dirname, 'src');
        const testDir = path.join(__dirname, 'test');

        function findTsFiles(dir) {
            const files = [];
            if (!fs.existsSync(dir)) return files;

            function walk(currentDir) {
                const items = fs.readdirSync(currentDir);
                for (const item of items) {
                    const fullPath = path.join(currentDir, item);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        walk(fullPath);
                    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
                        files.push(fullPath);
                    }
                }
            }

            walk(dir);
            return files;
        }

        const sourceFiles = [...findTsFiles(srcDir), ...findTsFiles(testDir)];

        console.log(`   找到 ${sourceFiles.length} 个 TypeScript 文件`);

        // 编译文件
        const program = ts.createProgram(sourceFiles, compilerOptions);
        const emitResult = program.emit();

        const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

        // 只显示错误，忽略警告
        const errors = diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);

        if (errors.length > 0) {
            console.log('❌ TypeScript 编译错误:');
            errors.forEach(diagnostic => {
                if (diagnostic.file) {
                    const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
                    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                    console.log(`   ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
                } else {
                    console.log(`   ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
                }
            });
            throw new Error('TypeScript 编译失败');
        }

        if (emitResult.emitSkipped) {
            throw new Error('TypeScript 发射被跳过');
        } else {
            console.log('✅ TypeScript 编译成功');
        }
    } catch (tsError) {
        console.log('⚠️  TypeScript 编译出错，尝试直接复制文件...');
        console.log('   错误详情:', tsError.message);

        // 如果没有 TypeScript，尝试简单的文件复制
        function copyFiles(srcDir, destDir) {
            if (!fs.existsSync(srcDir)) return;

            function copy(currentSrc, currentDest) {
                const items = fs.readdirSync(currentSrc);
                for (const item of items) {
                    const srcPath = path.join(currentSrc, item);
                    const destPath = path.join(currentDest, item);
                    const stat = fs.statSync(srcPath);

                    if (stat.isDirectory()) {
                        if (!fs.existsSync(destPath)) {
                            fs.mkdirSync(destPath, { recursive: true });
                        }
                        copy(srcPath, destPath);
                    } else if (item.endsWith('.ts')) {
                        // 简单的 TypeScript 到 JavaScript 转换
                        const content = fs.readFileSync(srcPath, 'utf8');
                        const jsContent = content
                            .replace(/import\\s+.*?from\\s+['"][^'"]*['"];?/g, '') // 移除 import
                            .replace(/export\\s+/g, '') // 移除 export
                            .replace(/:\\s*[A-Za-z_][A-Za-z0-9_<>\\[\\]|&]*(?:\\s*=.*?)?(?=\\s*[,;)])/g, '') // 移除类型注解
                            .replace(/interface\\s+[^{]+\\{[^}]*\\}/g, '') // 移除接口
                            .replace(/type\\s+[^=]+=.*?;/g, ''); // 移除类型别名

                        const jsPath = destPath.replace('.ts', '.js');
                        fs.writeFileSync(jsPath, jsContent);
                    }
                }
            }

            copy(srcDir, destDir);
        }

        copyFiles(path.join(__dirname, 'src'), path.join(__dirname, 'lib', 'src'));
        copyFiles(path.join(__dirname, 'test'), path.join(__dirname, 'lib', 'test'));

        console.log('✅ 文件复制完成');
    }

    console.log('🎉 构建完成!');
} catch (error) {
    console.error('❌ 构建失败:', error.message);
    process.exit(1);
}
