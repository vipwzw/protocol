// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@0x/contracts-utils/contracts/src/errors/LibRichErrors.sol";
import "@0x/contracts-erc20/contracts/src/interfaces/IERC20Token.sol";
import "@0x/contracts-erc20/contracts/src/LibERC20Token.sol";
import "@0x/contracts-utils/contracts/src/LibMath.sol";
import "../src/errors/LibTransformERC20RichErrors.sol";
import "../src/features/interfaces/INativeOrdersFeature.sol";
import "../src/features/libs/LibNativeOrder.sol";
import "../src/transformers/bridges/IBridgeAdapter.sol";
import "../src/transformers/Transformer.sol";
import "../src/transformers/LibERC20Transformer.sol";
import "../src/IZeroEx.sol";
import "../src/features/libs/LibSignature.sol";
import "../src/features/interfaces/INativeOrdersFeature.sol";

/// @dev Debug FillQuoteTransformer V2 - Detailed console.log debugging
contract DebugFillQuoteTransformerV2 is Transformer {
    using LibERC20Token for IERC20Token;
    using LibERC20Transformer for IERC20Token;
    using LibRichErrors for bytes;

    enum Side { Sell, Buy }
    enum OrderType { Bridge, Limit, Rfq, Otc }

    struct LimitOrderInfo {
        LibNativeOrder.LimitOrder order;
        LibSignature.Signature signature;
        uint256 maxTakerTokenFillAmount;
    }

    struct RfqOrderInfo {
        LibNativeOrder.RfqOrder order;
        LibSignature.Signature signature;
        uint256 maxTakerTokenFillAmount;
    }

    struct OtcOrderInfo {
        LibNativeOrder.OtcOrder order;
        LibSignature.Signature signature;
        uint256 maxTakerTokenFillAmount;
    }

    struct BridgeOrder {
        bytes32 source;
        uint256 takerTokenAmount;
        uint256 makerTokenAmount;
        bytes bridgeData;
    }

    struct TransformData {
        Side side;
        IERC20Token sellToken;
        IERC20Token buyToken;
        // External liquidity bridge orders. Sorted by fill sequence.
        BridgeOrder[] bridgeOrders;
        // Native limit orders. Sorted by fill sequence.
        LimitOrderInfo[] limitOrders;
        // Native RFQ orders. Sorted by fill sequence.
        RfqOrderInfo[] rfqOrders;
        // The sequence to fill the orders in.
        OrderType[] fillSequence;
        // Amount of `sellToken` to sell or `buyToken` to buy.
        uint256 fillAmount;
        // Who to transfer unused protocol fees to.
        address payable refundReceiver;
        // Otc orders. Sorted by fill sequence.
        OtcOrderInfo[] otcOrders;
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

    IBridgeAdapter public immutable bridgeAdapter;
    IZeroEx public immutable zeroEx;

    constructor(IBridgeAdapter bridgeAdapter_, IZeroEx zeroEx_) public Transformer() {
        bridgeAdapter = bridgeAdapter_;
        zeroEx = zeroEx_;
        console.log("DebugFillQuoteTransformerV2 constructor completed");
        console.log("  bridgeAdapter:", address(bridgeAdapter_));
        console.log("  zeroEx:", address(zeroEx_));
    }

    function transform(TransformContext calldata context) external override returns (bytes4 magicBytes) {
        console.log("===== DebugFillQuoteTransformerV2.transform START =====");
        console.log("Caller (msg.sender):", msg.sender);
        console.log("Contract address (this):", address(this));
        console.log("tx.origin:", tx.origin);
        console.log("context.data length:", context.data.length);

        console.log("ATTEMPTING DATA DECODE...");
        TransformData memory data;
        // Direct decode without try-catch to get exact error
        data = abi.decode(context.data, (TransformData));
        console.log("STEP 1: Data decoding completed successfully");
        
        FillState memory state;
        console.log("STEP 2: State initialization completed");

        // Basic validation
        console.log("STEP 3: Starting validation...");
        if (data.sellToken.isTokenETH() || data.buyToken.isTokenETH()) {
            console.log("ERROR: ETH token validation failed");
            LibTransformERC20RichErrors
                .InvalidTransformDataError(
                    LibTransformERC20RichErrors.InvalidTransformDataErrorCode.INVALID_TOKENS,
                    context.data
                )
                .rrevert();
        }
        console.log("STEP 3: ETH token validation passed");

        console.log("STEP 4: Array length validation...");
        console.log("  bridgeOrders.length:", data.bridgeOrders.length);
        console.log("  limitOrders.length:", data.limitOrders.length);
        console.log("  rfqOrders.length:", data.rfqOrders.length);
        console.log("  otcOrders.length:", data.otcOrders.length);
        console.log("  fillSequence.length:", data.fillSequence.length);
        
        uint256 totalOrders = data.bridgeOrders.length + data.limitOrders.length + data.rfqOrders.length + data.otcOrders.length;
        if (totalOrders != data.fillSequence.length) {
            console.log("ERROR: Array length mismatch");
            LibTransformERC20RichErrors
                .InvalidTransformDataError(
                    LibTransformERC20RichErrors.InvalidTransformDataErrorCode.INVALID_ARRAY_LENGTH,
                    context.data
                )
                .rrevert();
        }
        console.log("STEP 4: Array length validation passed");

        // Balance and allowance checks
        console.log("STEP 5: Balance and allowance checks...");
        state.takerTokenBalanceRemaining = data.sellToken.getTokenBalanceOf(address(this));
        console.log("  sellToken balance:", state.takerTokenBalanceRemaining);
        console.log("  fillAmount:", data.fillAmount);
        console.log("  zeroEx address:", address(zeroEx));

        // CRITICAL STEP: Authorization (only for native orders)
        console.log("STEP 6: CRITICAL - Authorization step...");
        if (data.limitOrders.length + data.rfqOrders.length + data.otcOrders.length != 0) {
            data.sellToken.approve(address(zeroEx), data.fillAmount);
            console.log("SUCCESS: sellToken -> zeroEx approved for native orders");
        } else {
            console.log("INFO: No native orders, skipping authorization");
        }

        // CRITICAL STEP: Protocol fee calculation - Skip for RFQ (no protocol fees)
        console.log("STEP 7: CRITICAL - Protocol fee calculation...");
        console.log("INFO: Skipping protocol fee for RFQ orders (no fees required)");

        state.ethRemaining = address(this).balance;
        console.log("ETH balance:", state.ethRemaining);

        // RFQ order filling
        console.log("STEP 8: RFQ order filling...");
        if (data.rfqOrders.length > 0) {
            RfqOrderInfo memory orderInfo = data.rfqOrders[0];
            
            console.log("RFQ Order Info:");
            console.log("  maker:", orderInfo.order.maker);
            console.log("  taker:", orderInfo.order.taker);
            console.log("  txOrigin:", orderInfo.order.txOrigin);
            console.log("  makerToken:", address(orderInfo.order.makerToken));
            console.log("  takerToken:", address(orderInfo.order.takerToken));
            console.log("  makerAmount:", orderInfo.order.makerAmount);
            console.log("  takerAmount:", orderInfo.order.takerAmount);

            uint256 takerTokenFillAmount = LibMath.min256(data.fillAmount, orderInfo.maxTakerTokenFillAmount);
            console.log("  calculated fill amount:", takerTokenFillAmount);

            // MOST CRITICAL STEP: zeroEx.fillRfqOrder
            console.log("STEP 9: MOST CRITICAL - zeroEx.fillRfqOrder...");
            console.log("  Call parameters:");
            console.log("    order.taker:", orderInfo.order.taker);
            console.log("    msg.sender:", msg.sender);
            console.log("    tx.origin:", tx.origin);
            console.log("    expected tx.origin:", orderInfo.order.txOrigin);
            
            // Direct call without try-catch to expose real error
            (uint128 takerTokenFilledAmount, uint128 makerTokenFilledAmount) = zeroEx.fillRfqOrder(
                orderInfo.order,
                orderInfo.signature,
                LibMath.safeDowncastToUint128(takerTokenFillAmount)
            );
            console.log("SUCCESS: fillRfqOrder succeeded!");
            console.log("  takerTokenFilledAmount:", takerTokenFilledAmount);
            console.log("  makerTokenFilledAmount:", makerTokenFilledAmount);
            
            state.soldAmount = takerTokenFilledAmount;
            state.boughtAmount = makerTokenFilledAmount;
        }

        console.log("transform completed, returning success");
        return LibERC20Transformer.TRANSFORMER_SUCCESS;
    }
}
