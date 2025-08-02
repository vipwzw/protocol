// 调试 assertRoughlyEquals 函数
const { assertRoughlyEquals } = require('../../packages/test-utils/src/number_utils');

console.log("测试 assertRoughlyEquals");

try {
    console.log("测试相同的负数...");
    assertRoughlyEquals(-62, -62, 12); // 1200%
    console.log("✅ 通过");
} catch (error) {
    console.log("❌ 失败:", error.message);
}

try {
    console.log("测试相同的正数...");
    assertRoughlyEquals(62, 62, 12);
    console.log("✅ 通过");
} catch (error) {
    console.log("❌ 失败:", error.message);
}

try {
    console.log("测试接近的负数...");
    assertRoughlyEquals(-62, -63, 0.1); // 10%
    console.log("✅ 通过");
} catch (error) {
    console.log("❌ 失败:", error.message);
}

// 手动计算容差
console.log("\n手动验证计算：");
const expectedBig = BigInt(-62);
const actualBig = BigInt(-62);
const tolerancePercentage = 12;

const diff = actualBig > expectedBig ? actualBig - expectedBig : expectedBig - actualBig;
const toleranceAmount = (expectedBig < 0n ? -expectedBig : expectedBig) * BigInt(Math.floor(tolerancePercentage * 10000)) / 10000n;

console.log("expectedBig:", expectedBig);
console.log("actualBig:", actualBig);
console.log("diff:", diff);
console.log("toleranceAmount:", toleranceAmount);
console.log("diff > toleranceAmount:", diff > toleranceAmount);