// ESLint 配置 - 使用 CommonJS 格式以便兼容
module.exports = [
    {
        files: ['**/*.{ts,tsx,js,jsx}'],
        languageOptions: {
            parser: require('@typescript-eslint/parser'),
            parserOptions: {
                ecmaVersion: 2021,
                sourceType: 'module',
            },
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                global: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
        },
        rules: {
            // 基础规则
            'no-unused-vars': 'off',
            'no-undef': 'off',
            'no-console': 'off',
            // TypeScript 规则
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-var-requires': 'off',
        },
    },
    {
        ignores: [
            'node_modules/**',
            'lib/**',
            'build/**',
            'dist/**',
            'out/**',
            'artifacts/**',
            'cache/**',
            'typechain-types/**',
            'generated-*/**',
            '**/*.d.ts',
        ],
    },
];
