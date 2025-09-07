module.exports = {
    root: true,
    env: {
        node: true,
        es2021: true,
    },
    extends: ['eslint:recommended', '@typescript-eslint/recommended', 'prettier'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        project: './tsconfig.json',
    },
    plugins: ['@typescript-eslint', 'prettier'],
    rules: {
        // 禁用一些过于严格的规则
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        'no-console': 'off',
        'prettier/prettier': 'error',
        // 允许使用 require
        '@typescript-eslint/no-var-requires': 'off',
    },
    ignorePatterns: [
        'node_modules/',
        'lib/',
        'build/',
        'dist/',
        'out/',
        'artifacts/',
        'cache/',
        'typechain-types/',
        'generated-*/',
        '*.d.ts',
    ],
    overrides: [
        {
            files: ['*.ts', '*.tsx'],
            rules: {
                // TypeScript 特定规则
            },
        },
        {
            files: ['*.js', '*.jsx'],
            rules: {
                '@typescript-eslint/no-var-requires': 'off',
            },
        },
    ],
};
