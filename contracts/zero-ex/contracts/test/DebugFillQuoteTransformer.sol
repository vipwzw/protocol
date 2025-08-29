// SPDX-License-Identifier: Apache-2.0
/*
  Copyright 2023 ZeroEx Intl.
  Licensed under the Apache License, Version 2.0 (the "License");
*/

pragma solidity ^0.8.0;

import "@0x/contracts-utils/contracts/src/errors/LibRichErrors.sol";
import "@0x/contracts-erc20/contracts/src/interfaces/IERC20Token.sol";
import "@0x/contracts-erc20/contracts/src/LibERC20Token.sol";
import "@0x/contracts-utils/contracts/src/LibMath.sol";
import "../src/errors/LibTransformERC20RichErrors.sol";
import "../src/features/interfaces/INativeOrdersFeature.sol";
import "../src/features/libs/LibNativeOrder.sol";
import "../src/features/libs/LibSignature.sol";
import "../src/transformers/bridges/IBridgeAdapter.sol";
import "../src/transformers/Transformer.sol";
import "../src/transformers/LibERC20Transformer.sol";
import "../src/IZeroEx.sol";

/// @dev 🔬 调试版 FillQuoteTransformer - 移除 try-catch 来暴露真实错误
contract DebugFillQuoteTransformer is Transformer {
    using LibERC20Token for IERC20Token;
    using LibERC20Transformer for IERC20Token;
    using LibRichErrors for bytes;

    /// @dev Whether we are performing a market sell or buy.
    enum Side {
        Sell,
        Buy
    }

    enum OrderType {
        Bridge,
        Limit,
        Rfq,
        Otc
    }

    struct RfqOrderInfo {
        LibNativeOrder.RfqOrder order;
        LibSignature.Signature signature;
        uint256 maxTakerTokenFillAmount;
    }

    struct TransformData {
        Side side;
        IERC20Token sellToken;
        IERC20Token buyToken;
        RfqOrderInfo[] rfqOrders;
        uint256 fillAmount;
        OrderType[] fillSequence;
    }

    struct FillState {
        uint256 takerTokenBalanceRemaining;
        uint256 makerTokenBalanceTarget;
        uint256 ethRemaining;
        uint256 protocolFee;
        uint256 soldAmount;
        uint256 boughtAmount;
    }

    struct FillOrderResults {
        uint256 takerTokenSoldAmount;
        uint256 makerTokenBoughtAmount;
        uint256 protocolFeePaid;
    }

    /// @dev The exchange proxy contract.
    IZeroEx public immutable zeroEx;

    /// @dev Create this contract.
    constructor(IZeroEx zeroEx_) public Transformer() {
        zeroEx = zeroEx_;
    }

    /// @dev 🎯 简化版 transform - 只处理单个 RFQ 订单，暴露真实错误
    function transform(TransformContext calldata context) external override returns (bytes4 magicBytes) {
        TransformData memory data = abi.decode(context.data, (TransformData));
        
        require(data.rfqOrders.length == 1, "Debug: Only single RFQ order supported");
        require(data.fillSequence.length == 1, "Debug: Only single order in sequence");
        require(data.fillSequence[0] == OrderType.Rfq, "Debug: Must be RFQ order");
        
        // 🔧 设置授权（关键步骤）
        data.sellToken.approve(address(zeroEx), data.fillAmount);
        
        // 🔬 暴露真实错误：移除 try-catch！
        RfqOrderInfo memory orderInfo = data.rfqOrders[0];
        
        uint256 takerTokenFillAmount = orderInfo.maxTakerTokenFillAmount;
        if (takerTokenFillAmount > data.fillAmount) {
            takerTokenFillAmount = data.fillAmount;
        }
        
        // 🚨 关键：直接调用，不使用 try-catch！
        (uint128 takerTokenFilledAmount, uint128 makerTokenFilledAmount) = zeroEx.fillRfqOrder(
            orderInfo.order,
            orderInfo.signature,
            LibMath.safeDowncastToUint128(takerTokenFillAmount)
        );
        
        // 验证结果
        if (takerTokenFilledAmount == 0) {
            revert("Debug: No tokens filled!");
        }
        
        return LibERC20Transformer.TRANSFORMER_SUCCESS;
    }
}
