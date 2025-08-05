# contracts-asset-proxy 错误统计报告

## 📊 总体统计
- **总测试数**: 197
- **通过测试**: 127 (64.5%)
- **失败测试**: 47 (23.9%)  
- **跳过测试**: 23 (11.7%)

## 🔍 按测试套件分析失败数量
1. **DydxBridge unit tests**: 16 个失败
2. **UniswapBridge unit tests**: 11 个失败
3. **ERC20BridgeProxy unit tests**: 9 个失败
4. **UniswapV2 unit tests**: 6 个失败
5. **Eth2DaiBridge unit tests**: 5 个失败
6. **Bancor unit tests**: 4 个失败
7. **KyberBridge unit tests**: 2 个失败
8. **ChaiBridge unit tests**: 1 个失败

## 🚨 按错误类型分析
1. **TypeError**: 17 个
   - 主要是 `expected array value (argument="", value=null)`
   - ethers.js v6 ABI 编码问题，传入了 null 值

2. **AssertionError**: 16 个
   - `expected +0 to equal 1`: 事件计数错误 (主要问题)
   - `Expected transaction to be reverted`: 预期回滚但实际成功

3. **Error**: 14 个
   - 主要是 `Transaction reverted` 错误
   - 合约调用失败

## 🎯 主要问题分析
1. **事件验证失败** (最多): 测试期望找到事件但实际没有找到
2. **ABI 编码问题**: 传递了 null 值导致编码失败  
3. **合约调用失败**: 交易回滚，可能是合约部署或配置问题
4. **断言错误**: 预期的合约行为与实际不符

## ✅ 已修复内容
- BigNumber → bigint 类型转换 ✅
- 基础编码器兼容性 ✅
- BlockchainLifecycle 替换 ✅
- 127 个测试通过 ✅

## 🔧 待修复重点
1. **DydxBridge**: 修复 null 值传递问题
2. **事件验证**: 检查事件触发逻辑
3. **合约部署**: 确保测试合约正确部署
4. **断言逻辑**: 更新预期行为
