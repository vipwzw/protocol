# Git 历史清理指南：移除大文件

## ⚠️ 重要警告

**这个操作会重写 Git 历史！请确保：**

1. 通知所有协作者
2. 备份重要数据
3. 选择合适的时机执行

## 🔍 问题分析

当前仓库中存在的大文件：

-   `contracts/zero-ex/artifacts/build-info/68f133729da008c783c12f9ea6aab8b6.json` (51MB)
-   `contracts/zero-ex/artifacts/build-info/ccb1d7a3408f48b0d3a789f14d152e5d.json` (37MB)
-   `contracts/zero-ex/artifacts/build-info/642f7b799d34d939eeca74e52ef4fbfd.json` (37MB)
-   其他多个 build-info JSON 文件（7-29MB）

## ✅ 已完成的步骤

1. **添加到 .gitignore** ✅

    ```
    **/artifacts/build-info/
    ```

2. **删除当前文件** ✅

    - 已从工作目录删除所有 build-info 文件

3. **提交更改** ✅
    - 提交了 .gitignore 更新
    - 提交了文件删除

## 🧹 清理 Git 历史的方法

### 方法 1：使用 BFG Repo-Cleaner（推荐）

1. **安装 BFG**

    ```bash
    brew install bfg
    ```

2. **克隆镜像仓库**

    ```bash
    git clone --mirror https://github.com/vipwzw/protocol.git protocol-mirror
    cd protocol-mirror
    ```

3. **删除大文件**

    ```bash
    # 删除所有 build-info 目录
    bfg --delete-folders 'build-info'

    # 或者删除所有大于 10MB 的文件
    bfg --strip-blobs-bigger-than 10M
    ```

4. **清理和优化**

    ```bash
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
    ```

5. **推送更改**
    ```bash
    git push --force
    ```

### 方法 2：使用 git filter-repo

1. **安装工具**

    ```bash
    pip install git-filter-repo
    ```

2. **执行清理**

    ```bash
    # 删除所有 build-info 文件
    git filter-repo --path-glob '*/artifacts/build-info/*' --invert-paths
    ```

3. **强制推送**
    ```bash
    git push origin --force --all
    git push origin --force --tags
    ```

## 📋 后续步骤

1. **通知团队成员**

    - 发送通知，要求所有人重新克隆仓库
    - 或者使用以下命令更新本地仓库：

    ```bash
    git fetch origin
    git reset --hard origin/main
    ```

2. **验证结果**

    ```bash
    # 检查仓库大小
    du -sh .git

    # 查看大文件
    git rev-list --objects --all | \
      git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
      sed -n 's/^blob //p' | \
      sort --numeric-sort --key=2 | \
      tail -10
    ```

3. **GitHub 端清理**
    - 联系 GitHub 支持运行垃圾回收
    - 或等待自动垃圾回收（通常在 30 天内）

## 🚨 注意事项

1. **分支保护**：临时禁用分支保护规则
2. **CI/CD**：更新所有 CI/CD 配置
3. **子模块**：如果有子模块，需要单独处理
4. **备份**：在执行前备份重要分支

## 💡 预防措施

1. **使用 Git LFS**

    ```bash
    git lfs track "*.json"
    git lfs track "**/build-info/*"
    ```

2. **Pre-commit Hook**

    - 添加文件大小检查
    - 阻止提交大文件

3. **定期审查**
    - 监控仓库大小
    - 及时清理不必要的文件
