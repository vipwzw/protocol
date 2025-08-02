const { Decimal } = require('decimal.js');

// 计算 MIN_LN_NUMBER 的值
const MIN_EXP_NUMBER = -63.875;
const MIN_LN_NUMBER = Number(new Decimal(MIN_EXP_NUMBER.toString()).exp().toFixed(128));

console.log("MIN_EXP_NUMBER:", MIN_EXP_NUMBER);
console.log("MIN_LN_NUMBER:", MIN_LN_NUMBER);
console.log("MIN_LN_NUMBER - 1:", MIN_LN_NUMBER - 1);
console.log("MIN_LN_NUMBER - 1 是否为负数:", MIN_LN_NUMBER - 1 < 0);

// 模拟 toFixed 转换
const FIXED_POINT_BASE = BigInt('0x80000000000000000000000000000000'); // 2^127
console.log("toFixed(MIN_LN_NUMBER):", BigInt(Math.floor(MIN_LN_NUMBER * Number(FIXED_POINT_BASE))));
console.log("toFixed(MIN_LN_NUMBER) - 1n:", BigInt(Math.floor(MIN_LN_NUMBER * Number(FIXED_POINT_BASE))) - 1n);

// 合约中的 LN_MIN_VAL
const LN_MIN_VAL = BigInt('0x0000000000000000000000000000000000000000000000000000000733048c5a');
console.log("合约中的 LN_MIN_VAL:", LN_MIN_VAL);

const testValue = BigInt(Math.floor(MIN_LN_NUMBER * Number(FIXED_POINT_BASE))) - 1n;
console.log("测试值:", testValue);
console.log("测试值 <= 0:", testValue <= 0n);
console.log("测试值 <= LN_MIN_VAL:", testValue <= LN_MIN_VAL);