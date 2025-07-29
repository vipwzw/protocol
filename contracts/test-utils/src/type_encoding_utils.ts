import BN = require('bn.js');
import ethUtil = require('ethereumjs-util');

import { constants } from './constants';

export const typeEncodingUtils = {
    encodeUint256(value: bigint): Buffer {
        const formattedValue = new BN(value.toString(10));
        const encodedValue = ethUtil.toBuffer(formattedValue as any);
        const paddedValue = ethUtil.setLengthLeft(encodedValue, constants.WORD_LENGTH);
        return paddedValue;
    },
    decodeUint256(encodedValue: Buffer): bigint {
        const formattedValue = ethUtil.bufferToHex(encodedValue);
        return BigInt(formattedValue);
    },
};
