// 测试精确的参数
console.log("测试精确的参数");

function assertRoughlyEquals(actual, expected, tolerancePercentage) {
    const actualBig = BigInt(actual);
    const expectedBig = BigInt(expected);
    
    console.log(`\n测试: actual=${actual}, expected=${expected}, tolerance=${tolerancePercentage}%`);
    
    if (expectedBig === 0n) {
        console.log("期望值为 0，特殊处理");
        if (actualBig === 0n) {
            console.log("✅ 通过（都为 0）");
            return;
        }
        console.log(`❌ 失败：Expected ${actualBig} to equal ${expectedBig}`);
        return;
    }
    
    const diff = actualBig > expectedBig ? actualBig - expectedBig : expectedBig - actualBig;
    const toleranceAmount = (expectedBig < 0n ? -expectedBig : expectedBig) * BigInt(Math.floor(tolerancePercentage * 10000)) / 10000n;
    
    console.log("actualBig:", actualBig);
    console.log("expectedBig:", expectedBig);
    console.log("diff:", diff);
    console.log("toleranceAmount:", toleranceAmount);
    console.log("Math.floor(tolerancePercentage * 10000):", Math.floor(tolerancePercentage * 10000));
    console.log("diff > toleranceAmount:", diff > toleranceAmount);
    
    if (diff > toleranceAmount) {
        console.log(`❌ 失败：Expected ${actualBig} to be roughly equal to ${expectedBig} (tolerance: ${tolerancePercentage * 100}%), but difference was ${diff}`);
    } else {
        console.log("✅ 通过");
    }
}

// 测试精确的参数：来自测试中的实际值
assertRoughlyEquals(-62, -62, 12); // LN_PRECISION 是 16，但这里显示 1200%，所以是 12