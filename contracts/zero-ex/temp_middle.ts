it('✅ RFQ Delegatecall 修复验证', async () => {
    await setupGlobalMakerState();

    // 🔧 应用 RFQ 专项修复
    const rfqOrder = await createRfqOrder({
        maker: makerAddress,
        taker: hostAddress, // ✅ 关键修复：taker = Host
        txOrigin: signer.address, // ✅ 关键修复：txOrigin = 实际发送者
    });

    console.log('🔧 应用 RFQ 专项修复...');
    console.log(`  ✅ txOrigin 已设置为 deployer: ${signer.address}`);
    console.log(`  ✅ taker 已设置为 Host: ${hostAddress}`);
    console.log(`  ✅ takerAmount: ${rfqOrder.takerAmount}`);

    const transformData = createTransformData({
        rfqOrders: [
            {
                order: rfqOrder,
                maxTakerTokenFillAmount: MAX_UINT256,
                signature: createOrderSignature(0),
            },
        ],
        fillAmount: rfqOrder.takerAmount,
        fillSequence: [OrderType.Rfq],
    });

    const result = await host
        .connect(signer)
        .executeTransform(
            await transformer.getAddress(),
            takerTokenAddress,
            rfqOrder.takerAmount,
            encodeFillQuoteTransformerData(convertBigIntToString(transformData)),
            signer.address,
            signer.address,
        );
    await result.wait();

    const finalMakerBalance = await makerToken.balanceOf(hostAddress);
    expect(finalMakerBalance).to.equal(rfqOrder.makerAmount);
    console.log('🎉 RFQ 订单部分卖出验证完成！');
});
