console.log("调试 ln(0.85) 的问题");

const Decimal = require('decimal.js');

// 测试值
const x = 0.85;
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

console.log("是否小于 1e-25?", Math.abs(contractInputFloat) < 1e-25);

// 计算这个值的对数
console.log("ln(contractInputFloat):", Math.log(contractInputFloat));
console.log("理论 ln(0.85):", Math.log(0.85));

// 计算期望的固定点格式
const lnResult = Math.log(contractInputFloat);
const lnResultFixed = new Decimal(lnResult.toString()).mul(new Decimal('170141183460469231731687303715884105728'));
console.log("期望的固定点格式:", lnResultFixed.toFixed(0));