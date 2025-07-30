# Git Hooks

本目录包含项目的 Git hooks，用于在提交代码前执行自动检查。

## 🚀 快速开始

### 自动安装（推荐）

在项目根目录运行：

```bash
yarn setup-hooks
```

或者在 `yarn install` 时会自动安装。

### 手动安装

```bash
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## 📋 Hook 功能

### pre-commit

在提交前执行以下检查：

1. **文件大小检查** 🗂️
    - 阻止提交大于 10MB 的文件
    - 防止意外提交大型二进制文件

2. **build-info 文件检查** 🚫
    - 阻止提交 `artifacts/build-info/` 目录下的文件
    - 这些文件应该通过 `.gitignore` 忽略

3. **敏感文件检查** ⚠️
    - 警告可能不应该提交的文件：
        - `node_modules/`
        - `.env` 文件
        - `.DS_Store`
        - `*.log` 文件
        - 临时文件和备份文件

4. **敏感信息检查** 🔐
    - 扫描代码中的潜在敏感信息：
        - 密码
        - API 密钥
        - 私钥

## 🛠️ 配置

可以在 `.githooks/pre-commit` 文件中修改以下配置：

```bash
MAX_FILE_SIZE=10485760  # 10MB in bytes
```

## 🚫 跳过检查

如果在特殊情况下需要跳过 pre-commit 检查：

```bash
git commit --no-verify -m "your message"
```

⚠️ **注意**：请谨慎使用此选项，确保不会提交不当文件。

## 🤝 贡献

如果你想添加新的检查规则：

1. 编辑 `.githooks/pre-commit`
2. 测试你的更改
3. 提交 PR

## 📝 最佳实践

1. **定期更新 hooks**：运行 `yarn setup-hooks` 获取最新版本
2. **团队同步**：确保所有团队成员都安装了 hooks
3. **CI/CD 集成**：在 CI 中也运行相同的检查

## 🐛 故障排除

### Hook 没有执行？

- 确保文件有执行权限：`chmod +x .git/hooks/pre-commit`
- 检查 Git 版本：需要 Git 2.9+

### 误报？

- 检查文件是否应该在 `.gitignore` 中
- 考虑使用 Git LFS 管理大文件

### 性能问题？

- 对于大型仓库，可以调整检查范围
- 考虑只检查暂存的文件而不是所有文件
