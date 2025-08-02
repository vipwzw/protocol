console.log("调试合约调用的问题");

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
    return BigInt(scaledStr);
}

// 实际传给合约的值
const contractInput = toFixedFromFloat(x);
console.log("传给合约的固定点值:", contractInput);

// 将固定点值转换回浮点数，看看合约实际接收到什么
const FIXED_POINT_BASE = BigInt('0x80000000000000000000000000000000'); // 2^127 = 170141183460469231731687303715884105728
const contractInputFloat = Number(contractInput) / Number(FIXED_POINT_BASE);
console.log("合约接收到的浮点数值:", contractInputFloat);

// 计算这个值的对数
console.log("ln(contractInputFloat):", Math.log(contractInputFloat));

// 如果合约计算 ln(contractInputFloat) 并返回固定点格式
const lnResult = Math.log(contractInputFloat);
const lnResultFixed = BigInt(Math.floor(lnResult * Number(FIXED_POINT_BASE)));
console.log("ln 结果的固定点格式应该是:", lnResultFixed);

// 但是合约返回了 -62，这意味着什么？
console.log("如果合约返回 -62，作为固定点值，它代表:", -62 / Number(FIXED_POINT_BASE));

// 可能的解释：合约返回的不是固定点格式，而是某种其他格式
// 或者合约内部有精度问题