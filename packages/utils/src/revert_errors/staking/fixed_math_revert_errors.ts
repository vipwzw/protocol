// BigNumber removed - using bigint
import { RevertError } from '../../revert_error';

// tslint:disable:max-classes-per-file

export enum ValueErrorCodes {
    TooSmall,
    TooLarge,
}

export enum BinOpErrorCodes {
    AdditionOverflow,
    MultiplicationOverflow,
    DivisionByZero,
    DivisionOverflow,
}

export class SignedValueError extends RevertError {
    constructor(error?: ValueErrorCodes, n?: bigint | number | string) {
        super('SignedValueError', 'SignedValueError(uint8 error, int256 n)', {
            error,
            n,
        });
    }
}

export class UnsignedValueError extends RevertError {
    constructor(error?: ValueErrorCodes, n?: bigint | number | string) {
        super('UnsignedValueError', 'UnsignedValueError(uint8 error, uint256 n)', {
            error,
            n,
        });
    }
}

export class BinOpError extends RevertError {
    constructor(error?: BinOpErrorCodes, a?: bigint | number | string, b?: bigint | number | string) {
        super('BinOpError', 'BinOpError(uint8 error, int256 a, int256 b)', {
            error,
            a,
            b,
        });
    }
}

const types = [SignedValueError, UnsignedValueError, BinOpError];

// Register the types we've defined.
for (const type of types) {
    RevertError.registerType(type);
}
