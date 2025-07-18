# Scripts Directory

这个目录包含了 0x Protocol 项目的辅助脚本。

## Foundry 相关脚本

### setup-foundry.sh

自动安装和验证 Foundry 工具链的脚本。

**功能:**
- 检查 Foundry 工具 (forge, cast, anvil) 是否已安装
- 如果未安装，自动下载并安装最新版本的 Foundry
- 验证安装是否成功
- 自动添加 Foundry 到 shell 配置文件的 PATH

**使用方法:**
```bash
# 直接运行脚本
bash scripts/setup-foundry.sh

# 或使用 npm scripts
yarn foundry:setup
yarn foundry:install  # 别名，指向同一个脚本
```

**集成:**
- 这个脚本会在 `yarn install` 时自动运行 (通过 postinstall hook)
- 确保所有团队成员在安装依赖时自动获得 Foundry 工具

**Foundry 版本:**
- 脚本会安装最新的稳定版本
- 当前支持的版本: v1.2.3-stable
- 包含 forge, cast, anvil, chisel 工具

**troubleshooting:**
如果脚本失败，请手动安装：
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## 其他脚本

### GitHub Actions 相关
- `test-github-actions-local.sh` - 本地测试 GitHub Actions 工作流
- `quick-test.sh` - 快速验证测试
- `verify-foundry-setup.sh` - 验证 Foundry 设置

### 使用建议

1. **开发环境设置**: 新团队成员只需运行 `yarn install` 即可自动设置完整开发环境
2. **CI/CD**: GitHub Actions 会使用 foundry-toolchain action，但本地脚本确保一致性
3. **版本管理**: 通过统一脚本确保所有开发者使用相同版本的工具

### 依赖管理策略

我们采用混合策略来管理 Foundry 依赖：

1. **本地开发**: 使用 setup-foundry.sh 脚本和 postinstall hook
2. **CI/CD**: 使用 GitHub Actions 的 foundry-toolchain action
3. **一致性**: 两种方式都会安装相同的稳定版本

这样确保了：
- 本地开发环境的便利性 (自动安装)
- CI/CD 的可靠性 (官方 action)
- 版本一致性 (统一版本管理) 
