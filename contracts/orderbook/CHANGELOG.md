# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-31

### Added

- 初始版本发布
- OrderBook 核心合约
- 创建买单/卖单功能
- 撮合交易功能（支持部分成交）
- 取消订单功能
- 完整的事件系统
- 查询接口（支持分页）
- TypeScript 客户端（OrderBookClient）
- 本地订单簿管理器（LocalOrderBook）
- 完整的测试套件（Hardhat + Foundry）
- 部署脚本
- 使用示例
- 详细的文档

### Security

- 重入攻击防护（ReentrancyGuard）
- 整数溢出保护（Solidity 0.8.28）
- 安全的 ERC20 转账（SafeERC20）
- 严格的权限检查
- 完整的参数验证

