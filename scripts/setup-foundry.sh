#!/bin/bash

# Foundry 设置脚本
# 自动安装和验证 Foundry 工具链

set -e

echo "🔧 Setting up Foundry toolchain..."

# 检查 Foundry 是否已安装
check_foundry() {
    if command -v forge >/dev/null 2>&1 && command -v cast >/dev/null 2>&1 && command -v anvil >/dev/null 2>&1; then
        echo "✅ Foundry tools found:"
        echo "   forge: $(which forge)"
        echo "   cast: $(which cast)" 
        echo "   anvil: $(which anvil)"
        echo "   Versions:"
        forge --version
        cast --version
        anvil --version
        return 0
    else
        return 1
    fi
}

# 安装 Foundry
install_foundry() {
    echo "📦 Installing Foundry..."
    
    # 下载并安装 foundryup
    curl -L https://foundry.paradigm.xyz | bash
    
    # 添加到 PATH (如果需要)
    if [[ -f "$HOME/.foundry/bin/foundryup" ]]; then
        export PATH="$HOME/.foundry/bin:$PATH"
        
        # 运行 foundryup 安装最新版本
        echo "🚀 Installing latest Foundry version..."
        "$HOME/.foundry/bin/foundryup"
    else
        echo "❌ foundryup installation failed"
        exit 1
    fi
}

# 主逻辑
if check_foundry; then
    echo "🎉 Foundry is already installed and working!"
else
    echo "⚠️  Foundry not found or incomplete installation"
    
    # 尝试使用已有的 foundryup 更新
    if [[ -f "$HOME/.foundry/bin/foundryup" ]]; then
        echo "🔄 Updating Foundry using existing foundryup..."
        "$HOME/.foundry/bin/foundryup"
    else
        # 全新安装
        install_foundry
    fi
    
    # 重新检查
    echo ""
    echo "🔍 Verifying installation..."
    if check_foundry; then
        echo "✅ Foundry setup completed successfully!"
    else
        echo "❌ Foundry setup failed. Please install manually:"
        echo "   curl -L https://foundry.paradigm.xyz | bash"
        echo "   foundryup"
        exit 1
    fi
fi

# 添加到 shell 配置 (如果需要)
SHELL_RC=""
if [[ "$SHELL" == *"zsh"* ]]; then
    SHELL_RC="$HOME/.zshrc"
elif [[ "$SHELL" == *"bash"* ]]; then
    SHELL_RC="$HOME/.bashrc"
fi

if [[ -n "$SHELL_RC" && -f "$SHELL_RC" ]]; then
    if ! grep -q "/.foundry/bin" "$SHELL_RC"; then
        echo "📝 Adding Foundry to PATH in $SHELL_RC"
        echo 'export PATH="$HOME/.foundry/bin:$PATH"' >> "$SHELL_RC"
        echo "   Please restart your terminal or run: source $SHELL_RC"
    fi
fi

echo ""
echo "🎯 Foundry is ready for 0x Protocol development!"
echo "   You can now run:"
echo "   - yarn build:contracts"
echo "   - yarn test:contracts" 
echo "   - forge build"
echo "   - forge test" 
