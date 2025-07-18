# Foundry 在 GitHub Actions 中的设置

## 问题描述

在 GitHub Actions 中使用 Foundry 时，经常会遇到 PATH 配置问题，导致 `forge`、`cast`、`anvil` 等工具无法正常工作。

## 解决方案

### 1. 在 package.json 中添加 Foundry 脚本

我们在 `package.json` 中添加了以下脚本：

```json
{
  "scripts": {
    "foundry:install": "curl -L https://foundry.paradigm.xyz | bash && ~/.foundry/bin/foundryup",
    "foundry:check": "forge --version && cast --version && anvil --version"
  }
}
```

### 2. GitHub Actions 工作流配置

在所有使用 Foundry 的 GitHub Actions 工作流中，我们采用以下标准化配置：

```yaml
- name: Install Foundry
  uses: foundry-rs/foundry-toolchain@v1
  with:
    version: nightly

- name: Add Foundry to PATH
  run: echo "$HOME/.foundry/bin" >> $GITHUB_PATH

- name: Verify Foundry installation
  run: |
    which forge || echo "forge not in PATH"
    which cast || echo "cast not in PATH" 
    which anvil || echo "anvil not in PATH"
    forge --version
    cast --version
    anvil --version
```

### 3. 关键修复点

#### PATH 设置
使用 `$GITHUB_PATH` 环境变量是 GitHub Actions 推荐的方式：
```bash
echo "$HOME/.foundry/bin" >> $GITHUB_PATH
```

这比在每个步骤中手动导出 PATH 更可靠：
```bash
# 不推荐：需要在每个步骤重复
export PATH="$HOME/.foundry/bin:$PATH"
```

#### 验证安装
在运行任何 Foundry 命令之前，先验证所有工具都正确安装：
```yaml
- name: Verify Foundry installation
  run: |
    forge --version
    cast --version
    anvil --version
```

### 4. 影响的工作流文件

以下工作流文件已更新以正确处理 Foundry PATH：

1. `.github/workflows/improved-ci.yml` - 主要 CI 流水线
2. `.github/workflows/code-quality.yml` - 代码质量检查 
3. `.github/workflows/deploy.yml` - 部署工作流

### 5. 本地测试

为了在本地验证 GitHub Actions 配置，我们提供了以下脚本：

#### 快速验证
```bash
bash scripts/quick-test.sh
```

#### 完整验证
```bash
bash scripts/test-github-actions-local.sh
```

#### Foundry 设置验证
```bash
bash scripts/verify-foundry-setup.sh
```

### 6. 故障排除

#### 常见问题

1. **forge: command not found**
   - 确保 `foundry-rs/foundry-toolchain@v1` action 成功运行
   - 验证 PATH 设置步骤正确执行

2. **权限问题**
   - 确保安装脚本有执行权限
   - 在本地测试时确保脚本是可执行的：`chmod +x scripts/*.sh`

3. **版本兼容性**
   - 我们使用 `nightly` 版本以获得最新功能
   - 如果遇到兼容性问题，可以固定特定版本

#### 调试步骤

1. 检查 Foundry 是否正确安装：
```bash
yarn foundry:check
```

2. 验证 PATH 配置：
```bash
echo $PATH | tr ':' '\n' | grep foundry
```

3. 手动测试合约编译：
```bash
cd contracts/erc20
forge build --sizes
```

### 7. 最佳实践

1. **始终验证安装**：在运行 Foundry 命令之前先验证工具可用
2. **使用 $GITHUB_PATH**：而不是临时的 PATH 导出
3. **错误处理**：为 Foundry 命令添加适当的错误处理
4. **版本固定**：考虑固定 Foundry 版本以确保可重现的构建

### 8. 相关资源

- [Foundry 官方文档](https://book.getfoundry.sh/)
- [foundry-rs/foundry-toolchain Action](https://github.com/foundry-rs/foundry-toolchain)
- [GitHub Actions PATH 管理](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#adding-a-system-path) 
