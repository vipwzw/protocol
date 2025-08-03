/**
 * BigNumber compatibility shim for legacy code
 * This provides a BigNumber-like interface that returns bigint values
 */

import { toBigInt, pow } from './configured_bigint';

export interface BigNumberLike {
    toString(base?: number): string;
    plus(other: any): BigNumberLike;
    minus(other: any): BigNumberLike;
    times(other: any): BigNumberLike;
    div(other: any): BigNumberLike;
    pow(exponent: any): BigNumberLike;
    eq(other: any): boolean;
    isNegative(): boolean;
    abs(): BigNumberLike;
    integerValue(): BigNumberLike;
    mod(other: any): BigNumberLike;
    valueOf(): bigint;
}

class BigNumberCompat implements BigNumberLike {
    private _value: bigint;

    constructor(value: any) {
        this._value = toBigInt(value);
    }

    toString(base: number = 10): string {
        return this._value.toString(base);
    }

    plus(other: any): BigNumberLike {
        return new BigNumberCompat(this._value + toBigInt(other));
    }

    minus(other: any): BigNumberLike {
        return new BigNumberCompat(this._value - toBigInt(other));
    }

    times(other: any): BigNumberLike {
        return new BigNumberCompat(this._value * toBigInt(other));
    }

    div(other: any): BigNumberLike {
        return new BigNumberCompat(this._value / toBigInt(other));
    }

    pow(exponent: any): BigNumberLike {
        return new BigNumberCompat(pow(this._value, toBigInt(exponent)));
    }

    eq(other: any): boolean {
        return this._value === toBigInt(other);
    }

    isNegative(): boolean {
        return this._value < 0n;
    }

    abs(): BigNumberLike {
        return new BigNumberCompat(this._value < 0n ? -this._value : this._value);
    }

    integerValue(): BigNumberLike {
        return this; // bigint is already an integer
    }

    mod(other: any): BigNumberLike {
        return new BigNumberCompat(this._value % toBigInt(other));
    }

    valueOf(): bigint {
        return this._value;
    }
}

// Export a constructor interface that can be used with 'new'
export interface BigNumberConstructor {
    new (value: any): BigNumberLike;
    (value: any): BigNumberLike;
    isBigNumber(value: any): value is bigint;
    from(value: any): BigNumberLike;
    random(decimalPlaces: number): BigNumberLike;
    config(...args: any[]): any;
    set(...args: any[]): any;
}

const BigNumberImpl: any = function(value: any): BigNumberLike {
    if (new.target) {
        return new BigNumberCompat(value);
    }
    return new BigNumberCompat(value);
};

BigNumberImpl.prototype = BigNumberCompat.prototype;

export const BigNumber = BigNumberImpl as BigNumberConstructor;

// Add static methods
BigNumber.isBigNumber = (value: any): value is bigint => typeof value === 'bigint';
BigNumber.from = BigNumber;

// Add a random method for compatibility
BigNumber.random = (decimalPlaces: number): BigNumberLike => {
    // Generate a random decimal between 0 and 1
    const maxValue = pow(10n, BigInt(decimalPlaces));
    const randomValue = BigInt(Math.floor(Math.random() * Number(maxValue)));
    return new BigNumberCompat(randomValue);
};

// Add config method (no-op for compatibility)
BigNumber.config = (..._args: any[]) => ({});
BigNumber.set = BigNumber.config;