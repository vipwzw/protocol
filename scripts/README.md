# Scripts Directory

这个目录包含了 0x Protocol 项目的辅助脚本。

## 脚本说明

### GitHub Actions 相关
- `test-github-actions-local.sh` - 本地测试 GitHub Actions 工作流
- `quick-test.sh` - 快速验证测试
- `verify-foundry-setup.sh` - 验证 Foundry 设置

## Foundry 依赖管理

### 策略说明

项目采用以下 Foundry 管理策略：

1. **CI/CD 环境**: 使用 GitHub Actions 的 `foundry-rs/foundry-toolchain@v1` action
   - 自动安装最新稳定版本的 Foundry
   - 所有工作流 (CI, 部署, 代码质量检查) 都已配置
   - 确保 CI 环境的一致性和可靠性

2. **本地开发**: 开发者可以手动或通过 npm script 安装 Foundry
   - 使用 npm script: `yarn foundry:install` (推荐)
   - 或手动安装: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
   - 使用 `yarn foundry:check` 验证本地安装
   - 确保与 CI 使用相同版本 (当前: v1.2.3-stable)

### 使用建议

1. **新开发者设置**:
   ```bash
   # 克隆项目
   git clone <repo-url>
   cd protocol
   
   # 安装 Node.js 依赖
   yarn install
   
   # 安装 Foundry (如果还没有)
   yarn foundry:install
   
   # 验证安装
   yarn foundry:check
   ```

2. **可用命令**:
   - `yarn foundry:install` - 安装最新版本的 Foundry
   - `yarn foundry:check` - 验证 Foundry 工具是否可用并显示版本信息

3. **构建和测试**:
   - 构建合约: `yarn build:contracts` 或直接 `forge build`
   - 运行测试: `yarn test:contracts` 或直接 `forge test`

**注意**: `foundry:install` 会下载并安装最新的稳定版本，可能需要重启终端或重新加载 shell 配置以更新 PATH。 
