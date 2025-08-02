// 简单测试 assertRoughlyEquals 逻辑
console.log("测试容差计算逻辑");

function testToleranceLogic(actual, expected, tolerancePercentage) {
    const actualBig = BigInt(actual);
    const expectedBig = BigInt(expected);
    
    console.log(`\n测试: actual=${actual}, expected=${expected}, tolerance=${tolerancePercentage}%`);
    
    if (expectedBig === 0n) {
        console.log("期望值为 0，特殊处理");
        return actualBig === 0n;
    }
    
    const diff = actualBig > expectedBig ? actualBig - expectedBig : expectedBig - actualBig;
    const toleranceAmount = (expectedBig < 0n ? -expectedBig : expectedBig) * BigInt(Math.floor(tolerancePercentage * 10000)) / 10000n;
    
    console.log("actualBig:", actualBig);
    console.log("expectedBig:", expectedBig);
    console.log("diff:", diff);
    console.log("toleranceAmount:", toleranceAmount);
    console.log("diff > toleranceAmount:", diff > toleranceAmount);
    
    return diff <= toleranceAmount;
}

// 测试相同的负数
testToleranceLogic(-62, -62, 12); // 1200%

// 测试相同的正数
testToleranceLogic(62, 62, 12);

// 测试接近的负数
testToleranceLogic(-62, -63, 10);