console.log("调试 ln 函数的问题");

// 模拟问题
const Decimal = require('decimal.js');

// 测试值
const x = 1e-27;
console.log("原始值 x:", x);

// 模拟 toFixedFromFloat
function toFixedFromFloat(value) {
    const decimal = new Decimal(value.toString());
    const fixedPointBase = new Decimal('170141183460469231731687303715884105728'); // 2^127
    const scaled = decimal.mul(fixedPointBase);
    
    // 检查结果是否太小，如果太小就返回 0
    if (scaled.abs().lt(1)) {
        console.log("结果太小，返回 0");
        return 0n;
    }
    
    const scaledStr = scaled.toFixed(0);
    console.log("Scaled string:", scaledStr);
    return BigInt(scaledStr);
}

// 模拟 fromFixed
function fromFixed(value) {
    const FIXED_POINT_BASE = BigInt('0x80000000000000000000000000000000'); // 2^127
    return value / FIXED_POINT_BASE;
}

// 测试 toFixedFromFloat
const fixedX = toFixedFromFloat(x);
console.log("toFixedFromFloat(x):", fixedX);

// 如果合约接收到 0，那么 ln(0) 是未定义的
// 但测试期望的值是什么？

// 计算期望值
function ln(x) {
    const decimal = new Decimal(x.toString());
    const lnResult = decimal.ln();
    const fixedPointBase = new Decimal('170141183460469231731687303715884105728'); // 2^127
    const scaled = lnResult.mul(fixedPointBase);
    return BigInt(scaled.toFixed(0));
}

const expectedFixed = ln(x);
console.log("ln(x) 期望的固定点值:", expectedFixed);

// 转换为浮点数进行比较
const expectedFloat = Number(expectedFixed) / Number(BigInt('0x80000000000000000000000000000000'));
console.log("期望的浮点数值:", expectedFloat);

// 合约返回 -62，转换为浮点数
const contractResult = -62n;
const contractFloat = Number(contractResult) / Number(BigInt('0x80000000000000000000000000000000'));
console.log("合约返回的浮点数值:", contractFloat);

console.log("ln(1e-27) 的理论值:", Math.log(1e-27));