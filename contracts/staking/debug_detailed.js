const { Decimal } = require('decimal.js');

// 模拟测试中的逻辑
const MIN_EXP_NUMBER = -63.875;
const MIN_LN_NUMBER = Number(new Decimal(MIN_EXP_NUMBER.toString()).exp().toFixed(128));

console.log("=== 第一步：toFixed(MIN_LN_NUMBER) ===");
console.log("MIN_LN_NUMBER:", MIN_LN_NUMBER);

// 模拟 toFixed 函数
function toFixed(value) {
    const FIXED_POINT_BASE = BigInt('0x80000000000000000000000000000000'); // 2^127 = 170141183460469231731687303715884105728
    const decimal = new Decimal(value.toString());
    const scaled = decimal.mul(new Decimal('170141183460469231731687303715884105728'));
    
    if (scaled.abs().lt(1)) {
        console.log("toFixed 结果太小，返回 0");
        return 0n;
    }
    
    const scaledStr = scaled.toFixed(0);
    console.log("toFixed 缩放字符串:", scaledStr);
    return BigInt(scaledStr);
}

const fixedValue = toFixed(MIN_LN_NUMBER);
console.log("toFixed 结果:", fixedValue);

console.log("\n=== 第二步：toBigInt(toFixed(MIN_LN_NUMBER)) ===");
// 模拟 toBigInt 函数
function toBigInt(value) {
    if (typeof value === 'bigint') {
        return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const str = value.toString();
        if (str.includes('.')) {
            const floatValue = parseFloat(str);
            if (isNaN(floatValue)) {
                throw new Error(`Cannot convert invalid number string to BigInt: ${value}`);
            }
            return BigInt(Math.floor(floatValue));
        }
        return BigInt(value);
    }
    throw new Error(`Cannot convert ${typeof value} to BigInt: ${value}`);
}

const bigintValue = toBigInt(fixedValue);
console.log("toBigInt 结果:", bigintValue);

console.log("\n=== 第三步：减去 1n ===");
const testValue = bigintValue - 1n;
console.log("最终测试值:", testValue);

console.log("\n=== 检查边界条件 ===");
console.log("测试值 <= 0:", testValue <= 0n);
console.log("测试值是负数:", testValue < 0n);

// 如果是负数，会触发合约的哪个检查？
if (testValue <= 0n) {
    console.log("⚠️ 测试值 <= 0，会触发合约 ln 函数的 TOO_SMALL 错误！");
}